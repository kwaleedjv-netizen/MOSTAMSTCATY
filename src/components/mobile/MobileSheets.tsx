import React, { useState } from 'react';
import {
  ExternalLink,
  Edit3,
  Printer,
  Download,
  Star,
  RotateCcw,
  Copy,
  Scissors,
  Archive,
  Trash2,
  FolderInput,
  ChevronDown,
  ChevronLeft,
  Check,
  FilePlus,
  FolderPlus,
  Plus,
  Upload,
  Ruler,
  Clipboard,
  ShieldCheck,
  History,
  Settings,
  Lock,
  RefreshCw,
  Cloud,
  CloudCheck,
  CloudAlert,
  HelpCircle,
  Keyboard,
  Info,
  Database,
  FileText,
  Clock,
  Shield,
  SlidersHorizontal,
  CheckSquare,
  MoreHorizontal,
  Palette,
  Image as ImageIcon,
  AlertTriangle,
} from 'lucide-react';
import {
  MostamsakDocument,
  DocumentGroup,
  ViewMode,
  CardSize,
} from '../../types';
import { SidebarFilter } from '../DesktopSidebar';
import { VIEW_MODES, ViewModeIcon } from '../../constants/viewModes';
import { DOCUMENT_PRESETS } from '../../constants/presets';
import { SyncStatus } from '../../services/syncEngine';
import { GroupIcon } from '../GroupIcon';
import { MobileBottomSheet } from './MobileBottomSheet';

// ============================================================================
// 1. DOCUMENT ACTION SHEET (Touch Equivalent of ContextMenu + Document Menu)
// ============================================================================
interface MobileDocumentActionSheetProps {
  doc: MostamsakDocument | null;
  groups: DocumentGroup[];
  onClose: () => void;
  onOpenDetails: (doc: MostamsakDocument) => void;
  onEditInStudio: (doc: MostamsakDocument) => void;
  onPrint: (doc: MostamsakDocument) => void;
  onDownload: (doc: MostamsakDocument) => void;
  onDuplicate: (doc: MostamsakDocument) => void;
  onCopy: (doc: MostamsakDocument) => void;
  onCut: (doc: MostamsakDocument) => void;
  onToggleFavorite: (doc: MostamsakDocument) => void;
  onToggleCoverFace: (doc: MostamsakDocument) => void;
  onToggleArchive: (doc: MostamsakDocument) => void;
  onMoveToGroup: (doc: MostamsakDocument, groupId: string | undefined) => void;
  onTrash: (doc: MostamsakDocument) => void;
}

export const MobileDocumentActionSheet: React.FC<MobileDocumentActionSheetProps> = ({
  doc,
  groups,
  onClose,
  onOpenDetails,
  onEditInStudio,
  onPrint,
  onDownload,
  onDuplicate,
  onCopy,
  onCut,
  onToggleFavorite,
  onToggleCoverFace,
  onToggleArchive,
  onMoveToGroup,
  onTrash,
}) => {
  const [showGroupPicker, setShowGroupPicker] = useState(false);

  if (!doc) return null;

  const rowCls =
    'w-full min-h-[48px] px-4 py-2.5 flex items-center justify-between gap-3 text-right text-xs font-semibold text-slate-800 active:bg-slate-100 cursor-pointer transition-colors';

  return (
    <MobileBottomSheet
      isOpen={Boolean(doc)}
      onClose={() => {
        setShowGroupPicker(false);
        onClose();
      }}
      title={doc.title}
      subtitle={`${doc.typeName} · ${doc.widthMm} × ${doc.heightMm} mm`}
    >
      {/* Primary Quick Tiles */}
      <div className="p-3 grid grid-cols-4 gap-2 border-b border-slate-200 bg-slate-50/70">
        <button
          type="button"
          onClick={() => {
            onOpenDetails(doc);
            onClose();
          }}
          className="min-h-[60px] rounded-xl bg-white border border-slate-200 active:bg-slate-100 flex flex-col items-center justify-center gap-1 text-[11px] font-bold text-slate-800 cursor-pointer"
        >
          <ExternalLink className="w-4 h-4 text-blue-600" />
          <span>التفاصيل</span>
        </button>

        <button
          type="button"
          onClick={() => {
            onEditInStudio(doc);
            onClose();
          }}
          className="min-h-[60px] rounded-xl bg-white border border-slate-200 active:bg-slate-100 flex flex-col items-center justify-center gap-1 text-[11px] font-bold text-slate-800 cursor-pointer"
        >
          <Edit3 className="w-4 h-4 text-indigo-600" />
          <span>تعديل وقص</span>
        </button>

        <button
          type="button"
          onClick={() => {
            onPrint(doc);
            onClose();
          }}
          className="min-h-[60px] rounded-xl bg-blue-600 active:bg-blue-700 text-white flex flex-col items-center justify-center gap-1 text-[11px] font-bold cursor-pointer"
        >
          <Printer className="w-4 h-4" />
          <span>طباعة 1:1</span>
        </button>

        <button
          type="button"
          onClick={() => {
            onDownload(doc);
            onClose();
          }}
          className="min-h-[60px] rounded-xl bg-white border border-slate-200 active:bg-slate-100 flex flex-col items-center justify-center gap-1 text-[11px] font-bold text-slate-800 cursor-pointer"
        >
          <Download className="w-4 h-4 text-emerald-600" />
          <span>تنزيل</span>
        </button>
      </div>

      {/* Full Action List */}
      <div className="divide-y divide-slate-100 pb-safe">
        <button
          type="button"
          onClick={() => {
            onToggleFavorite(doc);
            onClose();
          }}
          className={rowCls}
        >
          <div className="flex items-center gap-3">
            <Star className={`w-4 h-4 text-amber-500 ${doc.isFavorite ? 'fill-amber-400' : ''}`} />
            <span>{doc.isFavorite ? 'إزالة من المفضلة' : 'إضافة إلى المفضلة'}</span>
          </div>
        </button>

        {doc.sidesCount === 2 && doc.backImage && (
          <button
            type="button"
            onClick={() => {
              onToggleCoverFace(doc);
              onClose();
            }}
            className={rowCls}
          >
            <div className="flex items-center gap-3">
              <RotateCcw className="w-4 h-4 text-slate-500" />
              <span>تبديل غلاف العرض (الأمامي / الخلفي)</span>
            </div>
          </button>
        )}

        <div>
          <button
            type="button"
            onClick={() => setShowGroupPicker((v) => !v)}
            className={rowCls}
          >
            <div className="flex items-center gap-3">
              <FolderInput className="w-4 h-4 text-blue-600" />
              <span>نقل إلى مجموعة</span>
            </div>
            <ChevronDown
              className={`w-4 h-4 text-slate-400 transition-transform ${
                showGroupPicker ? 'rotate-180' : ''
              }`}
            />
          </button>

          {showGroupPicker && (
            <div className="bg-slate-50 border-t border-slate-100 px-3 py-2 space-y-1">
              <button
                type="button"
                onClick={() => {
                  onMoveToGroup(doc, undefined);
                  setShowGroupPicker(false);
                  onClose();
                }}
                className={`w-full min-h-[44px] px-3 rounded-xl flex items-center justify-between text-xs cursor-pointer ${
                  !doc.groupId ? 'bg-blue-50 text-blue-700 font-bold' : 'bg-white text-slate-700'
                }`}
              >
                <span>بدون مجموعة</span>
                {!doc.groupId && <Check className="w-4 h-4 text-blue-600" />}
              </button>
              {groups.map((g) => (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => {
                    onMoveToGroup(doc, g.id);
                    setShowGroupPicker(false);
                    onClose();
                  }}
                  className={`w-full min-h-[44px] px-3 rounded-xl flex items-center justify-between text-xs cursor-pointer ${
                    doc.groupId === g.id ? 'bg-blue-50 text-blue-700 font-bold' : 'bg-white text-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-2 truncate">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: g.color }} />
                    <span className="truncate">{g.name}</span>
                  </div>
                  {doc.groupId === g.id && <Check className="w-4 h-4 text-blue-600" />}
                </button>
              ))}
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={() => {
            onDuplicate(doc);
            onClose();
          }}
          className={rowCls}
        >
          <div className="flex items-center gap-3">
            <Copy className="w-4 h-4 text-slate-500" />
            <span>إنشاء نسخة</span>
          </div>
        </button>

        <button
          type="button"
          onClick={() => {
            onCopy(doc);
            onClose();
          }}
          className={rowCls}
        >
          <div className="flex items-center gap-3">
            <Clipboard className="w-4 h-4 text-slate-500" />
            <span>نسخ إلى الحافظة الداخلية</span>
          </div>
        </button>

        <button
          type="button"
          onClick={() => {
            onCut(doc);
            onClose();
          }}
          className={rowCls}
        >
          <div className="flex items-center gap-3">
            <Scissors className="w-4 h-4 text-slate-500" />
            <span>قص المستمسك</span>
          </div>
        </button>

        <button
          type="button"
          onClick={() => {
            onToggleArchive(doc);
            onClose();
          }}
          className={rowCls}
        >
          <div className="flex items-center gap-3">
            <Archive className="w-4 h-4 text-slate-500" />
            <span>{doc.isArchived ? 'إلغاء الأرشفة' : 'نقل إلى الأرشيف'}</span>
          </div>
        </button>

        <button
          type="button"
          onClick={() => {
            onTrash(doc);
            onClose();
          }}
          className="w-full min-h-[48px] px-4 py-2.5 flex items-center gap-3 text-right text-xs font-bold text-red-600 active:bg-red-50 cursor-pointer"
        >
          <Trash2 className="w-4 h-4" />
          <span>نقل إلى سلة المحذوفات</span>
        </button>
      </div>
    </MobileBottomSheet>
  );
};

// ============================================================================
// 2. VIEW, SORT & TYPE FILTER SHEET
// ============================================================================
interface MobileViewSortSheetProps {
  isOpen: boolean;
  onClose: () => void;
  viewMode: ViewMode;
  onChangeViewMode: (mode: ViewMode) => void;
  cardSize: CardSize;
  onChangeCardSize: (size: CardSize) => void;
  sortBy: 'dateAdded' | 'dateModified' | 'name' | 'type';
  onChangeSortBy: (s: 'dateAdded' | 'dateModified' | 'name' | 'type') => void;
  sortOrder: 'asc' | 'desc';
  onToggleSortOrder: () => void;
  typeFilter: string;
  onChangeTypeFilter: (t: string) => void;
  isMultiSelectMode: boolean;
  onToggleMultiSelect: () => void;
  onSelectAll: () => void;
  onRefresh: () => void;
}

export const MobileViewSortSheet: React.FC<MobileViewSortSheetProps> = ({
  isOpen,
  onClose,
  viewMode,
  onChangeViewMode,
  cardSize,
  onChangeCardSize,
  sortBy,
  onChangeSortBy,
  sortOrder,
  onToggleSortOrder,
  typeFilter,
  onChangeTypeFilter,
  isMultiSelectMode,
  onToggleMultiSelect,
  onSelectAll,
  onRefresh,
}) => {
  return (
    <MobileBottomSheet isOpen={isOpen} onClose={onClose} title="العرض والترتيب والتصفية">
      <div className="px-4 pt-4 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] space-y-5 text-xs">
        {/* 10 View Modes */}
        <section className="space-y-2">
          <div className="font-bold text-slate-800">طريقة العرض (10 أنماط)</div>
          <div className="grid grid-cols-2 gap-2">
            {VIEW_MODES.map((m) => {
              const active = viewMode === m.id;
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => onChangeViewMode(m.id)}
                  className={`min-h-[44px] px-3 rounded-xl border flex items-center gap-2.5 cursor-pointer text-right transition-colors ${
                    active
                      ? 'bg-blue-50 border-blue-600 text-blue-700 font-bold'
                      : 'bg-white border-slate-200 text-slate-700 active:bg-slate-50'
                  }`}
                >
                  <ViewModeIcon mode={m.id} className={`w-4 h-4 shrink-0 ${active ? 'text-blue-600' : 'text-slate-500'}`} />
                  <span className="truncate">{m.label}</span>
                </button>
              );
            })}
          </div>
        </section>

        {/* Card Size */}
        <section className="space-y-2">
          <div className="font-bold text-slate-800">حجم البطاقات</div>
          <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-100 rounded-xl border border-slate-200">
            {(['small', 'medium', 'large'] as CardSize[]).map((sz) => (
              <button
                key={sz}
                type="button"
                onClick={() => onChangeCardSize(sz)}
                className={`min-h-[40px] rounded-lg font-semibold cursor-pointer transition-colors ${
                  cardSize === sz ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
                }`}
              >
                {sz === 'small' ? 'صغير' : sz === 'medium' ? 'متوسط' : 'كبير'}
              </button>
            ))}
          </div>
        </section>

        {/* Sort By + Order */}
        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-bold text-slate-800">ترتيب المستمسكات</span>
            <button
              type="button"
              onClick={onToggleSortOrder}
              className="min-h-[36px] px-3 rounded-lg bg-slate-100 text-slate-800 font-mono text-[11px] font-bold cursor-pointer"
            >
              {sortOrder === 'asc' ? '↑ تصاعدي' : '↓ تنازلي'}
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {[
              { id: 'dateAdded' as const, label: 'تاريخ الإضافة' },
              { id: 'dateModified' as const, label: 'تاريخ التعديل' },
              { id: 'name' as const, label: 'الاسم أبجدياً' },
              { id: 'type' as const, label: 'نوع المستمسك' },
            ].map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => onChangeSortBy(opt.id)}
                className={`min-h-[44px] px-3 rounded-xl border flex items-center justify-between cursor-pointer ${
                  sortBy === opt.id
                    ? 'bg-blue-50 border-blue-600 text-blue-700 font-bold'
                    : 'bg-white border-slate-200 text-slate-700'
                }`}
              >
                <span>{opt.label}</span>
                {sortBy === opt.id && <Check className="w-4 h-4 text-blue-600" />}
              </button>
            ))}
          </div>
        </section>

        {/* Type Filter */}
        <section className="space-y-2">
          <div className="font-bold text-slate-800">تصفية حسب نوع المستمسك</div>
          <select
            value={typeFilter}
            onChange={(e) => onChangeTypeFilter(e.target.value)}
            className="w-full min-h-[44px] bg-white border border-slate-300 rounded-xl px-3 text-xs font-medium text-slate-800 focus:border-blue-600 focus:outline-none"
          >
            <option value="all">جميع أنواع المستمسكات</option>
            {DOCUMENT_PRESETS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nameAr}
              </option>
            ))}
          </select>
        </section>

        {/* Selection & Refresh Utilities */}
        <section className="pt-2 border-t border-slate-200 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => {
              onToggleMultiSelect();
              onClose();
            }}
            className={`min-h-[46px] px-3 rounded-xl border flex items-center justify-center gap-2 font-semibold cursor-pointer ${
              isMultiSelectMode
                ? 'bg-blue-600 border-blue-600 text-white'
                : 'bg-white border-slate-300 text-slate-800'
            }`}
          >
            <CheckSquare className="w-4 h-4" />
            <span>{isMultiSelectMode ? 'إنهاء التحديد' : 'تحديد متعدد'}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              onSelectAll();
              onClose();
            }}
            className="min-h-[46px] px-3 rounded-xl border border-slate-300 bg-white text-slate-800 font-semibold flex items-center justify-center gap-2 cursor-pointer"
          >
            <Check className="w-4 h-4 text-blue-600" />
            <span>تحديد الكل</span>
          </button>

          <button
            type="button"
            onClick={() => {
              onRefresh();
              onClose();
            }}
            className="col-span-2 min-h-[44px] px-3 rounded-xl border border-slate-200 bg-slate-50 text-slate-700 font-semibold flex items-center justify-center gap-2 cursor-pointer"
          >
            <RefreshCw className="w-4 h-4 text-blue-600" />
            <span>تحديث القائمة والبيانات</span>
          </button>
        </section>
      </div>
    </MobileBottomSheet>
  );
};

// ============================================================================
// 3. GROUPS & SMART FOLDERS PAGE (Full Page View, No Popup)
// ============================================================================
interface MobileGroupsPageProps {
  currentFilter: SidebarFilter;
  onSelectFilter: (f: SidebarFilter) => void;
  onNavigateVault: () => void;
  groups: DocumentGroup[];
  counts: {
    all: number;
    favorites: number;
    recentAdded: number;
    recentModified: number;
    archived: number;
    trash: number;
    groupCounts: Record<string, number>;
  };
  onCreateGroup: () => void;
  onEditGroup: (g: DocumentGroup) => void;
  onAddDocToGroup: (g: DocumentGroup) => void;
  onPrintGroup: (g: DocumentGroup) => void;
  onToggleLockGroup: (g: DocumentGroup) => void;
  onDeleteGroup: (g: DocumentGroup) => void;
}

export const MobileGroupsPage: React.FC<MobileGroupsPageProps> = ({
  currentFilter,
  onSelectFilter,
  onNavigateVault,
  groups,
  counts,
  onCreateGroup,
  onEditGroup,
  onAddDocToGroup,
  onPrintGroup,
  onToggleLockGroup,
  onDeleteGroup,
}) => {
  const [actionGroup, setActionGroup] = useState<DocumentGroup | null>(null);
  const [isSmartListsOpen, setIsSmartListsOpen] = useState(false);

  const smartItems: Array<{
    id: SidebarFilter;
    label: string;
    count: number;
    icon: React.ComponentType<{ className?: string }>;
    danger?: boolean;
  }> = [
    { id: 'all', label: 'جميع المستمسكات', count: counts.all, icon: FileText },
    { id: 'favorites', label: 'المفضلة', count: counts.favorites, icon: Star },
    { id: 'recent_added', label: 'المضافة حديثاً', count: counts.recentAdded, icon: Clock },
    { id: 'recent_modified', label: 'المعدلة حديثاً', count: counts.recentModified, icon: Edit3 },
    { id: 'archived', label: 'الأرشيف', count: counts.archived, icon: Archive },
    { id: 'trash', label: 'سلة المحذوفات', count: counts.trash, icon: Trash2, danger: true },
  ];

  return (
    <div className="flex-1 min-h-0 flex flex-col bg-slate-50 overflow-hidden">
      <div className="flex-1 overflow-y-auto px-4 pb-4 pt-[calc(1rem+env(safe-area-inset-top,0px))] space-y-5 text-xs">
        {/* Custom Groups (2-column unlimited grid) */}
        <section className="space-y-2">
          {groups.length === 0 ? (
            <div className="p-6 text-center text-slate-400 bg-white rounded-2xl border border-dashed border-slate-200">
              لا توجد مجموعات مخصصة حتى الآن
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2.5">
              {groups.map((grp) => {
                const isActive = currentFilter === `group_${grp.id}`;
                const count = counts.groupCounts[grp.id] || 0;

                return (
                  <div
                    key={grp.id}
                    onClick={() => {
                      onSelectFilter(`group_${grp.id}`);
                      onNavigateVault();
                    }}
                    className={`bg-white border rounded-2xl p-3 flex flex-col justify-between gap-2.5 cursor-pointer active:bg-slate-50 transition-colors min-w-0 ${
                      isActive ? 'border-blue-600 ring-1 ring-blue-600/20 bg-blue-50/20' : 'border-slate-200'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1.5">
                      <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center shrink-0">
                        <GroupIcon icon={grp.icon} color="#2563eb" className="w-4 h-4" />
                      </div>

                      <div className="flex items-center gap-0.5 shrink-0">
                        {grp.isLocked && <Shield className="w-3.5 h-3.5 text-amber-500 shrink-0" />}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setActionGroup(grp);
                          }}
                          aria-label="إجراءات المجموعة"
                          className="min-w-[36px] min-h-[36px] -ml-1 rounded-xl text-slate-500 active:bg-slate-100 flex items-center justify-center cursor-pointer"
                        >
                          <MoreHorizontal className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    <div className="min-w-0 text-right">
                      <div className="font-bold text-xs text-slate-900 truncate">{grp.name}</div>
                      <div className="text-[11px] font-mono tabular-nums text-slate-500 mt-0.5">
                        {count} مستمسك
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Smart Lists (Collapsed by default on mobile) */}
        <section className="space-y-1.5">
          <button
            type="button"
            onClick={() => setIsSmartListsOpen((v) => !v)}
            aria-expanded={isSmartListsOpen}
            className="w-full min-h-[46px] px-3.5 bg-white border border-slate-200 rounded-2xl flex items-center justify-between gap-2 text-right cursor-pointer active:bg-slate-50 transition-colors"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <FileText className="w-4 h-4 text-blue-600 shrink-0" />
              <span className="font-bold text-slate-800 text-xs">القوائم الذكية</span>
              <span className="font-mono text-[11px] px-2 py-0.5 rounded-md bg-slate-100 text-slate-600">
                {smartItems.length}
              </span>
            </div>
            <ChevronDown
              className={`w-4 h-4 text-slate-500 shrink-0 transition-transform ${
                isSmartListsOpen ? 'rotate-180' : ''
              }`}
            />
          </button>

          {isSmartListsOpen && (
            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden divide-y divide-slate-100">
              {smartItems.map((item) => {
                const Icon = item.icon;
                const active = currentFilter === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      onSelectFilter(item.id);
                      onNavigateVault();
                    }}
                    className={`w-full min-h-[48px] px-3.5 flex items-center justify-between cursor-pointer ${
                      active ? 'bg-blue-50 text-blue-700 font-bold' : 'text-slate-800 active:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Icon className={`w-4 h-4 ${item.danger ? 'text-red-500' : 'text-blue-600'}`} />
                      <span className={item.danger && item.count > 0 ? 'text-red-600 font-bold' : ''}>
                        {item.label}
                      </span>
                    </div>
                    <span className="font-mono tabular-nums text-slate-400">{item.count}</span>
                  </button>
                );
              })}
            </div>
          )}
        </section>
      </div>

      <MobileBottomSheet
        isOpen={Boolean(actionGroup)}
        onClose={() => setActionGroup(null)}
        title={actionGroup?.name}
        subtitle={actionGroup ? `${counts.groupCounts[actionGroup.id] || 0} مستمسك` : undefined}
      >
        {actionGroup && (
          <div className="divide-y divide-slate-100 pb-safe text-xs">
            <button
              type="button"
              onClick={() => {
                onAddDocToGroup(actionGroup);
                setActionGroup(null);
              }}
              className="w-full min-h-[48px] px-4 flex items-center gap-3 text-right font-semibold text-blue-700 active:bg-slate-100 cursor-pointer"
            >
              <FilePlus className="w-4 h-4" />
              <span>إضافة مستمسك</span>
            </button>
            <button
              type="button"
              onClick={() => {
                onEditGroup(actionGroup);
                setActionGroup(null);
              }}
              className="w-full min-h-[48px] px-4 flex items-center gap-3 text-right font-semibold text-slate-800 active:bg-slate-100 cursor-pointer"
            >
              <Edit3 className="w-4 h-4 text-slate-600" />
              <span>تعديل المجموعة</span>
            </button>
            <button
              type="button"
              onClick={() => {
                onPrintGroup(actionGroup);
                setActionGroup(null);
              }}
              className="w-full min-h-[48px] px-4 flex items-center gap-3 text-right font-semibold text-slate-800 active:bg-slate-100 cursor-pointer"
            >
              <Printer className="w-4 h-4 text-slate-600" />
              <span>طباعة المجموعة</span>
            </button>
            <button
              type="button"
              onClick={() => {
                onToggleLockGroup(actionGroup);
                setActionGroup(null);
              }}
              className="w-full min-h-[48px] px-4 flex items-center gap-3 text-right font-semibold text-amber-700 active:bg-slate-100 cursor-pointer"
            >
              <Lock className="w-4 h-4" />
              <span>{actionGroup.isLocked ? 'إلغاء القفل' : 'قفل المجموعة'}</span>
            </button>
            <button
              type="button"
              onClick={() => {
                onDeleteGroup(actionGroup);
                setActionGroup(null);
              }}
              className="w-full min-h-[48px] px-4 flex items-center gap-3 text-right font-bold text-red-600 active:bg-red-50 cursor-pointer"
            >
              <Trash2 className="w-4 h-4" />
              <span>حذف المجموعة</span>
            </button>
          </div>
        )}
      </MobileBottomSheet>
    </div>
  );
};

// ============================================================================
// 4. QUICK ADD PAGE (+ Button Target - Full Page View, No Popup)
// ============================================================================
interface MobileQuickAddPageProps {
  onNewDocument: () => void;
  onImport: () => void;
  onCustomTemplate: () => void;
  onPaste: () => void;
  onNewGroup: () => void;
}

export const MobileQuickAddPage: React.FC<MobileQuickAddPageProps> = ({
  onNewDocument,
  onImport,
  onCustomTemplate,
  onPaste,
  onNewGroup,
}) => {
  return (
    <div className="flex-1 min-h-0 flex flex-col bg-slate-50 overflow-hidden">
      <header className="min-h-[50px] pt-safe px-4 bg-white border-b border-slate-200 flex items-center justify-between gap-2 shrink-0">
        <h1 className="font-bold text-sm text-slate-900">إضافة وإنشاء جديد</h1>
      </header>

      <div className="flex-1 overflow-y-auto p-4 space-y-3 text-xs">
        <button
          type="button"
          onClick={onNewDocument}
          className="w-full min-h-[68px] px-4 py-3 rounded-2xl bg-blue-600 active:bg-blue-700 text-white flex items-center justify-between cursor-pointer shadow-xs"
        >
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center shrink-0">
              <FilePlus className="w-5 h-5" />
            </div>
            <div className="text-right">
              <div className="font-bold text-sm">إضافة مستمسك قياسي</div>
              <div className="text-[11px] text-blue-100 mt-0.5">هوية، جواز، بطاقة سكن، أو تصوير بالكاميرا</div>
            </div>
          </div>
          <ChevronLeft className="w-4 h-4 opacity-80 shrink-0" />
        </button>

        <button
          type="button"
          onClick={onImport}
          className="w-full min-h-[64px] px-4 py-3 rounded-2xl bg-white border border-slate-200 active:bg-slate-50 text-slate-900 flex items-center justify-between cursor-pointer"
        >
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
              <Upload className="w-5 h-5" />
            </div>
            <div className="text-right">
              <div className="font-bold text-xs">استيراد دفعة صور وملفات</div>
              <div className="text-[11px] text-slate-500 mt-0.5">تحديد عدة صور وتصنيفها دفعة واحدة</div>
            </div>
          </div>
          <ChevronLeft className="w-4 h-4 text-slate-400 shrink-0" />
        </button>

        <button
          type="button"
          onClick={onCustomTemplate}
          className="w-full min-h-[64px] px-4 py-3 rounded-2xl bg-white border border-slate-200 active:bg-slate-50 text-slate-900 flex items-center justify-between cursor-pointer"
        >
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
              <Ruler className="w-5 h-5" />
            </div>
            <div className="text-right">
              <div className="font-bold text-xs">إنشاء قالب بمقاس مخصص</div>
              <div className="text-[11px] text-slate-500 mt-0.5">تحديد الأبعاد بالملم أو السنتيمتر أو البوصة</div>
            </div>
          </div>
          <ChevronLeft className="w-4 h-4 text-slate-400 shrink-0" />
        </button>

        <div className="grid grid-cols-2 gap-2.5 pt-1">
          <button
            type="button"
            onClick={onPaste}
            className="min-h-[56px] px-3 rounded-2xl bg-white border border-slate-200 active:bg-slate-50 text-slate-800 font-semibold flex items-center justify-center gap-2 cursor-pointer"
          >
            <Clipboard className="w-4 h-4 text-slate-600" />
            <span>لصق من الحافظة</span>
          </button>

          <button
            type="button"
            onClick={onNewGroup}
            className="min-h-[56px] px-3 rounded-2xl bg-white border border-slate-200 active:bg-slate-50 text-slate-800 font-semibold flex items-center justify-center gap-2 cursor-pointer"
          >
            <FolderPlus className="w-4 h-4 text-amber-500" />
            <span>مجموعة جديدة</span>
          </button>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// 5. FULL TOOLS, SETTINGS & HELP PAGE (Full Page View, No Popup)
// ============================================================================
interface MobileToolsHubPageProps {
  storageUsedBytes: number;
  trashCount: number;
  selectedCount: number;
  hasMasterPassword: boolean;
  syncStatus: SyncStatus;
  userEmail?: string | null;
  currentIp?: string | null;
  onManualSync: () => void;
  onLockVault: () => void;
  onOpenPrintStudio: () => void;
  onImport: () => void;
  onExportAll: () => void;
  onExportSelected: () => void;
  onBackup: () => void;
  onOpenTrash: () => void;
  onManageTemplates: () => void;
  onManageGroups: () => void;
  onOpenAuditLog: () => void;
  onPaste: () => void;
  onOpenSettingsTab: (tab: 'ui' | 'images' | 'storage' | 'security' | 'cloud' | 'reset') => void;
  onOpenUserGuide: () => void;
  onOpenShortcuts: () => void;
  onOpenAbout: () => void;
  onRefresh: () => void;
  onSignOutGoogle?: () => void;
}

export const MobileToolsHubPage: React.FC<MobileToolsHubPageProps> = ({
  storageUsedBytes,
  trashCount,
  selectedCount,
  hasMasterPassword,
  syncStatus,
  userEmail,
  currentIp,
  onManualSync,
  onLockVault,
  onOpenPrintStudio,
  onImport,
  onExportAll,
  onExportSelected,
  onBackup,
  onOpenTrash,
  onManageTemplates,
  onManageGroups,
  onOpenAuditLog,
  onPaste,
  onOpenSettingsTab,
  onOpenUserGuide,
  onOpenShortcuts,
  onOpenAbout,
  onRefresh,
  onSignOutGoogle,
}) => {
  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const itemCls =
    'w-full min-h-[48px] px-3.5 py-2 flex items-center justify-between gap-3 text-right text-xs font-semibold text-slate-800 active:bg-slate-100 cursor-pointer';

  return (
    <div className="flex-1 min-h-0 flex flex-col bg-slate-50 overflow-hidden">
      <header className="min-h-[50px] pt-safe px-4 bg-white border-b border-slate-200 flex items-center justify-between gap-2 shrink-0">
        <h1 className="font-bold text-sm text-slate-900">الأدوات والإعدادات الشاملة</h1>
      </header>

      <div className="flex-1 overflow-y-auto p-4 space-y-5 text-xs">
        {/* Google Account & IP Card */}
        {userEmail && (
          <section className="bg-white border border-slate-200 rounded-2xl p-3.5 space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="font-bold text-slate-900">حساب Google المتصل</div>
                <div className="text-[11px] font-mono text-blue-700 truncate mt-0.5">{userEmail}</div>
                {currentIp && (
                  <div className="text-[10px] text-slate-500 font-mono mt-0.5">IP: {currentIp}</div>
                )}
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => onOpenSettingsTab('cloud')}
                  className="min-h-[36px] px-3 bg-blue-50 text-blue-700 border border-blue-200 rounded-xl font-bold cursor-pointer"
                >
                  الأجهزة والـ IP
                </button>
                {onSignOutGoogle && (
                  <button
                    type="button"
                    onClick={onSignOutGoogle}
                    className="min-h-[36px] px-3 bg-red-50 text-red-600 border border-red-200 rounded-xl font-bold cursor-pointer"
                  >
                    خروج
                  </button>
                )}
              </div>
            </div>
          </section>
        )}

        {/* Storage & Cloud Sync Summary */}
        <section className="bg-white border border-slate-200 rounded-2xl p-3.5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Database className="w-4 h-4 text-blue-600" />
              <span className="font-bold text-slate-800">التخزين المحلي</span>
            </div>
            <span className="font-mono tabular-nums text-slate-600">{formatBytes(storageUsedBytes)}</span>
          </div>
          <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
            <div
              className="bg-blue-600 h-full rounded-full"
              style={{ width: `${Math.min(100, Math.max(4, (storageUsedBytes / (50 * 1024 * 1024)) * 100))}%` }}
            />
          </div>

          <div className="grid grid-cols-2 gap-2 pt-1">
            <button
              type="button"
              onClick={onManualSync}
              className="min-h-[44px] px-3 bg-slate-50 active:bg-slate-100 border border-slate-200 rounded-xl flex items-center justify-center gap-2 font-semibold text-slate-800 cursor-pointer"
            >
              {syncStatus.state === 'synced' ? (
                <CloudCheck className="w-4 h-4 text-emerald-600" />
              ) : syncStatus.state === 'syncing' ? (
                <RefreshCw className="w-4 h-4 text-blue-600 animate-spin" />
              ) : syncStatus.state === 'conflict' ? (
                <CloudAlert className="w-4 h-4 text-amber-600" />
              ) : (
                <Cloud className="w-4 h-4 text-slate-500" />
              )}
              <span>مزامنة فورية</span>
            </button>

            <button
              type="button"
              onClick={onLockVault}
              className="min-h-[44px] px-3 bg-slate-50 active:bg-slate-100 border border-slate-200 rounded-xl flex items-center justify-center gap-2 font-semibold text-amber-700 cursor-pointer"
            >
              <Lock className="w-4 h-4" />
              <span>{hasMasterPassword ? 'قفل الخزانة' : 'إعداد القفل'}</span>
            </button>
          </div>
        </section>

        {/* Core Tools */}
        <section className="space-y-1.5">
          <div className="font-bold text-slate-500 text-[11px] px-1">الأدوات والعمليات</div>
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden divide-y divide-slate-100">
            <button type="button" onClick={onOpenPrintStudio} className={itemCls}>
              <div className="flex items-center gap-3">
                <Printer className="w-4 h-4 text-blue-600" />
                <span>استوديو الطباعة 1:1</span>
              </div>
              <ChevronLeft className="w-4 h-4 text-slate-400" />
            </button>

            <button type="button" onClick={onBackup} className={itemCls}>
              <div className="flex items-center gap-3">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span>النسخ الاحتياطي والاستعادة المشفرة</span>
              </div>
              <ChevronLeft className="w-4 h-4 text-slate-400" />
            </button>

            <button type="button" onClick={onImport} className={itemCls}>
              <div className="flex items-center gap-3">
                <Upload className="w-4 h-4 text-slate-600" />
                <span>استيراد ملفات وصور</span>
              </div>
              <ChevronLeft className="w-4 h-4 text-slate-400" />
            </button>

            <button type="button" onClick={onExportAll} className={itemCls}>
              <div className="flex items-center gap-3">
                <Download className="w-4 h-4 text-slate-600" />
                <span>تصدير الكل</span>
              </div>
              <ChevronLeft className="w-4 h-4 text-slate-400" />
            </button>

            {selectedCount > 0 && (
              <button type="button" onClick={onExportSelected} className={itemCls}>
                <div className="flex items-center gap-3">
                  <Download className="w-4 h-4 text-blue-600" />
                  <span>تصدير المحدد ({selectedCount})</span>
                </div>
                <ChevronLeft className="w-4 h-4 text-slate-400" />
              </button>
            )}

            <button type="button" onClick={onPaste} className={itemCls}>
              <div className="flex items-center gap-3">
                <Clipboard className="w-4 h-4 text-slate-600" />
                <span>لصق صورة من الحافظة</span>
              </div>
              <ChevronLeft className="w-4 h-4 text-slate-400" />
            </button>

            <button type="button" onClick={onManageTemplates} className={itemCls}>
              <div className="flex items-center gap-3">
                <Ruler className="w-4 h-4 text-slate-600" />
                <span>إدارة القياسات والقوالب المخصصة</span>
              </div>
              <ChevronLeft className="w-4 h-4 text-slate-400" />
            </button>

            <button type="button" onClick={onManageGroups} className={itemCls}>
              <div className="flex items-center gap-3">
                <FolderPlus className="w-4 h-4 text-amber-500" />
                <span>إدارة المجموعات</span>
              </div>
              <ChevronLeft className="w-4 h-4 text-slate-400" />
            </button>

            <button type="button" onClick={onOpenAuditLog} className={itemCls}>
              <div className="flex items-center gap-3">
                <History className="w-4 h-4 text-slate-600" />
                <span>سجل العمليات</span>
              </div>
              <ChevronLeft className="w-4 h-4 text-slate-400" />
            </button>

            <button type="button" onClick={onOpenTrash} className={itemCls}>
              <div className="flex items-center gap-3">
                <Trash2 className="w-4 h-4 text-red-500" />
                <span>سلة المحذوفات</span>
              </div>
              <span className="font-mono tabular-nums text-slate-500">{trashCount}</span>
            </button>
          </div>
        </section>

        {/* Settings Direct Sections */}
        <section className="space-y-1.5">
          <div className="font-bold text-slate-500 text-[11px] px-1">الإعدادات</div>
          <div className="grid grid-cols-2 gap-2">
            {[
              { id: 'ui' as const, label: 'الواجهة', icon: Palette },
              { id: 'images' as const, label: 'الصور والطباعة', icon: ImageIcon },
              { id: 'storage' as const, label: 'التخزين', icon: Database },
              { id: 'security' as const, label: 'الأمان والتشفير', icon: Shield },
              { id: 'cloud' as const, label: 'المزامنة السحابية', icon: Cloud },
              { id: 'reset' as const, label: 'ضبط المصنع', icon: AlertTriangle, danger: true },
            ].map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => onOpenSettingsTab(tab.id)}
                  className={`min-h-[46px] px-3 rounded-xl border bg-white flex items-center gap-2 cursor-pointer ${
                    tab.danger
                      ? 'border-red-200 text-red-600'
                      : 'border-slate-200 text-slate-800 active:bg-slate-50'
                  }`}
                >
                  <Icon className={`w-4 h-4 shrink-0 ${tab.danger ? 'text-red-500' : 'text-blue-600'}`} />
                  <span className="font-semibold truncate">{tab.label}</span>
                </button>
              );
            })}
          </div>
        </section>

        {/* Help & Info */}
        <section className="space-y-1.5">
          <div className="font-bold text-slate-500 text-[11px] px-1">المساعدة والنظام</div>
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden divide-y divide-slate-100">
            <button type="button" onClick={onOpenUserGuide} className={itemCls}>
              <div className="flex items-center gap-3">
                <HelpCircle className="w-4 h-4 text-blue-600" />
                <span>دليل الاستخدام</span>
              </div>
              <ChevronLeft className="w-4 h-4 text-slate-400" />
            </button>
            <button type="button" onClick={onOpenShortcuts} className={itemCls}>
              <div className="flex items-center gap-3">
                <Keyboard className="w-4 h-4 text-slate-600" />
                <span>اختصارات لوحة المفاتيح</span>
              </div>
              <ChevronLeft className="w-4 h-4 text-slate-400" />
            </button>
            <button type="button" onClick={onOpenAbout} className={itemCls}>
              <div className="flex items-center gap-3">
                <Info className="w-4 h-4 text-slate-600" />
                <span>حول مستمسكاتي</span>
              </div>
              <ChevronLeft className="w-4 h-4 text-slate-400" />
            </button>
            <button type="button" onClick={onRefresh} className={itemCls}>
              <div className="flex items-center gap-3">
                <RefreshCw className="w-4 h-4 text-slate-600" />
                <span>تحديث البيانات</span>
              </div>
            </button>
          </div>
        </section>
      </div>
    </div>
  );
};
