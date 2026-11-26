import React, { useState, useEffect } from 'react';
import {
  Download,
  Upload,
  RefreshCw,
  Check,
  AlertCircle,
  Cloud,
  CloudCheck,
  CloudAlert,
} from 'lucide-react';
import {
  createEncryptedBackup,
  restoreFromBackup,
  uploadBackupToCloud,
  listCloudBackups,
  downloadCloudBackup,
  CloudBackupSummary,
} from '../services/backupEngine';
import { SyncStatus } from '../services/syncEngine';
import { useLayoutMode } from '../hooks/useViewportMode';

interface BackupSyncWorkspaceProps {
  syncStatus: SyncStatus;
  onManualSync: () => Promise<void>;
  onDataRestored: () => Promise<void>;
}

export const BackupSyncWorkspace: React.FC<BackupSyncWorkspaceProps> = ({
  syncStatus,
  onManualSync,
  onDataRestored,
}) => {
  const [section, setSection] = useState<'create' | 'restore' | 'cloud'>('create');
  const { isMobile } = useLayoutMode();

  const [backupPassword, setBackupPassword] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [createdResult, setCreatedResult] = useState<{ fileName: string; meta: any } | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);

  const [restoreFileText, setRestoreFileText] = useState('');
  const [restoreFileName, setRestoreFileName] = useState('');
  const [restorePassword, setRestorePassword] = useState('');
  const [isRestoring, setIsRestoring] = useState(false);
  const [restoreError, setRestoreError] = useState<string | null>(null);
  const [restoreSuccess, setRestoreSuccess] = useState<string | null>(null);

  const [cloudBackups, setCloudBackups] = useState<CloudBackupSummary[]>([]);
  const [isLoadingCloud, setIsLoadingCloud] = useState(false);
  const [cloudError, setCloudError] = useState<string | null>(null);

  const loadCloudBackups = async () => {
    setIsLoadingCloud(true);
    setCloudError(null);
    try {
      const backups = await listCloudBackups();
      setCloudBackups(backups);
    } catch (err: unknown) {
      setCloudError(err instanceof Error ? err.message : 'تعذر الاتصال بالسحابة لجلب النسخ الاحتياطية');
    } finally {
      setIsLoadingCloud(false);
    }
  };

  useEffect(() => {
    if (section === 'cloud') {
      void loadCloudBackups();
    }
  }, [section]);

  const handleCreateBackup = async () => {
    setIsCreating(true);
    setCreateError(null);
    try {
      const { blob, fileName, meta } = await createEncryptedBackup(backupPassword);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(url);
      await uploadBackupToCloud(blob, fileName, meta);
      setCreatedResult({ fileName, meta });
    } catch {
      setCreateError('حدث خطأ أثناء إنشاء النسخة الاحتياطية');
    } finally {
      setIsCreating(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setRestoreFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      setRestoreFileText(reader.result as string);
      setRestoreError(null);
    };
    reader.readAsText(file);
  };

  const handleExecuteRestore = async () => {
    if (!restoreFileText) return;
    setIsRestoring(true);
    setRestoreError(null);
    setRestoreSuccess(null);

    const result = await restoreFromBackup(restoreFileText, restorePassword);
    setIsRestoring(false);

    if (result.success) {
      setRestoreSuccess(
        `تمت استعادة ${result.restoredCounts.docs} مستمسك و${result.restoredCounts.groups} مجموعة بنجاح`
      );
      await onDataRestored();
    } else {
      setRestoreError(result.error || 'فشلت عملية الاستعادة');
    }
  };

  const handleRestoreFromCloud = async (backupId: string) => {
    setCloudError(null);
    try {
      const text = await downloadCloudBackup(backupId);
      setRestoreFileText(text);
      setRestoreFileName(backupId + '.mostamsak');
      setSection('restore');
    } catch {
      setCloudError('تعذر تنزيل النسخة السحابية');
    }
  };

  const syncLabel =
    syncStatus.state === 'synced'
      ? 'متزامن مع الخادم'
      : syncStatus.state === 'syncing'
      ? 'جاري المزامنة...'
      : syncStatus.state === 'conflict'
      ? 'يوجد تعارض يحتاج مراجعة'
      : 'وضع محلي';

  return (
    <div className="flex-1 min-h-0 flex flex-col lg:flex-row bg-white overflow-hidden select-none">
      {/* Navigation & Sync Status Rail */}
      {isMobile ? (
        <div className="bg-slate-50 border-b border-slate-200 p-3 space-y-2.5 shrink-0 text-xs">
          <div className="grid grid-cols-3 gap-1.5">
            <button
              type="button"
              onClick={() => setSection('create')}
              className={`min-h-[38px] px-2 rounded-xl font-bold cursor-pointer ${
                section === 'create' ? 'bg-blue-600 text-white' : 'bg-white border border-slate-200 text-slate-700'
              }`}
            >
              إنشاء نسخة
            </button>
            <button
              type="button"
              onClick={() => setSection('restore')}
              className={`min-h-[38px] px-2 rounded-xl font-bold cursor-pointer ${
                section === 'restore' ? 'bg-blue-600 text-white' : 'bg-white border border-slate-200 text-slate-700'
              }`}
            >
              استعادة ملف
            </button>
            <button
              type="button"
              onClick={() => setSection('cloud')}
              className={`min-h-[38px] px-2 rounded-xl font-bold cursor-pointer ${
                section === 'cloud' ? 'bg-blue-600 text-white' : 'bg-white border border-slate-200 text-slate-700'
              }`}
            >
              السحابي
            </button>
          </div>
          <div className="flex items-center justify-between bg-white border border-slate-200 rounded-xl px-3 py-2">
            <div className="flex items-center gap-2 min-w-0">
              {syncStatus.state === 'synced' ? (
                <CloudCheck className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : syncStatus.state === 'syncing' ? (
                <RefreshCw className="w-4 h-4 text-blue-600 animate-spin shrink-0" />
              ) : syncStatus.state === 'conflict' ? (
                <CloudAlert className="w-4 h-4 text-amber-600 shrink-0" />
              ) : (
                <Cloud className="w-4 h-4 text-slate-500 shrink-0" />
              )}
              <span className="text-[11px] font-semibold text-slate-700 truncate">{syncLabel}</span>
            </div>
            <button
              type="button"
              onClick={onManualSync}
              disabled={syncStatus.state === 'syncing'}
              className="min-h-[36px] px-3 bg-slate-100 text-slate-800 rounded-lg text-[11px] font-bold flex items-center gap-1 cursor-pointer shrink-0"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${syncStatus.state === 'syncing' ? 'animate-spin' : ''}`} />
              <span>مزامنة</span>
            </button>
          </div>
        </div>
      ) : (
        <aside className="w-full lg:w-72 bg-slate-50/70 border-b lg:border-b-0 lg:border-l border-slate-200 p-4 flex flex-col justify-between gap-5 shrink-0 text-xs">
          <div className="space-y-4">
            <div className="space-y-1">
              <button
                type="button"
                onClick={() => setSection('create')}
                className={`w-full text-right px-3 py-2 rounded-md cursor-pointer transition-colors ${
                  section === 'create'
                    ? 'bg-white text-slate-900 font-bold border border-slate-200 shadow-2xs'
                    : 'text-slate-700 hover:bg-slate-200/50 font-medium border border-transparent'
                }`}
              >
                إنشاء نسخة احتياطية مشفرة
              </button>
              <button
                type="button"
                onClick={() => setSection('restore')}
                className={`w-full text-right px-3 py-2 rounded-md cursor-pointer transition-colors ${
                  section === 'restore'
                    ? 'bg-white text-slate-900 font-bold border border-slate-200 shadow-2xs'
                    : 'text-slate-700 hover:bg-slate-200/50 font-medium border border-transparent'
                }`}
              >
                استعادة من ملف (.mostamsak)
              </button>
              <button
                type="button"
                onClick={() => setSection('cloud')}
                className={`w-full text-right px-3 py-2 rounded-md cursor-pointer transition-colors ${
                  section === 'cloud'
                    ? 'bg-white text-slate-900 font-bold border border-slate-200 shadow-2xs'
                    : 'text-slate-700 hover:bg-slate-200/50 font-medium border border-transparent'
                }`}
              >
                الأرشيف السحابي على الخادم
              </button>
            </div>
          </div>

          {/* Live Cloud Sync Control */}
          <div className="pt-4 border-t border-slate-200 space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-700">المزامنة السحابية</span>
              {syncStatus.state === 'synced' ? (
                <CloudCheck className="w-4 h-4 text-emerald-600" />
              ) : syncStatus.state === 'syncing' ? (
                <RefreshCw className="w-4 h-4 text-blue-600 animate-spin" />
              ) : syncStatus.state === 'conflict' ? (
                <CloudAlert className="w-4 h-4 text-amber-600" />
              ) : (
                <Cloud className="w-4 h-4 text-slate-500" />
              )}
            </div>
            <p className="text-[11px] text-slate-600">{syncLabel}</p>
            <button
              type="button"
              onClick={onManualSync}
              disabled={syncStatus.state === 'syncing'}
              className="w-full py-2 bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 rounded-md font-semibold flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${syncStatus.state === 'syncing' ? 'animate-spin' : ''}`} />
              <span>مزامنة فورية</span>
            </button>
          </div>
        </aside>
      )}

      {/* Main Content Stage */}
      <div className={`flex-1 overflow-y-auto studio-stage-grid ${isMobile ? 'p-3 pb-safe' : 'p-6 lg:p-10'}`}>
        <div className={`max-w-2xl bg-white border border-slate-200 ${isMobile ? 'rounded-2xl p-4' : 'rounded-lg p-6'} shadow-2xs text-xs space-y-5`}>
          {section === 'create' && (
            <>
              <div>
                <h2 className="text-sm font-bold text-slate-900">تصدير نسخة احتياطية كاملة</h2>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  يُنتج ملفاً مشفراً بصيغة <span className="font-mono font-bold text-slate-800">.mostamsak</span> يضم جميع المستمسكات والصور والمجموعات وسجل العمليات، مع نسخة على الخادم المحلي.
                </p>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1.5">
                  كلمة مرور التشفير AES-256-GCM (اختياري)
                </label>
                <input
                  type="password"
                  value={backupPassword}
                  onChange={(e) => setBackupPassword(e.target.value)}
                  placeholder="أدخل كلمة مرور أو اتركه فارغاً للتصدير غير المقفل"
                  className="w-full bg-white border border-slate-300 rounded-md px-3 py-2 text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
                />
              </div>

              {createError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-md text-red-700 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{createError}</span>
                </div>
              )}

              {createdResult && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-md text-emerald-800 flex items-center gap-2">
                  <Check className="w-4 h-4 shrink-0" />
                  <span>تم إنشاء وتنزيل النسخة ({createdResult.fileName}) بنجاح.</span>
                </div>
              )}

              <button
                type="button"
                onClick={handleCreateBackup}
                disabled={isCreating}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-45 text-white rounded-md text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                <span>{isCreating ? 'جاري الإنشاء...' : 'إنشاء وتنزيل النسخة'}</span>
              </button>
            </>
          )}

          {section === 'restore' && (
            <>
              <div>
                <h2 className="text-sm font-bold text-slate-900">استعادة الخزانة من ملف</h2>
                <p className="text-xs text-slate-500 mt-1">
                  اختر ملف <span className="font-mono font-bold text-slate-800">.mostamsak</span> وأدخل كلمة مرور التشفير إن وُجدت.
                </p>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1.5">
                  ملف النسخة الاحتياطية
                </label>
                <input
                  type="file"
                  accept=".mostamsak,.json"
                  onChange={handleFileChange}
                  className="w-full bg-white border border-slate-300 rounded-md px-3 py-2 text-xs text-slate-800 cursor-pointer"
                />
                {restoreFileName && (
                  <p className="text-[11px] text-blue-600 font-mono mt-1">{restoreFileName}</p>
                )}
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1.5">
                  كلمة مرور فك التشفير
                </label>
                <input
                  type="password"
                  value={restorePassword}
                  onChange={(e) => setRestorePassword(e.target.value)}
                  placeholder="اتركه فارغاً إذا لم تكن محمية"
                  className="w-full bg-white border border-slate-300 rounded-md px-3 py-2 text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
                />
              </div>

              {restoreError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-md text-red-700 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{restoreError}</span>
                </div>
              )}

              {restoreSuccess && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-md text-emerald-800 flex items-center gap-2">
                  <Check className="w-4 h-4 shrink-0" />
                  <span>{restoreSuccess}</span>
                </div>
              )}

              <button
                type="button"
                onClick={handleExecuteRestore}
                disabled={isRestoring || !restoreFileText}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-45 text-white rounded-md text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>{isRestoring ? 'جاري الاستعادة...' : 'بدء الاستعادة'}</span>
              </button>
            </>
          )}

          {section === 'cloud' && (
            <>
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-bold text-slate-900">النسخ المحفوظة على الخادم</h2>
                  <p className="text-xs text-slate-500 mt-0.5">تحميل أي نسخة لاستعادتها محلياً</p>
                </div>
                <button
                  type="button"
                  onClick={loadCloudBackups}
                  className="px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded-md font-semibold flex items-center gap-1.5 cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>تحديث</span>
                </button>
              </div>

              {cloudError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-md text-red-700">
                  {cloudError}
                </div>
              )}

              {isLoadingCloud ? (
                <div className="py-10 text-center text-slate-400">جاري جلب النسخ السحابية...</div>
              ) : cloudBackups.length === 0 ? (
                <div className="py-10 text-center text-slate-500 border border-dashed border-slate-300 rounded-md">
                  لا توجد نسخ احتياطية محفوظة على الخادم حتى الآن.
                </div>
              ) : (
                <div className="divide-y divide-slate-200 border border-slate-200 rounded-md">
                  {cloudBackups.map((b) => (
                    <div key={b.id} className="p-3.5 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-bold text-slate-900 truncate">{b.name}</div>
                        <div className="text-[11px] text-slate-500 font-mono tabular-nums mt-0.5">
                          {new Date(b.createdAt).toLocaleString('ar-IQ')} · {Math.round(b.sizeBytes / 1024)} KB
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRestoreFromCloud(b.id)}
                        className="px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 rounded-md text-xs font-semibold flex items-center gap-1.5 cursor-pointer shrink-0"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>تحميل للاستعادة</span>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
