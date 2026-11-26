import React, { useEffect } from 'react';
import { X, CloudAlert, Copy } from 'lucide-react';
import { ConflictItem } from '../types';
import { useLayoutMode } from '../hooks/useViewportMode';

interface ConflictResolutionModalProps {
  isOpen: boolean;
  conflicts: ConflictItem[];
  onClose: () => void;
  onResolve: (conflict: ConflictItem, choice: 'keep_local' | 'keep_server' | 'keep_both') => Promise<void>;
}

export const ConflictResolutionModal: React.FC<ConflictResolutionModalProps> = ({
  isOpen,
  conflicts,
  onClose,
  onResolve,
}) => {
  const { isMobile } = useLayoutMode();
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  if (!isOpen || conflicts.length === 0) return null;

  const currentConflict = conflicts[0];
  const { clientVersion, serverVersion } = currentConflict;

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
            : 'max-w-3xl border border-slate-200 rounded-lg shadow-2xl max-h-[90vh]'
        }`}
      >
        {/* Header */}
        <header
          className={`px-4 bg-white border-b border-slate-200 flex items-center justify-between gap-4 shrink-0 ${
            isMobile ? 'min-h-[50px] pt-safe' : 'h-12'
          }`}
        >
          <div className="flex items-center gap-2.5">
            <CloudAlert className="w-4 h-4 text-amber-600" />
            <h2 className="font-bold text-sm text-slate-900">حل تعارض المزامنة السحابية</h2>
            <span className="text-xs text-slate-500 font-mono tabular-nums">
              {conflicts.length} تعارض
            </span>
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

        {/* Notice */}
        <div className="px-4 py-2.5 bg-amber-50/70 border-b border-amber-200 text-xs text-amber-900 leading-relaxed shrink-0">
          تم تعديل هذا المستمسك في وقت واحد من جهازين مختلفين. قارن بين النسختين واختر النسخة المعتمدة أو احتفظ بكلتيهما.
        </div>

        {/* Side-by-Side Comparison */}
        <div className="p-4 overflow-y-auto flex-1 grid grid-cols-1 md:grid-cols-2 gap-4 text-xs bg-slate-50/40">
          {/* Local Version */}
          <div className="bg-white border border-slate-200 rounded-lg overflow-hidden flex flex-col justify-between">
            <div>
              <div className="px-3.5 py-2.5 bg-slate-50/70 border-b border-slate-200 flex items-center justify-between">
                <span className="font-bold text-slate-900">النسخة المحلية</span>
                <span className="text-[11px] font-semibold text-blue-600">على هذا الجهاز</span>
              </div>

              <div className="h-44 studio-stage-grid border-b border-slate-200 p-3 flex items-center justify-center">
                <img
                  src={clientVersion.frontImage}
                  alt={clientVersion.title}
                  className="max-h-full max-w-full object-contain rounded-xs shadow-sm border border-slate-200 bg-white"
                />
              </div>

              <dl className="p-3.5 space-y-2 text-xs">
                <div className="flex items-start justify-between gap-3">
                  <dt className="text-slate-500 shrink-0">العنوان</dt>
                  <dd className="font-bold text-slate-900 text-left truncate">{clientVersion.title}</dd>
                </div>
                <div className="flex items-start justify-between gap-3">
                  <dt className="text-slate-500 shrink-0">الملاحظات</dt>
                  <dd className="text-slate-700 text-left line-clamp-2">
                    {clientVersion.notes || 'بدون ملاحظات'}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-3 pt-1 border-t border-slate-100">
                  <dt className="text-slate-500 shrink-0">آخر تعديل</dt>
                  <dd className="font-mono tabular-nums text-[11px] text-slate-600" dir="ltr">
                    {new Date(clientVersion.updatedAt).toLocaleString('ar-IQ')}
                  </dd>
                </div>
              </dl>
            </div>

            <div className="p-3 border-t border-slate-200 bg-slate-50/50">
              <button
                type="button"
                onClick={() => onResolve(currentConflict, 'keep_local')}
                className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-md cursor-pointer transition-colors"
              >
                اعتماد النسخة المحلية
              </button>
            </div>
          </div>

          {/* Server Version */}
          <div className="bg-white border border-slate-200 rounded-lg overflow-hidden flex flex-col justify-between">
            <div>
              <div className="px-3.5 py-2.5 bg-slate-50/70 border-b border-slate-200 flex items-center justify-between">
                <span className="font-bold text-slate-900">النسخة السحابية</span>
                <span className="text-[11px] font-semibold text-emerald-700">من الخادم</span>
              </div>

              <div className="h-44 studio-stage-grid border-b border-slate-200 p-3 flex items-center justify-center">
                <img
                  src={serverVersion.frontImage}
                  alt={serverVersion.title}
                  className="max-h-full max-w-full object-contain rounded-xs shadow-sm border border-slate-200 bg-white"
                />
              </div>

              <dl className="p-3.5 space-y-2 text-xs">
                <div className="flex items-start justify-between gap-3">
                  <dt className="text-slate-500 shrink-0">العنوان</dt>
                  <dd className="font-bold text-slate-900 text-left truncate">{serverVersion.title}</dd>
                </div>
                <div className="flex items-start justify-between gap-3">
                  <dt className="text-slate-500 shrink-0">الملاحظات</dt>
                  <dd className="text-slate-700 text-left line-clamp-2">
                    {serverVersion.notes || 'بدون ملاحظات'}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-3 pt-1 border-t border-slate-100">
                  <dt className="text-slate-500 shrink-0">آخر تعديل</dt>
                  <dd className="font-mono tabular-nums text-[11px] text-slate-600" dir="ltr">
                    {new Date(serverVersion.updatedAt).toLocaleString('ar-IQ')}
                  </dd>
                </div>
              </dl>
            </div>

            <div className="p-3 border-t border-slate-200 bg-slate-50/50">
              <button
                type="button"
                onClick={() => onResolve(currentConflict, 'keep_server')}
                className={`w-full bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-md cursor-pointer transition-colors ${
                  isMobile ? 'min-h-[44px] py-2.5' : 'py-2'
                }`}
              >
                اعتماد النسخة السحابية
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <footer
          className={`px-4 border-t border-slate-200 flex items-center justify-between gap-3 shrink-0 text-xs ${
            isMobile ? 'bg-white/95 backdrop-blur-md pb-safe h-[calc(60px+env(safe-area-inset-bottom,0px))]' : 'bg-white h-13'
          }`}
        >
          {!isMobile && (
            <span className="text-slate-500">أو احتفظ بالنسختين معاً كملفين منفصلين في الخزانة</span>
          )}
          <button
            type="button"
            onClick={() => onResolve(currentConflict, 'keep_both')}
            className={`px-4 bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 font-semibold cursor-pointer flex items-center justify-center gap-1.5 transition-colors ${
              isMobile ? 'min-h-[44px] w-full rounded-xl' : 'py-1.5 rounded-md'
            }`}
          >
            <Copy className="w-3.5 h-3.5 text-blue-600" />
            <span>الاحتفاظ بالنسختين معاً</span>
          </button>
        </footer>
      </div>
    </div>
  );
};
