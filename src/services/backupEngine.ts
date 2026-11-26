/**
 * Complete Backup and Restore Engine
 * Encrypted .mostamsak archives, data verification, Firebase Firestore cloud backup integration
 */

import {
  collection,
  doc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  where,
} from 'firebase/firestore';
import { dbGetAll, dbPut, recordAudit } from './db';
import { MostamsakDocument, DocumentGroup, AuditLog, AppSettings, CustomTemplate } from '../types';
import { encryptData, decryptData, getDeviceName } from './crypto';
import {
  auth,
  db,
  ensureUserProfile,
  handleFirestoreError,
  OperationType,
  sanitizeFirestoreId,
} from './firebase';

export interface BackupArchiveData {
  version: number;
  appName: string;
  createdAt: string;
  deviceName: string;
  documents: MostamsakDocument[];
  groups: DocumentGroup[];
  auditLogs: AuditLog[];
  settings?: AppSettings;
  customTemplates?: CustomTemplate[];
}

export interface CloudBackupSummary {
  id: string;
  name: string;
  createdAt: string;
  sizeBytes: number;
  documentsCount: number;
  groupsCount: number;
  chunkCount: number;
}

const BACKUP_CHUNK_CHAR_LIMIT = 450_000;

/**
 * Creates an encrypted backup file blob
 */
export async function createEncryptedBackup(
  password?: string
): Promise<{
  blob: Blob;
  fileName: string;
  meta: { documentsCount: number; groupsCount: number; sizeBytes: number };
}> {
  const documents = await dbGetAll<MostamsakDocument>('documents');
  const groups = await dbGetAll<DocumentGroup>('groups');
  const auditLogs = await dbGetAll<AuditLog>('auditLogs');
  const customTemplates = await dbGetAll<CustomTemplate>('customTemplates');

  const payload: BackupArchiveData = {
    version: 1,
    appName: 'MOSTAMSAKATI',
    createdAt: new Date().toISOString(),
    deviceName: getDeviceName(),
    documents,
    groups,
    auditLogs: auditLogs.slice(-200),
    customTemplates,
  };

  const jsonStr = JSON.stringify(payload);
  let finalContent: string;

  if (password && password.trim().length > 0) {
    finalContent = await encryptData(jsonStr, password);
  } else {
    finalContent = JSON.stringify({
      v: 1,
      algo: 'PLAINTEXT',
      data: jsonStr,
    });
  }

  const dateStr = new Date().toISOString().slice(0, 10);
  const fileName = `mostamsakati_backup_${dateStr}.mostamsak`;
  const blob = new Blob([finalContent], { type: 'application/json' });

  await recordAudit(
    'backup_create',
    fileName,
    `تم إنشاء نسخة احتياطية تتضمن ${documents.length} مستمسك و ${groups.length} مجموعة`
  );

  return {
    blob,
    fileName,
    meta: {
      documentsCount: documents.length,
      groupsCount: groups.length,
      sizeBytes: blob.size,
    },
  };
}

/**
 * Validates and restores a backup file
 */
export async function restoreFromBackup(
  backupFileText: string,
  password?: string
): Promise<{ success: boolean; restoredCounts: { docs: number; groups: number }; error?: string }> {
  try {
    let payloadStr: string;

    const parsedEnvelope = JSON.parse(backupFileText);
    if (parsedEnvelope.algo === 'AES-256-GCM') {
      if (!password) {
        return {
          success: false,
          restoredCounts: { docs: 0, groups: 0 },
          error: 'النسخة الاحتياطية مشفرة، يرجى إدخال كلمة المرور',
        };
      }
      try {
        payloadStr = await decryptData(backupFileText, password);
      } catch {
        return {
          success: false,
          restoredCounts: { docs: 0, groups: 0 },
          error: 'كلمة المرور غير صحيحة لفك تشفير النسخة الاحتياطية',
        };
      }
    } else if (parsedEnvelope.algo === 'PLAINTEXT') {
      payloadStr = parsedEnvelope.data;
    } else if (parsedEnvelope.documents && parsedEnvelope.groups) {
      payloadStr = backupFileText;
    } else {
      return {
        success: false,
        restoredCounts: { docs: 0, groups: 0 },
        error: 'ملف النسخة الاحتياطية غير صالح أو تالف',
      };
    }

    const data: BackupArchiveData = JSON.parse(payloadStr);

    if (!Array.isArray(data.documents) || !Array.isArray(data.groups)) {
      return {
        success: false,
        restoredCounts: { docs: 0, groups: 0 },
        error: 'بنية البيانات غير مطابقة للمواصفات',
      };
    }

    for (const group of data.groups) {
      await dbPut('groups', group);
    }

    for (const docItem of data.documents) {
      await dbPut('documents', docItem);
    }

    if (Array.isArray(data.customTemplates)) {
      for (const tmpl of data.customTemplates) {
        await dbPut('customTemplates', tmpl);
      }
    }

    await recordAudit(
      'backup_restore',
      'استعادة نسخة احتياطية',
      `تم استعادة ${data.documents.length} مستمسك و ${data.groups.length} مجموعة بنجاح`
    );

    return {
      success: true,
      restoredCounts: {
        docs: data.documents.length,
        groups: data.groups.length,
      },
    };
  } catch (err: unknown) {
    return {
      success: false,
      restoredCounts: { docs: 0, groups: 0 },
      error: err instanceof Error ? err.message : 'فشلت قراءة ملف النسخة الاحتياطية',
    };
  }
}

/**
 * Upload encrypted backup archive to Firebase Firestore under authenticated user's account
 */
export async function uploadBackupToCloud(
  backupBlob: Blob,
  backupName: string,
  meta: { documentsCount?: number; groupsCount?: number; sizeBytes?: number }
): Promise<boolean> {
  const user = auth.currentUser;
  if (!user || !user.emailVerified || !navigator.onLine) {
    return false;
  }

  try {
    const uid = sanitizeFirestoreId(user.uid);
    await ensureUserProfile(user);

    const text = await backupBlob.text();
    const chunks: string[] = [];
    for (let i = 0; i < text.length; i += BACKUP_CHUNK_CHAR_LIMIT) {
      chunks.push(text.slice(i, i + BACKUP_CHUNK_CHAR_LIMIT));
    }

    if (chunks.length === 0 || chunks.length > 100) {
      return false;
    }

    const backupId = `backup_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const clientCreatedAt = new Date().toISOString();
    const backupPath = `users/${uid}/backups/${backupId}`;

    try {
      await setDoc(doc(db, 'users', uid, 'backups', backupId), {
        ownerUid: uid,
        id: backupId,
        name: (backupName || 'نسخة احتياطية سحابية').slice(0, 160),
        sizeBytes: Number(meta?.sizeBytes ?? backupBlob.size) || 0,
        documentsCount: Number(meta?.documentsCount ?? 0) || 0,
        groupsCount: Number(meta?.groupsCount ?? 0) || 0,
        chunkCount: chunks.length,
        clientCreatedAt,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, backupPath);
    }

    for (let index = 0; index < chunks.length; index++) {
      const chunkId = `${backupId}__${index}`;
      const chunkPath = `users/${uid}/backupChunks/${chunkId}`;
      try {
        await setDoc(doc(db, 'users', uid, 'backupChunks', chunkId), {
          ownerUid: uid,
          backupId,
          index,
          total: chunks.length,
          data: chunks[index],
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, chunkPath);
      }
    }

    return true;
  } catch (err) {
    console.error('Failed to upload cloud backup:', err);
    return false;
  }
}

/**
 * List encrypted cloud backups belonging to the authenticated Google user
 */
export async function listCloudBackups(): Promise<CloudBackupSummary[]> {
  const user = auth.currentUser;
  if (!user || !user.emailVerified) {
    throw new Error('يجب تسجيل الدخول بحساب Google أولاً');
  }

  const uid = sanitizeFirestoreId(user.uid);
  const path = `users/${uid}/backups`;
  let snap;
  try {
    snap = await getDocs(query(collection(db, 'users', uid, 'backups'), where('ownerUid', '==', uid)));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }

  const list: CloudBackupSummary[] = snap.docs.map((d) => {
    const data = d.data() as Record<string, unknown>;
    return {
      id: String(data.id || d.id),
      name: String(data.name || d.id),
      createdAt: String(data.clientCreatedAt || new Date().toISOString()),
      sizeBytes: Number(data.sizeBytes) || 0,
      documentsCount: Number(data.documentsCount) || 0,
      groupsCount: Number(data.groupsCount) || 0,
      chunkCount: Number(data.chunkCount) || 1,
    };
  });

  return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

/**
 * Download and reassemble a cloud backup archive from Firestore chunks
 */
export async function downloadCloudBackup(backupIdRaw: string): Promise<string> {
  const user = auth.currentUser;
  if (!user || !user.emailVerified) {
    throw new Error('يجب تسجيل الدخول بحساب Google أولاً');
  }

  const uid = sanitizeFirestoreId(user.uid);
  const backupId = sanitizeFirestoreId(backupIdRaw);
  const path = `users/${uid}/backupChunks`;

  let snap;
  try {
    snap = await getDocs(
      query(collection(db, 'users', uid, 'backupChunks'), where('ownerUid', '==', uid))
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }

  const matchingDocs = snap.docs.filter(
    (d) => (d.data() as { backupId?: string }).backupId === backupId
  );

  if (matchingDocs.length === 0) {
    throw new Error('تعذر العثور على أجزاء النسخة السحابية');
  }

  const chunks = matchingDocs
    .map((d) => d.data() as { index: number; data: string })
    .sort((a, b) => a.index - b.index);

  return chunks.map((c) => c.data).join('');
}
