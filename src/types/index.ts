/**
 * Types & Data Models for MOSTAMSAKATI Desktop Application
 */

export type DocumentOrientation = 'landscape' | 'portrait';
export type ViewMode =
  | 'single'
  | 'cards'
  | 'grid'
  | 'compact'
  | 'gallery'
  | 'list'
  | 'detail'
  | 'grouped'
  | 'map'
  | 'carousel';
export type CardSize = 'small' | 'medium' | 'large';
export type UnitType = 'mm' | 'cm' | 'inch' | 'px';

export interface StandardDocumentPreset {
  id: string;
  nameAr: string;
  nameEn: string;
  widthMm: number;
  heightMm: number;
  defaultOrientation: DocumentOrientation;
  defaultSides: 1 | 2;
  frontLabel: string;
  backLabel: string;
  defaultRadiusMm: number;
  description: string;
  category: 'id' | 'travel' | 'official' | 'financial' | 'property' | 'custom';
  icon: string;
}

export type DocumentFilterType =
  | 'original'
  | 'magic_color'
  | 'bw_adaptive'
  | 'grayscale_crisp'
  | 'high_contrast'
  | 'print_clean';

export interface DocumentAdjustments {
  filter: DocumentFilterType;
  brightness: number; // -100 to 100
  contrast: number; // -100 to 100
  sharpness: number; // 0 to 100
  fineAngle: number; // -45 to 45 degrees
  autoCorrected?: boolean;
}

export interface ImageTransform {
  zoom: number; // 1.0 = 100%
  panX: number; // pixels offset
  panY: number;
  rotation: 0 | 90 | 180 | 270;
  flipH: boolean;
  flipV: boolean;
  crop?: {
    x: number; // percentage 0-100
    y: number;
    width: number;
    height: number;
  };
  adjustments?: DocumentAdjustments;
}

export interface MostamsakDocument {
  id: string;
  title: string;
  typeId: string;
  typeName: string;
  isCustom: boolean;
  widthMm: number;
  heightMm: number;
  orientation: DocumentOrientation;
  sidesCount: 1 | 2;
  frontLabel: string;
  backLabel: string;
  radiusMm: number;
  previewBgColor?: string;

  // Image data (Data URLs or Blob URLs)
  frontImage: string;
  backImage?: string;
  originalFrontImage?: string;
  originalBackImage?: string;

  frontTransform: ImageTransform;
  backTransform: ImageTransform;

  notes: string; // Max 500 characters
  groupId?: string;
  isFavorite: boolean;
  isArchived: boolean;
  isDeleted: boolean;
  deletedAt?: string;
  previousGroupId?: string;

  isEncrypted: boolean;
  coverFace: 'front' | 'back';

  createdAt: string;
  updatedAt: string;
  lastModifiedBy?: string; // Device ID
  historyLogs?: DocumentHistoryEntry[];
}

export interface DocumentHistoryEntry {
  id: string;
  timestamp: string;
  action: string;
  details?: string;
  deviceId?: string;
}

export interface DocumentGroup {
  id: string;
  name: string;
  color: string;
  icon: string;
  description?: string;
  coverImage?: string;
  isLocked: boolean;
  passwordHash?: string;
  passwordSalt?: string;
  createdAt: string;
  updatedAt: string;
  isHidden?: boolean;
}

export interface CustomTemplate {
  id: string;
  name: string;
  category: string;
  widthMm: number;
  heightMm: number;
  unit: UnitType;
  orientation: DocumentOrientation;
  sidesCount: 1 | 2;
  frontLabel: string;
  backLabel: string;
  radiusMm: number;
  previewBgColor: string;
  notes?: string;
  createdAt: string;
}

export interface AuditLog {
  id: string;
  timestamp: string;
  actionType:
    | 'doc_create'
    | 'doc_update'
    | 'doc_rename'
    | 'doc_resize'
    | 'doc_replace_image'
    | 'doc_move'
    | 'doc_trash'
    | 'doc_restore'
    | 'doc_permanent_delete'
    | 'group_create'
    | 'group_update'
    | 'group_delete'
    | 'export'
    | 'import'
    | 'print'
    | 'backup_create'
    | 'backup_restore'
    | 'login'
    | 'lock'
    | 'sync'
    | 'security_change';
  itemName: string;
  deviceName: string;
  details: string;
  status: 'success' | 'failed' | 'warning';
}

export interface PaperPreset {
  id: string;
  name: string;
  widthMm: number;
  heightMm: number;
}

export interface PrintItem {
  id: string;
  documentId: string;
  groupId?: string;
  face: 'front' | 'back';
  pageIndex: number; // 0 = first page, 1 = second page (for duplex)
  xMm: number;
  yMm: number;
  widthMm: number;
  heightMm: number;
  rotation: 0 | 90 | 180 | 270;
  showBorder: boolean;
  showCutMarks: boolean;
  showLabel: boolean;
  label?: string;
}

export interface PrintSheetSettings {
  paperId: string;
  customWidthMm: number;
  customHeightMm: number;
  orientation: DocumentOrientation;
  marginsMm: number;
  gridSnapMm: number;
  showGrid: boolean;
  showRulers: boolean;
  showCutMarksAll: boolean;
  showLabelsAll: boolean;
  groupTwoSidedLock: boolean;
  duplexMode: 'single' | 'side_by_side' | 'duplex_aligned';
  targetDpi: 300 | 600;
}

export interface AppSettings {
  theme: 'dark' | 'light' | 'system';
  language: 'ar' | 'en';
  fontSize: 'small' | 'medium' | 'large';
  viewMode: ViewMode;
  cardSize: CardSize;
  sortBy: 'dateAdded' | 'dateModified' | 'name' | 'type' | 'group';
  sortOrder: 'asc' | 'desc';
  typeFilter: string;

  previewQuality: 'high' | 'medium' | 'low';
  exportDpi: 300 | 600;
  defaultCornerRadiusMm: number;
  keepOriginalImages: boolean;

  autoLockMinutes: number; // 0 = disabled
  hasMasterPassword: boolean;
  masterPasswordHash?: string;
  masterPasswordSalt?: string;
  passwordHint?: string;

  cloudSyncEnabled: boolean;
  cloudServerUrl: string;
  cloudDeviceId: string;
  cloudDeviceName: string;
  lastSyncTime?: string;
  autoSyncOnStart: boolean;

  autoBackupEnabled: boolean;
  autoBackupIntervalDays: number;
  lastBackupTime?: string;
}

export interface ConflictItem {
  documentId: string;
  serverVersion: MostamsakDocument;
  clientVersion: MostamsakDocument;
  detectedAt: string;
}
