import React, { useState, useEffect } from 'react';
import {
  History,
  Palette,
  Image,
  Database,
  Shield,
  Cloud,
  AlertTriangle,
  Check,
  RefreshCw,
  Search,
  Download,
  HelpCircle,
  Keyboard,
  Info,
} from 'lucide-react';
import { AppSettings, AuditLog, MostamsakDocument, DocumentGroup } from '../types';
import { VIEW_MODES } from '../constants/viewModes';
import { hashPassword, verifyPassword } from '../services/crypto';
import { dbGetAll } from '../services/db';

interface SystemWorkspaceProps {
  settings: AppSettings;
  onSaveSettings: (newSettings: AppSettings) => Promise<void>;
  storageStats: {
    usedBytes: number;
    documentsCount: number;
    groupsCount: number;
    logsCount: number;
  };
  onResetSettingsOnly: () => Promise<void>;
  onFactoryResetWipeAll: (password?: string) => Promise<void>;
  onOpenUserGuide: () => void;
  onOpenShortcuts: () => void;
  onOpenAbout: () => void;
}

type SystemTab = 'audit' | 'ui' | 'images' | 'storage' | 'security' | 'cloud' | 'reset';

export const SystemWorkspace: React.FC<SystemWorkspaceProps> = ({
  settings,
  onSaveSettings,
  storageStats,
  onResetSettingsOnly,
  onFactoryResetWipeAll,
  onOpenUserGuide,
  onOpenShortcuts,
  onOpenAbout,
}) => {
  const [currentTab, setCurrentTab] = useState<SystemTab>('audit');
  const [localSettings, setLocalSettings] = useState<AppSettings>({ ...settings, theme: 'light' });
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Audit logs state
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [logSearch, setLogSearch] = useState('');
  const [logType, setLogType] = useState('all');

  // Security password state
  const [newMasterPassword, setNewMasterPassword] = useState('');
  const [confirmMasterPassword, setConfirmMasterPassword] = useState('');
  const [passwordHint, setPasswordHint] = useState(settings.passwordHint || '');
  const [securityMessage, setSecurityMessage] = useState<string | null>(null);

  // Integrity check state
  const [integrityStatus, setIntegrityStatus] = useState<string | null>(null);

  // Factory reset state
  const [wipePassword, setWipePassword] = useState('');
  const [wipeConfirmPhrase, setWipeConfirmPhrase] = useState('');
  const [wipeError, setWipeError] = useState<string | null>(null);

  useEffect(() => {
    setLocalSettings({ ...settings, theme: 'light' });
  }, [settings]);

  useEffect(() => {
    if (currentTab === 'audit') {
      dbGetAll<AuditLog>('auditLogs').then((data) => {
        data.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        setLogs(data);
      });
    }
  }, [currentTab]);

  const handleSaveGeneral = async () => {
    await onSaveSettings({ ...localSettings, theme: 'light' });
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2000);
  };

  const handleUpdateMasterPassword = async () => {
    if (!newMasterPassword || newMasterPassword.length < 6) {
      setSecurityMessage('يجب أن تكون كلمة المرور 6 أحرف أو أرقام على الأقل');
      return;
    }
    if (newMasterPassword !== confirmMasterPassword) {
      setSecurityMessage('كلمتا المرور غير متطابقتين');
      return;
    }

    const { hash, salt } = await hashPassword(newMasterPassword);
    const updated = {
      ...localSettings,
      hasMasterPassword: true,
      masterPasswordHash: hash,
      masterPasswordSalt: salt,
      passwordHint: passwordHint.trim(),
    };
    await onSaveSettings(updated);
    setLocalSettings(updated);
    setSecurityMessage('تم تحديث كلمة المرور الرئيسية بنجاح');
    setNewMasterPassword('');
    setConfirmMasterPassword('');
  };

  const handleRemoveMasterPassword = async () => {
    const updated = {
      ...localSettings,
      hasMasterPassword: false,
      masterPasswordHash: undefined,
      masterPasswordSalt: undefined,
      passwordHint: undefined,
    };
    await onSaveSettings(updated);
    setLocalSettings(updated);
    setSecurityMessage('تم إلغاء كلمة المرور الرئيسية');
  };

  const handleRunIntegrityCheck = async () => {
    setIntegrityStatus('جاري فحص الجداول والروابط والصور في قاعدة البيانات المحلية...');
    try {
      const [docs, grps, audit] = await Promise.all([
        dbGetAll<MostamsakDocument>('documents'),
        dbGetAll<DocumentGroup>('groups'),
        dbGetAll('auditLogs'),
      ]);
      const groupIds = new Set(grps.map((g) => g.id));
      const invalidDims = docs.filter((d) => !d.widthMm || !d.heightMm || d.widthMm <= 0 || d.heightMm <= 0).length;
      const missingFront = docs.filter((d) => !d.frontImage).length;
      const orphanGroups = docs.filter((d) => d.groupId && !groupIds.has(d.groupId)).length;

      if (invalidDims === 0 && missingFront === 0 && orphanGroups === 0) {
        setIntegrityStatus(
          `الفحص سليم: تم التحقق فعلياً من ${docs.length} مستمسك و${grps.length} مجموعة و${audit.length} قيد سجل بدون أي أخطاء.`
        );
      } else {
        setIntegrityStatus(
          `نتيجة الفحص (${docs.length} مستمسك): ${missingFront} بدون صورة، ${invalidDims} بأبعاد غير صالحة، ${orphanGroups} مرتبطة بمجموعة محذوفة.`
        );
      }
    } catch {
      setIntegrityStatus('تعذّر إتمام فحص قاعدة البيانات المحلية.');
    }
  };

  const handleExecuteWipe = async () => {
    setWipeError(null);
    if (wipeConfirmPhrase !== 'مسح كافة البيانات') {
      setWipeError('يرجى كتابة عبارة التأكيد بدقة: مسح كافة البيانات');
      return;
    }
    if (settings.hasMasterPassword && settings.masterPasswordHash && settings.masterPasswordSalt) {
      const isValid = await verifyPassword(
        wipePassword,
        settings.masterPasswordHash,
        settings.masterPasswordSalt
      );
      if (!isValid) {
        setWipeError('كلمة المرور الرئيسية غير صحيحة');
        return;
      }
    }
    await onFactoryResetWipeAll(wipePassword);
  };

  const filteredLogs = logs.filter((log) => {
    const q = logSearch.toLowerCase();
    const matchesSearch =
      log.itemName.toLowerCase().includes(q) ||
      log.details.toLowerCase().includes(q) ||
      log.deviceName.toLowerCase().includes(q);
    const matchesType = logType === 'all' || log.actionType.startsWith(logType);
    return matchesSearch && matchesType;
  });

  const handleExportLogs = () => {
    const content = JSON.stringify(logs, null, 2);
    const blob = new Blob([content], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mostamsakati_audit_log_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const navBtnClass = (active: boolean, danger = false) =>
    `w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-xs text-right transition-colors cursor-pointer ${
      active
        ? danger
          ? 'bg-red-50 text-red-700 font-bold border border-red-200'
          : 'bg-white text-slate-900 font-bold shadow-2xs border border-slate-200'
        : danger
        ? 'text-red-600 hover:bg-red-50/70 border border-transparent font-medium'
        : 'text-slate-700 hover:bg-slate-200/50 hover:text-slate-900 border border-transparent font-medium'
    }`;

  return (
    <div className="flex-1 min-h-0 flex flex-col lg:flex-row bg-white overflow-hidden select-none">
      {/* Left/Right Navigation Rail */}
      <aside className="w-full lg:w-64 bg-slate-50/70 border-b lg:border-b-0 lg:border-l border-slate-200 p-4 flex flex-col justify-between gap-4 shrink-0 text-xs">
        <div className="space-y-1">
          <button type="button" onClick={() => setCurrentTab('audit')} className={navBtnClass(currentTab === 'audit')}>
            <History className="w-3.5 h-3.5 text-slate-500" />
            <span>سجل العمليات</span>
          </button>
          <button type="button" onClick={() => setCurrentTab('ui')} className={navBtnClass(currentTab === 'ui')}>
            <Palette className="w-3.5 h-3.5 text-slate-500" />
            <span>الواجهة والعرض</span>
          </button>
          <button type="button" onClick={() => setCurrentTab('images')} className={navBtnClass(currentTab === 'images')}>
            <Image className="w-3.5 h-3.5 text-slate-500" />
            <span>الصور والطباعة</span>
          </button>
          <button type="button" onClick={() => setCurrentTab('storage')} className={navBtnClass(currentTab === 'storage')}>
            <Database className="w-3.5 h-3.5 text-slate-500" />
            <span>التخزين والفحص</span>
          </button>
          <button type="button" onClick={() => setCurrentTab('security')} className={navBtnClass(currentTab === 'security')}>
            <Shield className="w-3.5 h-3.5 text-slate-500" />
            <span>الأمان وكلمة المرور</span>
          </button>
          <button type="button" onClick={() => setCurrentTab('cloud')} className={navBtnClass(currentTab === 'cloud')}>
            <Cloud className="w-3.5 h-3.5 text-slate-500" />
            <span>إعدادات المزامنة</span>
          </button>

          <div className="border-t border-slate-200 my-2" />

          <button type="button" onClick={() => setCurrentTab('reset')} className={navBtnClass(currentTab === 'reset', true)}>
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>إعادة ضبط المصنع</span>
          </button>
        </div>

        {/* Clean Help & Documentation Links */}
        <div className="pt-3 border-t border-slate-200 space-y-1">
          <button
            type="button"
            onClick={onOpenUserGuide}
            className="w-full flex items-center gap-2 px-3 py-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-200/50 rounded-md cursor-pointer text-right"
          >
            <HelpCircle className="w-3.5 h-3.5" />
            <span>دليل الاستخدام</span>
          </button>
          <button
            type="button"
            onClick={onOpenShortcuts}
            className="w-full flex items-center justify-between px-3 py-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-200/50 rounded-md cursor-pointer text-right"
          >
            <span className="flex items-center gap-2">
              <Keyboard className="w-3.5 h-3.5" />
              <span>اختصارات المفاتيح</span>
            </span>
            <kbd className="font-mono text-[10px] text-slate-400">F1</kbd>
          </button>
          <button
            type="button"
            onClick={onOpenAbout}
            className="w-full flex items-center gap-2 px-3 py-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-200/50 rounded-md cursor-pointer text-right"
          >
            <Info className="w-3.5 h-3.5" />
            <span>حول مستمسكاتي</span>
          </button>
        </div>
      </aside>

      {/* Main Content Stage */}
      <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
        {currentTab === 'audit' ? (
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="h-12 px-5 bg-white border-b border-slate-200 flex items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-2 flex-1 max-w-lg">
                <div className="relative flex-1">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={logSearch}
                    onChange={(e) => setLogSearch(e.target.value)}
                    placeholder="بحث في سجل العمليات..."
                    className="w-full bg-slate-50 focus:bg-white border border-slate-300 rounded-md pr-8 pl-3 py-1.5 text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
                  />
                </div>
                <select
                  value={logType}
                  onChange={(e) => setLogType(e.target.value)}
                  className="bg-white border border-slate-300 rounded-md px-2.5 py-1.5 text-xs text-slate-800 focus:border-blue-600 focus:outline-none cursor-pointer"
                >
                  <option value="all">كل العمليات</option>
                  <option value="doc">المستمسكات</option>
                  <option value="group">المجموعات</option>
                  <option value="backup">النسخ الاحتياطي</option>
                  <option value="sync">المزامنة</option>
                </select>
              </div>

              <button
                type="button"
                onClick={handleExportLogs}
                className="px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 rounded-md text-xs font-semibold flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
              >
                <Download className="w-3.5 h-3.5 text-slate-600" />
                <span>تصدير JSON</span>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto text-xs">
              <table className="w-full border-collapse">
                <thead className="bg-slate-50 text-slate-600 sticky top-0 border-b border-slate-200 text-[11px]">
                  <tr>
                    <th className="py-2.5 px-4 font-bold text-right">الوقت</th>
                    <th className="py-2.5 px-4 font-bold text-right">العملية</th>
                    <th className="py-2.5 px-4 font-bold text-right">العنصر</th>
                    <th className="py-2.5 px-4 font-bold text-right">التفاصيل</th>
                    <th className="py-2.5 px-4 font-bold text-right">الحالة</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-2.5 px-4 font-mono tabular-nums text-[11px] text-slate-500 whitespace-nowrap">
                        {new Date(log.timestamp).toLocaleString('ar-IQ')}
                      </td>
                      <td className="py-2.5 px-4 font-mono text-[11px] text-slate-700 whitespace-nowrap">
                        {log.actionType}
                      </td>
                      <td className="py-2.5 px-4 font-semibold text-slate-900 max-w-[180px] truncate">
                        {log.itemName}
                      </td>
                      <td className="py-2.5 px-4 text-slate-600 max-w-md truncate">{log.details}</td>
                      <td className="py-2.5 px-4 text-[11px] font-semibold whitespace-nowrap">
                        <span
                          className={
                            log.status === 'success'
                              ? 'text-emerald-700'
                              : log.status === 'warning'
                              ? 'text-amber-700'
                              : 'text-red-700'
                          }
                        >
                          {log.status === 'success' ? 'ناجح' : log.status === 'warning' ? 'تنبيه' : 'فشل'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filteredLogs.length === 0 && (
                <div className="py-12 text-center text-slate-400">لا توجد قيود مطابقة.</div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto studio-stage-grid p-6 lg:p-10">
            <div className="max-w-2xl bg-white border border-slate-200 rounded-lg p-6 shadow-2xs text-xs space-y-5">
              {currentTab === 'ui' && (
                <>
                  <div className="text-sm font-bold text-slate-900">تخصيص الواجهة والعرض الافتراضي</div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">اللغة</label>
                      <select
                        value="ar"
                        onChange={(e) => setLocalSettings({ ...localSettings, language: e.target.value as any })}
                        className="w-full bg-white border border-slate-300 rounded-md px-2.5 py-2 text-xs text-slate-800 focus:border-blue-600 focus:outline-none cursor-pointer"
                      >
                        <option value="ar">العربية (RTL)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">حجم البطاقات</label>
                      <select
                        value={localSettings.cardSize}
                        onChange={(e) => setLocalSettings({ ...localSettings, cardSize: e.target.value as any })}
                        className="w-full bg-white border border-slate-300 rounded-md px-2.5 py-2 text-xs text-slate-800 focus:border-blue-600 focus:outline-none cursor-pointer"
                      >
                        <option value="small">صغير</option>
                        <option value="medium">متوسط</option>
                        <option value="large">كبير</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">طريقة العرض الافتراضية</label>
                      <select
                        value={localSettings.viewMode}
                        onChange={(e) => setLocalSettings({ ...localSettings, viewMode: e.target.value as any })}
                        className="w-full bg-white border border-slate-300 rounded-md px-2.5 py-2 text-xs text-slate-800 focus:border-blue-600 focus:outline-none cursor-pointer"
                      >
                        {VIEW_MODES.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </>
              )}

              {currentTab === 'images' && (
                <>
                  <div className="text-sm font-bold text-slate-900">جودة الصور ودقة الطباعة</div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">دقة التصدير (DPI)</label>
                      <select
                        value={localSettings.exportDpi}
                        onChange={(e) =>
                          setLocalSettings({ ...localSettings, exportDpi: Number(e.target.value) as any })
                        }
                        className="w-full bg-white border border-slate-300 rounded-md px-2.5 py-2 text-xs font-mono text-slate-800 focus:border-blue-600 focus:outline-none cursor-pointer"
                      >
                        <option value={300}>300 DPI (قياسي للطباعة)</option>
                        <option value={600}>600 DPI (دقة عالية جداً)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">استدارة الحواف الافتراضية (mm)</label>
                      <input
                        type="number"
                        step="0.5"
                        value={localSettings.defaultCornerRadiusMm}
                        onChange={(e) =>
                          setLocalSettings({
                            ...localSettings,
                            defaultCornerRadiusMm: Number(e.target.value) || 0,
                          })
                        }
                        className="w-full bg-white border border-slate-300 rounded-md px-2.5 py-2 text-xs font-mono tabular-nums text-slate-800 focus:border-blue-600 focus:outline-none"
                      />
                    </div>
                  </div>

                  <label className="flex items-center gap-2 cursor-pointer text-slate-700">
                    <input
                      type="checkbox"
                      checked={localSettings.keepOriginalImages}
                      onChange={(e) =>
                        setLocalSettings({ ...localSettings, keepOriginalImages: e.target.checked })
                      }
                      className="rounded accent-blue-600"
                    />
                    <span>الاحتفاظ بنسخة من الصورة الأصلية قبل أي قص أو تعديل</span>
                  </label>
                </>
              )}

              {currentTab === 'storage' && (
                <>
                  <div className="text-sm font-bold text-slate-900">إدارة التخزين المحلي وفحص السلامة</div>
                  <dl className="divide-y divide-slate-200 border border-slate-200 rounded-md bg-slate-50/50">
                    <div className="flex items-center justify-between px-3.5 py-2.5">
                      <dt className="text-slate-600">مساحة التخزين المستخدمة</dt>
                      <dd className="font-mono tabular-nums font-bold text-slate-900" dir="ltr">
                        {formatBytes(storageStats.usedBytes)}
                      </dd>
                    </div>
                    <div className="flex items-center justify-between px-3.5 py-2.5">
                      <dt className="text-slate-600">عدد المستمسكات</dt>
                      <dd className="font-mono tabular-nums font-semibold text-slate-900">{storageStats.documentsCount}</dd>
                    </div>
                    <div className="flex items-center justify-between px-3.5 py-2.5">
                      <dt className="text-slate-600">عدد المجموعات</dt>
                      <dd className="font-mono tabular-nums font-semibold text-slate-900">{storageStats.groupsCount}</dd>
                    </div>
                    <div className="flex items-center justify-between px-3.5 py-2.5">
                      <dt className="text-slate-600">قيود سجل العمليات</dt>
                      <dd className="font-mono tabular-nums font-semibold text-slate-900">{storageStats.logsCount}</dd>
                    </div>
                  </dl>

                  <div className="flex items-center justify-between gap-3 pt-2">
                    <div>
                      <div className="font-bold text-slate-900">فحص سلامة قاعدة البيانات</div>
                      <div className="text-[11px] text-slate-500">التحقق من سلامة الجداول والصور وروابط المجموعات</div>
                    </div>
                    <button
                      type="button"
                      onClick={handleRunIntegrityCheck}
                      className="px-3.5 py-1.5 bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 rounded-md text-xs font-semibold flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                    >
                      <RefreshCw className="w-3.5 h-3.5 text-slate-600" />
                      <span>فحص الآن</span>
                    </button>
                  </div>

                  {integrityStatus && (
                    <div className="p-3 bg-blue-50 border border-blue-200 rounded-md text-blue-800 text-xs">
                      {integrityStatus}
                    </div>
                  )}
                </>
              )}

              {currentTab === 'security' && (
                <>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-bold text-slate-900">الأمان وكلمة المرور الرئيسية</div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        {localSettings.hasMasterPassword
                          ? 'كلمة المرور الرئيسية مفعلة لحماية الخزانة'
                          : 'الحماية بكلمة مرور غير مفعلة حالياً'}
                      </div>
                    </div>
                    {localSettings.hasMasterPassword && (
                      <button
                        type="button"
                        onClick={handleRemoveMasterPassword}
                        className="px-3 py-1.5 bg-white hover:bg-red-50 text-red-600 border border-red-200 rounded-md text-xs font-semibold cursor-pointer"
                      >
                        إلغاء القفل
                      </button>
                    )}
                  </div>

                  <div className="border-t border-slate-200 pt-4 space-y-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        {localSettings.hasMasterPassword ? 'كلمة المرور الجديدة' : 'تعيين كلمة مرور جديدة'}
                      </label>
                      <input
                        type="password"
                        value={newMasterPassword}
                        onChange={(e) => setNewMasterPassword(e.target.value)}
                        placeholder="6 أحرف أو أرقام على الأقل"
                        className="w-full bg-white border border-slate-300 rounded-md px-2.5 py-1.5 text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">تأكيد كلمة المرور</label>
                      <input
                        type="password"
                        value={confirmMasterPassword}
                        onChange={(e) => setConfirmMasterPassword(e.target.value)}
                        placeholder="أعد إدخال كلمة المرور"
                        className="w-full bg-white border border-slate-300 rounded-md px-2.5 py-1.5 text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">تلميح كلمة المرور (اختياري)</label>
                      <input
                        type="text"
                        value={passwordHint}
                        onChange={(e) => setPasswordHint(e.target.value)}
                        className="w-full bg-white border border-slate-300 rounded-md px-2.5 py-1.5 text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
                      />
                    </div>

                    {securityMessage && (
                      <div className="p-2.5 bg-blue-50 border border-blue-200 rounded-md text-blue-800 text-xs">
                        {securityMessage}
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={handleUpdateMasterPassword}
                      className="px-4 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-md text-xs font-bold cursor-pointer"
                    >
                      حفظ كلمة المرور
                    </button>
                  </div>

                  <div className="border-t border-slate-200 pt-4">
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">القفل التلقائي عند الخمول</label>
                    <select
                      value={localSettings.autoLockMinutes}
                      onChange={(e) =>
                        setLocalSettings({ ...localSettings, autoLockMinutes: Number(e.target.value) })
                      }
                      className="w-full bg-white border border-slate-300 rounded-md px-2.5 py-2 text-xs text-slate-800 focus:border-blue-600 focus:outline-none cursor-pointer"
                    >
                      <option value={0}>معطل</option>
                      <option value={5}>بعد 5 دقائق</option>
                      <option value={15}>بعد 15 دقيقة</option>
                      <option value={30}>بعد 30 دقيقة</option>
                      <option value={60}>بعد ساعة واحدة</option>
                    </select>
                  </div>
                </>
              )}

              {currentTab === 'cloud' && (
                <>
                  <div className="text-sm font-bold text-slate-900">إعدادات المزامنة السحابية</div>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">معرف الجهاز</label>
                      <input
                        type="text"
                        readOnly
                        value={localSettings.cloudDeviceId}
                        className="w-full bg-slate-50 border border-slate-200 rounded-md px-2.5 py-1.5 text-xs font-mono text-slate-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">اسم الجهاز</label>
                      <input
                        type="text"
                        value={localSettings.cloudDeviceName}
                        onChange={(e) => setLocalSettings({ ...localSettings, cloudDeviceName: e.target.value })}
                        className="w-full bg-white border border-slate-300 rounded-md px-2.5 py-1.5 text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">عنوان خادم المزامنة</label>
                      <input
                        type="text"
                        value={localSettings.cloudServerUrl}
                        onChange={(e) => setLocalSettings({ ...localSettings, cloudServerUrl: e.target.value })}
                        className="w-full bg-white border border-slate-300 rounded-md px-2.5 py-1.5 text-xs font-mono text-slate-900 focus:border-blue-600 focus:outline-none"
                        dir="ltr"
                      />
                    </div>
                    <label className="flex items-center gap-2 cursor-pointer text-slate-700 pt-1">
                      <input
                        type="checkbox"
                        checked={localSettings.autoSyncOnStart}
                        onChange={(e) => setLocalSettings({ ...localSettings, autoSyncOnStart: e.target.checked })}
                        className="rounded accent-blue-600"
                      />
                      <span>مزامنة تلقائية عند فتح التطبيق</span>
                    </label>
                  </div>
                </>
              )}

              {currentTab === 'reset' && (
                <>
                  <div className="space-y-2">
                    <div className="text-sm font-bold text-slate-900">استعادة الإعدادات الافتراضية</div>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      يعيد ضبط خيارات العرض والدقة والواجهة فقط مع بقاء جميع المستمسكات والمجموعات كما هي.
                    </p>
                    <button
                      type="button"
                      onClick={onResetSettingsOnly}
                      className="px-3.5 py-1.5 bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 rounded-md text-xs font-semibold cursor-pointer"
                    >
                      استعادة الإعدادات فقط
                    </button>
                  </div>

                  <div className="border-t border-slate-200 pt-4 space-y-3">
                    <div className="text-sm font-bold text-red-700">مسح كافة البيانات نهائياً</div>
                    <p className="text-xs text-red-700 leading-relaxed">
                      سيتم حذف جميع المستمسكات والصور والمجموعات وسجل العمليات نهائياً ولا يمكن التراجع عن هذا الإجراء.
                    </p>

                    {localSettings.hasMasterPassword && (
                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">كلمة المرور الرئيسية</label>
                        <input
                          type="password"
                          value={wipePassword}
                          onChange={(e) => setWipePassword(e.target.value)}
                          className="w-full bg-white border border-red-300 rounded-md px-2.5 py-1.5 text-xs text-slate-900 focus:outline-none"
                        />
                      </div>
                    )}

                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        اكتب عبارة التأكيد: <span className="text-red-700">مسح كافة البيانات</span>
                      </label>
                      <input
                        type="text"
                        value={wipeConfirmPhrase}
                        onChange={(e) => setWipeConfirmPhrase(e.target.value)}
                        placeholder="مسح كافة البيانات"
                        className="w-full bg-white border border-red-300 rounded-md px-2.5 py-1.5 text-xs text-slate-900 focus:outline-none"
                      />
                    </div>

                    {wipeError && (
                      <div className="p-2.5 bg-red-50 border border-red-200 rounded-md text-red-700 text-xs">
                        {wipeError}
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={handleExecuteWipe}
                      className="px-4 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-md text-xs font-bold cursor-pointer"
                    >
                      تأكيد المسح النهائي
                    </button>
                  </div>
                </>
              )}

              {(currentTab === 'ui' || currentTab === 'images' || currentTab === 'cloud' || currentTab === 'security') && (
                <div className="pt-4 border-t border-slate-200 flex items-center justify-between gap-4">
                  <span className="text-xs font-semibold text-emerald-700">
                    {saveSuccess ? 'تم حفظ الإعدادات بنجاح' : ''}
                  </span>
                  <button
                    type="button"
                    onClick={handleSaveGeneral}
                    className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>حفظ التغييرات</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
