import React, { useState, useEffect, useRef } from 'react';
import {
  Search,
  X,
  Cloud,
  CloudCheck,
  CloudAlert,
  RefreshCw,
  Lock,
  LayoutGrid,
  Layers,
  Plus,
  Printer,
  Menu,
  FilePlus,
  Upload,
  CheckSquare,
  Download,
  Archive,
  Trash2,
  Clipboard,
  ChevronDown,
  Check,
} from 'lucide-react';
import {
  MostamsakDocument,
  DocumentGroup,
  ViewMode,
  CardSize,
} from '../../types';
import { SidebarFilter } from '../DesktopSidebar';
import { SyncStatus } from '../../services/syncEngine';
import { useLayoutMode } from '../../hooks/useViewportMode';
import { MobileDocumentViews } from './MobileDocumentViews';
import {
  MobileDocumentActionSheet,
  MobileGroupsPage,
  MobileQuickAddPage,
  MobileToolsHubPage,
} from './MobileSheets';

interface MobileShellProps {
  documents: MostamsakDocument[];
  allDocumentsCount: number;
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

  // Search, Filter, Sort, View
  searchQuery: string;
  onSearchChange: (q: string) => void;
  sidebarFilter: SidebarFilter;
  onSelectFilter: (f: SidebarFilter) => void;
  typeFilter: string;
  onChangeTypeFilter: (t: string) => void;
  sortBy: 'dateAdded' | 'dateModified' | 'name' | 'type';
  onChangeSortBy: (s: 'dateAdded' | 'dateModified' | 'name' | 'type') => void;
  sortOrder: 'asc' | 'desc';
  onToggleSortOrder: () => void;
  viewMode: ViewMode;
  onChangeViewMode: (m: ViewMode) => void;
  cardSize: CardSize;
  onChangeCardSize: (s: CardSize) => void;

  // Selection
  selectedDocIds: Set<string>;
  isMultiSelectMode: boolean;
  onToggleMultiSelect: () => void;
  onSelectDoc: (doc: MostamsakDocument, isMulti: boolean) => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;

  // Clipboard & System
  hasClipboardDoc: boolean;
  storageUsedBytes: number;
  syncStatus: SyncStatus;
  hasMasterPassword: boolean;
  userEmail?: string | null;
  currentIp?: string | null;
  onManualSync: () => void;
  onLockVault: () => void;
  onRefresh: () => void;
  onSignOutGoogle?: () => void;

  // Document Actions
  onOpenDoc: (doc: MostamsakDocument) => void;
  onEditDocInStudio: (doc: MostamsakDocument) => void;
  onDirectPrint: (doc: MostamsakDocument) => void;
  onDownloadDoc: (doc: MostamsakDocument) => void;
  onDuplicateDoc: (doc: MostamsakDocument) => void;
  onCopyDoc: (doc: MostamsakDocument) => void;
  onCutDoc: (doc: MostamsakDocument) => void;
  onToggleFavorite: (doc: MostamsakDocument, e?: React.MouseEvent) => void;
  onToggleCoverFace: (doc: MostamsakDocument) => void;
  onToggleArchive: (doc: MostamsakDocument) => void;
  onMoveToGroup: (doc: MostamsakDocument, groupId: string | undefined) => void;
  onTrashDoc: (doc: MostamsakDocument) => void;
  onBatchTrash: () => void;
  onBatchArchive: () => void;
  onExportSelected: () => void;
  onExportAll: () => void;

  // Group Actions
  onCreateGroup: () => void;
  onEditGroup: (g: DocumentGroup) => void;
  onAddDocToGroup: (g: DocumentGroup) => void;
  onPrintGroup: (g: DocumentGroup) => void;
  onToggleLockGroup: (g: DocumentGroup) => void;
  onDeleteGroup: (g: DocumentGroup) => void;

  // Workspace / Modals
  onNewDocument: () => void;
  onImport: () => void;
  onCustomTemplate: () => void;
  onPaste: () => void;
  onOpenPrintStudio: () => void;
  onBackup: () => void;
  onOpenTrash: () => void;
  onManageTemplates: () => void;
  onManageGroups: () => void;
  onOpenAuditLog: () => void;
  onOpenSettingsTab: (tab: 'ui' | 'images' | 'storage' | 'security' | 'cloud' | 'reset') => void;
  onOpenUserGuide: () => void;
  onOpenShortcuts: () => void;
  onOpenAbout: () => void;
}

export const MobileShell: React.FC<MobileShellProps> = ({
  documents,
  groups,
  counts,
  searchQuery,
  onSearchChange,
  sidebarFilter,
  onSelectFilter,
  typeFilter,
  onChangeTypeFilter,
  sortBy,
  onChangeSortBy,
  sortOrder,
  onToggleSortOrder,
  viewMode: _viewMode,
  onChangeViewMode: _onChangeViewMode,
  cardSize,
  onChangeCardSize,
  selectedDocIds,
  isMultiSelectMode,
  onToggleMultiSelect,
  onSelectDoc,
  onSelectAll,
  onDeselectAll,
  hasClipboardDoc,
  storageUsedBytes,
  syncStatus,
  hasMasterPassword,
  userEmail,
  currentIp,
  onManualSync,
  onLockVault,
  onRefresh,
  onSignOutGoogle,
  onOpenDoc,
  onEditDocInStudio,
  onDirectPrint,
  onDownloadDoc,
  onDuplicateDoc,
  onCopyDoc,
  onCutDoc,
  onToggleFavorite,
  onToggleCoverFace,
  onToggleArchive,
  onMoveToGroup,
  onTrashDoc,
  onBatchTrash,
  onBatchArchive,
  onExportSelected,
  onExportAll,
  onCreateGroup,
  onEditGroup,
  onAddDocToGroup,
  onPrintGroup,
  onToggleLockGroup,
  onDeleteGroup,
  onNewDocument,
  onImport,
  onCustomTemplate,
  onPaste,
  onOpenPrintStudio,
  onBackup,
  onOpenTrash,
  onManageTemplates,
  onManageGroups,
  onOpenAuditLog,
  onOpenSettingsTab,
  onOpenUserGuide,
  onOpenShortcuts,
  onOpenAbout,
}) => {
  const { isLandscape, height } = useLayoutMode();
  const useLandscapeRail = isLandscape && height < 540;

  // Mobile Page Routing & Local Controls
  const [activePage, setActivePage] = useState<'vault' | 'groups' | 'add' | 'tools'>('vault');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isFilterDropdownOpen, setIsFilterDropdownOpen] = useState(false);
  const filterDropdownRef = useRef<HTMLDivElement>(null);
  const [actionSheetDoc, setActionSheetDoc] = useState<MostamsakDocument | null>(null);

  useEffect(() => {
    if (!isFilterDropdownOpen) return;
    const handleOutside = (e: PointerEvent) => {
      if (filterDropdownRef.current && !filterDropdownRef.current.contains(e.target as Node)) {
        setIsFilterDropdownOpen(false);
      }
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsFilterDropdownOpen(false);
    };
    window.addEventListener('pointerdown', handleOutside);
    window.addEventListener('keydown', handleEscape);
    return () => {
      window.removeEventListener('pointerdown', handleOutside);
      window.removeEventListener('keydown', handleEscape);
    };
  }, [isFilterDropdownOpen]);

  const currentFilterTitle = (() => {
    if (sidebarFilter === 'all') return 'مستمسكاتي';
    if (sidebarFilter === 'favorites') return 'المفضلة';
    if (sidebarFilter === 'recent_added') return 'المضافة حديثاً';
    if (sidebarFilter === 'recent_modified') return 'المعدلة حديثاً';
    if (sidebarFilter === 'archived') return 'الأرشيف';
    if (sidebarFilter === 'trash') return 'سلة المحذوفات';
    if (sidebarFilter.startsWith('group_')) {
      const id = sidebarFilter.replace('group_', '');
      return groups.find((g) => g.id === id)?.name || 'مجموعة';
    }
    return 'مستمسكاتي';
  })();

  const showBulkBar = isMultiSelectMode || selectedDocIds.size > 0;

  const renderSyncIcon = () => {
    if (syncStatus.state === 'syncing') {
      return <RefreshCw className="w-5 h-5 text-blue-600 animate-spin" />;
    }
    if (syncStatus.state === 'synced') {
      return <CloudCheck className="w-5 h-5 text-emerald-600" />;
    }
    if (syncStatus.state === 'conflict' || syncStatus.state === 'error') {
      return <CloudAlert className="w-5 h-5 text-amber-600" />;
    }
    return <Cloud className="w-5 h-5" />;
  };

  return (
    <div
      className="flex min-h-[100dvh] w-full bg-slate-50 text-slate-900 select-none font-['Cairo',system-ui,sans-serif]"
      style={{ touchAction: 'pan-x pan-y pinch-zoom' }}
      dir="rtl"
    >
      {/* Compact Landscape Right Rail (RTL start side) */}
      {useLandscapeRail && (
        <aside className="sticky top-0 h-[100dvh] self-start w-[68px] bg-white border-l border-slate-200 flex flex-col items-center justify-between py-2 px-1 shrink-0 z-30">
          <button
            type="button"
            onClick={() => setActivePage('vault')}
            className={`w-full min-h-[48px] rounded-xl flex flex-col items-center justify-center gap-0.5 cursor-pointer ${
              activePage === 'vault' ? 'bg-blue-50 text-blue-600 font-bold' : 'text-slate-600'
            }`}
          >
            <LayoutGrid className="w-5 h-5" />
            <span className="text-[10px]">الخزانة</span>
          </button>

          <button
            type="button"
            onClick={() => setActivePage('groups')}
            className={`w-full min-h-[48px] rounded-xl flex flex-col items-center justify-center gap-0.5 cursor-pointer ${
              activePage === 'groups' ? 'bg-blue-50 text-blue-600 font-bold' : 'text-slate-600'
            }`}
          >
            <Layers className="w-5 h-5" />
            <span className="text-[10px]">المجموعات</span>
          </button>

          <button
            type="button"
            onClick={() => setActivePage('add')}
            aria-label="إضافة جديد"
            className={`w-12 h-11 rounded-2xl text-white shadow-sm flex items-center justify-center cursor-pointer ${
              activePage === 'add' ? 'bg-blue-700 ring-2 ring-blue-200' : 'bg-blue-600 active:bg-blue-700'
            }`}
          >
            <Plus className="w-5 h-5" />
          </button>

          <button
            type="button"
            onClick={onOpenPrintStudio}
            className="w-full min-h-[48px] rounded-xl text-slate-600 active:bg-slate-100 flex flex-col items-center justify-center gap-0.5 cursor-pointer"
          >
            <Printer className="w-5 h-5" />
            <span className="text-[10px]">الطباعة</span>
          </button>

          <button
            type="button"
            onClick={() => setActivePage('tools')}
            className={`w-full min-h-[48px] rounded-xl flex flex-col items-center justify-center gap-0.5 cursor-pointer ${
              activePage === 'tools' ? 'bg-blue-50 text-blue-600 font-bold' : 'text-slate-600'
            }`}
          >
            <Menu className="w-5 h-5" />
            <span className="text-[10px]">الأدوات</span>
          </button>
        </aside>
      )}

      {/* Main Column */}
      <div className="flex-1 flex flex-col min-w-0 min-h-[100dvh]">
        {activePage === 'groups' ? (
          <MobileGroupsPage
            currentFilter={sidebarFilter}
            onSelectFilter={(f) => {
              onSelectFilter(f);
              onDeselectAll();
            }}
            onNavigateVault={() => setActivePage('vault')}
            groups={groups}
            counts={counts}
            onCreateGroup={onCreateGroup}
            onEditGroup={onEditGroup}
            onAddDocToGroup={onAddDocToGroup}
            onPrintGroup={onPrintGroup}
            onToggleLockGroup={onToggleLockGroup}
            onDeleteGroup={onDeleteGroup}
          />
        ) : activePage === 'add' ? (
          <MobileQuickAddPage
            onNewDocument={onNewDocument}
            onImport={onImport}
            onCustomTemplate={onCustomTemplate}
            onPaste={onPaste}
            onNewGroup={onCreateGroup}
          />
        ) : activePage === 'tools' ? (
          <MobileToolsHubPage
            storageUsedBytes={storageUsedBytes}
            trashCount={counts.trash}
            selectedCount={selectedDocIds.size}
            hasMasterPassword={hasMasterPassword}
            syncStatus={syncStatus}
            userEmail={userEmail}
            currentIp={currentIp}
            onManualSync={onManualSync}
            onLockVault={onLockVault}
            onOpenPrintStudio={onOpenPrintStudio}
            onImport={onImport}
            onExportAll={onExportAll}
            onExportSelected={onExportSelected}
            onBackup={onBackup}
            onOpenTrash={onOpenTrash}
            onManageTemplates={onManageTemplates}
            onManageGroups={onManageGroups}
            onOpenAuditLog={onOpenAuditLog}
            onPaste={onPaste}
            onOpenSettingsTab={onOpenSettingsTab}
            onOpenUserGuide={onOpenUserGuide}
            onOpenShortcuts={onOpenShortcuts}
            onOpenAbout={onOpenAbout}
            onRefresh={onRefresh}
            onSignOutGoogle={onSignOutGoogle}
          />
        ) : (
          <>
            {/* 1. Compact Sticky Top Bar (only when lock button is active) */}
            {hasMasterPassword && (
              <header
                className={`sticky top-0 bg-white border-b border-slate-200 px-3 flex items-center justify-end gap-2 shrink-0 z-30 ${
                  useLandscapeRail ? 'min-h-[44px]' : 'min-h-[50px] pt-safe'
                }`}
              >
                <div className="flex items-center gap-0.5 shrink-0">
                  <button
                    type="button"
                    onClick={onLockVault}
                    aria-label="قفل الخزانة"
                    className="min-w-[42px] min-h-[42px] rounded-xl flex items-center justify-center text-amber-600 active:bg-amber-50 cursor-pointer"
                  >
                    <Lock className="w-[18px] h-[18px]" />
                  </button>
                </div>
              </header>
            )}

        {/* 2. Collapsible Search Input */}
        {(isSearchOpen || searchQuery.length > 0) && (
          <div className="sticky top-0 bg-white border-b border-slate-200 px-3 py-2 shrink-0 z-25">
            <div className="relative flex items-center">
              <Search className="w-4 h-4 text-slate-400 absolute right-3 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder="ابحث بالاسم، النوع، الملاحظات، أو المجموعة..."
                autoFocus={isSearchOpen}
                className="w-full min-h-[42px] bg-slate-100 border border-slate-200 focus:border-blue-600 focus:bg-white rounded-xl pr-9 pl-10 text-xs text-slate-900 focus:outline-none"
              />
              {(searchQuery || isSearchOpen) && (
                <button
                  type="button"
                  onClick={() => {
                    onSearchChange('');
                    setIsSearchOpen(false);
                  }}
                  aria-label="مسح وإغلاق البحث"
                  className="absolute left-1 min-w-[36px] min-h-[36px] rounded-lg flex items-center justify-center text-slate-500 active:bg-slate-200 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        )}

        {/* 3. Mobile Dropdown Filter Menu */}
        {!useLandscapeRail && (
          <div
            ref={filterDropdownRef}
            className="sticky top-0 bg-white border-b border-slate-200/80 px-3 py-1.5 shrink-0 z-20"
          >
            {(() => {
              const quickFilters: { id: SidebarFilter; label: string; count: number; color?: string }[] = [
                { id: 'all', label: 'الكل', count: counts.all },
                { id: 'favorites', label: 'المفضلة', count: counts.favorites },
                { id: 'recent_added', label: 'الأحدث', count: counts.recentAdded },
                { id: 'archived', label: 'الأرشيف', count: counts.archived },
              ];
              const activeQuick = quickFilters.find((item) => item.id === sidebarFilter);
              const activeGroup = sidebarFilter.startsWith('group_')
                ? groups.find((g) => `group_${g.id}` === sidebarFilter)
                : undefined;
              const currentLabel = activeQuick
                ? activeQuick.label
                : activeGroup
                ? activeGroup.name
                : currentFilterTitle;
              const currentCount = activeQuick
                ? activeQuick.count
                : activeGroup
                ? counts.groupCounts[activeGroup.id] || 0
                : documents.length;

              return (
                <>
                  <button
                    type="button"
                    onClick={() => setIsFilterDropdownOpen((v) => !v)}
                    aria-expanded={isFilterDropdownOpen}
                    aria-haspopup="listbox"
                    className="w-full min-h-[42px] px-3 bg-slate-50 active:bg-slate-100 border border-slate-200 rounded-xl flex items-center justify-between gap-2 text-xs font-bold text-slate-800 cursor-pointer transition-colors"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {activeGroup ? (
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: activeGroup.color }}
                        />
                      ) : (
                        <Layers className="w-4 h-4 text-blue-600 shrink-0" />
                      )}
                      <span className="truncate">{currentLabel}</span>
                      <span className="font-mono text-[11px] font-semibold px-2 py-0.5 rounded-md bg-white border border-slate-200 text-slate-600 shrink-0">
                        {currentCount}
                      </span>
                    </div>
                    <ChevronDown
                      className={`w-4 h-4 text-slate-500 shrink-0 transition-transform ${
                        isFilterDropdownOpen ? 'rotate-180' : ''
                      }`}
                    />
                  </button>

                  {isFilterDropdownOpen && (
                    <div
                      role="listbox"
                      className="absolute right-3 left-3 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden max-h-[60dvh] overflow-y-auto divide-y divide-slate-100 z-40"
                    >
                      <div className="p-1.5 space-y-0.5">
                        {quickFilters.map((item) => {
                          const active = sidebarFilter === item.id;
                          return (
                            <button
                              key={item.id}
                              type="button"
                              role="option"
                              aria-selected={active}
                              onClick={() => {
                                onSelectFilter(item.id);
                                setIsFilterDropdownOpen(false);
                              }}
                              className={`w-full min-h-[44px] px-3 rounded-lg flex items-center justify-between gap-2 text-xs font-semibold cursor-pointer transition-colors ${
                                active
                                  ? 'bg-blue-50 text-blue-700 font-bold'
                                  : 'text-slate-700 active:bg-slate-100'
                              }`}
                            >
                              <span>{item.label}</span>
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-[11px] text-slate-400">{item.count}</span>
                                {active && <Check className="w-4 h-4 text-blue-600" />}
                              </div>
                            </button>
                          );
                        })}
                      </div>

                      {groups.length > 0 && (
                        <div className="p-1.5 space-y-0.5">
                          <div className="px-3 py-1 text-[10px] font-bold text-slate-400">المجموعات</div>
                          {groups.map((grp) => {
                            const active = sidebarFilter === `group_${grp.id}`;
                            const cnt = counts.groupCounts[grp.id] || 0;
                            return (
                              <button
                                key={grp.id}
                                type="button"
                                role="option"
                                aria-selected={active}
                                onClick={() => {
                                  onSelectFilter(`group_${grp.id}`);
                                  setIsFilterDropdownOpen(false);
                                }}
                                className={`w-full min-h-[44px] px-3 rounded-lg flex items-center justify-between gap-2 text-xs font-semibold cursor-pointer transition-colors ${
                                  active
                                    ? 'bg-blue-50 text-blue-700 font-bold'
                                    : 'text-slate-700 active:bg-slate-100'
                                }`}
                              >
                                <div className="flex items-center gap-2 min-w-0">
                                  <span
                                    className="w-2.5 h-2.5 rounded-full shrink-0"
                                    style={{ backgroundColor: grp.color }}
                                  />
                                  <span className="truncate">{grp.name}</span>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                  <span className="font-mono text-[11px] text-slate-400">{cnt}</span>
                                  {active && <Check className="w-4 h-4 text-blue-600" />}
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </>
              );
            })()}
          </div>
        )}

        {/* 4. Multi-Select Bulk Action Bar */}
        {showBulkBar && (
          <div className="bg-blue-50 border-b border-blue-200 px-3 py-1.5 flex items-center justify-between gap-2 shrink-0">
            <div className="flex items-center gap-2">
              <CheckSquare className="w-4 h-4 text-blue-600 shrink-0" />
              <span className="text-xs font-bold text-blue-900 font-mono tabular-nums">
                محدد: {selectedDocIds.size}
              </span>
              <button
                type="button"
                onClick={onSelectAll}
                className="min-h-[34px] px-2.5 rounded-lg bg-white border border-blue-200 text-[11px] font-bold text-blue-700 cursor-pointer"
              >
                الكل
              </button>
            </div>

            <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
              {selectedDocIds.size > 0 && (
                <>
                  <button
                    type="button"
                    onClick={onExportSelected}
                    aria-label="تصدير المحدد"
                    className="min-h-[36px] px-2.5 rounded-lg bg-white border border-slate-200 text-[11px] font-semibold text-slate-800 flex items-center gap-1 cursor-pointer shrink-0"
                  >
                    <Download className="w-3.5 h-3.5 text-emerald-600" />
                    <span>تصدير</span>
                  </button>
                  <button
                    type="button"
                    onClick={onBatchArchive}
                    aria-label="أرشفة المحدد"
                    className="min-h-[36px] px-2.5 rounded-lg bg-white border border-slate-200 text-[11px] font-semibold text-slate-800 flex items-center gap-1 cursor-pointer shrink-0"
                  >
                    <Archive className="w-3.5 h-3.5 text-slate-600" />
                    <span>أرشفة</span>
                  </button>
                  <button
                    type="button"
                    onClick={onBatchTrash}
                    aria-label="حذف المحدد"
                    className="min-h-[36px] px-2.5 rounded-lg bg-white border border-red-200 text-[11px] font-semibold text-red-600 flex items-center gap-1 cursor-pointer shrink-0"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>حذف</span>
                  </button>
                </>
              )}
              <button
                type="button"
                onClick={() => {
                  onDeselectAll();
                  if (isMultiSelectMode) onToggleMultiSelect();
                }}
                aria-label="إنهاء التحديد"
                className="min-w-[36px] min-h-[36px] rounded-lg bg-white border border-slate-200 text-slate-600 flex items-center justify-center cursor-pointer shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* 5. Main Documents Content Canvas */}
        <main className="flex-1 p-3">
          {documents.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-500">
              <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center mb-3 border border-slate-200 shadow-xs">
                <FilePlus className="w-7 h-7 text-blue-600" />
              </div>
              <h2 className="font-bold text-sm text-slate-800 mb-1">لا توجد مستمسكات للعرض</h2>
              <p className="text-xs text-slate-500 max-w-xs mb-5 leading-relaxed">
                {searchQuery || typeFilter !== 'all'
                  ? 'لا توجد نتائج تطابق البحث أو نوع المستمسك المحدد.'
                  : 'أضف بطاقة هوية، جواز سفر، بطاقة سكن أو أي وثيقة رسمية بالقياس الحقيقي 1:1.'}
              </p>
              <div className="flex flex-col sm:flex-row gap-2 w-full max-w-xs">
                <button
                  type="button"
                  onClick={onNewDocument}
                  className="w-full min-h-[46px] px-4 bg-blue-600 active:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 cursor-pointer"
                >
                  <FilePlus className="w-4 h-4" />
                  <span>إضافة مستمسك جديد</span>
                </button>
                <button
                  type="button"
                  onClick={onImport}
                  className="w-full min-h-[46px] px-4 bg-white border border-slate-300 active:bg-slate-50 text-slate-800 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Upload className="w-4 h-4 text-blue-600" />
                  <span>استيراد صور</span>
                </button>
                {hasClipboardDoc && (
                  <button
                    type="button"
                    onClick={onPaste}
                    className="w-full min-h-[44px] px-4 bg-slate-100 text-slate-800 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Clipboard className="w-4 h-4" />
                    <span>لصق من الحافظة</span>
                  </button>
                )}
              </div>
            </div>
          ) : (
            <MobileDocumentViews
              documents={documents}
              groups={groups}
              viewMode="cards"
              cardSize={cardSize}
              selectedDocIds={selectedDocIds}
              isMultiSelectMode={isMultiSelectMode}
              onSelect={onSelectDoc}
              onOpen={onOpenDoc}
              onToggleFavorite={onToggleFavorite}
              onOpenDocActions={(doc) => setActionSheetDoc(doc)}
              onDirectPrint={onDirectPrint}
              onDownload={onDownloadDoc}
            />
          )}
            </main>
          </>
        )}

        {/* 6. Fixed Bottom Tab Bar (Portrait / Standard Height Phones) */}
        {!useLandscapeRail && (
          <nav
            aria-label="التنقل الرئيسي"
            className="sticky bottom-0 bg-white/95 backdrop-blur-md border-t border-slate-200 px-1.5 pb-safe shrink-0 z-30"
          >
            <div className="h-[60px] flex items-center justify-around gap-0.5">
              <button
                type="button"
                onClick={() => setActivePage('vault')}
                className={`flex-1 min-w-0 min-h-[48px] px-1 rounded-xl flex flex-col items-center justify-center gap-0.5 cursor-pointer transition-colors ${
                  activePage === 'vault' ? 'text-blue-600 font-bold' : 'text-slate-500 active:bg-slate-100'
                }`}
              >
                <LayoutGrid className="w-5 h-5" />
                <span className="text-[10px] truncate">الخزانة</span>
              </button>

              <button
                type="button"
                onClick={() => setActivePage('groups')}
                className={`flex-1 min-w-0 min-h-[48px] px-1 rounded-xl flex flex-col items-center justify-center gap-0.5 cursor-pointer transition-colors ${
                  activePage === 'groups' ? 'text-blue-600 font-bold' : 'text-slate-500 active:bg-slate-100'
                }`}
              >
                <Layers className="w-5 h-5" />
                <span className="text-[10px] truncate">المجموعات</span>
              </button>

              <button
                type="button"
                onClick={() => setActivePage('add')}
                aria-label="إضافة جديد"
                className={`flex-1 min-w-0 min-h-[48px] px-1 rounded-xl flex flex-col items-center justify-center gap-0.5 cursor-pointer transition-colors ${
                  activePage === 'add' ? 'text-blue-600 font-bold' : 'text-slate-500 active:bg-slate-100'
                }`}
              >
                <Plus className="w-5 h-5" />
                <span className="text-[10px] truncate">إضافة</span>
              </button>

              <button
                type="button"
                onClick={onOpenPrintStudio}
                className="flex-1 min-w-0 min-h-[48px] px-1 rounded-xl text-slate-500 active:bg-slate-100 flex flex-col items-center justify-center gap-0.5 cursor-pointer transition-colors"
              >
                <Printer className="w-5 h-5" />
                <span className="text-[10px] truncate">الطباعة</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  if (activePage !== 'vault') {
                    setActivePage('vault');
                    setIsSearchOpen(true);
                  } else {
                    setIsSearchOpen((v) => !v);
                  }
                }}
                aria-label="بحث"
                className={`flex-1 min-w-0 min-h-[48px] px-1 rounded-xl flex flex-col items-center justify-center gap-0.5 cursor-pointer transition-colors ${
                  isSearchOpen || searchQuery ? 'text-blue-600 font-bold' : 'text-slate-500 active:bg-slate-100'
                }`}
              >
                <Search className="w-5 h-5" />
                <span className="text-[10px] truncate">بحث</span>
              </button>

              <button
                type="button"
                onClick={onManualSync}
                aria-label="مزامنة"
                className="flex-1 min-w-0 min-h-[48px] px-1 rounded-xl text-slate-500 active:bg-slate-100 flex flex-col items-center justify-center gap-0.5 cursor-pointer transition-colors"
              >
                {renderSyncIcon()}
                <span className="text-[10px] truncate">مزامنة</span>
              </button>
            </div>
          </nav>
        )}
      </div>

      {/* === MOBILE CONTEXTUAL SHEETS (For in-place Document Actions & View/Sort) === */}
      <MobileDocumentActionSheet
        doc={actionSheetDoc}
        groups={groups}
        onClose={() => setActionSheetDoc(null)}
        onOpenDetails={onOpenDoc}
        onEditInStudio={onEditDocInStudio}
        onPrint={onDirectPrint}
        onDownload={onDownloadDoc}
        onDuplicate={onDuplicateDoc}
        onCopy={onCopyDoc}
        onCut={onCutDoc}
        onToggleFavorite={(doc) => onToggleFavorite(doc)}
        onToggleCoverFace={onToggleCoverFace}
        onToggleArchive={onToggleArchive}
        onMoveToGroup={onMoveToGroup}
        onTrash={onTrashDoc}
      />
    </div>
  );
};
