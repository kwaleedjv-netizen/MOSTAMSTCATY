/**
 * Persistent Database Service using Native Browser IndexedDB
 * Meets requirement #11: Permanent local storage, zero data loss, transaction safe
 */

import { MostamsakDocument, DocumentGroup, AuditLog, AppSettings, CustomTemplate } from '../types';
import { DEFAULT_GROUPS, DOCUMENT_PRESETS } from '../constants/presets';
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

// === Procedural High-Res Vector SVG Artwork for Initial Document Demos ===

function createMockCardSvg(title: string, sub: string, color: string, isBack = false): string {
  const w = 428;
  const h = 270;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
    <defs>
      <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="${color}" stop-opacity="0.94" />
        <stop offset="100%" stop-color="#0f172a" stop-opacity="0.98" />
      </linearGradient>
      <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
        <path d="M 20 0 L 0 0 0 20" fill="none" stroke="rgba(255,255,255,0.05)" stroke-width="1"/>
      </pattern>
    </defs>
    <rect width="${w}" height="${h}" rx="12" fill="url(#bg)"/>
    <rect width="${w}" height="${h}" rx="12" fill="url(#grid)"/>
    <rect x="4" y="4" width="${w - 8}" height="${h - 8}" rx="10" fill="none" stroke="rgba(255,255,255,0.18)" stroke-width="1"/>

    <text x="214" y="34" font-family="system-ui, Tahoma, Arial, sans-serif" font-size="11" font-weight="700" fill="#bae6fd" text-anchor="middle">جمهورية العراق</text>
    <text x="214" y="58" font-family="system-ui, Tahoma, Arial, sans-serif" font-size="16" font-weight="700" fill="#ffffff" text-anchor="middle">${title}</text>
    <text x="214" y="77" font-family="system-ui, Tahoma, Arial, sans-serif" font-size="10.5" fill="rgba(255,255,255,0.72)" text-anchor="middle">${sub} · ${isBack ? 'الوجه الخلفي' : 'الوجه الأمامي'}</text>
    <line x1="24" y1="89" x2="404" y2="89" stroke="rgba(255,255,255,0.16)" stroke-width="1"/>

    ${
      !isBack
        ? `
      <!-- Photo Frame (Left) -->
      <rect x="26" y="104" width="88" height="116" rx="6" fill="#1e293b" stroke="rgba(255,255,255,0.28)"/>
      <circle cx="70" cy="144" r="20" fill="#94a3b8"/>
      <path d="M 40 202 Q 70 174 100 202 Z" fill="#94a3b8"/>

      <!-- Chip -->
      <rect x="352" y="106" width="46" height="34" rx="4" fill="#ca8a04" opacity="0.85"/>
      <rect x="357" y="111" width="36" height="24" rx="2" fill="none" stroke="#fef08a" stroke-width="1.2"/>

      <!-- RTL Aligned Metadata (Right-to-Left) -->
      <text x="336" y="122" font-family="system-ui, Tahoma, Arial, sans-serif" font-size="10.5" font-weight="700" fill="#7dd3fc" text-anchor="end">الاسم:</text>
      <text x="288" y="122" font-family="system-ui, Tahoma, Arial, sans-serif" font-size="11.5" font-weight="600" fill="#ffffff" text-anchor="end">نموذج مستمسك رسمي</text>

      <text x="336" y="150" font-family="system-ui, Tahoma, Arial, sans-serif" font-size="10.5" font-weight="700" fill="#7dd3fc" text-anchor="end">الرقم:</text>
      <text x="288" y="150" font-family="monospace" font-size="12" font-weight="700" fill="#fde047" text-anchor="end">1990-4821-0094</text>

      <text x="336" y="178" font-family="system-ui, Tahoma, Arial, sans-serif" font-size="10.5" font-weight="700" fill="#7dd3fc" text-anchor="end">الإصدار:</text>
      <text x="288" y="178" font-family="system-ui, Tahoma, Arial, sans-serif" font-size="11" fill="#e2e8f0" text-anchor="end">بغداد - المديرية العامة</text>

      <text x="336" y="206" font-family="system-ui, Tahoma, Arial, sans-serif" font-size="10.5" font-weight="700" fill="#7dd3fc" text-anchor="end">الحالة:</text>
      <text x="288" y="206" font-family="system-ui, Tahoma, Arial, sans-serif" font-size="11" fill="#86efac" text-anchor="end">صالح للطباعة 1:1</text>
      `
        : `
      <!-- Back side Barcode & MRZ -->
      <rect x="28" y="104" width="372" height="48" rx="4" fill="#0f172a" stroke="rgba(255,255,255,0.2)"/>
      <line x1="46" y1="113" x2="46" y2="143" stroke="#ffffff" stroke-width="3"/>
      <line x1="56" y1="113" x2="56" y2="143" stroke="#ffffff" stroke-width="1.5"/>
      <line x1="64" y1="113" x2="64" y2="143" stroke="#ffffff" stroke-width="4"/>
      <line x1="76" y1="113" x2="76" y2="143" stroke="#ffffff" stroke-width="2"/>
      <line x1="88" y1="113" x2="88" y2="143" stroke="#ffffff" stroke-width="3.5"/>
      <line x1="102" y1="113" x2="102" y2="143" stroke="#ffffff" stroke-width="2"/>
      <line x1="116" y1="113" x2="116" y2="143" stroke="#ffffff" stroke-width="4"/>
      <line x1="132" y1="113" x2="132" y2="143" stroke="#ffffff" stroke-width="1.5"/>
      <line x1="144" y1="113" x2="144" y2="143" stroke="#ffffff" stroke-width="3"/>
      <line x1="160" y1="113" x2="160" y2="143" stroke="#ffffff" stroke-width="5"/>
      <line x1="178" y1="113" x2="178" y2="143" stroke="#ffffff" stroke-width="2"/>
      <line x1="192" y1="113" x2="192" y2="143" stroke="#ffffff" stroke-width="4"/>
      <line x1="208" y1="113" x2="208" y2="143" stroke="#ffffff" stroke-width="2"/>
      <line x1="224" y1="113" x2="224" y2="143" stroke="#ffffff" stroke-width="3.5"/>
      <line x1="240" y1="113" x2="240" y2="143" stroke="#ffffff" stroke-width="2"/>
      <line x1="258" y1="113" x2="258" y2="143" stroke="#ffffff" stroke-width="4"/>
      <line x1="278" y1="113" x2="278" y2="143" stroke="#ffffff" stroke-width="1.5"/>
      <line x1="296" y1="113" x2="296" y2="143" stroke="#ffffff" stroke-width="3"/>
      <line x1="316" y1="113" x2="316" y2="143" stroke="#ffffff" stroke-width="2"/>
      <line x1="336" y1="113" x2="336" y2="143" stroke="#ffffff" stroke-width="4"/>
      <line x1="360" y1="113" x2="360" y2="143" stroke="#ffffff" stroke-width="3"/>
      <line x1="378" y1="113" x2="378" y2="143" stroke="#ffffff" stroke-width="2"/>

      <rect x="28" y="166" width="56" height="56" rx="4" fill="#ffffff"/>
      <rect x="34" y="172" width="18" height="18" fill="#0f172a"/>
      <rect x="60" y="172" width="18" height="18" fill="#0f172a"/>
      <rect x="34" y="198" width="18" height="18" fill="#0f172a"/>

      <text x="100" y="190" font-family="monospace" font-size="11" fill="#cbd5e1">I&lt;IRQ199048210094&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;</text>
      <text x="100" y="210" font-family="monospace" font-size="11" fill="#cbd5e1">9001018M3201015IRQ&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;4</text>
    `
    }

    <text x="214" y="252" font-family="monospace" font-size="9" fill="rgba(255,255,255,0.45)" text-anchor="middle">MOSTAMSAKATI · 1:1 PHYSICAL SCALE</text>
  </svg>`;

  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}

// === Initialize Database with Seed Data if Empty ===

export async function initializeDatabase(): Promise<{
  documents: MostamsakDocument[];
  groups: DocumentGroup[];
  settings: AppSettings;
}> {
  await getDb();

  // Load or Seed Groups
  let groups = await dbGetAll<DocumentGroup>('groups');
  if (groups.length === 0) {
    const now = new Date().toISOString();
    const seededGroups: DocumentGroup[] = DEFAULT_GROUPS.map((g) => ({
      ...g,
      createdAt: now,
      updatedAt: now,
    }));
    for (const g of seededGroups) {
      await dbPut('groups', g);
    }
    groups = seededGroups;
  }

  // Load or Seed Documents
  let documents = await dbGetAll<MostamsakDocument>('documents');
  if (documents.length === 0) {
    const now = new Date().toISOString();
    const defaultTransform = { zoom: 1, panX: 0, panY: 0, rotation: 0 as const, flipH: false, flipV: false };

    const sampleDocs: MostamsakDocument[] = [
      {
        id: 'doc_seed_id_card',
        title: 'بطاقة الهوية الوطنية الموحدة',
        typeId: 'unified_id',
        typeName: 'بطاقة الهوية الموحدة',
        isCustom: false,
        widthMm: 85.6,
        heightMm: 54,
        orientation: 'landscape',
        sidesCount: 2,
        frontLabel: 'الوجه الأمامي (الصورة والبيانات)',
        backLabel: 'الوجه الخلفي (الباركود والبصمة)',
        radiusMm: 3.18,
        frontImage: createMockCardSvg('بطاقة الهوية الوطنية الموحدة', 'جمهورية العراق - وزارة الداخلية', '#0369a1', false),
        backImage: createMockCardSvg('بطاقة الهوية الوطنية الموحدة', 'المديرية العامة للجنسية', '#0369a1', true),
        frontTransform: { ...defaultTransform },
        backTransform: { ...defaultTransform },
        notes: 'البطاقة الوطنية الأصلية الصادرة سنة 2021، صالحة لغاية 2031.',
        groupId: 'grp_personal',
        isFavorite: true,
        isArchived: false,
        isDeleted: false,
        isEncrypted: false,
        coverFace: 'front',
        createdAt: now,
        updatedAt: now,
        historyLogs: [
          {
            id: 'h1',
            timestamp: now,
            action: 'إنشاء المستمسك الأولي',
            deviceId: getDeviceName(),
          },
        ],
      },
      {
        id: 'doc_seed_driver_lic',
        title: 'إجازة قيادة دولية ومحلية',
        typeId: 'driving_license',
        typeName: 'إجازة القيادة',
        isCustom: false,
        widthMm: 85.6,
        heightMm: 54,
        orientation: 'landscape',
        sidesCount: 2,
        frontLabel: 'الوجه الأمامي (فئة A و B)',
        backLabel: 'الوجه الخلفي (فصيلة الدم والرمز)',
        radiusMm: 3.18,
        frontImage: createMockCardSvg('إجازة السوق القياسية', 'مديرية المرور العامة - بغداد', '#15803d', false),
        backImage: createMockCardSvg('إجازة السوق القياسية', 'بيانات السائق وفئات المركبات', '#15803d', true),
        frontTransform: { ...defaultTransform },
        backTransform: { ...defaultTransform },
        notes: 'إجازة خصوصي وعمومي سارية المفعول، فصيلة الدم O+.',
        groupId: 'grp_personal',
        isFavorite: true,
        isArchived: false,
        isDeleted: false,
        isEncrypted: false,
        coverFace: 'front',
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'doc_seed_passport',
        title: 'جواز السفر العراقي (الفئة A)',
        typeId: 'passport',
        typeName: 'جواز السفر',
        isCustom: false,
        widthMm: 125,
        heightMm: 88,
        orientation: 'landscape',
        sidesCount: 1,
        frontLabel: 'صفحة البيانات الرئيسية',
        backLabel: 'صفحة التأشيرات',
        radiusMm: 2,
        frontImage: createMockCardSvg('جواز السفر الإلكتروني', 'REPUBLIC OF IRAQ PASSPORT', '#1e1b4b', false),
        frontTransform: { ...defaultTransform },
        backTransform: { ...defaultTransform },
        notes: 'جواز سفر إلكتروني بايومتري صالح للسفر لجميع الدول.',
        groupId: 'grp_personal',
        isFavorite: false,
        isArchived: false,
        isDeleted: false,
        isEncrypted: false,
        coverFace: 'front',
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'doc_seed_ration_card',
        title: 'البطاقة التموينية الإلكترونية الجديدة',
        typeId: 'ration_card_new',
        typeName: 'البطاقة التموينية (الإصدار الجديد)',
        isCustom: false,
        widthMm: 85.6,
        heightMm: 54,
        orientation: 'landscape',
        sidesCount: 2,
        frontLabel: 'الوجه الأمامي (رقم المركز)',
        backLabel: 'الوجه الخلفي (أفراد الأسرة)',
        radiusMm: 3.18,
        frontImage: createMockCardSvg('البطاقة التموينية الإلكترونية', 'وزارة التجارة - دائرة التخطيط والمتابعة', '#7c2d12', false),
        backImage: createMockCardSvg('البطاقة التموينية الإلكترونية', 'بيانات الوكيل والمركز التمويني', '#7c2d12', true),
        frontTransform: { ...defaultTransform },
        backTransform: { ...defaultTransform },
        notes: 'البطاقة التموينية الرقمية المحدثة مع أفراد العائلة.',
        groupId: 'grp_family',
        isFavorite: false,
        isArchived: false,
        isDeleted: false,
        isEncrypted: false,
        coverFace: 'front',
        createdAt: now,
        updatedAt: now,
      },
    ];

    for (const doc of sampleDocs) {
      await dbPut('documents', doc);
    }
    documents = sampleDocs;

    await recordAudit('doc_create', 'تهيئة المستودع', 'تم إنشاء المستمسكات الافتراضية بنجاح');
  }

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
