import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import { useLayoutMode } from '../../hooks/useViewportMode';

interface MobileBottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  maxHeightClass?: string;
}

export const MobileBottomSheet: React.FC<MobileBottomSheetProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  footer,
  maxHeightClass = 'max-h-[86vh]',
}) => {
  const { isLandscape, height } = useLayoutMode();
  const isCompactLandscape = isLandscape && height < 540;

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
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/50 backdrop-blur-[2px] select-none"
      dir="rtl"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`w-full bg-white shadow-2xl flex flex-col overflow-hidden transition-transform duration-150 ${
          isCompactLandscape
            ? 'max-w-lg max-h-[92vh] rounded-2xl mx-4 my-auto border border-slate-200'
            : `sm:max-w-lg ${maxHeightClass} rounded-t-3xl sm:rounded-2xl border-t sm:border border-slate-200`
        }`}
      >
        {/* Drag Handle (Portrait) */}
        {!isCompactLandscape && (
          <div className="pt-2.5 pb-1 flex justify-center shrink-0">
            <div className="w-10 h-1 rounded-full bg-slate-300" />
          </div>
        )}

        {/* Header */}
        {(title || subtitle) && (
          <div className="px-4 py-2.5 border-b border-slate-200 flex items-center justify-between gap-3 shrink-0 bg-white">
            <div className="min-w-0 flex-1">
              {title && <h3 className="text-sm font-bold text-slate-900 truncate">{title}</h3>}
              {subtitle && <p className="text-[11px] text-slate-500 truncate mt-0.5">{subtitle}</p>}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="إغلاق"
              className="min-w-[44px] min-h-[44px] -ml-2 flex items-center justify-center rounded-xl text-slate-500 active:bg-slate-100 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        )}

        {/* Body */}
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain">{children}</div>

        {/* Sticky Footer */}
        {footer && (
          <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 shrink-0 pb-safe">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};
