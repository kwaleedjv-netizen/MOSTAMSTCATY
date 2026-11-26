import React, { useState } from 'react';
import { X, Trash2, RotateCcw } from 'lucide-react';
import { MostamsakDocument } from '../types';
import { useLayoutMode } from '../hooks/useViewportMode';

interface TrashBinModalProps {
  isOpen: boolean;
  onClose: () => void;
  trashDocuments: MostamsakDocument[];
  onRestore: (docId: string) => Promise<void>;
  onRestoreAll: () => Promise<void>;
  onPermanentDelete: (docId: string) => Promise<void>;
  onEmptyTrash: () => Promise<void>;
}

export const TrashBinModal: React.FC<TrashBinModalProps> = ({
  isOpen,
  onClose,
  trashDocuments,
  onRestore,
  onRestoreAll,
  onPermanentDelete,
  onEmptyTrash,
}) => {
  const { isMobile } = useLayoutMode();
  const [confirmEmpty, setConfirmEmpty] = useState(false);

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
            : 'max-w-2xl max-h-[84vh] border border-slate-200 rounded-xl shadow-2xl'
        }`}
      >
        <div
          className={`px-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between shrink-0 ${
            isMobile ? 'min-h-[50px] pt-safe' : 'h-11'
          }`}
        >
          <div className="flex items-center gap-2">
            <Trash2 className="w-4 h-4 text-red-600" />
            <span className="font-bold text-xs sm:text-sm text-slate-900">
              سلة المحذوفات ({trashDocuments.length})
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق"
            className={`text-slate-500 hover:text-slate-900 hover:bg-slate-200 rounded-md cursor-pointer flex items-center justify-center ${
              isMobile ? 'min-w-[44px] min-h-[44px]' : 'p-1.5'
            }`}
          >
            <X className={isMobile ? 'w-5 h-5' : 'w-4 h-4'} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {trashDocuments.length === 0 ? (
            <div className="py-16 text-center text-xs text-slate-400">سلة المحذوفات فارغة</div>
          ) : (
            trashDocuments.map((doc) => (
              <div
                key={doc.id}
                className="flex items-center justify-between gap-3 p-2.5 bg-white border border-slate-200 rounded-lg"
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="w-12 h-8 bg-slate-100 border border-slate-200 rounded overflow-hidden shrink-0 flex items-center justify-center p-0.5">
                    <img src={doc.frontImage} alt={doc.title} className="w-full h-full object-contain" />
                  </div>
                  <span className="font-bold text-xs text-slate-900 truncate">{doc.title}</span>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => onRestore(doc.id)}
                    aria-label="استعادة"
                    className={`bg-white hover:bg-emerald-50 text-emerald-700 border border-slate-200 hover:border-emerald-300 rounded-md cursor-pointer flex items-center justify-center ${
                      isMobile ? 'min-w-[42px] min-h-[42px]' : 'p-1.5'
                    }`}
                  >
                    <RotateCcw className={isMobile ? 'w-4 h-4' : 'w-3.5 h-3.5'} />
                  </button>
                  <button
                    type="button"
                    onClick={() => onPermanentDelete(doc.id)}
                    aria-label="حذف نهائي"
                    className={`bg-white hover:bg-red-50 text-red-600 border border-red-200 rounded-md cursor-pointer flex items-center justify-center ${
                      isMobile ? 'min-w-[42px] min-h-[42px]' : 'p-1.5'
                    }`}
                  >
                    <Trash2 className={isMobile ? 'w-4 h-4' : 'w-3.5 h-3.5'} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {trashDocuments.length > 0 && (
          <div
            className={`px-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-2 shrink-0 ${
              isMobile ? 'py-2.5 pb-[calc(0.625rem+env(safe-area-inset-bottom,0px))] flex-wrap' : 'h-12'
            }`}
          >
            <button
              type="button"
              onClick={onRestoreAll}
              className={`px-3 bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 rounded-md text-xs font-semibold flex items-center gap-1.5 cursor-pointer ${
                isMobile ? 'min-h-[44px] py-2' : 'py-1.5'
              }`}
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>استعادة الكل</span>
            </button>

            {confirmEmpty ? (
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={async () => {
                    await onEmptyTrash();
                    setConfirmEmpty(false);
                  }}
                  className={`px-3 bg-red-600 hover:bg-red-700 text-white rounded-md text-xs font-bold cursor-pointer ${
                    isMobile ? 'min-h-[44px] py-2' : 'py-1.5'
                  }`}
                >
                  تأكيد الإفراغ النهائي
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmEmpty(false)}
                  className={`px-2.5 bg-white border border-slate-300 text-slate-700 rounded-md text-xs cursor-pointer ${
                    isMobile ? 'min-h-[44px] py-2' : 'py-1.5'
                  }`}
                >
                  إلغاء
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmEmpty(true)}
                className={`px-3 bg-white hover:bg-red-50 text-red-600 border border-red-200 rounded-md text-xs font-semibold flex items-center gap-1.5 cursor-pointer ${
                  isMobile ? 'min-h-[44px] py-2' : 'py-1.5'
                }`}
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>إفراغ السلة</span>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
