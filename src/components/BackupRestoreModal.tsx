import React, { useState, useEffect } from 'react';
import { X, ShieldCheck } from 'lucide-react';
import { BackupSyncWorkspace } from './BackupSyncWorkspace';
import { syncEngine, SyncStatus } from '../services/syncEngine';
import { useLayoutMode } from '../hooks/useViewportMode';

interface BackupRestoreModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDataRestored: () => Promise<void>;
}

export const BackupRestoreModal: React.FC<BackupRestoreModalProps> = ({
  isOpen,
  onClose,
  onDataRestored,
}) => {
  const [syncStatus, setSyncStatus] = useState<SyncStatus>(syncEngine.getStatus());
  const { isMobile } = useLayoutMode();

  useEffect(() => {
    const unsub = syncEngine.subscribe(setSyncStatus);
    return () => unsub();
  }, []);

  if (!isOpen) return null;

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 backdrop-blur-[1px] select-none ${
        isMobile ? 'p-0' : 'p-4'
      }`}
      dir="rtl"
    >
      <div
        className={
          isMobile
            ? 'w-full h-[100dvh] bg-white overflow-hidden flex flex-col'
            : 'w-full max-w-4xl h-[82vh] bg-white border border-slate-200 rounded-xl shadow-2xl overflow-hidden flex flex-col'
        }
      >
        <div
          className={`${
            isMobile ? 'min-h-[50px] pt-safe px-3 bg-white' : 'h-11 px-4 bg-slate-50'
          } border-b border-slate-200 flex items-center justify-between shrink-0`}
        >
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span className="font-bold text-xs sm:text-sm text-slate-900">النسخ الاحتياطي والمزامنة</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق"
            className={`${
              isMobile ? 'min-w-[42px] min-h-[42px] rounded-xl flex items-center justify-center' : 'p-1.5 rounded-md'
            } text-slate-500 hover:text-slate-900 hover:bg-slate-200 cursor-pointer transition-colors`}
          >
            <X className={isMobile ? 'w-5 h-5' : 'w-4 h-4'} />
          </button>
        </div>

        <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
          <BackupSyncWorkspace
            syncStatus={syncStatus}
            onManualSync={async () => {
              await syncEngine.syncNow();
            }}
            onDataRestored={onDataRestored}
          />
        </div>
      </div>
    </div>
  );
};
