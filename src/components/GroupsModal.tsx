import React, { useState, useRef } from 'react';
import { X, Check, Trash2, Shield, Upload, RotateCcw } from 'lucide-react';
import { DocumentGroup, MostamsakDocument } from '../types';
import {
  GroupIcon,
  SYSTEM_GROUP_ICONS,
  isCustomImageIcon,
  isCustomEmojiIcon,
} from './GroupIcon';
import { useLayoutMode } from '../hooks/useViewportMode';

interface GroupsModalProps {
  isOpen: boolean;
  onClose: () => void;
  groups: DocumentGroup[];
  documents: MostamsakDocument[];
  initialEditingGroup?: DocumentGroup | null;
  onSaveGroup: (group: DocumentGroup) => Promise<void>;
  onDeleteGroup: (groupId: string, targetGroupId?: string) => Promise<void>;
}

function resizeIconFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('فشل قراءة ملف الأيقونة'));
    reader.onload = () => {
      const result = reader.result as string;
      if (file.type === 'image/svg+xml' && result.length < 32768) {
        resolve(result);
        return;
      }
      const img = new Image();
      img.onerror = () => reject(new Error('ملف الصورة غير صالح'));
      img.onload = () => {
        const size = 96;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(result);
          return;
        }
        const scale = Math.min(size / img.width, size / img.height);
        const w = img.width * scale;
        const h = img.height * scale;
        ctx.clearRect(0, 0, size, size);
        ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);
        resolve(canvas.toDataURL('image/png'));
      };
      img.src = result;
    };
    reader.readAsDataURL(file);
  });
}

export const GroupsModal: React.FC<GroupsModalProps> = ({
  isOpen,
  onClose,
  groups,
  documents,
  initialEditingGroup,
  onSaveGroup,
  onDeleteGroup,
}) => {
  const { isMobile } = useLayoutMode();
  const [name, setName] = useState(initialEditingGroup?.name || '');
  const [color, setColor] = useState(initialEditingGroup?.color || '#3b82f6');
  const [icon, setIcon] = useState(initialEditingGroup?.icon || 'Folder');
  const [iconSource, setIconSource] = useState<'system' | 'custom'>(() =>
    isCustomImageIcon(initialEditingGroup?.icon) || isCustomEmojiIcon(initialEditingGroup?.icon)
      ? 'custom'
      : 'system'
  );
  const [customEmoji, setCustomEmoji] = useState(() =>
    isCustomEmojiIcon(initialEditingGroup?.icon) ? initialEditingGroup!.icon.slice(6) : ''
  );
  const [description, setDescription] = useState(initialEditingGroup?.description || '');
  const [isLocked, setIsLocked] = useState(initialEditingGroup?.isLocked || false);
  const [password, setPassword] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Delete confirmation dialog
  const [deletingGroup, setDeletingGroup] = useState<DocumentGroup | null>(null);
  const [migrationTargetGroup, setMigrationTargetGroup] = useState<string>('');

  React.useEffect(() => {
    if (initialEditingGroup) {
      const grpIcon = initialEditingGroup.icon || 'Folder';
      setName(initialEditingGroup.name);
      setColor(initialEditingGroup.color);
      setIcon(grpIcon);
      setIconSource(isCustomImageIcon(grpIcon) || isCustomEmojiIcon(grpIcon) ? 'custom' : 'system');
      setCustomEmoji(isCustomEmojiIcon(grpIcon) ? grpIcon.slice(6) : '');
      setDescription(initialEditingGroup.description || '');
      setIsLocked(initialEditingGroup.isLocked || false);
    } else {
      setName('');
      setColor('#3b82f6');
      setIcon('Folder');
      setIconSource('system');
      setCustomEmoji('');
      setDescription('');
      setIsLocked(false);
      setPassword('');
    }
  }, [initialEditingGroup, isOpen]);

  if (!isOpen) return null;

  const colorPalette = [
    '#3b82f6', // Blue
    '#10b981', // Emerald
    '#f59e0b', // Amber
    '#8b5cf6', // Violet
    '#ec4899', // Pink
    '#06b6d4', // Cyan
    '#ef4444', // Red
    '#64748b', // Slate
  ];

  const handleCustomFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await resizeIconFile(file);
      setIcon(dataUrl);
      setCustomEmoji('');
      setIconSource('custom');
    } catch (err) {
      console.error('Failed to process custom icon:', err);
    } finally {
      e.target.value = '';
    }
  };

  const handleSave = async () => {
    if (!name.trim()) return;

    const resolvedIcon = icon && icon.trim() ? icon.trim() : 'Folder';

    const group: DocumentGroup = {
      id: initialEditingGroup?.id || 'grp_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      name: name.trim(),
      color,
      icon: resolvedIcon,
      description: description.trim(),
      isLocked,
      passwordHash: isLocked && password ? password : initialEditingGroup?.passwordHash,
      createdAt: initialEditingGroup?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await onSaveGroup(group);
    onClose();
  };

  const handleConfirmDelete = async () => {
    if (!deletingGroup) return;
    await onDeleteGroup(deletingGroup.id, migrationTargetGroup || undefined);
    setDeletingGroup(null);
    onClose();
  };

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-[1px] select-none font-['Cairo',system-ui,sans-serif] ${
        isMobile ? 'p-0' : 'p-4'
      }`}
    >
      <div
        className={`w-full bg-white overflow-hidden flex flex-col text-right ${
          isMobile
            ? 'h-[100dvh] max-w-none rounded-none border-0'
            : 'max-w-md border border-slate-200 rounded-lg shadow-xl max-h-[90vh]'
        }`}
      >
        {/* Header */}
        <div
          className={`flex items-center justify-between px-4 bg-slate-50 border-b border-slate-200 shrink-0 ${
            isMobile ? 'min-h-[50px] pt-safe' : 'py-3'
          }`}
        >
          <div className="flex items-center gap-2">
            <GroupIcon icon={icon} color="#2563eb" className="w-4 h-4" />
            <span className="font-bold text-sm text-slate-800">
              {initialEditingGroup ? 'تعديل المجموعة' : 'إنشاء مجموعة جديدة'}
            </span>
          </div>
          <button
            onClick={onClose}
            className={`text-slate-400 hover:text-slate-700 rounded hover:bg-slate-200 cursor-pointer flex items-center justify-center ${
              isMobile ? 'min-w-[44px] min-h-[44px]' : 'p-1'
            }`}
          >
            <X className={isMobile ? 'w-5 h-5' : 'w-4 h-4'} />
          </button>
        </div>

        {/* Normal Edit / Create Body */}
        {!deletingGroup ? (
          <div className={`p-4 space-y-4 text-xs text-right overflow-y-auto flex-1 ${isMobile ? 'pb-[calc(1.25rem+env(safe-area-inset-bottom,0px))]' : ''}`}>
            <div>
              <label className="block text-slate-700 font-semibold mb-1">اسم المجموعة</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="مثال: مستمسكات السفر، معاملات الدائرة..."
                className={`w-full bg-white border border-slate-200 rounded px-3 text-slate-800 focus:border-blue-500 focus:outline-none ${
                  isMobile ? 'min-h-[42px] py-2 text-sm' : 'py-1.5'
                }`}
              />
            </div>

            {/* Color Palette */}
            <div>
              <label className="block text-slate-700 font-semibold mb-1">لون التمييز</label>
              <div className="flex items-center gap-2">
                {colorPalette.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    className="w-6 h-6 rounded-full cursor-pointer transition-transform hover:scale-110 flex items-center justify-center"
                    style={{ backgroundColor: c }}
                  >
                    {color === c && <Check className="w-3.5 h-3.5 text-white stroke-[3]" />}
                  </button>
                ))}
              </div>
            </div>

            {/* Group Icon Selector (System or Custom) */}
            <div className="bg-slate-50 p-3 rounded border border-slate-200 space-y-2.5">
              <div className="flex items-center justify-between">
                <label className="text-slate-700 font-semibold">أيقونة المجموعة</label>
                <div className="flex items-center gap-1 bg-white border border-slate-200 rounded p-0.5">
                  <button
                    type="button"
                    onClick={() => {
                      setIconSource('system');
                      if (isCustomImageIcon(icon) || isCustomEmojiIcon(icon)) {
                        setIcon('Folder');
                      }
                    }}
                    className={`px-2 py-0.5 rounded text-[11px] font-medium cursor-pointer transition-colors ${
                      iconSource === 'system'
                        ? 'bg-blue-600 text-white'
                        : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    أيقونة نظامية
                  </button>
                  <button
                    type="button"
                    onClick={() => setIconSource('custom')}
                    className={`px-2 py-0.5 rounded text-[11px] font-medium cursor-pointer transition-colors ${
                      iconSource === 'custom'
                        ? 'bg-blue-600 text-white'
                        : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    أيقونة مخصصة
                  </button>
                </div>
              </div>

              {iconSource === 'system' ? (
                <div
                  className={`grid gap-1.5 overflow-y-auto p-1 bg-white rounded border border-slate-200 ${
                    isMobile ? 'grid-cols-6 max-h-44' : 'grid-cols-8 max-h-32'
                  }`}
                >
                  {SYSTEM_GROUP_ICONS.map((item) => {
                    const IconComp = item.component;
                    const isSelected = icon === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setIcon(item.id)}
                        title={item.label}
                        className={`rounded flex items-center justify-center cursor-pointer transition-all ${
                          isMobile ? 'h-10' : 'h-8'
                        } ${
                          isSelected
                            ? 'bg-blue-50 ring-2 ring-blue-500 scale-105'
                            : 'hover:bg-slate-100'
                        }`}
                      >
                        <IconComp className="w-4 h-4 text-blue-600" />
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="space-y-2.5 bg-white p-2.5 rounded border border-slate-200">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-md border border-slate-200 bg-slate-50 flex items-center justify-center shrink-0">
                      <GroupIcon icon={icon} color="#2563eb" className="w-6 h-6" />
                    </div>
                    <div className="flex-1 flex flex-wrap items-center gap-2">
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/png,image/jpeg,image/webp,image/svg+xml"
                        onChange={handleCustomFileChange}
                        className="hidden"
                      />
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded border border-slate-200 flex items-center gap-1.5 cursor-pointer font-medium"
                      >
                        <Upload className="w-3.5 h-3.5 text-blue-600" />
                        <span>رفع صورة أيقونة</span>
                      </button>
                      {(isCustomImageIcon(icon) || isCustomEmojiIcon(icon)) && (
                        <button
                          type="button"
                          onClick={() => {
                            setIcon('Folder');
                            setCustomEmoji('');
                            setIconSource('system');
                          }}
                          className="px-2 py-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded flex items-center gap-1 cursor-pointer"
                          title="استعادة الأيقونة النظامية"
                        >
                          <RotateCcw className="w-3 h-3" />
                          <span>افتراضي</span>
                        </button>
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] text-slate-500 mb-1">
                      أو أدخل رمزاً تعبيرياً مخصصاً (Emoji / رمز):
                    </label>
                    <input
                      type="text"
                      value={customEmoji}
                      onChange={(e) => {
                        const val = e.target.value;
                        setCustomEmoji(val);
                        if (val.trim()) {
                          setIcon(`emoji:${val.trim().slice(0, 4)}`);
                        } else if (!isCustomImageIcon(icon)) {
                          setIcon('Folder');
                        }
                      }}
                      placeholder="مثال: 🏛️ أو 💼 أو 🪪"
                      className="w-full bg-slate-50 border border-slate-200 rounded px-2.5 py-1 text-slate-800 focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                </div>
              )}
            </div>

            <div>
              <label className="block text-slate-700 font-semibold mb-1">وصف المجموعة (اختياري)</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                placeholder="وصف مختصر لمحتويات المجموعة..."
                className="w-full bg-white border border-slate-200 rounded px-3 py-1.5 text-slate-800 focus:border-blue-500 focus:outline-none resize-none"
              />
            </div>

            {/* Lock with Password */}
            <div className="bg-slate-50 p-3 rounded border border-slate-200 space-y-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isLocked}
                  onChange={(e) => setIsLocked(e.target.checked)}
                  className="rounded accent-amber-500"
                />
                <span className="font-semibold text-slate-700 flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5 text-amber-500" />
                  <span>قفل المجموعة بكلمة مرور خاصة</span>
                </span>
              </label>

              {isLocked && (
                <div>
                  <label className="text-[10px] text-slate-500 block mb-1">كلمة مرور المجموعة</label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="أدخل كلمة مرور لقفل هذه المجموعة..."
                    className="w-full bg-white border border-slate-200 rounded px-2.5 py-1 text-slate-800"
                  />
                </div>
              )}
            </div>

            <div className={`pt-2 flex items-center justify-between gap-2 ${isMobile ? 'flex-wrap' : ''}`}>
              {initialEditingGroup && (
                <button
                  type="button"
                  onClick={() => setDeletingGroup(initialEditingGroup)}
                  className={`px-3 bg-red-50 hover:bg-red-100 text-red-600 rounded border border-red-200 flex items-center gap-1 cursor-pointer ${
                    isMobile ? 'min-h-[42px] py-2' : 'py-1.5'
                  }`}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>حذف المجموعة</span>
                </button>
              )}

              <div className="flex-1" />

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className={`px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded cursor-pointer ${
                    isMobile ? 'min-h-[42px] py-2 px-4' : 'py-1.5'
                  }`}
                >
                  إلغاء
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={!name.trim()}
                  className={`px-4 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded font-bold cursor-pointer ${
                    isMobile ? 'min-h-[42px] py-2 px-5' : 'py-1.5'
                  }`}
                >
                  حفظ المجموعة
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* Safe Group Delete Confirmation */
          <div className={`p-4 space-y-4 text-xs text-right flex-1 overflow-y-auto ${isMobile ? 'pb-[calc(1.25rem+env(safe-area-inset-bottom,0px))]' : ''}`}>
            <div className="p-3 bg-amber-50 border border-amber-200 rounded text-amber-800">
              <p className="font-bold mb-1">تأكيد حذف مجموعة: {deletingGroup.name}</p>
              <p className="text-[11px] leading-relaxed">
                تحتوي هذه المجموعة على{' '}
                {documents.filter((d) => d.groupId === deletingGroup.id).length} مستمسك. وفقاً لسياسة الأمان، لن يتم
                حذف المستمسكات مطلقاً. يرجى اختيار الإجراء المناسب لها:
              </p>
            </div>

            <div>
              <label className="block text-slate-700 font-semibold mb-1">ماذا تريد أن تفعل بمستمسكات هذه المجموعة؟</label>
              <select
                value={migrationTargetGroup}
                onChange={(e) => setMigrationTargetGroup(e.target.value)}
                className={`w-full bg-white border border-slate-200 rounded px-2.5 text-slate-800 ${
                  isMobile ? 'min-h-[42px] py-2' : 'py-1.5'
                }`}
              >
                <option value="">الاحتفاظ بها بدون مجموعة (عام)</option>
                {groups
                  .filter((g) => g.id !== deletingGroup.id)
                  .map((g) => (
                    <option key={g.id} value={g.id}>
                      نقل جميع المستمسكات إلى مجموعة: {g.name}
                    </option>
                  ))}
              </select>
            </div>

            <div className="flex items-center justify-between gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeletingGroup(null)}
                className={`px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded cursor-pointer ${
                  isMobile ? 'min-h-[44px] px-4' : 'py-1.5'
                }`}
              >
                رجوع
              </button>

              <button
                type="button"
                onClick={handleConfirmDelete}
                className={`px-4 bg-red-600 hover:bg-red-700 text-white rounded font-bold cursor-pointer ${
                  isMobile ? 'min-h-[44px] flex-1' : 'py-1.5'
                }`}
              >
                تأكيد حذف المجموعة وحفظ المستمسكات
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
