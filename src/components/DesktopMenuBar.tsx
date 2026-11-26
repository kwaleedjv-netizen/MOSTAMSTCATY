import React, { useState, useRef, useEffect } from 'react';
import {
  FilePlus,
  FolderPlus,
  Upload,
  Download,
  Printer,
  ShieldCheck,
  RotateCcw,
  Trash2,
  Lock,
  Edit,
  Copy,
  Scissors,
  Clipboard,
  CheckSquare,
  Square,
  LayoutGrid,
  List,
  SlidersHorizontal,
  ArrowUpDown,
  Sidebar,
  Info,
  HelpCircle,
  Keyboard,
  Settings,
  History,
  Image,
  Folder,
  Ruler,
  Star,
  Archive,
  RefreshCw,
  Check,
  ChevronDown,
} from 'lucide-react';
import { ViewMode, CardSize } from '../types';
import { VIEW_MODES, ViewModeIcon } from '../constants/viewModes';

interface DesktopMenuBarProps {
  // File
  onNewDocument: () => void;
  onNewGroup: () => void;
  onImport: () => void;
  onExportAll: () => void;
  onExportSelected: () => void;
  onBackup: () => void;
  onRestore: () => void;
  onPrint: () => void;
  onFactoryReset: () => void;
  onLockVault: () => void;

  // Edit
  onUndo?: () => void;
  onRedo?: () => void;
  onCut?: () => void;
  onCopy?: () => void;
  onPaste?: () => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  onDeleteSelected: () => void;
  onRenameSelected: () => void;

  // View
  viewMode: ViewMode;
  onChangeViewMode: (mode: ViewMode) => void;
  cardSize: CardSize;
  onChangeCardSize: (size: CardSize) => void;
  sortBy: string;
  onChangeSortBy: (sort: 'dateAdded' | 'dateModified' | 'name' | 'type') => void;
  showSidebar: boolean;
  onToggleSidebar: () => void;
  onRefresh: () => void;

  // Documents
  onEditDocument: () => void;
  onMoveToGroup: () => void;
  onToggleCoverFace: () => void;
  onToggleFavorite: () => void;
  onArchiveSelected: () => void;
  onOpenTrash: () => void;

  // Tools
  onOpenImageEditor: () => void;
  onOpenPrintStudio: () => void;
  onManageDimensions: () => void;
  onManageTemplates: () => void;
  onManageGroups: () => void;
  onOpenAuditLog: () => void;

  // Settings
  onOpenSettingsTab: (tab: 'ui' | 'storage' | 'security' | 'cloud' | 'reset') => void;

  // Help
  onOpenUserGuide: () => void;
  onOpenShortcuts: () => void;
  onOpenAbout: () => void;

  // State flags
  selectedCount: number;
  hasMasterPassword: boolean;
  userEmail?: string | null;
  userPhotoUrl?: string | null;
  currentIp?: string | null;
}

export const DesktopMenuBar: React.FC<DesktopMenuBarProps> = ({
  onNewDocument,
  onNewGroup,
  onImport,
  onExportAll,
  onExportSelected,
  onBackup,
  onRestore,
  onPrint,
  onFactoryReset,
  onLockVault,
  onUndo,
  onRedo,
  onCut,
  onCopy,
  onPaste,
  onSelectAll,
  onDeselectAll,
  onDeleteSelected,
  onRenameSelected,
  viewMode,
  onChangeViewMode,
  cardSize,
  onChangeCardSize,
  sortBy,
  onChangeSortBy,
  showSidebar,
  onToggleSidebar,
  onRefresh,
  onEditDocument,
  onMoveToGroup,
  onToggleCoverFace,
  onToggleFavorite,
  onArchiveSelected,
  onOpenTrash,
  onOpenImageEditor,
  onOpenPrintStudio,
  onManageDimensions,
  onManageTemplates,
  onManageGroups,
  onOpenAuditLog,
  onOpenSettingsTab,
  onOpenUserGuide,
  onOpenShortcuts,
  onOpenAbout,
  selectedCount,
  hasMasterPassword,
  userEmail,
  userPhotoUrl,
  currentIp,
}) => {
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const barRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (barRef.current && !barRef.current.contains(e.target as Node)) {
        setActiveMenu(null);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setActiveMenu(null);
    };

    window.addEventListener('mousedown', handleOutsideClick);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('mousedown', handleOutsideClick);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const handleMenuClick = (name: string) => {
    setActiveMenu(activeMenu === name ? null : name);
  };

  const handleMenuHover = (name: string) => {
    if (activeMenu !== null) {
      setActiveMenu(name);
    }
  };

  const closeMenu = () => setActiveMenu(null);

  const menuItemBtn = (name: string, label: string) => {
    const isOpen = activeMenu === name;
    return (
      <button
        onClick={() => handleMenuClick(name)}
        onMouseEnter={() => handleMenuHover(name)}
        className={`px-3 py-1 rounded text-xs font-medium transition-colors cursor-pointer ${
          isOpen
            ? 'bg-slate-200 text-slate-900 font-semibold'
            : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
        }`}
      >
        {label}
      </button>
    );
  };

  const dropdownItemClass =
    'w-full flex items-center justify-between px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-100 hover:text-slate-900 rounded-xs transition-colors cursor-pointer text-right';
  const disabledItemClass =
    'w-full flex items-center justify-between px-3 py-1.5 text-xs text-slate-400 cursor-not-allowed text-right';
  const dividerClass = 'h-[1px] bg-slate-200 my-1';

  return (
    <div
      ref={barRef}
      className="h-8 bg-white border-b border-slate-200 flex items-center justify-between px-2 shrink-0 select-none z-30 font-['Cairo',system-ui,sans-serif]"
    >
      {/* Right side in RTL: App Brand + Menus */}
      <div className="flex items-center gap-1 relative">
        {/* App Title badge */}
        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded text-slate-800 ml-2 font-semibold text-xs tracking-tight">
          <div className="w-4 h-4 rounded bg-blue-600 text-white flex items-center justify-center text-[10px] font-black">
            م
          </div>
          <span className="font-bold text-slate-900">مستمسكاتي</span>
        </div>

        <div className="h-4 w-[1px] bg-slate-200 mx-1" />

        {/* 1. ملف File */}
        <div className="relative">
          {menuItemBtn('file', 'ملف')}
          {activeMenu === 'file' && (
            <div className="absolute right-0 top-full mt-0.5 w-60 bg-white border border-slate-200 rounded-md shadow-xl py-1 z-50 text-right animate-in fade-in duration-75">
              <button
                onClick={() => {
                  closeMenu();
                  onNewDocument();
                }}
                className={dropdownItemClass}
              >
                <div className="flex items-center gap-2">
                  <FilePlus className="w-3.5 h-3.5 text-blue-600" />
                  <span>مستمسك جديد</span>
                </div>
                <kbd className="text-[10px] text-slate-400 font-mono">Ctrl+N</kbd>
              </button>

              <button
                onClick={() => {
                  closeMenu();
                  onNewGroup();
                }}
                className={dropdownItemClass}
              >
                <div className="flex items-center gap-2">
                  <FolderPlus className="w-3.5 h-3.5 text-amber-500" />
                  <span>مجموعة جديدة</span>
                </div>
                <kbd className="text-[10px] text-slate-400 font-mono">Ctrl+G</kbd>
              </button>

              <div className={dividerClass} />

              <button
                onClick={() => {
                  closeMenu();
                  onImport();
                }}
                className={dropdownItemClass}
              >
                <div className="flex items-center gap-2">
                  <Upload className="w-3.5 h-3.5 text-slate-600" />
                  <span>استيراد ملفات وصور...</span>
                </div>
              </button>

              <button
                onClick={() => {
                  closeMenu();
                  onExportAll();
                }}
                className={dropdownItemClass}
              >
                <div className="flex items-center gap-2">
                  <Download className="w-3.5 h-3.5 text-slate-600" />
                  <span>تصدير الكل</span>
                </div>
              </button>

              <button
                onClick={() => {
                  closeMenu();
                  onExportSelected();
                }}
                className={selectedCount > 0 ? dropdownItemClass : disabledItemClass}
                disabled={selectedCount === 0}
              >
                <div className="flex items-center gap-2">
                  <Download className="w-3.5 h-3.5 text-slate-600" />
                  <span>تصدير المحدد ({selectedCount})</span>
                </div>
                <kbd className="text-[10px] text-slate-400 font-mono">Ctrl+E</kbd>
              </button>

              <div className={dividerClass} />

              <button
                onClick={() => {
                  closeMenu();
                  onBackup();
                }}
                className={dropdownItemClass}
              >
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                  <span>النسخ الاحتياطي...</span>
                </div>
              </button>

              <button
                onClick={() => {
                  closeMenu();
                  onRestore();
                }}
                className={dropdownItemClass}
              >
                <div className="flex items-center gap-2">
                  <RotateCcw className="w-3.5 h-3.5 text-slate-600" />
                  <span>استعادة نسخة احتياطية...</span>
                </div>
              </button>

              <button
                onClick={() => {
                  closeMenu();
                  onPrint();
                }}
                className={dropdownItemClass}
              >
                <div className="flex items-center gap-2">
                  <Printer className="w-3.5 h-3.5 text-indigo-600" />
                  <span>استوديو الطباعة...</span>
                </div>
                <kbd className="text-[10px] text-slate-400 font-mono">Ctrl+P</kbd>
              </button>

              <div className={dividerClass} />

              <button
                onClick={() => {
                  closeMenu();
                  onFactoryReset();
                }}
                className={`${dropdownItemClass} text-red-600 hover:text-red-700 hover:bg-red-50`}
              >
                <div className="flex items-center gap-2">
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>إعادة ضبط المصنع...</span>
                </div>
              </button>

              <button
                onClick={() => {
                  closeMenu();
                  onLockVault();
                }}
                className={dropdownItemClass}
              >
                <div className="flex items-center gap-2">
                  <Lock className="w-3.5 h-3.5 text-amber-600" />
                  <span>{hasMasterPassword ? 'قفل الخزانة' : 'إغلاق وقفل'}</span>
                </div>
                <kbd className="text-[10px] text-slate-400 font-mono">Ctrl+L</kbd>
              </button>
            </div>
          )}
        </div>

        {/* 2. تحرير Edit */}
        <div className="relative">
          {menuItemBtn('edit', 'تحرير')}
          {activeMenu === 'edit' && (
            <div className="absolute right-0 top-full mt-0.5 w-56 bg-white border border-slate-200 rounded-md shadow-xl py-1 z-50 text-right animate-in fade-in duration-75">
              <button
                onClick={() => {
                  closeMenu();
                  onUndo?.();
                }}
                className={dropdownItemClass}
              >
                <div className="flex items-center gap-2">
                  <RotateCcw className="w-3.5 h-3.5 text-slate-600" />
                  <span>تراجع</span>
                </div>
                <kbd className="text-[10px] text-slate-400 font-mono">Ctrl+Z</kbd>
              </button>

              <button
                onClick={() => {
                  closeMenu();
                  onRedo?.();
                }}
                className={dropdownItemClass}
              >
                <div className="flex items-center gap-2">
                  <RotateCcw className="w-3.5 h-3.5 -scale-x-100 text-slate-600" />
                  <span>إعادة</span>
                </div>
                <kbd className="text-[10px] text-slate-400 font-mono">Ctrl+Y</kbd>
              </button>

              <div className={dividerClass} />

              <button
                onClick={() => {
                  closeMenu();
                  onCut?.();
                }}
                className={selectedCount > 0 ? dropdownItemClass : disabledItemClass}
                disabled={selectedCount === 0}
              >
                <div className="flex items-center gap-2">
                  <Scissors className="w-3.5 h-3.5 text-slate-600" />
                  <span>قص</span>
                </div>
                <kbd className="text-[10px] text-slate-400 font-mono">Ctrl+X</kbd>
              </button>

              <button
                onClick={() => {
                  closeMenu();
                  onCopy?.();
                }}
                className={selectedCount > 0 ? dropdownItemClass : disabledItemClass}
                disabled={selectedCount === 0}
              >
                <div className="flex items-center gap-2">
                  <Copy className="w-3.5 h-3.5 text-slate-600" />
                  <span>نسخ</span>
                </div>
                <kbd className="text-[10px] text-slate-400 font-mono">Ctrl+C</kbd>
              </button>

              <button
                onClick={() => {
                  closeMenu();
                  onPaste?.();
                }}
                className={dropdownItemClass}
              >
                <div className="flex items-center gap-2">
                  <Clipboard className="w-3.5 h-3.5 text-slate-600" />
                  <span>لصق صورة من الحافظة</span>
                </div>
                <kbd className="text-[10px] text-slate-400 font-mono">Ctrl+V</kbd>
              </button>

              <div className={dividerClass} />

              <button
                onClick={() => {
                  closeMenu();
                  onSelectAll();
                }}
                className={dropdownItemClass}
              >
                <div className="flex items-center gap-2">
                  <CheckSquare className="w-3.5 h-3.5 text-slate-600" />
                  <span>تحديد الكل</span>
                </div>
                <kbd className="text-[10px] text-slate-400 font-mono">Ctrl+A</kbd>
              </button>

              <button
                onClick={() => {
                  closeMenu();
                  onDeselectAll();
                }}
                className={selectedCount > 0 ? dropdownItemClass : disabledItemClass}
                disabled={selectedCount === 0}
              >
                <div className="flex items-center gap-2">
                  <Square className="w-3.5 h-3.5 text-slate-600" />
                  <span>إلغاء التحديد</span>
                </div>
                <kbd className="text-[10px] text-slate-400 font-mono">Esc</kbd>
              </button>

              <div className={dividerClass} />

              <button
                onClick={() => {
                  closeMenu();
                  onRenameSelected();
                }}
                className={selectedCount === 1 ? dropdownItemClass : disabledItemClass}
                disabled={selectedCount !== 1}
              >
                <div className="flex items-center gap-2">
                  <Edit className="w-3.5 h-3.5 text-slate-600" />
                  <span>إعادة تسمية</span>
                </div>
                <kbd className="text-[10px] text-slate-400 font-mono">F2</kbd>
              </button>

              <button
                onClick={() => {
                  closeMenu();
                  onDeleteSelected();
                }}
                className={selectedCount > 0 ? `${dropdownItemClass} text-red-600 hover:text-red-700 hover:bg-red-50` : disabledItemClass}
                disabled={selectedCount === 0}
              >
                <div className="flex items-center gap-2">
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>حذف</span>
                </div>
                <kbd className="text-[10px] text-slate-400 font-mono">Del</kbd>
              </button>
            </div>
          )}
        </div>

        {/* 3. عرض View */}
        <div className="relative">
          {menuItemBtn('view', 'عرض')}
          {activeMenu === 'view' && (
            <div className="absolute right-0 top-full mt-0.5 w-60 bg-white border border-slate-200 rounded-md shadow-xl py-1 z-50 text-right animate-in fade-in duration-75 max-h-[80vh] overflow-y-auto">
              {VIEW_MODES.map((mode) => (
                <button
                  key={mode.id}
                  onClick={() => {
                    onChangeViewMode(mode.id);
                    closeMenu();
                  }}
                  className={dropdownItemClass}
                >
                  <div className="flex items-center gap-2">
                    <ViewModeIcon mode={mode.id} className="w-3.5 h-3.5 text-slate-600" />
                    <span>{mode.label}</span>
                  </div>
                  {viewMode === mode.id && <Check className="w-3.5 h-3.5 text-blue-600" />}
                </button>
              ))}

              <div className={dividerClass} />

              <div className="px-3 py-1 text-[11px] font-semibold text-slate-400">حجم البطاقات</div>
              {(['small', 'medium', 'large'] as CardSize[]).map((size) => (
                <button
                  key={size}
                  onClick={() => {
                    onChangeCardSize(size);
                    closeMenu();
                  }}
                  className={dropdownItemClass}
                >
                  <span>{size === 'small' ? 'صغير' : size === 'medium' ? 'متوسط' : 'كبير'}</span>
                  {cardSize === size && <Check className="w-3.5 h-3.5 text-blue-600" />}
                </button>
              ))}

              <div className={dividerClass} />

              <div className="px-3 py-1 text-[11px] font-semibold text-slate-400">ترتيب المستمسكات</div>
              <button
                onClick={() => {
                  onChangeSortBy('dateAdded');
                  closeMenu();
                }}
                className={dropdownItemClass}
              >
                <span>تاريخ الإضافة</span>
                {sortBy === 'dateAdded' && <Check className="w-3.5 h-3.5 text-blue-600" />}
              </button>
              <button
                onClick={() => {
                  onChangeSortBy('dateModified');
                  closeMenu();
                }}
                className={dropdownItemClass}
              >
                <span>تاريخ التعديل</span>
                {sortBy === 'dateModified' && <Check className="w-3.5 h-3.5 text-blue-600" />}
              </button>
              <button
                onClick={() => {
                  onChangeSortBy('name');
                  closeMenu();
                }}
                className={dropdownItemClass}
              >
                <span>الاسم أبجدياً</span>
                {sortBy === 'name' && <Check className="w-3.5 h-3.5 text-blue-600" />}
              </button>
              <button
                onClick={() => {
                  onChangeSortBy('type');
                  closeMenu();
                }}
                className={dropdownItemClass}
              >
                <span>نوع المستمسك</span>
                {sortBy === 'type' && <Check className="w-3.5 h-3.5 text-blue-600" />}
              </button>

              <div className={dividerClass} />

              <button
                onClick={() => {
                  onToggleSidebar();
                  closeMenu();
                }}
                className={dropdownItemClass}
              >
                <div className="flex items-center gap-2">
                  <Sidebar className="w-3.5 h-3.5 text-slate-600" />
                  <span>{showSidebar ? 'طي القائمة الجانبية' : 'توسيع القائمة الجانبية'}</span>
                </div>
                {showSidebar && <Check className="w-3.5 h-3.5 text-blue-600" />}
              </button>

              <button
                onClick={() => {
                  onRefresh();
                  closeMenu();
                }}
                className={dropdownItemClass}
              >
                <div className="flex items-center gap-2">
                  <RefreshCw className="w-3.5 h-3.5 text-slate-600" />
                  <span>تحديث العرض</span>
                </div>
                <kbd className="text-[10px] text-slate-400 font-mono">F5</kbd>
              </button>
            </div>
          )}
        </div>

        {/* 4. المستمسكات Documents */}
        <div className="relative">
          {menuItemBtn('docs', 'المستمسكات')}
          {activeMenu === 'docs' && (
            <div className="absolute right-0 top-full mt-0.5 w-56 bg-white border border-slate-200 rounded-md shadow-xl py-1 z-50 text-right animate-in fade-in duration-75">
              <button
                onClick={() => {
                  closeMenu();
                  onNewDocument();
                }}
                className={dropdownItemClass}
              >
                <div className="flex items-center gap-2">
                  <FilePlus className="w-3.5 h-3.5 text-blue-600" />
                  <span>إضافة مستمسك...</span>
                </div>
              </button>

              <button
                onClick={() => {
                  closeMenu();
                  onEditDocument();
                }}
                className={selectedCount === 1 ? dropdownItemClass : disabledItemClass}
                disabled={selectedCount !== 1}
              >
                <div className="flex items-center gap-2">
                  <Edit className="w-3.5 h-3.5 text-slate-600" />
                  <span>تعديل مستمسك</span>
                </div>
              </button>

              <button
                onClick={() => {
                  closeMenu();
                  onMoveToGroup();
                }}
                className={selectedCount > 0 ? dropdownItemClass : disabledItemClass}
                disabled={selectedCount === 0}
              >
                <div className="flex items-center gap-2">
                  <Folder className="w-3.5 h-3.5 text-amber-500" />
                  <span>نقل إلى مجموعة...</span>
                </div>
              </button>

              <button
                onClick={() => {
                  closeMenu();
                  onToggleCoverFace();
                }}
                className={selectedCount === 1 ? dropdownItemClass : disabledItemClass}
                disabled={selectedCount !== 1}
              >
                <div className="flex items-center gap-2">
                  <RotateCcw className="w-3.5 h-3.5 text-slate-600" />
                  <span>تغيير الغلاف</span>
                </div>
              </button>

              <button
                onClick={() => {
                  closeMenu();
                  onToggleFavorite();
                }}
                className={selectedCount > 0 ? dropdownItemClass : disabledItemClass}
                disabled={selectedCount === 0}
              >
                <div className="flex items-center gap-2">
                  <Star className="w-3.5 h-3.5 text-amber-500" />
                  <span>إضافة للمفضلة</span>
                </div>
              </button>

              <button
                onClick={() => {
                  closeMenu();
                  onArchiveSelected();
                }}
                className={selectedCount > 0 ? dropdownItemClass : disabledItemClass}
                disabled={selectedCount === 0}
              >
                <div className="flex items-center gap-2">
                  <Archive className="w-3.5 h-3.5 text-slate-600" />
                  <span>الأرشفة</span>
                </div>
              </button>

              <div className={dividerClass} />

              <button
                onClick={() => {
                  closeMenu();
                  onOpenTrash();
                }}
                className={dropdownItemClass}
              >
                <div className="flex items-center gap-2">
                  <Trash2 className="w-3.5 h-3.5 text-red-500" />
                  <span>سلة المحذوفات</span>
                </div>
              </button>
            </div>
          )}
        </div>

        {/* 5. الأدوات Tools */}
        <div className="relative">
          {menuItemBtn('tools', 'الأدوات')}
          {activeMenu === 'tools' && (
            <div className="absolute right-0 top-full mt-0.5 w-56 bg-white border border-slate-200 rounded-md shadow-xl py-1 z-50 text-right animate-in fade-in duration-75">
              <button
                onClick={() => {
                  closeMenu();
                  onOpenImageEditor();
                }}
                className={dropdownItemClass}
              >
                <div className="flex items-center gap-2">
                  <Image className="w-3.5 h-3.5 text-indigo-600" />
                  <span>محرر الصور</span>
                </div>
              </button>

              <button
                onClick={() => {
                  closeMenu();
                  onOpenPrintStudio();
                }}
                className={dropdownItemClass}
              >
                <div className="flex items-center gap-2">
                  <Printer className="w-3.5 h-3.5 text-blue-600" />
                  <span>محرر الطباعة</span>
                </div>
                <kbd className="text-[10px] text-slate-400 font-mono">Ctrl+P</kbd>
              </button>

              <button
                onClick={() => {
                  closeMenu();
                  onManageDimensions();
                }}
                className={dropdownItemClass}
              >
                <div className="flex items-center gap-2">
                  <Ruler className="w-3.5 h-3.5 text-slate-600" />
                  <span>إدارة القياسات</span>
                </div>
              </button>

              <button
                onClick={() => {
                  closeMenu();
                  onManageTemplates();
                }}
                className={dropdownItemClass}
              >
                <div className="flex items-center gap-2">
                  <LayoutGrid className="w-3.5 h-3.5 text-slate-600" />
                  <span>إدارة القوالب</span>
                </div>
              </button>

              <button
                onClick={() => {
                  closeMenu();
                  onManageGroups();
                }}
                className={dropdownItemClass}
              >
                <div className="flex items-center gap-2">
                  <Folder className="w-3.5 h-3.5 text-amber-500" />
                  <span>إدارة المجموعات</span>
                </div>
              </button>

              <div className={dividerClass} />

              <button
                onClick={() => {
                  closeMenu();
                  onOpenAuditLog();
                }}
                className={dropdownItemClass}
              >
                <div className="flex items-center gap-2">
                  <History className="w-3.5 h-3.5 text-slate-600" />
                  <span>سجل العمليات</span>
                </div>
              </button>
            </div>
          )}
        </div>

        {/* 6. الإعدادات Settings */}
        <div className="relative">
          {menuItemBtn('settings', 'الإعدادات')}
          {activeMenu === 'settings' && (
            <div className="absolute right-0 top-full mt-0.5 w-56 bg-white border border-slate-200 rounded-md shadow-xl py-1 z-50 text-right animate-in fade-in duration-75">
              <button
                onClick={() => {
                  closeMenu();
                  onOpenSettingsTab('ui');
                }}
                className={dropdownItemClass}
              >
                <span>إعدادات الواجهة</span>
              </button>

              <button
                onClick={() => {
                  closeMenu();
                  onOpenSettingsTab('storage');
                }}
                className={dropdownItemClass}
              >
                <span>إعدادات التخزين</span>
              </button>

              <button
                onClick={() => {
                  closeMenu();
                  onOpenSettingsTab('security');
                }}
                className={dropdownItemClass}
              >
                <span>إعدادات الأمان</span>
              </button>

              <button
                onClick={() => {
                  closeMenu();
                  onOpenSettingsTab('cloud');
                }}
                className={dropdownItemClass}
              >
                <span>إعدادات المزامنة</span>
              </button>

              <button
                onClick={() => {
                  closeMenu();
                  onOpenSettingsTab('reset');
                }}
                className={dropdownItemClass}
              >
                <span>إعدادات النسخ الاحتياطي</span>
              </button>
            </div>
          )}
        </div>

        {/* 7. مساعدة Help */}
        <div className="relative">
          {menuItemBtn('help', 'مساعدة')}
          {activeMenu === 'help' && (
            <div className="absolute right-0 top-full mt-0.5 w-56 bg-white border border-slate-200 rounded-md shadow-xl py-1 z-50 text-right animate-in fade-in duration-75">
              <button
                onClick={() => {
                  closeMenu();
                  onOpenUserGuide();
                }}
                className={dropdownItemClass}
              >
                <div className="flex items-center gap-2">
                  <HelpCircle className="w-3.5 h-3.5 text-blue-600" />
                  <span>دليل الاستخدام</span>
                </div>
              </button>

              <button
                onClick={() => {
                  closeMenu();
                  onOpenShortcuts();
                }}
                className={dropdownItemClass}
              >
                <div className="flex items-center gap-2">
                  <Keyboard className="w-3.5 h-3.5 text-slate-600" />
                  <span>اختصارات لوحة المفاتيح</span>
                </div>
                <kbd className="text-[10px] text-slate-400 font-mono">F1</kbd>
              </button>

              <div className={dividerClass} />

              <button
                onClick={() => {
                  closeMenu();
                  onOpenAbout();
                }}
                className={dropdownItemClass}
              >
                <div className="flex items-center gap-2">
                  <Info className="w-3.5 h-3.5 text-slate-600" />
                  <span>حول التطبيق</span>
                </div>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Left side in RTL: Google account + Quick status & vault status indicator */}
      <div className="flex items-center gap-2 text-xs text-slate-500 font-mono">
        {userEmail && (
          <button
            type="button"
            onClick={() => onOpenSettingsTab('cloud')}
            className="flex items-center gap-1.5 text-[11px] text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 px-2 py-0.5 rounded cursor-pointer transition-colors"
            title={currentIp ? `حساب Google الموثق · IP: ${currentIp}` : 'إدارة حساب Google والأجهزة'}
          >
            {userPhotoUrl ? (
              <img
                src={userPhotoUrl}
                alt={userEmail}
                className="w-4 h-4 rounded-full object-cover"
                referrerPolicy="no-referrer"
              />
            ) : (
              <span className="w-4 h-4 rounded-full bg-blue-600 text-white text-[9px] font-bold flex items-center justify-center">
                {userEmail[0].toUpperCase()}
              </span>
            )}
            <span className="max-w-[150px] truncate">{userEmail}</span>
          </button>
        )}
        <span className="text-[11px] text-slate-400 hidden md:inline">MOSTAMSAKATI v2.4 Desktop</span>
        {hasMasterPassword && (
          <button
            onClick={onLockVault}
            className="flex items-center gap-1 text-[11px] text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 px-2 py-0.5 rounded cursor-pointer transition-colors"
            title="قفل الخزانة فوراً (Ctrl+L)"
          >
            <Lock className="w-3 h-3" />
            <span className="font-sans">مشفر</span>
          </button>
        )}
      </div>
    </div>
  );
};
