import React from 'react';
import { X, Printer } from 'lucide-react';
import { MostamsakDocument, PrintItem, PrintSheetSettings } from '../types';
import { PrintStudioWorkspace } from './PrintStudioWorkspace';
import { useLayoutMode } from '../hooks/useViewportMode';

interface PrintStudioModalProps {
  isOpen: boolean;
  onClose: () => void;
  documents: MostamsakDocument[];
  items: PrintItem[];
  setItems: React.Dispatch<React.SetStateAction<PrintItem[]>>;
  settings: PrintSheetSettings;
  setSettings: React.Dispatch<React.SetStateAction<PrintSheetSettings>>;
}

export const PrintStudioModal: React.FC<PrintStudioModalProps> = ({
  isOpen,
  onClose,
  documents,
  items,
  setItems,
  settings,
  setSettings,
}) => {
  const { isMobile, isTablet } = useLayoutMode();
  if (!isOpen) return null;

  if (isMobile) {
    return (
      <div
        className="fixed inset-0 z-50 bg-white flex flex-col h-[100dvh] w-screen select-none overflow-hidden"
        dir="rtl"
      >
        <div className="min-h-[48px] pt-safe px-3 bg-white border-b border-slate-200 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <Printer className="w-4 h-4 text-blue-600" />
            <span className="font-bold text-xs text-slate-900">استوديو الطباعة 1:1</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق"
            className="min-w-[42px] min-h-[42px] text-slate-600 active:bg-slate-100 rounded-xl flex items-center justify-center cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
          <PrintStudioWorkspace
            documents={documents}
            items={items}
            setItems={setItems}
            settings={settings}
            setSettings={setSettings}
          />
        </div>
      </div>
    );
  }

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 backdrop-blur-[1px] select-none ${
        isTablet ? 'p-2' : 'p-3 sm:p-5'
      }`}
      dir="rtl"
    >
      <div
        className={`w-full bg-white border border-slate-200 rounded-xl shadow-2xl overflow-hidden flex flex-col ${
          isTablet ? 'max-w-full h-[96dvh]' : 'max-w-7xl h-[92vh]'
        }`}
      >
        <div
          className={`${
            isTablet ? 'h-12 px-4' : 'h-11 px-4'
          } bg-slate-50 border-b border-slate-200 flex items-center justify-between shrink-0`}
        >
          <div className="flex items-center gap-2">
            <Printer className="w-4 h-4 text-blue-600" />
            <span className="font-bold text-xs sm:text-sm text-slate-900">استوديو الطباعة 1:1</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق"
            className={`${
              isTablet ? 'min-w-[40px] min-h-[40px]' : 'p-1.5'
            } text-slate-500 hover:text-slate-900 hover:bg-slate-200 rounded-md cursor-pointer transition-colors flex items-center justify-center`}
          >
            <X className={isTablet ? 'w-5 h-5' : 'w-4 h-4'} />
          </button>
        </div>

        <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
          <PrintStudioWorkspace
            documents={documents}
            items={items}
            setItems={setItems}
            settings={settings}
            setSettings={setSettings}
          />
        </div>
      </div>
    </div>
  );
};
