import React from 'react';
import { X, Upload } from 'lucide-react';
import { DocumentGroup, MostamsakDocument } from '../types';
import { ImportWorkspace } from './ImportWorkspace';
import { useLayoutMode } from '../hooks/useViewportMode';

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  groups: DocumentGroup[];
  existingDocuments: MostamsakDocument[];
  onImportDocuments: (docs: Omit<MostamsakDocument, 'id' | 'createdAt' | 'updatedAt'>[]) => Promise<void>;
}

export const ImportModal: React.FC<ImportModalProps> = ({
  isOpen,
  onClose,
  groups,
  existingDocuments,
  onImportDocuments,
}) => {
  const { isMobile } = useLayoutMode();
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
            : 'max-w-4xl h-[82vh] border border-slate-200 rounded-xl shadow-2xl'
        }`}
      >
        <div
          className={`px-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between shrink-0 ${
            isMobile ? 'min-h-[50px] pt-safe' : 'h-11'
          }`}
        >
          <div className="flex items-center gap-2">
            <Upload className="w-4 h-4 text-blue-600" />
            <span className="font-bold text-xs sm:text-sm text-slate-900">استيراد المستمسكات</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق"
            className={`text-slate-500 hover:text-slate-900 hover:bg-slate-200 rounded-md cursor-pointer transition-colors flex items-center justify-center ${
              isMobile ? 'min-w-[44px] min-h-[44px]' : 'p-1.5'
            }`}
          >
            <X className={isMobile ? 'w-5 h-5' : 'w-4 h-4'} />
          </button>
        </div>

        <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
          <ImportWorkspace
            groups={groups}
            existingDocuments={existingDocuments}
            onImportDocuments={onImportDocuments}
            onDoneNavigateVault={onClose}
          />
        </div>
      </div>
    </div>
  );
};
