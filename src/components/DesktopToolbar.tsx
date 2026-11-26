import React, { useState, useRef, useEffect } from 'react';
import {
  Search,
  LayoutGrid,
  List,
  SlidersHorizontal,
  Filter,
  CheckSquare,
  Square,
  MoreHorizontal,
  Printer,
  Upload,
  Download,
  ShieldCheck,
  RefreshCw,
  Cloud,
  CloudCheck,
  CloudAlert,
  ChevronDown,
  X,
  Sidebar,
  History,
} from 'lucide-react';
import { ViewMode } from '../types';
import { VIEW_MODES, ViewModeIcon } from '../constants/viewModes';
import { SyncStatus } from '../services/syncEngine';
import { DOCUMENT_PRESETS } from '../constants/presets';
import { useLayoutMode } from '../hooks/useViewportMode';

interface DesktopToolbarProps {
  // Search
  searchQuery: string;
  onSearchChange: (q: string) => void;

  // View modes
  viewMode: ViewMode;
  onChangeViewMode: (mode: ViewMode) => void;

  // Filter
  typeFilter: string;
  onChangeTypeFilter: (type: string) => void;

  // Multi-select
  isMultiSelectMode: boolean;
  onToggleMultiSelect: () => void;
  selectedCount: number;

  // More options
  onImport: () => void;
  onExport: () => void;
  onPrint: () => void;
  onBackup: () => void;
  onAuditLog: () => void;
  syncStatus: SyncStatus;
  onManualSync: () => void;

  // Sidebar toggle
  showSidebar: boolean;
  onToggleSidebar: () => void;
}

export const DesktopToolbar: React.FC<DesktopToolbarProps> = ({
  searchQuery,
  onSearchChange,
  viewMode,
  onChangeViewMode,
  typeFilter,
  onChangeTypeFilter,
  isMultiSelectMode,
  onToggleMultiSelect,
  selectedCount,
  onImport,
  onExport,
  onPrint,
  onBackup,
  onAuditLog,
  syncStatus,
  onManualSync,
  showSidebar,
  onToggleSidebar,
}) => {
  const { isTablet } = useLayoutMode();
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  const [showViewDropdown, setShowViewDropdown] = useState(false);
  const [showMoreDropdown, setShowMoreDropdown] = useState(false);

  const filterRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<HTMLDivElement>(null);
  const moreRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) {
        setShowFilterDropdown(false);
      }
      if (viewRef.current && !viewRef.current.contains(e.target as Node)) {
        setShowViewDropdown(false);
      }
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) {
        setShowMoreDropdown(false);
      }
    };
    window.addEventListener('mousedown', handleClickOutside);
    return () => window.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const activeTypeName =
    typeFilter === 'all'
      ? 'جميع الأنواع'
      : DOCUMENT_PRESETS.find((p) => p.id === typeFilter)?.nameAr || 'تصفية';

  return (
    <div
      className={`${
        isTablet ? 'h-12' : 'h-10'
      } bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-2 px-3 shrink-0 select-none z-20 font-['Cairo',system-ui,sans-serif]`}
    >
      {/* Right side (RTL): Primary Actions & Search */}
      <div className="flex items-center gap-1.5 flex-1 max-w-2xl">
        {/* Toggle Sidebar */}
        <button
          onClick={onToggleSidebar}
          className={`p-1.5 rounded border text-slate-600 hover:text-slate-900 transition-colors cursor-pointer ${
            showSidebar ? 'bg-white border-slate-200 shadow-2xs' : 'bg-transparent border-transparent hover:bg-slate-200'
          }`}
          title={showSidebar ? 'طي القائمة الجانبية (عرض الأيقونات)' : 'توسيع القائمة الجانبية'}
        >
          <Sidebar className="w-3.5 h-3.5" />
        </button>

        <div className="h-4 w-[1px] bg-slate-300 mx-0.5" />

        {/* 3. مربع البحث */}
        <div className="relative flex-1 min-w-[140px] max-w-xs">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            id="global-search-input"
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="بحث... (Ctrl+F)"
            className="w-full bg-white hover:bg-slate-50 focus:bg-white text-xs text-slate-800 pr-8 pl-7 py-1 rounded border border-slate-200 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-slate-400 shadow-2xs"
          />
          {searchQuery && (
            <button
              onClick={() => onSearchChange('')}
              className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer"
              title="مسح البحث"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      {/* Left side (RTL): View, Filter, Select, More */}
      <div className="flex items-center gap-1.5">
        {/* 4. زر التصفية Dropdown */}
        <div className="relative" ref={filterRef}>
          <button
            onClick={() => setShowFilterDropdown(!showFilterDropdown)}
            className={`flex items-center gap-1 px-2 py-1 rounded text-xs border transition-colors cursor-pointer ${
              typeFilter !== 'all'
                ? 'bg-blue-50 border-blue-300 text-blue-700 font-medium'
                : 'bg-white hover:bg-slate-100 border-slate-200 text-slate-700'
            }`}
            title="تصفية المستمسكات حسب النوع"
          >
            <Filter className="w-3.5 h-3.5 text-slate-500" />
            <span className="hidden md:inline text-[11px] max-w-[100px] truncate">{activeTypeName}</span>
            <ChevronDown className="w-3 h-3 opacity-60" />
          </button>

          {showFilterDropdown && (
            <div className="absolute left-0 mt-1 w-52 bg-white border border-slate-200 rounded-md shadow-lg py-1 z-50 text-right max-h-72 overflow-y-auto">
              <button
                onClick={() => {
                  onChangeTypeFilter('all');
                  setShowFilterDropdown(false);
                }}
                className={`w-full px-3 py-1.5 text-xs text-right hover:bg-slate-100 flex items-center justify-between cursor-pointer ${
                  typeFilter === 'all' ? 'font-bold text-blue-600 bg-blue-50/50' : 'text-slate-700'
                }`}
              >
                <span>جميع أنواع المستمسكات</span>
                {typeFilter === 'all' && <span className="text-blue-600">✓</span>}
              </button>
              <div className="h-[1px] bg-slate-200 my-1" />
              {DOCUMENT_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  onClick={() => {
                    onChangeTypeFilter(preset.id);
                    setShowFilterDropdown(false);
                  }}
                  className={`w-full px-3 py-1.5 text-xs text-right hover:bg-slate-100 flex items-center justify-between cursor-pointer ${
                    typeFilter === preset.id ? 'font-bold text-blue-600 bg-blue-50/50' : 'text-slate-700'
                  }`}
                >
                  <span className="truncate">{preset.nameAr}</span>
                  {typeFilter === preset.id && <span className="text-blue-600">✓</span>}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* 5. زر تغيير طريقة العرض */}
        <div className="relative" ref={viewRef}>
          <button
            onClick={() => setShowViewDropdown(!showViewDropdown)}
            className={`flex items-center gap-1.5 px-2.5 py-1 border rounded text-xs transition-colors cursor-pointer ${
              showViewDropdown
                ? 'bg-blue-50 border-blue-300 text-blue-700'
                : 'bg-white hover:bg-slate-100 border-slate-200 text-slate-700'
            }`}
            aria-label="تغيير طريقة العرض"
          >
            <ViewModeIcon mode={viewMode} className="w-3.5 h-3.5" />
            <span className="hidden sm:inline text-[11px] font-medium">
              {VIEW_MODES.find((m) => m.id === viewMode)?.label || 'عرض شبكي'}
            </span>
            <ChevronDown className="w-3 h-3 opacity-60" />
          </button>

          {showViewDropdown && (
            <div className="absolute left-0 mt-1 w-64 bg-white border border-slate-200 rounded-lg shadow-xl p-1.5 z-50 text-right grid grid-cols-2 gap-1">
              {VIEW_MODES.map((mode) => {
                const isActive = viewMode === mode.id;
                return (
                  <button
                    key={mode.id}
                    onClick={() => {
                      onChangeViewMode(mode.id);
                      setShowViewDropdown(false);
                    }}
                    className={`w-full px-2.5 py-1.5 rounded text-xs text-right flex items-center gap-2 cursor-pointer transition-colors ${
                      isActive
                        ? 'font-bold text-blue-700 bg-blue-50 border border-blue-200'
                        : 'text-slate-700 hover:bg-slate-100 border border-transparent'
                    }`}
                  >
                    <ViewModeIcon
                      mode={mode.id}
                      className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-blue-600' : 'text-slate-500'}`}
                    />
                    <span className="truncate">{mode.label}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* 6. زر تحديد العناصر */}
        <button
          onClick={onToggleMultiSelect}
          className={`flex items-center gap-1 px-2 py-1 rounded text-xs border transition-colors cursor-pointer ${
            isMultiSelectMode
              ? 'bg-blue-600 border-blue-600 text-white font-medium shadow-xs'
              : 'bg-white hover:bg-slate-100 border-slate-200 text-slate-700'
          }`}
          title="تفعيل / إلغاء وضع التحديد"
        >
          {isMultiSelectMode ? <CheckSquare className="w-3.5 h-3.5" /> : <Square className="w-3.5 h-3.5 text-slate-500" />}
          <span className="hidden sm:inline text-[11px]">
            {isMultiSelectMode ? (selectedCount > 0 ? `محدد (${selectedCount})` : 'التحديد نشط') : 'تحديد'}
          </span>
        </button>

        <div className="h-4 w-[1px] bg-slate-300 mx-0.5" />

        {/* 7. زر المزيد من الخيارات Dropdown */}
        <div className="relative" ref={moreRef}>
          <button
            onClick={() => setShowMoreDropdown(!showMoreDropdown)}
            className="p-1 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 rounded text-xs transition-colors cursor-pointer"
            title="المزيد من الأدوات والخيارات"
          >
            <MoreHorizontal className="w-4 h-4" />
          </button>

          {showMoreDropdown && (
            <div className="absolute left-0 mt-1 w-48 bg-white border border-slate-200 rounded-md shadow-xl py-1 z-50 text-right animate-in fade-in duration-75">
              <button
                onClick={() => {
                  onPrint();
                  setShowMoreDropdown(false);
                }}
                className="w-full px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-100 flex items-center gap-2 cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5 text-indigo-600" />
                <span>استوديو الطباعة (Ctrl+P)</span>
              </button>

              <button
                onClick={() => {
                  onImport();
                  setShowMoreDropdown(false);
                }}
                className="w-full px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-100 flex items-center gap-2 cursor-pointer"
              >
                <Upload className="w-3.5 h-3.5 text-slate-600" />
                <span>استيراد ملفات</span>
              </button>

              <button
                onClick={() => {
                  onExport();
                  setShowMoreDropdown(false);
                }}
                className="w-full px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-100 flex items-center gap-2 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5 text-slate-600" />
                <span>تصدير المستمسكات (Ctrl+E)</span>
              </button>

              <div className="h-[1px] bg-slate-200 my-1" />

              <button
                onClick={() => {
                  onBackup();
                  setShowMoreDropdown(false);
                }}
                className="w-full px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-100 flex items-center gap-2 cursor-pointer"
              >
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                <span>النسخ الاحتياطي المشفر</span>
              </button>

              <button
                onClick={() => {
                  onAuditLog();
                  setShowMoreDropdown(false);
                }}
                className="w-full px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-100 flex items-center gap-2 cursor-pointer"
              >
                <History className="w-3.5 h-3.5 text-slate-600" />
                <span>سجل العمليات</span>
              </button>

              <button
                onClick={() => {
                  onManualSync();
                  setShowMoreDropdown(false);
                }}
                className="w-full px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-100 flex items-center gap-2 cursor-pointer"
              >
                {syncStatus.state === 'synced' ? (
                  <CloudCheck className="w-3.5 h-3.5 text-emerald-600" />
                ) : syncStatus.state === 'syncing' ? (
                  <RefreshCw className="w-3.5 h-3.5 text-blue-600 animate-spin" />
                ) : syncStatus.state === 'conflict' ? (
                  <CloudAlert className="w-3.5 h-3.5 text-amber-600" />
                ) : (
                  <Cloud className="w-3.5 h-3.5 text-slate-500" />
                )}
                <span>مزامنة سحابية فورية</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
