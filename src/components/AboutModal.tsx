import React, { useEffect } from 'react';
import { X, CheckCircle2 } from 'lucide-react';
import { useLayoutMode } from '../hooks/useViewportMode';

interface AboutModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AboutModal: React.FC<AboutModalProps> = ({ isOpen, onClose }) => {
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
            : 'max-w-lg border border-slate-200 rounded-lg shadow-2xl'
        }`}
      >
        {/* Header */}
        <header
          className={`px-4 bg-white border-b border-slate-200 flex items-center justify-between gap-4 shrink-0 ${
            isMobile ? 'min-h-[50px] pt-safe' : 'h-12'
          }`}
        >
          <h2 className="font-bold text-sm text-slate-900">حول مستمسكاتي</h2>
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

        {/* Content */}
        <div className="p-5 space-y-4 text-xs text-slate-700 leading-relaxed overflow-y-auto flex-1">
          <div className="pb-3 border-b border-slate-200 flex items-center gap-3">
            <div className="w-9 h-9 rounded-md bg-blue-600 text-white flex items-center justify-center text-base font-bold shrink-0">
              م
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">مستمسكاتي – MOSTAMSAKATI</h3>
              <p className="text-[11px] text-slate-500">خزانة رقمية واستوديو طباعة للوثائق الرسمية</p>
            </div>
          </div>

          <p className="text-slate-700 leading-relaxed">
            بيئة عمل متكاملة لحفظ وأرشفة وتعديل وطباعة المستمسكات والوثائق الرسمية (البطاقة الوطنية، جواز السفر، بطاقة السكن، شهادة الجنسية، وإجازة السوق) بالقياسات الفيزيائية الحقيقية بالمليمتر.
          </p>

          <div className="border-t border-slate-200 pt-3.5 space-y-2.5">
            <div className="flex items-center gap-2 font-medium text-slate-800">
              <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0" />
              <span>تخزين محلي خاص وتشفير (AES-GCM / PBKDF2)</span>
            </div>
            <div className="flex items-center gap-2 font-medium text-slate-800">
              <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0" />
              <span>مطابقة أبعاد الطباعة الحقيقية 1:1 واستوديو ترتيب الأوراق</span>
            </div>
            <div className="flex items-center gap-2 font-medium text-slate-800">
              <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0" />
              <span>إدارة المجموعات، النسخ الاحتياطي المشفر، وسجل العمليات الكامل</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <footer
          className={`px-4 border-t border-slate-200 flex items-center justify-between shrink-0 text-xs ${
            isMobile ? 'bg-white/95 backdrop-blur-md pb-safe h-[calc(60px+env(safe-area-inset-bottom,0px))]' : 'bg-white h-13'
          }`}
        >
          <span className="text-[11px] text-slate-400 font-mono tabular-nums" dir="ltr">
            © {new Date().getFullYear()} MOSTAMSAKATI
          </span>
          <button
            type="button"
            onClick={onClose}
            className={`px-5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs transition-colors cursor-pointer ${
              isMobile ? 'min-h-[44px]' : 'py-1.5 rounded-md'
            }`}
          >
            إغلاق
          </button>
        </footer>
      </div>
    </div>
  );
};
