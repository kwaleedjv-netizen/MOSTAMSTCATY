import React, { useState, useRef, useEffect } from 'react';
import { Plus, Lock, Menu, X } from 'lucide-react';

export type WorkspaceTab = 'vault' | 'print' | 'import' | 'backup' | 'system';

interface StudioHeaderProps {
  activeTab: WorkspaceTab;
  onChangeTab: (tab: WorkspaceTab) => void;
  onAddDocument: () => void;
  hasMasterPassword: boolean;
  onLockVault: () => void;
}

const NAV_ITEMS: { id: WorkspaceTab; label: string }[] = [
  { id: 'vault', label: 'الاستوديو' },
  { id: 'print', label: 'الطباعة 1:1' },
  { id: 'import', label: 'الاستيراد' },
  { id: 'backup', label: 'النسخ السحابي' },
  { id: 'system', label: 'السجل والإعدادات' },
];

export const StudioHeader: React.FC<StudioHeaderProps> = ({
  activeTab,
  onChangeTab,
  onAddDocument,
  hasMasterPassword,
  onLockVault,
}) => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMobileOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMobileOpen(false);
    };
    window.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, []);

  return (
    <header className="h-13 px-5 bg-white border-b border-slate-200 flex items-center justify-between gap-8 shrink-0 z-30 select-none">
      {/* Zone 1: Clean Wordmark */}
      <button
        type="button"
        onClick={() => onChangeTab('vault')}
        className="text-base font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0 cursor-pointer"
      >
        مستمسكاتي
      </button>

      {/* Zone 2: Clean Architectural Workspace Navigation */}
      <nav className="hidden md:flex items-center gap-7 h-full">
        {NAV_ITEMS.map((item) => {
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onChangeTab(item.id)}
              className={`relative h-full flex items-center text-xs transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                isActive
                  ? 'font-bold text-slate-900'
                  : 'font-medium text-slate-500 hover:text-slate-900'
              }`}
            >
              <span>{item.label}</span>
              {isActive && (
                <span className="absolute bottom-0 inset-x-0 h-0.5 bg-blue-600" />
              )}
            </button>
          );
        })}
      </nav>

      {/* Zone 3: Primary Action + Mobile Nav Toggle */}
      <div className="flex items-center gap-2 shrink-0">
        {hasMasterPassword && (
          <button
            type="button"
            onClick={onLockVault}
            className="p-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded-md cursor-pointer transition-colors shrink-0"
            title="قفل الخزانة (Ctrl+L)"
            aria-label="قفل الخزانة"
          >
            <Lock className="w-3.5 h-3.5 text-amber-600" />
          </button>
        )}

        <div className="relative md:hidden" ref={menuRef}>
          <button
            type="button"
            onClick={() => setMobileOpen((v) => !v)}
            className="p-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded-md cursor-pointer"
            aria-label="التنقل"
          >
            {mobileOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
          </button>

          {mobileOpen && (
            <div className="absolute left-0 top-full mt-2 w-48 bg-white border border-slate-200 rounded-md shadow-lg py-1 z-50 text-xs text-right">
              {NAV_ITEMS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    onChangeTab(item.id);
                    setMobileOpen(false);
                  }}
                  className={`w-full px-3.5 py-2 text-right cursor-pointer ${
                    activeTab === item.id
                      ? 'bg-slate-100 font-bold text-slate-900'
                      : 'text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={onAddDocument}
          className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-md text-xs font-bold flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0 transition-colors"
          title="إضافة مستمسك جديد (Ctrl+N)"
        >
          <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
          <span>إضافة مستمسك</span>
        </button>
      </div>
    </header>
  );
};
