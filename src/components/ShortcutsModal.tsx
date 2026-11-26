import React, { useEffect } from 'react';
import { X, Keyboard } from 'lucide-react';
import { useLayoutMode } from '../hooks/useViewportMode';

interface ShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const SHORTCUTS = [
  { key: 'Ctrl + N', desc: 'إضافة مستمسك جديد' },
  { key: 'Ctrl + G', desc: 'إنشاء مجموعة جديدة' },
  { key: 'Ctrl + F', desc: 'التركيز على البحث الشامل' },
  { key: 'Ctrl + A', desc: 'تحديد جميع المستمسكات المعروضة' },
  { key: 'Ctrl + P', desc: 'فتح استوديو الطباعة' },
  { key: 'Ctrl + E', desc: 'تصدير المستمسكات المحددة' },
  { key: 'Ctrl + L', desc: 'قفل الخزانة فوراً' },
  { key: 'Delete', desc: 'نقل المحدد إلى سلة المحذوفات' },
  { key: 'F2', desc: 'فتح وتعديل المستمسك المحدد' },
  { key: 'Esc', desc: 'إغلاق النوافذ أو إلغاء التحديد' },
  { key: 'Double Click', desc: 'فتح نافذة تفاصيل المستمسك' },
  { key: 'Right Click', desc: 'عرض القائمة السياقية للأوامر' },
];

export const ShortcutsModal: React.FC<ShortcutsModalProps> = ({ isOpen, onClose }) => {
  const { isMobile } = useLayoutMode();

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 backdrop-blur-[1px] select-none ${
        isMobile ? 'p-0' : 'p-4'
      }`}
      dir="rtl"
    >
      <div
        className={`w-full bg-white overflow-hidden flex flex-col ${
          isMobile
            ? 'h-[100dvh] max-w-none rounded-none border-0'
            : 'max-w-md border border-slate-200 rounded-lg shadow-2xl'
        }`}
      >
        {/* Header */}
        <header
          className={`px-4 bg-white border-b border-slate-200 flex items-center justify-between gap-4 shrink-0 ${
            isMobile ? 'min-h-[50px] pt-safe' : 'h-12'
          }`}
        >
          <div className="flex items-center gap-2.5">
            <Keyboard className="w-4 h-4 text-blue-600" />
            <h2 className="font-bold text-sm text-slate-900">اختصارات لوحة المفاتيح</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className={`text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded cursor-pointer transition-colors flex items-center justify-center ${
              isMobile ? 'min-w-[44px] min-h-[44px]' : 'p-1.5'
            }`}
            aria-label="إغلاق"
          >
            <X className={isMobile ? 'w-5 h-5' : 'w-4 h-4'} />
          </button>
        </header>

        {/* Shortcuts List */}
        <div className={`p-4 overflow-y-auto text-xs ${isMobile ? 'flex-1' : 'max-h-96'}`}>
          <div className="divide-y divide-slate-200 border border-slate-200 rounded-md">
            {SHORTCUTS.map((s) => (
              <div key={s.key} className="px-3.5 py-2.5 flex items-center justify-between gap-4 bg-white">
                <span className="text-slate-800 font-medium">{s.desc}</span>
                <kbd
                  dir="ltr"
                  className="bg-slate-50 text-slate-700 border border-slate-300 font-mono tabular-nums text-[11px] px-2 py-0.5 rounded shrink-0"
                >
                  {s.key}
                </kbd>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <footer
          className={`px-4 border-t border-slate-200 flex justify-end items-center shrink-0 ${
            isMobile ? 'bg-white/95 backdrop-blur-md pb-safe h-[calc(60px+env(safe-area-inset-bottom,0px))]' : 'bg-white h-13'
          }`}
        >
          <button
            type="button"
            onClick={onClose}
            className={`px-5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold cursor-pointer transition-colors ${
              isMobile ? 'min-h-[44px] w-full rounded-xl' : 'py-1.5 rounded-md'
            }`}
          >
            إغلاق
          </button>
        </footer>
      </div>
    </div>
  );
};
