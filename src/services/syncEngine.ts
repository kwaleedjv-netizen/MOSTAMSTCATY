/**
 * Real Multi-Device Cloud Sync Engine backed by Firebase Firestore
 * Handles account-isolated real-time sync via Firestore onSnapshot listeners,
 * chunked high-res document image storage (<1MB per doc),
 * remote deletion propagation, and offline queuing.
 */

import {
  collection,
  deleteDoc,
  deleteField,
  doc,
  DocumentData,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  QuerySnapshot,
  serverTimestamp,
  setDoc,
  Unsubscribe,
  updateDoc,
  where,
} from 'firebase/firestore';
import { MostamsakDocument, DocumentGroup, ConflictItem } from '../types';
import { dbGetAll, dbPut, dbDelete, recordAudit } from './db';
import { getDeviceId } from './crypto';
import {
  auth,
  db,
  ensureUserProfile,
  handleFirestoreError,
  OperationType,
  sanitizeFirestoreId,
} from './firebase';

export interface SyncStatus {
  state: 'idle' | 'syncing' | 'synced' | 'offline' | 'conflict' | 'error';
  lastSyncTime?: string;
  pendingChanges: number;
  errorMessage?: string;
  conflicts: ConflictItem[];
  serverInfo?: Record<string, unknown>;
}

type SyncListener = (status: SyncStatus) => void;
type DataChangeListener = () => void;
type AssetSlot = 'front' | 'back' | 'originalFront' | 'originalBack';

const ASSET_SLOTS: AssetSlot[] = ['front', 'back', 'originalFront', 'originalBack'];
const CHUNK_CHAR_LIMIT = 450_000; // Safely under 600k rule limit & 1MB Firestore doc limit
const INCOMPLETE_ASSET_GRACE_MS = 4500;

interface KnownCloudIds {
  docIds: string[];
  groupIds: string[];
}

interface ParsedChunkItem {
  index: number;
  total: number;
  data: string;
}

type DocChunkSlots = Partial<Record<AssetSlot, ParsedChunkItem[]>>;

interface ParsedRemoteDoc {
  docItem: MostamsakDocument;
  hasCompleteAssets: boolean;
}

function getKnownIdsKey(uid: string): string {
  return `mostamsakati_cloud_ids_${sanitizeFirestoreId(uid)}`;
}

function loadKnownCloudIds(uid: string): KnownCloudIds {
  try {
    const raw = localStorage.getItem(getKnownIdsKey(uid));
    if (!raw) return { docIds: [], groupIds: [] };
    const parsed = JSON.parse(raw);
    return {
      docIds: Array.isArray(parsed.docIds) ? parsed.docIds : [],
      groupIds: Array.isArray(parsed.groupIds) ? parsed.groupIds : [],
    };
  } catch {
    return { docIds: [], groupIds: [] };
  }
}

function saveKnownCloudIds(uid: string, ids: KnownCloudIds): void {
  localStorage.setItem(getKnownIdsKey(uid), JSON.stringify(ids));
}

function stripUndefinedDeep<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) {
    return obj.map((item) => stripUndefinedDeep(item)) as unknown as T;
  }
  const out: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(obj as Record<string, unknown>)) {
    if (val !== undefined) {
      out[key] = stripUndefinedDeep(val);
    }
  }
  return out as T;
}

function splitIntoChunks(value: string | undefined): string[] {
  if (!value || value.length === 0) return [];
  const chunks: string[] = [];
  for (let i = 0; i < value.length; i += CHUNK_CHAR_LIMIT) {
    chunks.push(value.slice(i, i + CHUNK_CHAR_LIMIT));
  }
  // Rule allows up to 50 chunks per slot (approx 22.5 MB per image)
  return chunks.slice(0, 50);
}

function clampDocIdForChunk(docId: string): string {
  // Max chunkId is 128 chars; suffix `__originalFront__49` is 18 chars -> safe prefix <= 105 chars
  return sanitizeFirestoreId(docId).slice(0, 105);
}

function isSlotComplete(slots: DocChunkSlots | undefined, slot: AssetSlot): boolean {
  const arr = slots?.[slot];
  if (!arr || arr.length === 0) return false;
  const expectedTotal = Number(arr[0]?.total || arr.length);
  if (expectedTotal <= 0 || arr.length < expectedTotal) return false;
  const indices = new Set(arr.map((c) => c.index));
  for (let i = 0; i < expectedTotal; i++) {
    if (!indices.has(i)) return false;
  }
  return true;
}

function assembleSlot(slots: DocChunkSlots | undefined, slot: AssetSlot): string {
  const arr = slots?.[slot];
  if (!arr || arr.length === 0) return '';
  return [...arr]
    .sort((a, b) => a.index - b.index)
    .map((c) => c.data)
    .join('');
}

class SyncEngine {
  private status: SyncStatus = {
    state: navigator.onLine ? 'idle' : 'offline',
    pendingChanges: 0,
    conflicts: [],
  };

  private listeners: Set<SyncListener> = new Set();
  private dataChangeListeners: Set<DataChangeListener> = new Set();
  private broadcastChannel: BroadcastChannel | null = null;
  private tabInstanceId = Math.random().toString(36).slice(2, 10);

  private accessUnlocked = false;
  private activeUid: string | null = null;
  private isSyncingPromise: Promise<boolean> | null = null;
  private reconcileChain: Promise<void> = Promise.resolve();

  // Real-time Firestore snapshot subscriptions
  private subscribedUid: string | null = null;
  private unsubGroups: Unsubscribe | null = null;
  private unsubDocs: Unsubscribe | null = null;
  private unsubChunks: Unsubscribe | null = null;

  private latestGroupSnap: QuerySnapshot<DocumentData> | null = null;
  private latestDocSnap: QuerySnapshot<DocumentData> | null = null;
  private latestChunkSnap: QuerySnapshot<DocumentData> | null = null;

  private inFlightUpsertDocs = new Set<string>();
  private inFlightDeleteDocs = new Set<string>();
  private inFlightUpsertGroups = new Set<string>();
  private inFlightDeleteGroups = new Set<string>();

  private incompleteDocFirstSeen = new Map<string, number>();
  private deferredFlushTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    if (typeof BroadcastChannel !== 'undefined') {
      try {
        this.broadcastChannel = new BroadcastChannel('mostamsakati_vault_sync');
        this.broadcastChannel.onmessage = (event) => {
          const payload = event.data as { sender?: string; uid?: string; type?: string } | undefined;
          if (!payload || payload.sender === this.tabInstanceId) return;
          if (payload.uid && payload.uid === this.activeUid && this.accessUnlocked) {
            this.notifyDataChanged();
          }
        };
      } catch {
        this.broadcastChannel = null;
      }
    }

    window.addEventListener('online', () => {
      this.updateStatus({ state: 'idle' });
      if (this.accessUnlocked && this.activeUid) {
        void this.syncNow({ silent: true });
      }
    });

    window.addEventListener('offline', () => {
      this.updateStatus({ state: 'offline' });
    });
  }

  private broadcastLocalChange(uid: string): void {
    try {
      this.broadcastChannel?.postMessage({
        sender: this.tabInstanceId,
        uid,
        type: 'vault_changed',
      });
    } catch {
      // Ignore broadcast errors
    }
  }

  public setAccessContext(uid: string | null, unlocked: boolean): void {
    const normalizedUid = uid ? sanitizeFirestoreId(uid) : null;
    this.activeUid = normalizedUid;
    this.accessUnlocked = Boolean(normalizedUid && unlocked);

    if (!this.accessUnlocked || !this.activeUid) {
      this.stopRealtimeSync();
      this.updateStatus({
        state: navigator.onLine ? 'idle' : 'offline',
        conflicts: [],
      });
      return;
    }

    this.startRealtimeSync(this.activeUid);
  }

  public subscribe(listener: SyncListener): () => void {
    this.listeners.add(listener);
    listener(this.status);
    return () => this.listeners.delete(listener);
  }

  public subscribeDataChange(listener: DataChangeListener): () => void {
    this.dataChangeListeners.add(listener);
    return () => this.dataChangeListeners.delete(listener);
  }

  private notifyDataChanged(): void {
    for (const listener of this.dataChangeListeners) {
      try {
        listener();
      } catch (err) {
        console.error('Data change listener error:', err);
      }
    }
  }

  private updateStatus(partial: Partial<SyncStatus>): void {
    this.status = { ...this.status, ...partial };
    for (const listener of this.listeners) {
      listener(this.status);
    }
  }

  public getStatus(): SyncStatus {
    return this.status;
  }

  public async checkHealth(): Promise<{ online: boolean; info?: Record<string, unknown> }> {
    try {
      const res = await fetch('/api/health', { cache: 'no-store' });
      const contentType = res.headers.get('content-type') || '';
      if (res.ok && contentType.includes('application/json')) {
        const info = await res.json();
        return { online: true, info };
      }
    } catch {
      // offline
    }
    return { online: false };
  }

  private getVerifiedUid(): string | null {
    const user = auth.currentUser;
    if (!user || !user.emailVerified || !this.accessUnlocked) {
      return null;
    }
    const uid = sanitizeFirestoreId(user.uid);
    if (this.activeUid && this.activeUid !== uid) {
      return null;
    }
    return uid;
  }

  private startRealtimeSync(uid: string): void {
    if (this.subscribedUid === uid && this.unsubGroups && this.unsubDocs && this.unsubChunks) {
      return;
    }

    this.stopRealtimeSync();
    this.subscribedUid = uid;

    const triggerSnapshotReconcile = () => {
      if (!this.accessUnlocked || this.subscribedUid !== uid) return;
      if (!this.latestGroupSnap || !this.latestDocSnap || !this.latestChunkSnap) return;
      // Wait for server-confirmed snapshots if local pending writes exist
      if (
        this.latestGroupSnap.metadata.hasPendingWrites ||
        this.latestDocSnap.metadata.hasPendingWrites ||
        this.latestChunkSnap.metadata.hasPendingWrites
      ) {
        return;
      }

      const groupSnap = this.latestGroupSnap;
      const docSnap = this.latestDocSnap;
      const chunkSnap = this.latestChunkSnap;

      this.enqueueReconcile(async () => {
        if (!this.accessUnlocked || this.activeUid !== uid) return;
        await this.applyRemoteSnapshots(uid, groupSnap, docSnap, chunkSnap, {
          pushLocalChanges: true,
          silent: true,
        });
      });
    };

    this.unsubGroups = onSnapshot(
      query(collection(db, 'users', uid, 'groups'), where('ownerUid', '==', uid)),
      (snap) => {
        this.latestGroupSnap = snap;
        triggerSnapshotReconcile();
      },
      (error) => {
        if (this.accessUnlocked && auth.currentUser) {
          handleFirestoreError(error, OperationType.LIST, `users/${uid}/groups`);
        }
      }
    );

    this.unsubDocs = onSnapshot(
      query(collection(db, 'users', uid, 'documents'), where('ownerUid', '==', uid)),
      (snap) => {
        this.latestDocSnap = snap;
        triggerSnapshotReconcile();
      },
      (error) => {
        if (this.accessUnlocked && auth.currentUser) {
          handleFirestoreError(error, OperationType.LIST, `users/${uid}/documents`);
        }
      }
    );

    this.unsubChunks = onSnapshot(
      query(collection(db, 'users', uid, 'assetChunks'), where('ownerUid', '==', uid)),
      (snap) => {
        this.latestChunkSnap = snap;
        triggerSnapshotReconcile();
      },
      (error) => {
        if (this.accessUnlocked && auth.currentUser) {
          handleFirestoreError(error, OperationType.LIST, `users/${uid}/assetChunks`);
        }
      }
    );
  }

  private stopRealtimeSync(): void {
    this.unsubGroups?.();
    this.unsubDocs?.();
    this.unsubChunks?.();
    this.unsubGroups = null;
    this.unsubDocs = null;
    this.unsubChunks = null;
    this.subscribedUid = null;
    this.latestGroupSnap = null;
    this.latestDocSnap = null;
    this.latestChunkSnap = null;
    this.incompleteDocFirstSeen.clear();
    if (this.deferredFlushTimer) {
      clearTimeout(this.deferredFlushTimer);
      this.deferredFlushTimer = null;
    }
  }

  private enqueueReconcile<T>(task: () => Promise<T>): Promise<T> {
    const next = this.reconcileChain.then(task, task);
    this.reconcileChain = next.then(
      () => undefined,
      () => undefined
    );
    return next;
  }

  private async syncDocumentAssetChunks(
    uid: string,
    docId: string,
    localDoc: MostamsakDocument
  ): Promise<void> {
    const frontChunks = splitIntoChunks(localDoc.frontImage);
    const backChunks = splitIntoChunks(localDoc.backImage);
    const origFrontChunks = splitIntoChunks(localDoc.originalFrontImage);
    const origBackChunks = splitIntoChunks(localDoc.originalBackImage);

    const existingChunkQuery = query(
      collection(db, 'users', uid, 'assetChunks'),
      where('ownerUid', '==', uid)
    );
    let existingChunkSnap;
    try {
      existingChunkSnap = await getDocs(existingChunkQuery);
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, `users/${uid}/assetChunks`);
    }

    const existingMap = new Map<string, { data: string; total: number }>();
    existingChunkSnap.forEach((d) => {
      const item = d.data() as { docId?: string; data?: string; total?: number };
      if (item.docId === docId) {
        existingMap.set(d.id, { data: item.data || '', total: item.total || 0 });
      }
    });

    const slotMap: Record<AssetSlot, string[]> = {
      front: frontChunks,
      back: backChunks,
      originalFront: origFrontChunks,
      originalBack: origBackChunks,
    };

    const desiredIds = new Set<string>();
    const writeOps: Promise<void>[] = [];

    for (const slot of ASSET_SLOTS) {
      const chunks = slotMap[slot];
      const total = chunks.length;
      for (let index = 0; index < chunks.length; index++) {
        const chunkId = `${docId}__${slot}__${index}`;
        desiredIds.add(chunkId);
        const chunkData = chunks[index];
        const prev = existingMap.get(chunkId);
        const chunkPath = `users/${uid}/assetChunks/${chunkId}`;
        const chunkRef = doc(db, 'users', uid, 'assetChunks', chunkId);

        if (!prev) {
          writeOps.push(
            setDoc(chunkRef, {
              ownerUid: uid,
              docId,
              slot,
              index,
              total,
              data: chunkData,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            }).catch((error) => handleFirestoreError(error, OperationType.CREATE, chunkPath))
          );
        } else if (prev.data !== chunkData || prev.total !== total) {
          writeOps.push(
            updateDoc(chunkRef, {
              total,
              data: chunkData,
              updatedAt: serverTimestamp(),
            }).catch((error) => handleFirestoreError(error, OperationType.UPDATE, chunkPath))
          );
        }
      }
    }

    for (const oldChunkId of existingMap.keys()) {
      if (!desiredIds.has(oldChunkId)) {
        writeOps.push(
          deleteDoc(doc(db, 'users', uid, 'assetChunks', oldChunkId)).catch((error) =>
            handleFirestoreError(error, OperationType.DELETE, `users/${uid}/assetChunks/${oldChunkId}`)
          )
        );
      }
    }

    if (writeOps.length > 0) {
      await Promise.all(writeOps);
    }
  }

  public async upsertGroupToCloud(uidRaw: string, group: DocumentGroup): Promise<void> {
    const uid = sanitizeFirestoreId(uidRaw);
    const groupId = sanitizeFirestoreId(group.id, 'grp');
    const path = `users/${uid}/groups/${groupId}`;
    const ref = doc(db, 'users', uid, 'groups', groupId);

    const nowIso = new Date().toISOString();
    const clientCreatedAt = (group.createdAt || nowIso).slice(0, 64);
    const clientUpdatedAt = (group.updatedAt || nowIso).slice(0, 64);

    let snap;
    try {
      snap = await getDoc(ref);
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, path);
    }

    if (!snap.exists()) {
      const payload: Record<string, unknown> = {
        ownerUid: uid,
        id: groupId,
        name: (group.name || 'مجموعة').slice(0, 120),
        color: (group.color || '#2563eb').slice(0, 32),
        icon: (group.icon || 'Folder').slice(0, 64),
        isLocked: Boolean(group.isLocked),
        clientCreatedAt,
        clientUpdatedAt,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      if (group.description !== undefined) {
        payload.description = String(group.description).slice(0, 500);
      }
      if (group.passwordHash) {
        payload.passwordHash = String(group.passwordHash).slice(0, 256);
      }
      if (group.passwordSalt) {
        payload.passwordSalt = String(group.passwordSalt).slice(0, 128);
      }
      if (group.isHidden !== undefined) {
        payload.isHidden = Boolean(group.isHidden);
      }

      try {
        await setDoc(ref, payload);
      } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, path);
      }
      return;
    }

    const existing = snap.data() as Record<string, unknown>;
    const patch: Record<string, unknown> = {
      name: (group.name || 'مجموعة').slice(0, 120),
      color: (group.color || '#2563eb').slice(0, 32),
      icon: (group.icon || 'Folder').slice(0, 64),
      isLocked: Boolean(group.isLocked),
      clientUpdatedAt,
      updatedAt: serverTimestamp(),
    };

    if (group.description !== undefined) {
      patch.description = String(group.description).slice(0, 500);
    } else if ('description' in existing) {
      patch.description = deleteField();
    }

    if (group.passwordHash) {
      patch.passwordHash = String(group.passwordHash).slice(0, 256);
    } else if ('passwordHash' in existing) {
      patch.passwordHash = deleteField();
    }

    if (group.passwordSalt) {
      patch.passwordSalt = String(group.passwordSalt).slice(0, 128);
    } else if ('passwordSalt' in existing) {
      patch.passwordSalt = deleteField();
    }

    if (group.isHidden !== undefined) {
      patch.isHidden = Boolean(group.isHidden);
    } else if ('isHidden' in existing) {
      patch.isHidden = deleteField();
    }

    try {
      await updateDoc(ref, patch);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  }

  public async upsertDocumentToCloud(uidRaw: string, localDoc: MostamsakDocument): Promise<void> {
    const uid = sanitizeFirestoreId(uidRaw);
    const docId = clampDocIdForChunk(localDoc.id);
    const path = `users/${uid}/documents/${docId}`;
    const ref = doc(db, 'users', uid, 'documents', docId);

    const nowIso = new Date().toISOString();
    const clientCreatedAt = (localDoc.createdAt || nowIso).slice(0, 64);
    const clientUpdatedAt = (localDoc.updatedAt || nowIso).slice(0, 64);

    const hasFrontImage = splitIntoChunks(localDoc.frontImage).length > 0;
    const hasBackImage = splitIntoChunks(localDoc.backImage).length > 0;
    const hasOriginalFrontImage = splitIntoChunks(localDoc.originalFrontImage).length > 0;
    const hasOriginalBackImage = splitIntoChunks(localDoc.originalBackImage).length > 0;

    let snap;
    try {
      snap = await getDoc(ref);
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, path);
    }

    const baseMutableFields: Record<string, unknown> = {
      title: (localDoc.title || 'مستمسك').slice(0, 200),
      typeId: (localDoc.typeId || 'custom').slice(0, 80),
      typeName: (localDoc.typeName || 'مستند مخصص').slice(0, 120),
      isCustom: Boolean(localDoc.isCustom),
      widthMm: Math.min(2000, Math.max(1, Number(localDoc.widthMm) || 85.6)),
      heightMm: Math.min(2000, Math.max(1, Number(localDoc.heightMm) || 54)),
      orientation: localDoc.orientation === 'portrait' ? 'portrait' : 'landscape',
      sidesCount: localDoc.sidesCount === 2 ? 2 : 1,
      frontLabel: (localDoc.frontLabel ?? '').slice(0, 120),
      backLabel: (localDoc.backLabel ?? '').slice(0, 120),
      radiusMm: Math.min(100, Math.max(0, Number(localDoc.radiusMm) || 0)),
      frontTransform: stripUndefinedDeep(localDoc.frontTransform || {
        zoom: 1,
        panX: 0,
        panY: 0,
        rotation: 0,
        flipH: false,
        flipV: false,
      }),
      backTransform: stripUndefinedDeep(localDoc.backTransform || {
        zoom: 1,
        panX: 0,
        panY: 0,
        rotation: 0,
        flipH: false,
        flipV: false,
      }),
      notes: (localDoc.notes ?? '').slice(0, 1000),
      isFavorite: Boolean(localDoc.isFavorite),
      isArchived: Boolean(localDoc.isArchived),
      isDeleted: Boolean(localDoc.isDeleted),
      isEncrypted: Boolean(localDoc.isEncrypted),
      coverFace: localDoc.coverFace === 'back' ? 'back' : 'front',
      hasFrontImage,
      hasBackImage,
      hasOriginalFrontImage,
      hasOriginalBackImage,
      clientUpdatedAt,
      updatedAt: serverTimestamp(),
    };

    const optGroupId = localDoc.groupId ? sanitizeFirestoreId(localDoc.groupId) : undefined;
    const optPrevGroupId = localDoc.previousGroupId ? sanitizeFirestoreId(localDoc.previousGroupId) : undefined;
    const optDeletedAt = localDoc.deletedAt ? String(localDoc.deletedAt).slice(0, 64) : undefined;
    const optPreviewBg = localDoc.previewBgColor ? String(localDoc.previewBgColor).slice(0, 32) : undefined;
    const optLastMod = (localDoc.lastModifiedBy || getDeviceId()).slice(0, 128);

    if (!snap.exists()) {
      const createPayload: Record<string, unknown> = {
        ...baseMutableFields,
        ownerUid: uid,
        id: docId,
        clientCreatedAt,
        createdAt: serverTimestamp(),
        lastModifiedBy: optLastMod,
      };
      if (optPreviewBg) createPayload.previewBgColor = optPreviewBg;
      if (optGroupId) createPayload.groupId = optGroupId;
      if (optDeletedAt) createPayload.deletedAt = optDeletedAt;
      if (optPrevGroupId) createPayload.previousGroupId = optPrevGroupId;

      // Create parent doc first (required by existsAfter rule on assetChunks)
      try {
        await setDoc(ref, createPayload);
      } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, path);
      }

      await this.syncDocumentAssetChunks(uid, docId, localDoc);
    } else {
      // Upload updated assetChunks BEFORE updating parent timestamp so peers get complete assets atomically
      await this.syncDocumentAssetChunks(uid, docId, localDoc);

      const existing = snap.data() as Record<string, unknown>;
      const patch: Record<string, unknown> = {
        ...baseMutableFields,
        lastModifiedBy: optLastMod,
      };

      if (optPreviewBg) patch.previewBgColor = optPreviewBg;
      else if ('previewBgColor' in existing) patch.previewBgColor = deleteField();

      if (optGroupId) patch.groupId = optGroupId;
      else if ('groupId' in existing) patch.groupId = deleteField();

      if (optDeletedAt) patch.deletedAt = optDeletedAt;
      else if ('deletedAt' in existing) patch.deletedAt = deleteField();

      if (optPrevGroupId) patch.previousGroupId = optPrevGroupId;
      else if ('previousGroupId' in existing) patch.previousGroupId = deleteField();

      try {
        await updateDoc(ref, patch);
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, path);
      }
    }
  }

  public async deleteDocumentFromCloud(docIdRaw: string): Promise<void> {
    const uid = this.getVerifiedUid();
    if (!uid) return;

    const docId = clampDocIdForChunk(docIdRaw);
    this.broadcastLocalChange(uid);

    if (!navigator.onLine) return;

    this.inFlightDeleteDocs.add(docId);
    try {
      // Delete asset chunks first
      try {
        const chunkSnap = await getDocs(
          query(collection(db, 'users', uid, 'assetChunks'), where('ownerUid', '==', uid))
        );
        const matchingChunks = chunkSnap.docs.filter(
          (d) => (d.data() as { docId?: string }).docId === docId
        );
        await Promise.all(
          matchingChunks.map((d) =>
            deleteDoc(d.ref).catch((error) =>
              handleFirestoreError(error, OperationType.DELETE, `users/${uid}/assetChunks/${d.id}`)
            )
          )
        );
      } catch (error) {
        handleFirestoreError(error, OperationType.LIST, `users/${uid}/assetChunks`);
      }

      try {
        await deleteDoc(doc(db, 'users', uid, 'documents', docId));
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, `users/${uid}/documents/${docId}`);
      }

      const known = loadKnownCloudIds(uid);
      saveKnownCloudIds(uid, {
        ...known,
        docIds: known.docIds.filter((id) => id !== docId && id !== docIdRaw),
      });
    } finally {
      this.inFlightDeleteDocs.delete(docId);
    }
  }

  public async deleteGroupFromCloud(groupIdRaw: string): Promise<void> {
    const uid = this.getVerifiedUid();
    if (!uid) return;

    const groupId = sanitizeFirestoreId(groupIdRaw);
    this.broadcastLocalChange(uid);

    if (!navigator.onLine) return;

    this.inFlightDeleteGroups.add(groupId);
    try {
      try {
        await deleteDoc(doc(db, 'users', uid, 'groups', groupId));
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, `users/${uid}/groups/${groupId}`);
      }

      const known = loadKnownCloudIds(uid);
      saveKnownCloudIds(uid, {
        ...known,
        groupIds: known.groupIds.filter((id) => id !== groupId && id !== groupIdRaw),
      });
    } finally {
      this.inFlightDeleteGroups.delete(groupId);
    }
  }

  public async pushGroupNow(group: DocumentGroup): Promise<void> {
    const uid = this.getVerifiedUid();
    if (!uid) return;

    const gid = sanitizeFirestoreId(group.id, 'grp');
    this.broadcastLocalChange(uid);

    if (!navigator.onLine) return;

    this.inFlightUpsertGroups.add(gid);
    try {
      await ensureUserProfile(auth.currentUser!);
      await this.upsertGroupToCloud(uid, group);
      const known = loadKnownCloudIds(uid);
      if (!known.groupIds.includes(gid)) {
        saveKnownCloudIds(uid, { ...known, groupIds: [...known.groupIds, gid] });
      }
      this.updateStatus({ state: 'synced', lastSyncTime: new Date().toISOString() });
    } catch (err) {
      console.error('Background group sync failed:', err);
    } finally {
      this.inFlightUpsertGroups.delete(gid);
    }
  }

  public async pushDocumentNow(localDoc: MostamsakDocument): Promise<void> {
    const uid = this.getVerifiedUid();
    if (!uid) return;

    const did = clampDocIdForChunk(localDoc.id);
    this.broadcastLocalChange(uid);

    if (!navigator.onLine) return;

    this.inFlightUpsertDocs.add(did);
    try {
      await ensureUserProfile(auth.currentUser!);
      await this.upsertDocumentToCloud(uid, localDoc);
      const known = loadKnownCloudIds(uid);
      if (!known.docIds.includes(did)) {
        saveKnownCloudIds(uid, { ...known, docIds: [...known.docIds, did] });
      }
      this.updateStatus({ state: 'synced', lastSyncTime: new Date().toISOString() });
    } catch (err) {
      console.error('Background document sync failed:', err);
    } finally {
      this.inFlightUpsertDocs.delete(did);
    }
  }

  public async wipeUserCloudVault(uidRaw?: string): Promise<void> {
    const uid = uidRaw ? sanitizeFirestoreId(uidRaw) : this.getVerifiedUid();
    if (!uid || !navigator.onLine) return;

    const subcollections = ['assetChunks', 'documents', 'groups', 'backupChunks', 'backups'];
    for (const sub of subcollections) {
      try {
        const snap = await getDocs(
          query(collection(db, 'users', uid, sub), where('ownerUid', '==', uid))
        );
        await Promise.all(snap.docs.map((d) => deleteDoc(d.ref)));
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, `users/${uid}/${sub}`);
      }
    }

    localStorage.removeItem(getKnownIdsKey(uid));
  }

  private parseRemoteSnapshots(
    groupSnap: QuerySnapshot<DocumentData>,
    docSnap: QuerySnapshot<DocumentData>,
    chunkSnap: QuerySnapshot<DocumentData>
  ): {
    remoteGroups: Map<string, DocumentGroup>;
    remoteDocs: Map<string, ParsedRemoteDoc>;
  } {
    const chunksByDoc = new Map<string, DocChunkSlots>();
    chunkSnap.forEach((d) => {
      const item = d.data() as {
        docId: string;
        slot: AssetSlot;
        index: number;
        total: number;
        data: string;
      };
      if (!chunksByDoc.has(item.docId)) {
        chunksByDoc.set(item.docId, {});
      }
      const slots = chunksByDoc.get(item.docId)!;
      if (!slots[item.slot]) {
        slots[item.slot] = [];
      }
      slots[item.slot]!.push({
        index: item.index,
        total: item.total,
        data: item.data,
      });
    });

    const remoteGroups = new Map<string, DocumentGroup>();
    groupSnap.forEach((d) => {
      const data = d.data() as Record<string, unknown>;
      const g: DocumentGroup = {
        id: String(data.id || d.id),
        name: String(data.name || ''),
        color: String(data.color || '#2563eb'),
        icon: String(data.icon || 'Folder'),
        description: data.description ? String(data.description) : undefined,
        isLocked: Boolean(data.isLocked),
        passwordHash: data.passwordHash ? String(data.passwordHash) : undefined,
        passwordSalt: data.passwordSalt ? String(data.passwordSalt) : undefined,
        isHidden: data.isHidden !== undefined ? Boolean(data.isHidden) : undefined,
        createdAt: String(data.clientCreatedAt || new Date().toISOString()),
        updatedAt: String(data.clientUpdatedAt || data.clientCreatedAt || new Date().toISOString()),
      };
      remoteGroups.set(g.id, g);
    });

    const remoteDocs = new Map<string, ParsedRemoteDoc>();
    docSnap.forEach((d) => {
      const data = d.data() as Record<string, unknown>;
      const id = String(data.id || d.id);
      const docSlots = chunksByDoc.get(id);

      const needFront = Boolean(data.hasFrontImage);
      const needBack = Boolean(data.hasBackImage);
      const needOrigFront = Boolean(data.hasOriginalFrontImage);
      const needOrigBack = Boolean(data.hasOriginalBackImage);

      const hasCompleteAssets =
        (!needFront || isSlotComplete(docSlots, 'front')) &&
        (!needBack || isSlotComplete(docSlots, 'back')) &&
        (!needOrigFront || isSlotComplete(docSlots, 'originalFront')) &&
        (!needOrigBack || isSlotComplete(docSlots, 'originalBack'));

      const assembledFront = needFront ? assembleSlot(docSlots, 'front') : '';
      const assembledBack = needBack ? assembleSlot(docSlots, 'back') : undefined;
      const assembledOrigFront = needOrigFront ? assembleSlot(docSlots, 'originalFront') : undefined;
      const assembledOrigBack = needOrigBack ? assembleSlot(docSlots, 'originalBack') : undefined;

      const docItem: MostamsakDocument = {
        id,
        title: String(data.title || ''),
        typeId: String(data.typeId || 'custom'),
        typeName: String(data.typeName || ''),
        isCustom: Boolean(data.isCustom),
        widthMm: Number(data.widthMm) || 85.6,
        heightMm: Number(data.heightMm) || 54,
        orientation: data.orientation === 'portrait' ? 'portrait' : 'landscape',
        sidesCount: data.sidesCount === 2 ? 2 : 1,
        frontLabel: String(data.frontLabel || ''),
        backLabel: String(data.backLabel || ''),
        radiusMm: Number(data.radiusMm) || 0,
        previewBgColor: data.previewBgColor ? String(data.previewBgColor) : undefined,
        frontImage: assembledFront,
        backImage: assembledBack || undefined,
        originalFrontImage: assembledOrigFront || undefined,
        originalBackImage: assembledOrigBack || undefined,
        frontTransform: (data.frontTransform as MostamsakDocument['frontTransform']) || {
          zoom: 1,
          panX: 0,
          panY: 0,
          rotation: 0,
          flipH: false,
          flipV: false,
        },
        backTransform: (data.backTransform as MostamsakDocument['backTransform']) || {
          zoom: 1,
          panX: 0,
          panY: 0,
          rotation: 0,
          flipH: false,
          flipV: false,
        },
        notes: String(data.notes || ''),
        groupId: data.groupId ? String(data.groupId) : undefined,
        isFavorite: Boolean(data.isFavorite),
        isArchived: Boolean(data.isArchived),
        isDeleted: Boolean(data.isDeleted),
        deletedAt: data.deletedAt ? String(data.deletedAt) : undefined,
        previousGroupId: data.previousGroupId ? String(data.previousGroupId) : undefined,
        isEncrypted: Boolean(data.isEncrypted),
        coverFace: data.coverFace === 'back' ? 'back' : 'front',
        lastModifiedBy: data.lastModifiedBy ? String(data.lastModifiedBy) : undefined,
        createdAt: String(data.clientCreatedAt || new Date().toISOString()),
        updatedAt: String(data.clientUpdatedAt || data.clientCreatedAt || new Date().toISOString()),
      };
      remoteDocs.set(docItem.id, { docItem, hasCompleteAssets });
    });

    return { remoteGroups, remoteDocs };
  }

  private scheduleDeferredFlush(uid: string): void {
    if (this.deferredFlushTimer) return;
    this.deferredFlushTimer = setTimeout(() => {
      this.deferredFlushTimer = null;
      if (!this.accessUnlocked || this.activeUid !== uid) return;
      if (!this.latestGroupSnap || !this.latestDocSnap || !this.latestChunkSnap) return;
      const gSnap = this.latestGroupSnap;
      const dSnap = this.latestDocSnap;
      const cSnap = this.latestChunkSnap;
      this.enqueueReconcile(async () => {
        if (!this.accessUnlocked || this.activeUid !== uid) return;
        await this.applyRemoteSnapshots(uid, gSnap, dSnap, cSnap, {
          pushLocalChanges: false,
          silent: true,
        });
      });
    }, INCOMPLETE_ASSET_GRACE_MS + 100);
  }

  private async applyRemoteSnapshots(
    uid: string,
    groupSnap: QuerySnapshot<DocumentData>,
    docSnap: QuerySnapshot<DocumentData>,
    chunkSnap: QuerySnapshot<DocumentData>,
    options: { pushLocalChanges: boolean; silent: boolean }
  ): Promise<{ docCount: number; groupCount: number; didMutateLocal: boolean }> {
    const { remoteGroups, remoteDocs } = this.parseRemoteSnapshots(groupSnap, docSnap, chunkSnap);

    const previousKnown = loadKnownCloudIds(uid);
    const localGroups = await dbGetAll<DocumentGroup>('groups');
    const localDocs = await dbGetAll<MostamsakDocument>('documents');

    let didMutateLocal = false;
    let hasDeferredAssets = false;
    const nowMs = Date.now();

    // 1. Reconcile Groups
    const localGroupMap = new Map(localGroups.map((g) => [sanitizeFirestoreId(g.id), g]));
    const nextKnownGroupIds = new Set<string>();

    for (const [remoteId, rGroup] of remoteGroups.entries()) {
      if (this.inFlightDeleteGroups.has(remoteId)) continue;
      nextKnownGroupIds.add(remoteId);
      const lGroup = localGroupMap.get(remoteId);
      if (!lGroup) {
        await dbPut('groups', rGroup);
        didMutateLocal = true;
      } else if (!this.inFlightUpsertGroups.has(remoteId)) {
        const remoteTs = new Date(rGroup.updatedAt || 0).getTime();
        const localTs = new Date(lGroup.updatedAt || 0).getTime();
        if (remoteTs > localTs) {
          await dbPut('groups', rGroup);
          didMutateLocal = true;
        } else if (options.pushLocalChanges && localTs > remoteTs) {
          await this.upsertGroupToCloud(uid, lGroup);
        }
      }
    }

    for (const lGroup of localGroups) {
      const gid = sanitizeFirestoreId(lGroup.id);
      if (remoteGroups.has(gid) || this.inFlightUpsertGroups.has(gid) || this.inFlightDeleteGroups.has(gid)) {
        if (this.inFlightUpsertGroups.has(gid)) nextKnownGroupIds.add(gid);
        continue;
      }
      if (previousKnown.groupIds.includes(gid)) {
        await dbDelete('groups', lGroup.id);
        didMutateLocal = true;
      } else if (options.pushLocalChanges) {
        await this.upsertGroupToCloud(uid, lGroup);
        nextKnownGroupIds.add(gid);
      }
    }

    // 2. Reconcile Documents
    const localDocMap = new Map(localDocs.map((d) => [clampDocIdForChunk(d.id), d]));
    const nextKnownDocIds = new Set<string>();

    for (const [remoteId, parsed] of remoteDocs.entries()) {
      if (this.inFlightDeleteDocs.has(remoteId)) continue;
      const { docItem: rDoc, hasCompleteAssets } = parsed;
      nextKnownDocIds.add(remoteId);

      if (hasCompleteAssets) {
        this.incompleteDocFirstSeen.delete(remoteId);
      } else {
        if (!this.incompleteDocFirstSeen.has(remoteId)) {
          this.incompleteDocFirstSeen.set(remoteId, nowMs);
        }
        const elapsed = nowMs - (this.incompleteDocFirstSeen.get(remoteId) || nowMs);
        if (elapsed < INCOMPLETE_ASSET_GRACE_MS) {
          // Wait briefly for in-flight chunk writes from peer device before committing locally
          hasDeferredAssets = true;
          continue;
        }
      }

      const lDoc = localDocMap.get(remoteId);
      if (!lDoc) {
        await dbPut('documents', rDoc);
        didMutateLocal = true;
      } else if (!this.inFlightUpsertDocs.has(remoteId)) {
        const remoteTs = new Date(rDoc.updatedAt || 0).getTime();
        const localTs = new Date(lDoc.updatedAt || 0).getTime();
        if (remoteTs > localTs) {
          await dbPut('documents', {
            ...rDoc,
            frontImage: rDoc.frontImage || lDoc.frontImage,
            backImage: rDoc.backImage ?? (rDoc.sidesCount === 2 ? lDoc.backImage : undefined),
            originalFrontImage: rDoc.originalFrontImage ?? lDoc.originalFrontImage,
            originalBackImage: rDoc.originalBackImage ?? lDoc.originalBackImage,
            historyLogs: lDoc.historyLogs,
          });
          didMutateLocal = true;
        } else if (options.pushLocalChanges && localTs > remoteTs) {
          await this.upsertDocumentToCloud(uid, lDoc);
        }
      }
    }

    for (const lDoc of localDocs) {
      const did = clampDocIdForChunk(lDoc.id);
      if (remoteDocs.has(did) || this.inFlightUpsertDocs.has(did) || this.inFlightDeleteDocs.has(did)) {
        if (this.inFlightUpsertDocs.has(did)) nextKnownDocIds.add(did);
        continue;
      }
      if (previousKnown.docIds.includes(did)) {
        await dbDelete('documents', lDoc.id);
        didMutateLocal = true;
      } else if (options.pushLocalChanges) {
        await this.upsertDocumentToCloud(uid, lDoc);
        nextKnownDocIds.add(did);
      }
    }

    if (hasDeferredAssets) {
      this.scheduleDeferredFlush(uid);
    }

    saveKnownCloudIds(uid, {
      docIds: Array.from(nextKnownDocIds),
      groupIds: Array.from(nextKnownGroupIds),
    });

    if (didMutateLocal) {
      this.notifyDataChanged();
      this.broadcastLocalChange(uid);
    }

    if (!options.silent || didMutateLocal) {
      this.updateStatus({
        state: 'synced',
        lastSyncTime: new Date().toISOString(),
        conflicts: [],
        serverInfo: {
          provider: 'Firebase Firestore',
          syncedDocuments: nextKnownDocIds.size,
          syncedGroups: nextKnownGroupIds.size,
        },
      });
    }

    return {
      docCount: nextKnownDocIds.size,
      groupCount: nextKnownGroupIds.size,
      didMutateLocal,
    };
  }

  /**
   * Perform full bidirectional sync with Firebase Firestore for the verified user
   */
  public async syncNow(options?: { silent?: boolean }): Promise<boolean> {
    if (this.isSyncingPromise) {
      return this.isSyncingPromise;
    }

    const silent = Boolean(options?.silent);

    if (!navigator.onLine) {
      this.updateStatus({ state: 'offline' });
      return false;
    }

    const uid = this.getVerifiedUid();
    if (!uid || !auth.currentUser) {
      this.updateStatus({ state: 'idle' });
      return false;
    }

    this.isSyncingPromise = this.enqueueReconcile(async () => {
      if (!silent) {
        this.updateStatus({ state: 'syncing', errorMessage: undefined });
      }

      try {
        await ensureUserProfile(auth.currentUser!);

        let remoteGroupSnap;
        let remoteDocSnap;
        let remoteChunkSnap;
        try {
          [remoteGroupSnap, remoteDocSnap, remoteChunkSnap] = await Promise.all([
            getDocs(query(collection(db, 'users', uid, 'groups'), where('ownerUid', '==', uid))),
            getDocs(query(collection(db, 'users', uid, 'documents'), where('ownerUid', '==', uid))),
            getDocs(query(collection(db, 'users', uid, 'assetChunks'), where('ownerUid', '==', uid))),
          ]);
        } catch (error) {
          handleFirestoreError(error, OperationType.LIST, `users/${uid}/vault`);
        }

        const result = await this.applyRemoteSnapshots(
          uid,
          remoteGroupSnap,
          remoteDocSnap,
          remoteChunkSnap,
          { pushLocalChanges: true, silent }
        );

        if (!silent) {
          await recordAudit(
            'sync',
            'مزامنة سحابية (Google / Firestore)',
            `تمت مزامنة ${result.docCount} مستمسك و ${result.groupCount} مجموعة بنجاح`,
            'success'
          );
        }
        return true;
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'حدث خطأ في المزامنة السحابية';
        this.updateStatus({
          state: 'error',
          errorMessage: message,
        });
        return false;
      } finally {
        this.isSyncingPromise = null;
      }
    });

    return this.isSyncingPromise;
  }

  public async resolveConflict(
    conflict: ConflictItem,
    choice: 'keep_local' | 'keep_server' | 'keep_both'
  ): Promise<void> {
    const uid = this.getVerifiedUid();
    const chosenDoc = choice === 'keep_server' ? conflict.serverVersion : conflict.clientVersion;

    if (choice === 'keep_server') {
      await dbPut('documents', conflict.serverVersion);
    } else if (choice === 'keep_both') {
      const copyDoc: MostamsakDocument = {
        ...conflict.clientVersion,
        id: 'doc_conflict_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
        title: `${conflict.clientVersion.title} (نسخة متعارضة)`,
        updatedAt: new Date().toISOString(),
      };
      await dbPut('documents', copyDoc);
      await dbPut('documents', conflict.serverVersion);
      if (uid) await this.upsertDocumentToCloud(uid, copyDoc);
    } else if (uid) {
      await this.upsertDocumentToCloud(uid, chosenDoc);
    }

    const remaining = this.status.conflicts.filter((c) => c.documentId !== conflict.documentId);
    this.updateStatus({
      conflicts: remaining,
      state: remaining.length === 0 ? 'synced' : 'conflict',
    });
    this.notifyDataChanged();

    await recordAudit('sync', 'حل التعارض', `تم حل تعارض المستمسك (${chosenDoc.title}) باختيار: ${choice}`);
  }
}

export const syncEngine = new SyncEngine();
