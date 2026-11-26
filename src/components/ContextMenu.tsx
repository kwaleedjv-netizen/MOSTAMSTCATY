import React, { useEffect, useRef, useState } from 'react';
import {
  ExternalLink,
  Eye,
  Edit,
  FolderInput,
  Star,
  Copy,
  Printer,
  Download,
  Trash2,
  FilePlus,
  FolderPlus,
  RefreshCw,
  LayoutGrid,
  List,
  SlidersHorizontal,
  Lock,
  RotateCcw,
  History,
  CheckSquare,
} from 'lucide-react';
import { MostamsakDocument, DocumentGroup, ViewMode } from '../types';
import { VIEW_MODES, ViewModeIcon } from '../constants/viewModes';

export type ContextMenuType =
  | { kind: 'document'; document: MostamsakDocument }
  | { kind: 'group'; group: DocumentGroup }
  | { kind: 'canvas' };

interface ContextMenuProps {
  x: number;
  y: number;
  menu: ContextMenuType;
  groups: DocumentGroup[];
  onClose: () => void;

  // Document actions
  onOpenDoc?: (doc: MostamsakDocument) => void;
  onPreviewDoc?: (doc: MostamsakDocument) => void;
  onEditDoc?: (doc: MostamsakDocument) => void;
  onRenameDoc?: (doc: MostamsakDocument) => void;
  onDuplicateDoc?: (doc: MostamsakDocument) => void;
  onMoveDocToGroup?: (doc: MostamsakDocument, groupId: string) => void;
  onToggleFavoriteDoc?: (doc: MostamsakDocument) => void;
  onToggleCoverFace?: (doc: MostamsakDocument) => void;
  onExportDoc?: (doc: MostamsakDocument) => void;
  onPrintDoc?: (doc: MostamsakDocument) => void;
  onShowPropertiesDoc?: (doc: MostamsakDocument) => void;
  onShowHistoryDoc?: (doc: MostamsakDocument) => void;
  onTrashDoc?: (doc: MostamsakDocument) => void;

  // Group actions
  onOpenGroup?: (group: DocumentGroup) => void;
  onEditGroup?: (group: DocumentGroup) => void;
  onAddDocToGroup?: (group: DocumentGroup) => void;
  onExportGroup?: (group: DocumentGroup) => void;
  onLockGroup?: (group: DocumentGroup) => void;
  onDeleteGroup?: (group: DocumentGroup) => void;

  // Canvas actions
  onAddDocument?: () => void;
  onCreateGroup?: () => void;
  onImport?: () => void;
  onSelectAll?: () => void;
  onRefresh?: () => void;
  onChangeViewMode?: (mode: ViewMode) => void;
}

export const ContextMenu: React.FC<ContextMenuProps> = ({
  x,
  y,
  menu,
  groups,
  onClose,
  onOpenDoc,
  onPreviewDoc,
  onEditDoc,
  onRenameDoc,
  onDuplicateDoc,
  onMoveDocToGroup,
  onToggleFavoriteDoc,
  onToggleCoverFace,
  onExportDoc,
  onPrintDoc,
  onShowPropertiesDoc,
  onShowHistoryDoc,
  onTrashDoc,
  onOpenGroup,
  onEditGroup,
  onAddDocToGroup,
  onExportGroup,
  onLockGroup,
  onDeleteGroup,
  onAddDocument,
  onCreateGroup,
  onImport,
  onSelectAll,
  onRefresh,
  onChangeViewMode,
}) => {
  const menuRef = useRef<HTMLDivElement>(null);
  const [showGroupSubmenu, setShowGroupSubmenu] = useState(false);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    window.addEventListener('mousedown', handleOutsideClick);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('mousedown', handleOutsideClick);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  const adjustedX = Math.max(8, Math.min(x, window.innerWidth - 236));
  const adjustedY = Math.max(8, Math.min(y, window.innerHeight - 420));

  const itemClass =
    'w-full flex items-center justify-between px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-100 hover:text-slate-900 transition-colors cursor-pointer text-right';
  const divider = <div className="h-px bg-slate-200 my-1" />;

  return (
    <div
      ref={menuRef}
      style={{ left: `${adjustedX}px`, top: `${adjustedY}px` }}
      className="fixed z-50 w-56 bg-white border border-slate-200 rounded-lg shadow-xl py-1 text-right select-none"
      dir="rtl"
    >
      {/* 1. DOCUMENT CONTEXT MENU */}
      {menu.kind === 'document' && (
        <>
          <button
            type="button"
            onClick={() => {
              onOpenDoc?.(menu.document);
              onClose();
            }}
            className={`${itemClass} font-bold text-blue-600`}
          >
            <div className="flex items-center gap-2">
              <ExternalLink className="w-3.5 h-3.5" />
              <span>فتح التفاصيل</span>
            </div>
            <span className="text-[10px] text-slate-400 font-mono" dir="ltr">Enter</span>
          </button>

          <button
            type="button"
            onClick={() => {
              onPreviewDoc?.(menu.document);
              onClose();
            }}
            className={itemClass}
          >
            <div className="flex items-center gap-2">
              <Eye className="w-3.5 h-3.5 text-slate-500" />
              <span>معاينة</span>
            </div>
          </button>

          <button
            type="button"
            onClick={() => {
              onEditDoc?.(menu.document);
              onClose();
            }}
            className={itemClass}
          >
            <div className="flex items-center gap-2">
              <Edit className="w-3.5 h-3.5 text-slate-500" />
              <span>تعديل في الاستوديو</span>
            </div>
          </button>

          <button
            type="button"
            onClick={() => {
              onRenameDoc?.(menu.document);
              onClose();
            }}
            className={itemClass}
          >
            <div className="flex items-center gap-2">
              <Edit className="w-3.5 h-3.5 text-slate-500" />
              <span>إعادة تسمية</span>
            </div>
            <span className="text-[10px] text-slate-400 font-mono" dir="ltr">F2</span>
          </button>

          <button
            type="button"
            onClick={() => {
              onDuplicateDoc?.(menu.document);
              onClose();
            }}
            className={itemClass}
          >
            <div className="flex items-center gap-2">
              <Copy className="w-3.5 h-3.5 text-slate-500" />
              <span>إنشاء نسخة</span>
            </div>
          </button>

          {/* Move to group submenu */}
          <div
            className="relative"
            onMouseEnter={() => setShowGroupSubmenu(true)}
            onMouseLeave={() => setShowGroupSubmenu(false)}
          >
            <div className={itemClass}>
              <div className="flex items-center gap-2">
                <FolderInput className="w-3.5 h-3.5 text-slate-500" />
                <span>نقل إلى مجموعة</span>
              </div>
              <span className="text-[10px] text-slate-400">◀</span>
            </div>

            {showGroupSubmenu && (
              <div className="absolute right-full top-0 w-48 bg-white border border-slate-200 rounded-lg shadow-xl py-1 z-50 text-right">
                {groups.length === 0 ? (
                  <div className="px-3 py-1.5 text-xs text-slate-400">لا توجد مجموعات</div>
                ) : (
                  groups.map((g) => (
                    <button
                      key={g.id}
                      type="button"
                      onClick={() => {
                        onMoveDocToGroup?.(menu.document, g.id);
                        onClose();
                      }}
                      className={itemClass}
                    >
                      <div className="flex items-center gap-2 truncate">
                        <span className="w-2.5 h-2.5 rounded-xs shrink-0" style={{ backgroundColor: g.color }} />
                        <span className="truncate">{g.name}</span>
                      </div>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          {menu.document.sidesCount === 2 && (
            <button
              type="button"
              onClick={() => {
                onToggleCoverFace?.(menu.document);
                onClose();
              }}
              className={itemClass}
            >
              <div className="flex items-center gap-2">
                <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
                <span>تبديل غلاف العرض</span>
              </div>
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              onToggleFavoriteDoc?.(menu.document);
              onClose();
            }}
            className={itemClass}
          >
            <div className="flex items-center gap-2">
              <Star className="w-3.5 h-3.5 text-amber-500" />
              <span>{menu.document.isFavorite ? 'إزالة من المفضلة' : 'إضافة إلى المفضلة'}</span>
            </div>
          </button>

          {divider}

          <button
            type="button"
            onClick={() => {
              onExportDoc?.(menu.document);
              onClose();
            }}
            className={itemClass}
          >
            <div className="flex items-center gap-2">
              <Download className="w-3.5 h-3.5 text-slate-500" />
              <span>تصدير</span>
            </div>
            <span className="text-[10px] text-slate-400 font-mono" dir="ltr">Ctrl+E</span>
          </button>

          <button
            type="button"
            onClick={() => {
              onPrintDoc?.(menu.document);
              onClose();
            }}
            className={`${itemClass} font-semibold text-blue-700 bg-blue-50/50 hover:bg-blue-100/60`}
          >
            <div className="flex items-center gap-2">
              <Printer className="w-3.5 h-3.5 text-blue-600" />
              <span>إرسال للطباعة</span>
            </div>
            <span className="text-[10px] text-blue-600 font-mono" dir="ltr">Ctrl+P</span>
          </button>

          <button
            type="button"
            onClick={() => {
              onShowPropertiesDoc?.(menu.document);
              onClose();
            }}
            className={itemClass}
          >
            <div className="flex items-center gap-2">
              <SlidersHorizontal className="w-3.5 h-3.5 text-slate-500" />
              <span>الخصائص</span>
            </div>
          </button>

          <button
            type="button"
            onClick={() => {
              onShowHistoryDoc?.(menu.document);
              onClose();
            }}
            className={itemClass}
          >
            <div className="flex items-center gap-2">
              <History className="w-3.5 h-3.5 text-slate-500" />
              <span>سجل التغييرات</span>
            </div>
          </button>

          {divider}

          <button
            type="button"
            onClick={() => {
              onTrashDoc?.(menu.document);
              onClose();
            }}
            className={`${itemClass} text-red-600 hover:text-red-700 hover:bg-red-50`}
          >
            <div className="flex items-center gap-2">
              <Trash2 className="w-3.5 h-3.5" />
              <span>نقل إلى السلة</span>
            </div>
            <span className="text-[10px] text-slate-400 font-mono" dir="ltr">Del</span>
          </button>
        </>
      )}

      {/* 2. GROUP CONTEXT MENU */}
      {menu.kind === 'group' && (
        <>
          <button
            type="button"
            onClick={() => {
              onOpenGroup?.(menu.group);
              onClose();
            }}
            className={`${itemClass} font-bold text-blue-600`}
          >
            <div className="flex items-center gap-2">
              <ExternalLink className="w-3.5 h-3.5" />
              <span>عرض المجموعة</span>
            </div>
          </button>

          <button
            type="button"
            onClick={() => {
              onAddDocToGroup?.(menu.group);
              onClose();
            }}
            className={itemClass}
          >
            <div className="flex items-center gap-2">
              <FilePlus className="w-3.5 h-3.5 text-blue-600" />
              <span>إضافة مستمسك هنا</span>
            </div>
          </button>

          <button
            type="button"
            onClick={() => {
              onEditGroup?.(menu.group);
              onClose();
            }}
            className={itemClass}
          >
            <div className="flex items-center gap-2">
              <Edit className="w-3.5 h-3.5 text-slate-500" />
              <span>تعديل المجموعة</span>
            </div>
          </button>

          <button
            type="button"
            onClick={() => {
              onExportGroup?.(menu.group);
              onClose();
            }}
            className={itemClass}
          >
            <div className="flex items-center gap-2">
              <Download className="w-3.5 h-3.5 text-slate-500" />
              <span>طباعة مستمسكات المجموعة</span>
            </div>
          </button>

          <button
            type="button"
            onClick={() => {
              onLockGroup?.(menu.group);
              onClose();
            }}
            className={itemClass}
          >
            <div className="flex items-center gap-2">
              <Lock className="w-3.5 h-3.5 text-amber-600" />
              <span>{menu.group.isLocked ? 'إلغاء قفل المجموعة' : 'قفل المجموعة'}</span>
            </div>
          </button>

          {divider}

          <button
            type="button"
            onClick={() => {
              onDeleteGroup?.(menu.group);
              onClose();
            }}
            className={`${itemClass} text-red-600 hover:text-red-700 hover:bg-red-50`}
          >
            <div className="flex items-center gap-2">
              <Trash2 className="w-3.5 h-3.5" />
              <span>حذف المجموعة</span>
            </div>
          </button>
        </>
      )}

      {/* 3. EMPTY CANVAS CONTEXT MENU */}
      {menu.kind === 'canvas' && (
        <>
          <button
            type="button"
            onClick={() => {
              onAddDocument?.();
              onClose();
            }}
            className={`${itemClass} font-bold text-blue-600`}
          >
            <div className="flex items-center gap-2">
              <FilePlus className="w-3.5 h-3.5" />
              <span>إضافة مستمسك</span>
            </div>
            <span className="text-[10px] text-slate-400 font-mono" dir="ltr">Ctrl+N</span>
          </button>

          <button
            type="button"
            onClick={() => {
              onCreateGroup?.();
              onClose();
            }}
            className={itemClass}
          >
            <div className="flex items-center gap-2">
              <FolderPlus className="w-3.5 h-3.5 text-slate-500" />
              <span>إنشاء مجموعة</span>
            </div>
            <span className="text-[10px] text-slate-400 font-mono" dir="ltr">Ctrl+G</span>
          </button>

          <button
            type="button"
            onClick={() => {
              onImport?.();
              onClose();
            }}
            className={itemClass}
          >
            <div className="flex items-center gap-2">
              <Download className="w-3.5 h-3.5 text-slate-500" />
              <span>استيراد ملفات</span>
            </div>
          </button>

          {divider}

          <button
            type="button"
            onClick={() => {
              onSelectAll?.();
              onClose();
            }}
            className={itemClass}
          >
            <div className="flex items-center gap-2">
              <CheckSquare className="w-3.5 h-3.5 text-slate-500" />
              <span>تحديد الكل</span>
            </div>
            <span className="text-[10px] text-slate-400 font-mono" dir="ltr">Ctrl+A</span>
          </button>

          <button
            type="button"
            onClick={() => {
              onRefresh?.();
              onClose();
            }}
            className={itemClass}
          >
            <div className="flex items-center gap-2">
              <RefreshCw className="w-3.5 h-3.5 text-slate-500" />
              <span>تحديث العرض</span>
            </div>
          </button>

          {divider}

          <div className="px-3 py-1 text-[10px] text-slate-400 font-bold">طريقة العرض</div>
          <div className="grid grid-cols-5 gap-1 px-2 py-1">
            {VIEW_MODES.map((mode) => (
              <button
                key={mode.id}
                type="button"
                onClick={() => {
                  onChangeViewMode?.(mode.id);
                  onClose();
                }}
                className="p-1.5 rounded bg-slate-100 hover:bg-blue-50 hover:text-blue-600 text-slate-700 flex justify-center cursor-pointer transition-colors"
                aria-label={mode.label}
                title={mode.label}
              >
                <ViewModeIcon mode={mode.id} className="w-3.5 h-3.5" />
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
};
