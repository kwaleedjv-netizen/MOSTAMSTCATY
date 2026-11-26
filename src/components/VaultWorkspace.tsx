import React, { useState, useEffect, useMemo } from 'react';
import {
  PanelRightClose,
  PanelRightOpen,
  Search,
  ArrowUpDown,
  Plus,
  Ruler,
  Printer,
  Download,
  Archive,
  Trash2,
  RotateCcw,
  CheckSquare,
  LayoutGrid,
  Table as TableIcon,
  Maximize,
  ZoomIn,
  ZoomOut,
  Edit3,
  Copy,
  Star,
  FlipHorizontal,
  Shield,
  Lock,
  ShieldCheck,
  SearchX,
  FilePlus,
  Check,
  X,
  Eye,
} from 'lucide-react';
import {
  MostamsakDocument,
  DocumentGroup,
  CardSize,
} from '../types';
import { DOCUMENT_PRESETS } from '../constants/presets';
import { DesktopSidebar, SidebarFilter } from './DesktopSidebar';
import { DocumentCard } from './DocumentCard';

export type VaultViewMode = 'stage' | 'grid' | 'table';

interface VaultWorkspaceProps {
  documents: MostamsakDocument[];
  groups: DocumentGroup[];
  isLoading: boolean;
  sidebarFilter: SidebarFilter;
  onSelectSidebarFilter: (filter: SidebarFilter) => void;
  sidebarCounts: {
    all: number;
    favorites: number;
    recentAdded: number;
    recentModified: number;
    archived: number;
    trash: number;
    groupCounts: Record<string, number>;
  };
  storageUsedBytes: number;
  activeViewTitle: string;

  // Filters & sorting
  searchQuery: string;
  onSearchChange: (q: string) => void;
  typeFilter: string;
  onChangeTypeFilter: (t: string) => void;
  sortBy: 'dateAdded' | 'dateModified' | 'name' | 'type';
  onChangeSortBy: (s: 'dateAdded' | 'dateModified' | 'name' | 'type') => void;
  sortOrder: 'asc' | 'desc';
  onToggleSortOrder: () => void;

  // Vault view & stage focus
  vaultMode: VaultViewMode;
  onChangeVaultMode: (mode: VaultViewMode) => void;
  focusedDocId: string | null;
  onFocusDoc: (docId: string | null) => void;
  cardSize: CardSize;
  onChangeCardSize: (size: CardSize) => void;

  // Multi-select
  selectedDocIds: Set<string>;
  isMultiSelectMode: boolean;
  onToggleMultiSelect: () => void;
  onSelectDoc: (doc: MostamsakDocument, isMulti: boolean) => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;

  // Document CRUD
  onAddDocument: () => void;
  onOpenCustomTemplate: () => void;
  onEditDocument: (doc: MostamsakDocument) => void;
  onUpdateDocument: (doc: MostamsakDocument) => Promise<void>;
  onDuplicateDocument: (doc: MostamsakDocument) => Promise<void>;
  onTrashDocument: (doc: MostamsakDocument) => Promise<void>;
  onToggleFavorite: (doc: MostamsakDocument, e?: React.MouseEvent) => Promise<void>;
  onDirectPrint: (doc: MostamsakDocument) => void;
  onBatchPrint: () => void;
  onBatchExport: () => void;
  onBatchArchive: () => Promise<void>;
  onBatchTrash: () => Promise<void>;

  // Trash actions
  isTrashView: boolean;
  onRestoreFromTrash: (docId: string) => Promise<void>;
  onRestoreAllTrash: () => Promise<void>;
  onPermanentDelete: (docId: string) => Promise<void>;
  onEmptyTrash: () => Promise<void>;

  // Group & context menus
  onCreateGroup: () => void;
  onGroupContextMenu: (e: React.MouseEvent, group: DocumentGroup) => void;
  onDocumentContextMenu: (e: React.MouseEvent, doc: MostamsakDocument) => void;
  activeGroup?: DocumentGroup;
  isActiveGroupLocked: boolean;
  onUnlockActiveGroup: (password: string) => Promise<string | null>;
}

export const VaultWorkspace: React.FC<VaultWorkspaceProps> = ({
  documents,
  groups,
  isLoading,
  sidebarFilter,
  onSelectSidebarFilter,
  sidebarCounts,
  storageUsedBytes,
  activeViewTitle,
  searchQuery,
  onSearchChange,
  typeFilter,
  onChangeTypeFilter,
  sortBy,
  onChangeSortBy,
  sortOrder,
  onToggleSortOrder,
  vaultMode,
  onChangeVaultMode,
  focusedDocId,
  onFocusDoc,
  cardSize,
  onChangeCardSize,
  selectedDocIds,
  isMultiSelectMode,
  onToggleMultiSelect,
  onSelectDoc,
  onSelectAll,
  onDeselectAll,
  onAddDocument,
  onOpenCustomTemplate,
  onEditDocument,
  onUpdateDocument,
  onDuplicateDocument,
  onTrashDocument,
  onToggleFavorite,
  onDirectPrint,
  onBatchPrint,
  onBatchExport,
  onBatchArchive,
  onBatchTrash,
  isTrashView,
  onRestoreFromTrash,
  onRestoreAllTrash,
  onPermanentDelete,
  onEmptyTrash,
  onCreateGroup,
  onGroupContextMenu,
  onDocumentContextMenu,
  activeGroup,
  isActiveGroupLocked,
  onUnlockActiveGroup,
}) => {
  const [showSidebar, setShowSidebar] = useState(true);
  const [confirmEmptyTrash, setConfirmEmptyTrash] = useState(false);
  const [confirmDeleteStageDoc, setConfirmDeleteStageDoc] = useState(false);

  // Locked group local state
  const [groupPassword, setGroupPassword] = useState('');
  const [groupUnlockError, setGroupUnlockError] = useState<string | null>(null);

  // Stage inspection state
  const [faceMode, setFaceMode] = useState<'front' | 'back' | 'both'>('front');
  const [stageZoom, setStageZoom] = useState<number>(1);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState('');
  const [notesDraft, setNotesDraft] = useState('');
  const [notesSavedToast, setNotesSavedToast] = useState(false);

  // Determine active document on the stage
  const stageDoc = useMemo(() => {
    if (documents.length === 0) return null;
    if (focusedDocId) {
      const found = documents.find((d) => d.id === focusedDocId);
      if (found) return found;
    }
    return documents[0];
  }, [documents, focusedDocId]);

  useEffect(() => {
    if (stageDoc) {
      setTitleDraft(stageDoc.title);
      setNotesDraft(stageDoc.notes || '');
      setIsEditingTitle(false);
      setConfirmDeleteStageDoc(false);
      setFaceMode((prev) => {
        if (stageDoc.sidesCount === 1 || !stageDoc.backImage) return 'front';
        return prev;
      });
    }
  }, [stageDoc?.id]);

  useEffect(() => {
    setGroupPassword('');
    setGroupUnlockError(null);
    setConfirmEmptyTrash(false);
  }, [sidebarFilter]);

  const activeStageGroup = useMemo(() => {
    if (!stageDoc?.groupId) return undefined;
    return groups.find((g) => g.id === stageDoc.groupId);
  }, [stageDoc, groups]);

  const hasActiveFilters = Boolean(searchQuery.trim()) || typeFilter !== 'all';

  const gridColumnsClass =
    cardSize === 'small'
      ? 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5'
      : cardSize === 'large'
      ? 'grid-cols-1 sm:grid-cols-2 xl:grid-cols-3'
      : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4';

  const handleSaveTitle = async () => {
    if (!stageDoc) return;
    const trimmed = titleDraft.trim();
    if (!trimmed || trimmed === stageDoc.title) {
      setTitleDraft(stageDoc.title);
      setIsEditingTitle(false);
      return;
    }
    await onUpdateDocument({ ...stageDoc, title: trimmed });
    setIsEditingTitle(false);
  };

  const handleSaveNotes = async () => {
    if (!stageDoc) return;
    if (notesDraft === (stageDoc.notes || '')) return;
    await onUpdateDocument({ ...stageDoc, notes: notesDraft.slice(0, 500) });
    setNotesSavedToast(true);
    setTimeout(() => setNotesSavedToast(false), 1800);
  };

  const handleDownloadPng = (doc: MostamsakDocument) => {
    const href =
      faceMode === 'back' && doc.backImage
        ? doc.backImage
        : doc.coverFace === 'back' && doc.backImage && faceMode !== 'front'
        ? doc.backImage
        : doc.frontImage;
    const link = document.createElement('a');
    link.download = `${doc.title}_${faceMode === 'back' ? 'back' : 'front'}_${doc.widthMm}x${doc.heightMm}mm.png`;
    link.href = href;
    link.click();
  };

  const handleUnlockSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const err = await onUnlockActiveGroup(groupPassword);
    if (err) {
      setGroupUnlockError(err);
    } else {
      setGroupPassword('');
      setGroupUnlockError(null);
    }
  };

  // Compute crisp specimen card frame pixel dimensions matching aspect ratio
  const getSpecimenFrameSize = (doc: MostamsakDocument, isDual: boolean) => {
    const baseMaxW = isDual ? 340 : 480;
    const baseMaxH = isDual ? 270 : 340;
    const ratio = doc.widthMm / Math.max(1, doc.heightMm);

    let w = baseMaxW;
    let h = w / ratio;
    if (h > baseMaxH) {
      h = baseMaxH;
      w = h * ratio;
    }
    return {
      width: Math.round(w * stageZoom),
      height: Math.round(h * stageZoom),
    };
  };

  const formatDateTime = (iso?: string) => {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('ar-IQ', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <div className="flex-1 flex min-h-0 overflow-hidden bg-slate-50/40">
      {/* 1. Collapsible Left/Right Groups & Smart Views Rail */}
      <DesktopSidebar
        currentFilter={sidebarFilter}
        onSelectFilter={(f) => {
          onSelectSidebarFilter(f);
          onFocusDoc(null);
        }}
        groups={groups}
        counts={sidebarCounts}
        onAddDocument={onAddDocument}
        onCreateGroup={onCreateGroup}
        onGroupContextMenu={onGroupContextMenu}
        storageUsedBytes={storageUsedBytes}
        isCollapsed={!showSidebar}
      />

      {/* 2. Main Vault Stage & Views Column */}
      <main className="flex-1 flex flex-col min-w-0 bg-white overflow-hidden">
        {/* Vault Command Strip */}
        <div className="h-12 px-4 bg-white border-b border-slate-200 flex items-center justify-between gap-3 shrink-0 overflow-x-auto">
          {/* Start Zone: Sidebar Toggle + Section Title + Selection/Trash Controls */}
          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => setShowSidebar((v) => !v)}
              className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-md cursor-pointer transition-colors"
              title={showSidebar ? 'إخفاء القائمة الجانبية' : 'إظهار القائمة الجانبية'}
            >
              {showSidebar ? <PanelRightClose className="w-4 h-4" /> : <PanelRightOpen className="w-4 h-4" />}
            </button>

            <div className="flex items-baseline gap-2">
              <h1 className="text-sm font-bold text-slate-900 whitespace-nowrap">{activeViewTitle}</h1>
              <span className="text-xs font-mono tabular-nums text-slate-500">
                ({isActiveGroupLocked ? 0 : documents.length})
              </span>
            </div>

            {isTrashView && documents.length > 0 && (
              <div className="flex items-center gap-1.5 pr-2 border-r border-slate-200">
                <button
                  type="button"
                  onClick={onRestoreAllTrash}
                  className="px-2.5 py-1 bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 rounded-md text-[11px] font-semibold flex items-center gap-1 cursor-pointer"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>استعادة الكل</span>
                </button>
                {confirmEmptyTrash ? (
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        onEmptyTrash();
                        setConfirmEmptyTrash(false);
                      }}
                      className="px-2.5 py-1 bg-red-600 hover:bg-red-700 text-white rounded-md text-[11px] font-bold cursor-pointer"
                    >
                      تأكيد الإفراغ
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmEmptyTrash(false)}
                      className="px-2 py-1 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded-md text-[11px] cursor-pointer"
                    >
                      إلغاء
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmEmptyTrash(true)}
                    className="px-2.5 py-1 bg-white hover:bg-red-50 text-red-700 border border-red-200 rounded-md text-[11px] font-semibold flex items-center gap-1 cursor-pointer"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>إفراغ السلة</span>
                  </button>
                )}
              </div>
            )}

            {!isTrashView && selectedDocIds.size > 0 && vaultMode !== 'stage' && (
              <div className="flex items-center gap-1.5 pr-2 border-r border-slate-200">
                <span className="text-[11px] font-semibold text-blue-700 font-mono tabular-nums">
                  {selectedDocIds.size} محدد
                </span>
                <button
                  type="button"
                  onClick={onBatchPrint}
                  className="px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                >
                  <Printer className="w-3 h-3" />
                  <span>طباعة</span>
                </button>
                <button
                  type="button"
                  onClick={onBatchExport}
                  className="px-2 py-1 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded-md text-[11px] font-semibold flex items-center gap-1 cursor-pointer"
                >
                  <Download className="w-3 h-3" />
                  <span>تصدير</span>
                </button>
                <button
                  type="button"
                  onClick={onBatchArchive}
                  className="px-2 py-1 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded-md text-[11px] font-semibold flex items-center gap-1 cursor-pointer"
                >
                  <Archive className="w-3 h-3" />
                  <span>أرشفة</span>
                </button>
                <button
                  type="button"
                  onClick={onBatchTrash}
                  className="px-2 py-1 bg-white hover:bg-red-50 text-red-700 border border-red-200 rounded-md text-[11px] font-semibold flex items-center gap-1 cursor-pointer"
                >
                  <Trash2 className="w-3 h-3" />
                  <span>للسلة</span>
                </button>
                <button
                  type="button"
                  onClick={onDeselectAll}
                  className="px-2 py-1 text-[11px] text-slate-500 hover:text-slate-900 cursor-pointer"
                >
                  إلغاء
                </button>
              </div>
            )}
          </div>

          {/* End Zone: Search, Filter, Sort, Custom Template, Mode Switcher */}
          <div className="flex items-center gap-2 shrink-0">
            <div className="relative w-44 sm:w-56">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                id="global-search-input"
                type="text"
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder="بحث (Ctrl+F)..."
                className="w-full bg-slate-50 focus:bg-white border border-slate-200 focus:border-blue-600 rounded-md pr-8 pl-2.5 py-1 text-xs text-slate-900 focus:outline-none"
              />
            </div>

            <select
              value={typeFilter}
              onChange={(e) => onChangeTypeFilter(e.target.value)}
              className="bg-white border border-slate-200 rounded-md px-2 py-1 text-xs text-slate-700 focus:border-blue-600 focus:outline-none cursor-pointer"
              title="تصفية حسب النوع"
            >
              <option value="all">كل الأنواع</option>
              {DOCUMENT_PRESETS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nameAr}
                </option>
              ))}
            </select>

            <div className="hidden lg:flex items-center border border-slate-200 rounded-md overflow-hidden bg-white">
              <select
                value={sortBy}
                onChange={(e) => onChangeSortBy(e.target.value as any)}
                className="px-2 py-1 text-xs text-slate-700 bg-transparent focus:outline-none cursor-pointer"
              >
                <option value="dateAdded">تاريخ الإضافة</option>
                <option value="dateModified">آخر تعديل</option>
                <option value="name">الاسم</option>
                <option value="type">النوع</option>
              </select>
              <button
                type="button"
                onClick={onToggleSortOrder}
                className="px-1.5 py-1 border-r border-slate-200 text-slate-600 hover:bg-slate-50 cursor-pointer"
                title={sortOrder === 'asc' ? 'تصاعدي' : 'تنازلي'}
              >
                <ArrowUpDown className="w-3.5 h-3.5" />
              </button>
            </div>

            {!isTrashView && (
              <button
                type="button"
                onClick={onOpenCustomTemplate}
                className="hidden xl:flex items-center gap-1 px-2.5 py-1 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-md text-xs font-semibold cursor-pointer"
                title="إنشاء مستمسك بمقاس مخصص"
              >
                <Ruler className="w-3.5 h-3.5 text-slate-500" />
                <span>مقاس مخصص</span>
              </button>
            )}

            {vaultMode !== 'stage' && !isTrashView && (
              <>
                <button
                  type="button"
                  onClick={onToggleMultiSelect}
                  className={`px-2 py-1 rounded-md border text-xs font-medium flex items-center gap-1 cursor-pointer ${
                    isMultiSelectMode
                      ? 'bg-blue-50 border-blue-200 text-blue-700'
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                  title="وضع التحديد المتعدد"
                >
                  <CheckSquare className="w-3.5 h-3.5" />
                </button>

                {vaultMode === 'grid' && (
                  <select
                    value={cardSize}
                    onChange={(e) => onChangeCardSize(e.target.value as CardSize)}
                    className="bg-white border border-slate-200 rounded-md px-2 py-1 text-xs text-slate-700 cursor-pointer"
                    title="حجم البطاقات"
                  >
                    <option value="small">مصغرة</option>
                    <option value="medium">قياسية</option>
                    <option value="large">مكبرة</option>
                  </select>
                )}
              </>
            )}

            {/* Studio Mode Segmented Control */}
            <div className="flex items-center bg-slate-100 p-0.5 rounded-md border border-slate-200">
              <button
                type="button"
                onClick={() => onChangeVaultMode('stage')}
                className={`px-2.5 py-1 rounded text-xs font-semibold flex items-center gap-1 cursor-pointer transition-colors ${
                  vaultMode === 'stage'
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Maximize className="w-3 h-3" />
                <span className="hidden sm:inline">منصة المعاينة</span>
              </button>
              <button
                type="button"
                onClick={() => onChangeVaultMode('grid')}
                className={`px-2.5 py-1 rounded text-xs font-semibold flex items-center gap-1 cursor-pointer transition-colors ${
                  vaultMode === 'grid'
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <LayoutGrid className="w-3 h-3" />
                <span className="hidden sm:inline">البطاقات</span>
              </button>
              <button
                type="button"
                onClick={() => onChangeVaultMode('table')}
                className={`px-2.5 py-1 rounded text-xs font-semibold flex items-center gap-1 cursor-pointer transition-colors ${
                  vaultMode === 'table'
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <TableIcon className="w-3 h-3" />
                <span className="hidden sm:inline">جدول المواصفات</span>
              </button>
            </div>
          </div>
        </div>

        {/* Workspace Canvas Body */}
        {isActiveGroupLocked && activeGroup ? (
          <div className="flex-1 flex items-center justify-center p-6 bg-slate-50/50">
            <form
              onSubmit={handleUnlockSubmit}
              className="w-full max-w-sm bg-white border border-slate-200 rounded-lg shadow-sm p-6 space-y-4 text-center"
            >
              <div className="w-11 h-11 mx-auto rounded-lg bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600">
                <Lock className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-900">مجموعة محمية: {activeGroup.name}</h2>
                <p className="text-xs text-slate-500 mt-1">
                  أدخل كلمة مرور المجموعة لعرض المستمسكات المخزنة بداخلها.
                </p>
              </div>
              <input
                type="password"
                value={groupPassword}
                onChange={(e) => {
                  setGroupPassword(e.target.value);
                  setGroupUnlockError(null);
                }}
                placeholder="كلمة مرور المجموعة"
                className="w-full bg-white border border-slate-300 rounded-md px-3 py-2 text-xs text-slate-900 text-center focus:border-blue-600 focus:outline-none"
                autoFocus
              />
              {groupUnlockError && (
                <div className="text-xs text-red-600 font-medium">{groupUnlockError}</div>
              )}
              <button
                type="submit"
                className="w-full py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-md text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>فتح المجموعة</span>
              </button>
            </form>
          </div>
        ) : isLoading ? (
          <div className="flex-1 overflow-y-auto p-5 bg-slate-50/50">
            <div className={`grid ${gridColumnsClass} gap-4`}>
              {Array.from({ length: 8 }).map((_, idx) => (
                <div
                  key={idx}
                  className="bg-white border border-slate-200 rounded-lg overflow-hidden animate-pulse"
                >
                  <div className="h-44 bg-slate-100 border-b border-slate-200" />
                  <div className="p-3 space-y-2">
                    <div className="h-3.5 bg-slate-200 rounded w-3/4" />
                    <div className="h-3 bg-slate-100 rounded w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : documents.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8 bg-slate-50/50">
            <div className="w-11 h-11 bg-white rounded-lg flex items-center justify-center mb-3 border border-slate-200 shadow-2xs">
              {hasActiveFilters ? (
                <SearchX className="w-5 h-5 text-slate-400" />
              ) : (
                <FilePlus className="w-5 h-5 text-slate-400" />
              )}
            </div>
            <h3 className="font-bold text-sm text-slate-900 mb-1">
              {isTrashView
                ? 'سلة المحذوفات فارغة'
                : hasActiveFilters
                ? 'لا توجد نتائج مطابقة'
                : 'لا توجد مستمسكات في هذا القسم'}
            </h3>
            <p className="text-xs text-slate-500 max-w-sm mb-4 leading-relaxed">
              {isTrashView
                ? 'جميع المستمسكات التي تنقلها إلى السلة ستظهر هنا لتتمكن من استعادتها أو حذفها نهائياً.'
                : hasActiveFilters
                ? 'جرّب تغيير كلمات البحث أو مسح تصفية نوع المستمسك لعرض جميع العناصر.'
                : 'أضف بطاقات الهوية، الجوازات، أو الوثائق الرسمية بالقياس الفيزيائي الحقيقي للطباعة والأرشفة.'}
            </p>
            {hasActiveFilters ? (
              <button
                type="button"
                onClick={() => {
                  onSearchChange('');
                  onChangeTypeFilter('all');
                }}
                className="px-4 py-1.5 bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 rounded-md text-xs font-semibold cursor-pointer"
              >
                مسح عوامل التصفية
              </button>
            ) : !isTrashView ? (
              <button
                type="button"
                onClick={onAddDocument}
                className="px-4 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-md text-xs font-bold cursor-pointer"
              >
                إضافة مستمسك جديد
              </button>
            ) : null}
          </div>
        ) : vaultMode === 'stage' && stageDoc ? (
          /* ================= MODE 1: STUDIO SPECIMEN STAGE (DEFAULT HERO VIEW) ================= */
          <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
            {/* Upper Split: Drafting Workbench + Inspector Rail */}
            <div className="flex-1 flex min-h-0 overflow-hidden">
              {/* Central Specimen Stage */}
              <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
                {/* Specimen Header Strip */}
                <div className="h-10 px-4 bg-white border-b border-slate-200 flex items-center justify-between gap-3 shrink-0">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-xs font-bold text-slate-900 truncate">{stageDoc.title}</span>
                    <span className="text-[11px] font-mono tabular-nums text-slate-500 whitespace-nowrap">
                      · {stageDoc.widthMm}×{stageDoc.heightMm} mm · {stageDoc.sidesCount === 2 ? 'وجهان' : 'وجه واحد'}
                      {activeStageGroup ? ` · ${activeStageGroup.name}` : ''}
                    </span>
                  </div>

                  {/* Face Switcher Segmented Control */}
                  <div className="flex items-center bg-slate-100 p-0.5 rounded-md border border-slate-200 shrink-0">
                    <button
                      type="button"
                      onClick={() => setFaceMode('front')}
                      className={`px-2.5 py-0.5 rounded text-[11px] font-semibold cursor-pointer ${
                        faceMode === 'front' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {stageDoc.frontLabel || 'الوجه الأمامي'}
                    </button>
                    {stageDoc.sidesCount === 2 && stageDoc.backImage && (
                      <>
                        <button
                          type="button"
                          onClick={() => setFaceMode('back')}
                          className={`px-2.5 py-0.5 rounded text-[11px] font-semibold cursor-pointer ${
                            faceMode === 'back' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          {stageDoc.backLabel || 'الوجه الخلفي'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setFaceMode('both')}
                          className={`px-2.5 py-0.5 rounded text-[11px] font-semibold cursor-pointer ${
                            faceMode === 'both' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          كلا الوجهين
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Drafting Surface (studio-stage-grid) */}
                <div
                  className="flex-1 overflow-auto studio-stage-grid flex items-center justify-center p-6 select-none"
                  onWheel={(e) => {
                    if (e.ctrlKey || e.metaKey) {
                      e.preventDefault();
                      setStageZoom((z) => Math.max(0.5, Math.min(2, Number((z + (e.deltaY < 0 ? 0.1 : -0.1)).toFixed(2)))));
                    }
                  }}
                >
                  {faceMode === 'both' && stageDoc.sidesCount === 2 && stageDoc.backImage ? (
                    <div className="flex flex-wrap items-center justify-center gap-6">
                      {[
                        { label: stageDoc.frontLabel || 'الوجه الأمامي', src: stageDoc.frontImage },
                        { label: stageDoc.backLabel || 'الوجه الخلفي', src: stageDoc.backImage },
                      ].map((item, idx) => {
                        const dims = getSpecimenFrameSize(stageDoc, true);
                        return (
                          <div key={idx} className="flex flex-col items-center gap-2">
                            <span className="text-[11px] font-semibold text-slate-600">{item.label}</span>
                            <div
                              style={{
                                width: `${dims.width}px`,
                                height: `${dims.height}px`,
                                borderRadius: `${Math.min(18, Math.max(4, (stageDoc.radiusMm || 2) * 2.5))}px`,
                              }}
                              className="bg-white border border-slate-300 shadow-md overflow-hidden flex items-center justify-center p-1"
                            >
                              <img
                                src={item.src}
                                alt={`${stageDoc.title} - ${item.label}`}
                                className="w-full h-full object-contain"
                                draggable={false}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    (() => {
                      const dims = getSpecimenFrameSize(stageDoc, false);
                      const src =
                        faceMode === 'back' && stageDoc.backImage
                          ? stageDoc.backImage
                          : stageDoc.frontImage;
                      return (
                        <div className="flex flex-col items-center gap-2.5">
                          <div
                            style={{
                              width: `${dims.width}px`,
                              height: `${dims.height}px`,
                              borderRadius: `${Math.min(20, Math.max(4, (stageDoc.radiusMm || 2) * 2.5))}px`,
                            }}
                            className="bg-white border border-slate-300 shadow-lg overflow-hidden flex items-center justify-center p-1.5 transition-all"
                          >
                            <img
                              src={src}
                              alt={stageDoc.title}
                              className="w-full h-full object-contain"
                              draggable={false}
                            />
                          </div>
                          <div className="text-[11px] font-mono tabular-nums text-slate-500">
                            {stageDoc.widthMm} × {stageDoc.heightMm} mm · R{stageDoc.radiusMm || 0}mm
                          </div>
                        </div>
                      );
                    })()
                  )}
                </div>

                {/* Anchored Precision Bottom Action Dock (mirrors AddDocumentModal dock) */}
                <div className="h-12 px-4 bg-white border-t border-slate-200 flex items-center justify-between gap-2 shrink-0 overflow-x-auto">
                  <div className="flex items-center gap-1.5 shrink-0">
                    {isTrashView ? (
                      <>
                        <button
                          type="button"
                          onClick={() => onRestoreFromTrash(stageDoc.id)}
                          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>استعادة المستمسك</span>
                        </button>
                        {confirmDeleteStageDoc ? (
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => {
                                onPermanentDelete(stageDoc.id);
                                setConfirmDeleteStageDoc(false);
                              }}
                              className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-md text-xs font-bold cursor-pointer"
                            >
                              تأكيد الحذف النهائي
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteStageDoc(false)}
                              className="px-2.5 py-1.5 bg-white border border-slate-300 text-slate-700 rounded-md text-xs cursor-pointer"
                            >
                              إلغاء
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteStageDoc(true)}
                            className="px-3 py-1.5 bg-white hover:bg-red-50 text-red-700 border border-red-200 rounded-md text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>حذف نهائي</span>
                          </button>
                        )}
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => onEditDocument(stageDoc)}
                          className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-md text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          <span>تعديل وقص في الاستوديو</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => onDirectPrint(stageDoc)}
                          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                        >
                          <Printer className="w-3.5 h-3.5" />
                          <span>طباعة فورية 1:1</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDownloadPng(stageDoc)}
                          className="px-2.5 py-1.5 bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 rounded-md text-xs font-semibold flex items-center gap-1 cursor-pointer"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>تنزيل PNG</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => onDuplicateDocument(stageDoc)}
                          className="px-2.5 py-1.5 bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 rounded-md text-xs font-semibold flex items-center gap-1 cursor-pointer"
                        >
                          <Copy className="w-3.5 h-3.5" />
                          <span>تكرار</span>
                        </button>

                        {stageDoc.sidesCount === 2 && stageDoc.backImage && (
                          <button
                            type="button"
                            onClick={() =>
                              onUpdateDocument({
                                ...stageDoc,
                                coverFace: stageDoc.coverFace === 'front' ? 'back' : 'front',
                              })
                            }
                            className="px-2.5 py-1.5 bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 rounded-md text-xs font-semibold flex items-center gap-1 cursor-pointer"
                            title="تغيير صورة الغلاف"
                          >
                            <FlipHorizontal className="w-3.5 h-3.5" />
                            <span>تبديل الغلاف</span>
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() =>
                            onUpdateDocument({ ...stageDoc, isArchived: !stageDoc.isArchived })
                          }
                          className="px-2.5 py-1.5 bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 rounded-md text-xs font-semibold flex items-center gap-1 cursor-pointer"
                        >
                          <Archive className="w-3.5 h-3.5" />
                          <span>{stageDoc.isArchived ? 'إلغاء الأرشفة' : 'أرشفة'}</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => onTrashDocument(stageDoc)}
                          className="px-2.5 py-1.5 bg-white hover:bg-red-50 text-red-700 border border-red-200 rounded-md text-xs font-semibold flex items-center gap-1 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>نقل للسلة</span>
                        </button>
                      </>
                    )}
                  </div>

                  {/* Zoom Controls */}
                  <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-md border border-slate-200 shrink-0">
                    <button
                      type="button"
                      onClick={() => setStageZoom((z) => Math.max(0.5, Number((z - 0.15).toFixed(2))))}
                      className="p-1 text-slate-600 hover:bg-white rounded cursor-pointer"
                      title="تصغير"
                    >
                      <ZoomOut className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setStageZoom(1)}
                      className="px-2 py-0.5 text-[11px] font-mono tabular-nums font-bold text-slate-800 hover:bg-white rounded cursor-pointer"
                      title="إعادة ضبط التكبير"
                    >
                      {Math.round(stageZoom * 100)}%
                    </button>
                    <button
                      type="button"
                      onClick={() => setStageZoom((z) => Math.min(2, Number((z + 0.15).toFixed(2))))}
                      className="p-1 text-slate-600 hover:bg-white rounded cursor-pointer"
                      title="تكبير"
                    >
                      <ZoomIn className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Right/Left Live Inspector Rail (matches AddDocumentModal properties rail) */}
              <aside className="hidden lg:flex w-76 bg-slate-50/70 border-r border-slate-200 flex-col shrink-0 overflow-y-auto">
                <div className="p-4 border-b border-slate-200 space-y-2.5 bg-white">
                  <div className="flex items-start justify-between gap-2">
                    {isEditingTitle ? (
                      <div className="flex-1 flex items-center gap-1">
                        <input
                          type="text"
                          value={titleDraft}
                          onChange={(e) => setTitleDraft(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSaveTitle();
                            if (e.key === 'Escape') {
                              setTitleDraft(stageDoc.title);
                              setIsEditingTitle(false);
                            }
                          }}
                          className="flex-1 bg-white border border-blue-600 rounded px-2 py-1 text-xs font-bold text-slate-900 focus:outline-none"
                          autoFocus
                        />
                        <button
                          type="button"
                          onClick={handleSaveTitle}
                          className="p-1 bg-blue-600 text-white rounded cursor-pointer"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setTitleDraft(stageDoc.title);
                            setIsEditingTitle(false);
                          }}
                          className="p-1 bg-slate-100 text-slate-600 rounded cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <>
                        <div className="min-w-0">
                          <h2 className="text-sm font-bold text-slate-900 leading-snug break-words">
                            {stageDoc.title}
                          </h2>
                          <p className="text-[11px] text-slate-500 mt-0.5">{stageDoc.typeName}</p>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => setIsEditingTitle(true)}
                            className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded cursor-pointer"
                            title="تعديل الاسم"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => onToggleFavorite(stageDoc, e)}
                            className={`p-1.5 rounded cursor-pointer ${
                              stageDoc.isFavorite
                                ? 'text-amber-500 bg-amber-50'
                                : 'text-slate-400 hover:text-amber-500 hover:bg-slate-100'
                            }`}
                            title={stageDoc.isFavorite ? 'إزالة من المفضلة' : 'إضافة للمفضلة'}
                          >
                            <Star className={`w-3.5 h-3.5 ${stageDoc.isFavorite ? 'fill-amber-500' : ''}`} />
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* Spec Grid */}
                <div className="p-4 border-b border-slate-200 space-y-3">
                  <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">
                    المواصفات الفيزيائية
                  </div>
                  <dl className="grid grid-cols-2 gap-x-3 gap-y-2.5 text-xs">
                    <div>
                      <dt className="text-[11px] text-slate-500">الأبعاد الفعلية</dt>
                      <dd className="font-mono tabular-nums font-bold text-slate-900">
                        {stageDoc.widthMm} × {stageDoc.heightMm} mm
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[11px] text-slate-500">الأوجه</dt>
                      <dd className="font-semibold text-slate-900">
                        {stageDoc.sidesCount === 2 ? 'وجهان' : 'وجه واحد'}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[11px] text-slate-500">استدارة الحواف</dt>
                      <dd className="font-mono tabular-nums font-semibold text-slate-900">
                        {stageDoc.radiusMm || 0} mm
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[11px] text-slate-500">التشفير</dt>
                      <dd className="font-semibold text-emerald-700 flex items-center gap-1">
                        <Shield className="w-3 h-3" />
                        <span>{stageDoc.isEncrypted ? 'AES-256' : 'قياسي'}</span>
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[11px] text-slate-500">تاريخ الإضافة</dt>
                      <dd className="font-mono tabular-nums text-[11px] text-slate-700">
                        {formatDateTime(stageDoc.createdAt)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[11px] text-slate-500">آخر تعديل</dt>
                      <dd className="font-mono tabular-nums text-[11px] text-slate-700">
                        {formatDateTime(stageDoc.updatedAt)}
                      </dd>
                    </div>
                  </dl>
                </div>

                {/* Group Assignment */}
                <div className="p-4 border-b border-slate-200 space-y-2">
                  <label className="block text-[11px] font-bold text-slate-500 uppercase">
                    المجموعة
                  </label>
                  <select
                    value={stageDoc.groupId || ''}
                    onChange={(e) =>
                      onUpdateDocument({
                        ...stageDoc,
                        groupId: e.target.value || undefined,
                      })
                    }
                    className="w-full bg-white border border-slate-300 rounded-md px-2.5 py-1.5 text-xs text-slate-900 focus:border-blue-600 focus:outline-none cursor-pointer"
                  >
                    <option value="">بدون مجموعة</option>
                    {groups.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Inline Editable Notes */}
                <div className="p-4 border-b border-slate-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-bold text-slate-500 uppercase">الملاحظات</label>
                    <span className="text-[10px] font-mono tabular-nums text-slate-400">
                      {notesDraft.length}/500
                    </span>
                  </div>
                  <textarea
                    value={notesDraft}
                    maxLength={500}
                    rows={3}
                    onChange={(e) => setNotesDraft(e.target.value)}
                    onBlur={handleSaveNotes}
                    placeholder="أضف ملاحظات رسمية، رقم القيد، تاريخ النفاذ..."
                    className="w-full bg-white border border-slate-300 rounded-md px-2.5 py-2 text-xs text-slate-800 focus:border-blue-600 focus:outline-none resize-none"
                  />
                  <div className="flex items-center justify-between">
                    {notesSavedToast ? (
                      <span className="text-[11px] text-emerald-700 font-medium">تم حفظ الملاحظة</span>
                    ) : (
                      <span />
                    )}
                    {notesDraft !== (stageDoc.notes || '') && (
                      <button
                        type="button"
                        onClick={handleSaveNotes}
                        className="px-2.5 py-1 bg-slate-900 text-white rounded text-[11px] font-semibold cursor-pointer"
                      >
                        حفظ الملاحظة
                      </button>
                    )}
                  </div>
                </div>

                {/* History Timeline */}
                <div className="p-4 space-y-2.5">
                  <div className="text-[11px] font-bold text-slate-500 uppercase">سجل الحركات</div>
                  <div className="space-y-2">
                    {(stageDoc.historyLogs || []).slice(-6).reverse().map((h) => (
                      <div key={h.id} className="text-xs border-r-2 border-slate-300 pr-2.5 py-0.5">
                        <div className="font-medium text-slate-800">{h.action}</div>
                        <div className="text-[10px] font-mono tabular-nums text-slate-400">
                          {new Date(h.timestamp).toLocaleString('ar-IQ', {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </aside>
            </div>

            {/* Bottom Interactive Filmstrip Switcher */}
            <div className="h-28 px-4 bg-white border-t border-slate-200 flex items-center gap-3 overflow-x-auto shrink-0">
              {!isTrashView && (
                <button
                  type="button"
                  onClick={onAddDocument}
                  className="w-24 h-20 rounded-md border border-dashed border-slate-300 hover:border-blue-600 hover:bg-blue-50/40 flex flex-col items-center justify-center gap-1 text-slate-500 hover:text-blue-700 shrink-0 cursor-pointer transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  <span className="text-[11px] font-semibold">إضافة</span>
                </button>
              )}

              {documents.map((doc) => {
                const isActive = stageDoc.id === doc.id;
                const thumbSrc =
                  doc.coverFace === 'back' && doc.backImage ? doc.backImage : doc.frontImage;
                return (
                  <button
                    key={doc.id}
                    type="button"
                    onClick={() => {
                      onFocusDoc(doc.id);
                      onSelectDoc(doc, false);
                    }}
                    onContextMenu={(e) => onDocumentContextMenu(e, doc)}
                    className={`w-40 h-20 rounded-md border p-1.5 flex items-center gap-2 text-right shrink-0 cursor-pointer transition-all ${
                      isActive
                        ? 'border-blue-600 ring-2 ring-blue-600/20 bg-blue-50/30'
                        : 'border-slate-200 hover:border-slate-300 bg-white'
                    }`}
                  >
                    <div className="w-16 h-full rounded bg-slate-100 border border-slate-200 overflow-hidden flex items-center justify-center shrink-0 p-0.5">
                      <img
                        src={thumbSrc}
                        alt={doc.title}
                        className="w-full h-full object-contain"
                        draggable={false}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-bold text-slate-900 truncate">{doc.title}</div>
                      <div className="text-[10px] text-slate-500 truncate">{doc.typeName}</div>
                      <div className="text-[10px] font-mono tabular-nums text-slate-400 mt-0.5">
                        {doc.widthMm}×{doc.heightMm}mm
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        ) : vaultMode === 'grid' ? (
          /* ================= MODE 2: CLEAN CARDS CATALOG GRID ================= */
          <div className="flex-1 overflow-y-auto p-5 bg-slate-50/50">
            <div className={`grid ${gridColumnsClass} gap-4`}>
              {documents.map((doc) => {
                const grp = groups.find((g) => g.id === doc.groupId);
                return (
                  <div key={doc.id} className="document-card-item">
                    <DocumentCard
                      document={doc}
                      groupName={grp?.name}
                      groupColor={grp?.color}
                      cardSize={cardSize}
                      isSelected={selectedDocIds.has(doc.id)}
                      isMultiSelectMode={isMultiSelectMode}
                      isTrashView={isTrashView}
                      onSelect={onSelectDoc}
                      onOpen={(d) => {
                        onFocusDoc(d.id);
                        onChangeVaultMode('stage');
                      }}
                      onEdit={onEditDocument}
                      onToggleFavorite={onToggleFavorite}
                      onContextMenu={onDocumentContextMenu}
                      onDirectPrint={onDirectPrint}
                      onRestore={onRestoreFromTrash}
                      onPermanentDelete={onPermanentDelete}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          /* ================= MODE 3: SPECIFICATION DATA TABLE ================= */
          <div className="flex-1 overflow-auto bg-white">
            <table className="w-full text-right border-collapse text-xs">
              <thead className="sticky top-0 bg-slate-50 border-b border-slate-200 z-10">
                <tr className="text-[11px] font-bold text-slate-600">
                  <th className="w-10 px-4 py-2.5 text-center">
                    <input
                      type="checkbox"
                      checked={documents.length > 0 && selectedDocIds.size === documents.length}
                      onChange={onSelectAll}
                      className="rounded border-slate-300 cursor-pointer"
                    />
                  </th>
                  <th className="px-3 py-2.5">المستمسك</th>
                  <th className="px-3 py-2.5">القياس (mm)</th>
                  <th className="px-3 py-2.5">الأوجه</th>
                  <th className="px-3 py-2.5">المجموعة</th>
                  <th className="px-3 py-2.5">آخر تعديل</th>
                  <th className="px-4 py-2.5 text-left">إجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {documents.map((doc) => {
                  const grp = groups.find((g) => g.id === doc.groupId);
                  const isSelected = selectedDocIds.has(doc.id);
                  const thumb =
                    doc.coverFace === 'back' && doc.backImage ? doc.backImage : doc.frontImage;
                  return (
                    <tr
                      key={doc.id}
                      onClick={(e) => onSelectDoc(doc, e.ctrlKey || e.metaKey)}
                      onDoubleClick={() => {
                        onFocusDoc(doc.id);
                        onChangeVaultMode('stage');
                      }}
                      onContextMenu={(e) => onDocumentContextMenu(e, doc)}
                      className={`h-12 cursor-pointer transition-colors ${
                        isSelected ? 'bg-blue-50/60' : 'hover:bg-slate-50'
                      }`}
                    >
                      <td
                        className="px-4 py-2 text-center"
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectDoc(doc, true);
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => {}}
                          className="rounded border-slate-300 cursor-pointer"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2.5">
                          <div className="w-10 h-7 rounded bg-slate-100 border border-slate-200 overflow-hidden flex items-center justify-center p-0.5 shrink-0">
                            <img
                              src={thumb}
                              alt={doc.title}
                              className="w-full h-full object-contain"
                              draggable={false}
                            />
                          </div>
                          <div className="min-w-0">
                            <div className="font-bold text-slate-900 truncate">{doc.title}</div>
                            <div className="text-[11px] text-slate-500 truncate">{doc.typeName}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-2 font-mono tabular-nums text-slate-700 whitespace-nowrap">
                        {doc.widthMm} × {doc.heightMm}
                      </td>
                      <td className="px-3 py-2 text-slate-700 whitespace-nowrap">
                        {doc.sidesCount === 2 ? 'وجهان' : 'وجه واحد'}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        {grp ? (
                          <span className="inline-flex items-center gap-1.5 text-slate-700">
                            <span
                              className="w-2 h-2 rounded-full"
                              style={{ backgroundColor: grp.color }}
                            />
                            <span>{grp.name}</span>
                          </span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2 font-mono tabular-nums text-slate-500 whitespace-nowrap">
                        {formatDateTime(doc.updatedAt || doc.createdAt)}
                      </td>
                      <td
                        className="px-4 py-2 text-left whitespace-nowrap"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="inline-flex items-center gap-1">
                          {isTrashView ? (
                            <>
                              <button
                                type="button"
                                onClick={() => onRestoreFromTrash(doc.id)}
                                className="p-1.5 text-blue-700 hover:bg-blue-50 rounded cursor-pointer"
                                title="استعادة"
                              >
                                <RotateCcw className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => onPermanentDelete(doc.id)}
                                className="p-1.5 text-red-600 hover:bg-red-50 rounded cursor-pointer"
                                title="حذف نهائي"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                type="button"
                                onClick={() => {
                                  onFocusDoc(doc.id);
                                  onChangeVaultMode('stage');
                                }}
                                className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded cursor-pointer"
                                title="معاينة في المنصة"
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => onEditDocument(doc)}
                                className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded cursor-pointer"
                                title="تعديل في الاستوديو"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => onDirectPrint(doc)}
                                className="p-1.5 text-blue-600 hover:bg-blue-50 rounded cursor-pointer"
                                title="طباعة 1:1"
                              >
                                <Printer className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => onTrashDocument(doc)}
                                className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded cursor-pointer"
                                title="نقل للسلة"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
};
