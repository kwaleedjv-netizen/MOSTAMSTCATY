import React, { useState, useEffect } from 'react';
import { X, History, Search, Download } from 'lucide-react';
import { AuditLog } from '../types';
import { dbGetAll } from '../services/db';
import { useLayoutMode } from '../hooks/useViewportMode';

interface AuditLogModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AuditLogModal: React.FC<AuditLogModalProps> = ({ isOpen, onClose }) => {
  const { isMobile } = useLayoutMode();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    dbGetAll<AuditLog>('auditLogs').then((data) => {
      data.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      setLogs(data);
    });
  }, [isOpen]);

  if (!isOpen) return null;

  const filtered = logs.filter((log) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return (
      log.itemName.toLowerCase().includes(q) ||
      log.details.toLowerCase().includes(q) ||
      log.deviceName.toLowerCase().includes(q)
    );
  });

  const handleExport = () => {
    const blob = new Blob([JSON.stringify(logs, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mostamsakati_audit_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

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
            : 'max-w-3xl h-[80vh] border border-slate-200 rounded-xl shadow-2xl'
        }`}
      >
        <div
          className={`px-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between shrink-0 ${
            isMobile ? 'min-h-[50px] pt-safe' : 'h-11'
          }`}
        >
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-blue-600" />
            <span className="font-bold text-xs sm:text-sm text-slate-900">سجل العمليات</span>
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

        <div className="px-4 py-2.5 border-b border-slate-200 flex items-center justify-between gap-2 shrink-0 bg-white">
          <div className="relative flex-1 max-w-sm">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="بحث في السجل..."
              className={`w-full bg-slate-50 border border-slate-200 rounded-md pr-8 pl-2.5 text-xs focus:bg-white focus:border-blue-600 focus:outline-none ${
                isMobile ? 'min-h-[42px] py-2' : 'py-1.5'
              }`}
            />
          </div>
          <button
            type="button"
            onClick={handleExport}
            className={`px-3 bg-white hover:bg-slate-50 border border-slate-300 rounded-md text-xs font-semibold text-slate-700 flex items-center gap-1.5 cursor-pointer shrink-0 ${
              isMobile ? 'min-h-[42px] py-2' : 'py-1.5'
            }`}
          >
            <Download className="w-3.5 h-3.5" />
            <span>تصدير JSON</span>
          </button>
        </div>

        <div
          className={`flex-1 overflow-y-auto divide-y divide-slate-100 ${
            isMobile ? 'pb-[env(safe-area-inset-bottom,0px)]' : ''
          }`}
        >
          {filtered.length === 0 ? (
            <div className="py-16 text-center text-xs text-slate-400">لا توجد قيود في السجل</div>
          ) : (
            filtered.map((log) => (
              <div
                key={log.id}
                className={`px-4 flex items-center justify-between gap-4 text-xs ${
                  isMobile ? 'py-3' : 'py-2.5'
                }`}
              >
                <div className="min-w-0 flex-1">
                  <div className="font-bold text-slate-900 truncate">{log.itemName}</div>
                  <div className="text-[11px] text-slate-500 truncate">{log.details}</div>
                </div>
                <div className="text-left shrink-0 text-[11px] font-mono text-slate-400">
                  {new Date(log.timestamp).toLocaleString('ar-IQ', {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
