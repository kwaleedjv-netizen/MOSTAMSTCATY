/**
 * Real Multi-Device Cloud Sync Engine backed by Firebase Firestore
 * Handles account-isolated sync, chunked high-res document image storage (<1MB per doc),
 * remote deletion propagation, and offline queuing.
 */

import {
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
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
type AssetSlot = 'front' | 'back' | 'originalFront' | 'originalBack';

const ASSET_SLOTS: AssetSlot[] = ['front', 'back', 'originalFront', 'originalBack'];
const CHUNK_CHAR_LIMIT = 450_000; // Safely under 600k rule limit & 1MB Firestore doc limit

interface KnownCloudIds {
  docIds: string[];
  groupIds: string[];
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

class SyncEngine {
  private status: SyncStatus = {
    state: navigator.onLine ? 'idle' : 'offline',
    pendingChanges: 0,
    conflicts: [],
  };

  private listeners: Set<SyncListener> = new Set();
  private accessUnlocked = false;
  private activeUid: string | null = null;
  private isSyncingPromise: Promise<boolean> | null = null;

  constructor() {
    window.addEventListener('online', () => {
      this.updateStatus({ state: 'idle' });
      if (this.accessUnlocked && this.activeUid) {
        void this.syncNow();
      }
    });

    window.addEventListener('offline', () => {
      this.updateStatus({ state: 'offline' });
    });
  }

  public setAccessContext(uid: string | null, unlocked: boolean): void {
    this.activeUid = uid ? sanitizeFirestoreId(uid) : null;
    this.accessUnlocked = Boolean(uid && unlocked);
    if (!this.accessUnlocked) {
      this.updateStatus({
        state: navigator.onLine ? 'idle' : 'offline',
        conflicts: [],
      });
    }
  }

  public subscribe(listener: SyncListener): () => void {
    this.listeners.add(listener);
    listener(this.status);
    return () => this.listeners.delete(listener);
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
      if (res.ok) {
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

    const frontChunks = splitIntoChunks(localDoc.frontImage);
    const backChunks = splitIntoChunks(localDoc.backImage);
    const origFrontChunks = splitIntoChunks(localDoc.originalFrontImage);
    const origBackChunks = splitIntoChunks(localDoc.originalBackImage);

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
      hasFrontImage: frontChunks.length > 0,
      hasBackImage: backChunks.length > 0,
      hasOriginalFrontImage: origFrontChunks.length > 0,
      hasOriginalBackImage: origBackChunks.length > 0,
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

      try {
        await setDoc(ref, createPayload);
      } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, path);
      }
    } else {
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

    // Write image asset chunks AFTER parent document exists in Firestore
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
          try {
            await setDoc(chunkRef, {
              ownerUid: uid,
              docId,
              slot,
              index,
              total,
              data: chunkData,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
          } catch (error) {
            handleFirestoreError(error, OperationType.CREATE, chunkPath);
          }
        } else if (prev.data !== chunkData || prev.total !== total) {
          try {
            await updateDoc(chunkRef, {
              total,
              data: chunkData,
              updatedAt: serverTimestamp(),
            });
          } catch (error) {
            handleFirestoreError(error, OperationType.UPDATE, chunkPath);
          }
        }
      }
    }

    // Clean up obsolete chunks from previous edits or removed back/original images
    for (const oldChunkId of existingMap.keys()) {
      if (!desiredIds.has(oldChunkId)) {
        try {
          await deleteDoc(doc(db, 'users', uid, 'assetChunks', oldChunkId));
        } catch (error) {
          handleFirestoreError(error, OperationType.DELETE, `users/${uid}/assetChunks/${oldChunkId}`);
        }
      }
    }
  }

  public async deleteDocumentFromCloud(docIdRaw: string): Promise<void> {
    const uid = this.getVerifiedUid();
    if (!uid || !navigator.onLine) return;

    const docId = clampDocIdForChunk(docIdRaw);

    // Delete asset chunks first or concurrently
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
  }

  public async deleteGroupFromCloud(groupIdRaw: string): Promise<void> {
    const uid = this.getVerifiedUid();
    if (!uid || !navigator.onLine) return;

    const groupId = sanitizeFirestoreId(groupIdRaw);
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
  }

  public async pushGroupNow(group: DocumentGroup): Promise<void> {
    const uid = this.getVerifiedUid();
    if (!uid || !navigator.onLine) return;
    try {
      await ensureUserProfile(auth.currentUser!);
      await this.upsertGroupToCloud(uid, group);
      const known = loadKnownCloudIds(uid);
      const gid = sanitizeFirestoreId(group.id);
      if (!known.groupIds.includes(gid)) {
        saveKnownCloudIds(uid, { ...known, groupIds: [...known.groupIds, gid] });
      }
      this.updateStatus({ state: 'synced', lastSyncTime: new Date().toISOString() });
    } catch (err) {
      console.error('Background group sync failed:', err);
    }
  }

  public async pushDocumentNow(localDoc: MostamsakDocument): Promise<void> {
    const uid = this.getVerifiedUid();
    if (!uid || !navigator.onLine) return;
    try {
      await ensureUserProfile(auth.currentUser!);
      await this.upsertDocumentToCloud(uid, localDoc);
      const known = loadKnownCloudIds(uid);
      const did = clampDocIdForChunk(localDoc.id);
      if (!known.docIds.includes(did)) {
        saveKnownCloudIds(uid, { ...known, docIds: [...known.docIds, did] });
      }
      this.updateStatus({ state: 'synced', lastSyncTime: new Date().toISOString() });
    } catch (err) {
      console.error('Background document sync failed:', err);
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

  /**
   * Perform full bidirectional sync with Firebase Firestore for the verified Google user
   */
  public async syncNow(): Promise<boolean> {
    if (this.isSyncingPromise) {
      return this.isSyncingPromise;
    }

    if (!navigator.onLine) {
      this.updateStatus({ state: 'offline' });
      return false;
    }

    const uid = this.getVerifiedUid();
    if (!uid || !auth.currentUser) {
      this.updateStatus({ state: 'idle' });
      return false;
    }

    this.isSyncingPromise = (async () => {
      this.updateStatus({ state: 'syncing', errorMessage: undefined });

      try {
        await ensureUserProfile(auth.currentUser!);

        // 1. Fetch remote state in parallel
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

        // Reassemble chunk map: docId -> slot -> chunks[]
        const chunksByDoc = new Map<
          string,
          Partial<Record<AssetSlot, { index: number; data: string }[]>>
        >();
        remoteChunkSnap.forEach((d) => {
          const item = d.data() as {
            docId: string;
            slot: AssetSlot;
            index: number;
            data: string;
          };
          if (!chunksByDoc.has(item.docId)) {
            chunksByDoc.set(item.docId, {});
          }
          const slots = chunksByDoc.get(item.docId)!;
          if (!slots[item.slot]) {
            slots[item.slot] = [];
          }
          slots[item.slot]!.push({ index: item.index, data: item.data });
        });

        const assembleSlot = (docId: string, slot: AssetSlot): string => {
          const arr = chunksByDoc.get(docId)?.[slot];
          if (!arr || arr.length === 0) return '';
          return [...arr]
            .sort((a, b) => a.index - b.index)
            .map((c) => c.data)
            .join('');
        };

        const remoteGroups = new Map<string, DocumentGroup>();
        remoteGroupSnap.forEach((d) => {
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

        const remoteDocs = new Map<string, MostamsakDocument>();
        remoteDocSnap.forEach((d) => {
          const data = d.data() as Record<string, unknown>;
          const id = String(data.id || d.id);
          const assembledFront = data.hasFrontImage ? assembleSlot(id, 'front') : '';
          const assembledBack = data.hasBackImage ? assembleSlot(id, 'back') : undefined;
          const assembledOrigFront = data.hasOriginalFrontImage
            ? assembleSlot(id, 'originalFront')
            : undefined;
          const assembledOrigBack = data.hasOriginalBackImage
            ? assembleSlot(id, 'originalBack')
            : undefined;

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
          remoteDocs.set(docItem.id, docItem);
        });

        const previousKnown = loadKnownCloudIds(uid);
        const localGroups = await dbGetAll<DocumentGroup>('groups');
        const localDocs = await dbGetAll<MostamsakDocument>('documents');

        // 2. Reconcile Groups
        const localGroupMap = new Map(localGroups.map((g) => [sanitizeFirestoreId(g.id), g]));
        const nextKnownGroupIds = new Set<string>();

        for (const [remoteId, rGroup] of remoteGroups.entries()) {
          nextKnownGroupIds.add(remoteId);
          const lGroup = localGroupMap.get(remoteId);
          if (!lGroup) {
            await dbPut('groups', rGroup);
          } else {
            const remoteTs = new Date(rGroup.updatedAt || 0).getTime();
            const localTs = new Date(lGroup.updatedAt || 0).getTime();
            if (remoteTs > localTs) {
              await dbPut('groups', rGroup);
            } else if (localTs > remoteTs) {
              await this.upsertGroupToCloud(uid, lGroup);
            }
          }
        }

        for (const lGroup of localGroups) {
          const gid = sanitizeFirestoreId(lGroup.id);
          if (remoteGroups.has(gid)) continue;
          if (previousKnown.groupIds.includes(gid)) {
            await dbDelete('groups', lGroup.id);
          } else {
            await this.upsertGroupToCloud(uid, lGroup);
            nextKnownGroupIds.add(gid);
          }
        }

        // 3. Reconcile Documents
        const localDocMap = new Map(localDocs.map((d) => [clampDocIdForChunk(d.id), d]));
        const nextKnownDocIds = new Set<string>();

        for (const [remoteId, rDoc] of remoteDocs.entries()) {
          nextKnownDocIds.add(remoteId);
          const lDoc = localDocMap.get(remoteId);
          if (!lDoc) {
            await dbPut('documents', rDoc);
          } else {
            const remoteTs = new Date(rDoc.updatedAt || 0).getTime();
            const localTs = new Date(lDoc.updatedAt || 0).getTime();
            if (remoteTs > localTs) {
              await dbPut('documents', {
                ...rDoc,
                historyLogs: lDoc.historyLogs,
              });
            } else if (localTs > remoteTs) {
              await this.upsertDocumentToCloud(uid, lDoc);
            }
          }
        }

        for (const lDoc of localDocs) {
          const did = clampDocIdForChunk(lDoc.id);
          if (remoteDocs.has(did)) continue;
          if (previousKnown.docIds.includes(did)) {
            await dbDelete('documents', lDoc.id);
          } else {
            await this.upsertDocumentToCloud(uid, lDoc);
            nextKnownDocIds.add(did);
          }
        }

        saveKnownCloudIds(uid, {
          docIds: Array.from(nextKnownDocIds),
          groupIds: Array.from(nextKnownGroupIds),
        });

        const now = new Date().toISOString();
        this.updateStatus({
          state: 'synced',
          lastSyncTime: now,
          conflicts: [],
          serverInfo: {
            provider: 'Firebase Firestore',
            syncedDocuments: nextKnownDocIds.size,
            syncedGroups: nextKnownGroupIds.size,
          },
        });

        await recordAudit(
          'sync',
          'مزامنة سحابية (Google / Firestore)',
          `تمت مزامنة ${nextKnownDocIds.size} مستمسك و ${nextKnownGroupIds.size} مجموعة بنجاح`,
          'success'
        );
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
    })();

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

    await recordAudit('sync', 'حل التعارض', `تم حل تعارض المستمسك (${chosenDoc.title}) باختيار: ${choice}`);
  }
}

export const syncEngine = new SyncEngine();
