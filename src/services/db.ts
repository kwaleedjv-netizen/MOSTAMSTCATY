/**
 * Persistent Database Service using Native Browser IndexedDB
 * Meets requirement #11: Permanent local storage, zero data loss, transaction safe
 */

import { MostamsakDocument, DocumentGroup, AuditLog, AppSettings } from '../types';
import { getDeviceId, getDeviceName } from './crypto';

const DB_NAME = 'mostamsakati_vault_db';
const DB_VERSION = 1;

let dbInstance: IDBDatabase | null = null;

export async function getDb(): Promise<IDBDatabase> {
  if (dbInstance) return dbInstance;

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      if (!db.objectStoreNames.contains('documents')) {
        const docStore = db.createObjectStore('documents', { keyPath: 'id' });
        docStore.createIndex('groupId', 'groupId', { unique: false });
        docStore.createIndex('isFavorite', 'isFavorite', { unique: false });
        docStore.createIndex('isDeleted', 'isDeleted', { unique: false });
        docStore.createIndex('updatedAt', 'updatedAt', { unique: false });
      }

      if (!db.objectStoreNames.contains('groups')) {
        db.createObjectStore('groups', { keyPath: 'id' });
      }

      if (!db.objectStoreNames.contains('auditLogs')) {
        const logStore = db.createObjectStore('auditLogs', { keyPath: 'id' });
        logStore.createIndex('timestamp', 'timestamp', { unique: false });
        logStore.createIndex('actionType', 'actionType', { unique: false });
      }

      if (!db.objectStoreNames.contains('settings')) {
        db.createObjectStore('settings', { keyPath: 'id' });
      }

      if (!db.objectStoreNames.contains('customTemplates')) {
        db.createObjectStore('customTemplates', { keyPath: 'id' });
      }

      if (!db.objectStoreNames.contains('backups')) {
        db.createObjectStore('backups', { keyPath: 'id' });
      }
    };

    request.onsuccess = (event) => {
      dbInstance = (event.target as IDBOpenDBRequest).result;
      resolve(dbInstance);
    };

    request.onerror = (event) => {
      console.error('IndexedDB error:', (event.target as IDBOpenDBRequest).error);
      reject((event.target as IDBOpenDBRequest).error);
    };
  });
}

// === Generic Operations ===

export async function dbGetAll<T>(storeName: string): Promise<T[]> {
  const db = await getDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

export async function dbGet<T>(storeName: string, key: string): Promise<T | undefined> {
  const db = await getDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const req = store.get(key);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function dbPut<T>(storeName: string, item: T): Promise<void> {
  const db = await getDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const req = store.put(item);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function dbDelete(storeName: string, key: string): Promise<void> {
  const db = await getDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const req = store.delete(key);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function dbClear(storeName: string): Promise<void> {
  const db = await getDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const req = store.clear();
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

// === Audit Logging ===

export async function recordAudit(
  actionType: AuditLog['actionType'],
  itemName: string,
  details: string,
  status: 'success' | 'failed' | 'warning' = 'success'
): Promise<AuditLog> {
  const log: AuditLog = {
    id: 'log_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
    timestamp: new Date().toISOString(),
    actionType,
    itemName,
    deviceName: getDeviceName(),
    details,
    status,
  };

  try {
    await dbPut('auditLogs', log);
  } catch (err) {
    console.warn('Failed to record audit log:', err);
  }
  return log;
}

// === Settings Management ===

export const DEFAULT_APP_SETTINGS: AppSettings = {
  theme: 'dark',
  language: 'ar',
  fontSize: 'medium',
  viewMode: 'grid',
  cardSize: 'medium',
  sortBy: 'dateAdded',
  sortOrder: 'desc',
  typeFilter: 'all',

  previewQuality: 'high',
  exportDpi: 300,
  defaultCornerRadiusMm: 3.18,
  keepOriginalImages: true,

  autoLockMinutes: 0,
  hasMasterPassword: false,

  cloudSyncEnabled: true,
  cloudServerUrl: '/api/sync',
  cloudDeviceId: getDeviceId(),
  cloudDeviceName: getDeviceName(),
  autoSyncOnStart: true,

  autoBackupEnabled: false,
  autoBackupIntervalDays: 7,
};

export async function loadSettings(): Promise<AppSettings> {
  const stored = await dbGet<AppSettings & { id: string }>('settings', 'main_config');
  if (stored) {
    return { ...DEFAULT_APP_SETTINGS, ...stored };
  }
  await saveSettings(DEFAULT_APP_SETTINGS);
  return DEFAULT_APP_SETTINGS;
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  await dbPut('settings', { ...settings, id: 'main_config' });
}

// === Initialize Database Stores & Settings (No Sample/Educational Seed Data) ===

export async function initializeDatabase(): Promise<{
  documents: MostamsakDocument[];
  groups: DocumentGroup[];
  settings: AppSettings;
}> {
  await getDb();

  const groups = await dbGetAll<DocumentGroup>('groups');
  const documents = await dbGetAll<MostamsakDocument>('documents');
  const settings = await loadSettings();

  return { documents, groups, settings };
}

// === Storage Stats ===

export async function calculateStorageUsage(): Promise<{
  usedBytes: number;
  documentsCount: number;
  groupsCount: number;
  logsCount: number;
  quotaBytes?: number;
}> {
  const docs = await dbGetAll<MostamsakDocument>('documents');
  const groups = await dbGetAll<DocumentGroup>('groups');
  const logs = await dbGetAll<AuditLog>('auditLogs');

  // Approximate bytes
  let jsonString = JSON.stringify(docs) + JSON.stringify(groups) + JSON.stringify(logs);
  let usedBytes = new Blob([jsonString]).size;

  let quotaBytes: number | undefined;
  if (navigator.storage && navigator.storage.estimate) {
    try {
      const estimate = await navigator.storage.estimate();
      if (estimate.usage) usedBytes = Math.max(usedBytes, estimate.usage);
      quotaBytes = estimate.quota;
    } catch {
      // ignore
    }
  }

  return {
    usedBytes,
    documentsCount: docs.length,
    groupsCount: groups.length,
    logsCount: logs.length,
    quotaBytes,
  };
}
