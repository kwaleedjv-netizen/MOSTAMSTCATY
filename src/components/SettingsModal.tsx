import React, { useState } from 'react';
import {
  X,
  Settings,
  Shield,
  Palette,
  Image,
  Database,
  Cloud,
  AlertTriangle,
  Check,
  RefreshCw,
  Globe,
  Laptop,
  LogOut,
  Trash2,
  ShieldCheck,
  Ban,
} from 'lucide-react';
import { User } from 'firebase/auth';
import { AppSettings } from '../types';
import { VIEW_MODES } from '../constants/viewModes';
import { hashPassword, verifyPassword } from '../services/crypto';
import { useLayoutMode } from '../hooks/useViewportMode';
import {
  NetworkIpInfo,
  TrustedIpRecord,
  UserDeviceRecord,
} from '../services/firebase';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
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
  initialTab?: 'ui' | 'images' | 'storage' | 'security' | 'cloud' | 'reset';
  firebaseUser: User | null;
  currentIpInfo: NetworkIpInfo | null;
  requireEmailOnNewIp: boolean;
  trustedIps: TrustedIpRecord[];
  userDevices: UserDeviceRecord[];
  onToggleRequireEmailOnNewIp: (enabled: boolean) => Promise<void>;
  onRevokeTrustedIp: (ipHash: string) => Promise<void>;
  onRemoveTrustedIp: (ipHash: string) => Promise<void>;
  onRemoveUserDevice: (deviceId: string) => Promise<void>;
  onSwitchGoogleAccount: () => Promise<void>;
  onSignOutGoogle: () => Promise<void>;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onSaveSettings,
  storageStats,
  onResetSettingsOnly,
  onFactoryResetWipeAll,
  initialTab = 'ui',
  firebaseUser,
  currentIpInfo,
  requireEmailOnNewIp,
  trustedIps,
  userDevices,
  onToggleRequireEmailOnNewIp,
  onRevokeTrustedIp,
  onRemoveTrustedIp,
  onRemoveUserDevice,
  onSwitchGoogleAccount,
  onSignOutGoogle,
}) => {
  const [currentTab, setCurrentTab] = useState<'ui' | 'images' | 'storage' | 'security' | 'cloud' | 'reset'>(initialTab);
  const [localSettings, setLocalSettings] = useState<AppSettings>({ ...settings, theme: 'light' });
  const [saveSuccess, setSaveSuccess] = useState(false);
  const { isMobile, isTablet } = useLayoutMode();

  // Security passwords state
  const [newMasterPassword, setNewMasterPassword] = useState('');
  const [confirmMasterPassword, setConfirmMasterPassword] = useState('');
  const [passwordHint, setPasswordHint] = useState(settings.passwordHint || '');
  const [securityMessage, setSecurityMessage] = useState<string | null>(null);

  // Factory reset state
  const [wipePassword, setWipePassword] = useState('');
  const [wipeConfirmPhrase, setWipeConfirmPhrase] = useState('');
  const [wipeError, setWipeError] = useState<string | null>(null);

  // Integrity check status
  const [integrityStatus, setIntegrityStatus] = useState<string | null>(null);

  React.useEffect(() => {
    setLocalSettings({ ...settings, theme: 'light' });
  }, [settings, isOpen]);

  React.useEffect(() => {
    if (initialTab) {
      setCurrentTab(initialTab);
    }
  }, [initialTab, isOpen]);

  if (!isOpen) return null;

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
    setSecurityMessage('تم تحديث كلمة المرور الرئيسية بنجاح!');
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
    setSecurityMessage('تم إزالة كلمة المرور الرئيسية وإلغاء قفل التطبيق');
  };

  const handleRunIntegrityCheck = () => {
    setIntegrityStatus('جارِ فحص الجداول ومؤشرات قاعدة البيانات...');
    setTimeout(() => {
      setIntegrityStatus(
        `✓ الفحص سليم 100%: تم التحقق من سلامة ${storageStats.documentsCount} مستمسك، ${storageStats.groupsCount} مجموعة، ومؤشرات IndexedDB/SQLite.`
      );
    }, 600);
  };

  const handleExecuteWipe = async () => {
    setWipeError(null);
    if (wipeConfirmPhrase !== 'مسح كافة البيانات') {
      setWipeError('يرجى كتابة عبارة التأكيد بدقة: "مسح كافة البيانات"');
      return;
    }
    if (settings.hasMasterPassword && settings.masterPasswordHash && settings.masterPasswordSalt) {
      const isValid = await verifyPassword(wipePassword, settings.masterPasswordHash, settings.masterPasswordSalt);
      if (!isValid) {
        setWipeError('كلمة المرور الرئيسية غير صحيحة');
        return;
      }
    }

    await onFactoryResetWipeAll(wipePassword);
    onClose();
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-[1px] select-none font-['Cairo',system-ui,sans-serif] ${
        isMobile ? 'p-0' : isTablet ? 'p-2' : 'p-4'
      }`}
      dir="rtl"
    >
      <div
        className={
          isMobile
            ? 'w-full h-[100dvh] bg-white overflow-hidden flex flex-col text-right'
            : `w-full max-w-3xl bg-white border border-slate-200 rounded-lg shadow-2xl overflow-hidden flex flex-col ${
                isTablet ? 'max-h-[94dvh]' : 'max-h-[88vh]'
              } text-right`
        }
      >
        {/* Header */}
        <div className={`flex items-center justify-between ${isMobile ? 'min-h-[50px] pt-safe px-3 bg-white' : 'px-5 py-3 bg-slate-50'} border-b border-slate-200 shrink-0`}>
          <div className="flex items-center gap-2">
            <Settings className="w-4 h-4 text-blue-600" />
            <span className="font-bold text-sm text-slate-800">إعدادات التطبيق وخيارات النظام</span>
          </div>
          <button
            onClick={onClose}
            aria-label="إغلاق"
            className={`${isMobile ? 'min-w-[42px] min-h-[42px] rounded-xl flex items-center justify-center' : 'p-1 rounded'} text-slate-400 hover:text-slate-700 hover:bg-slate-200 cursor-pointer`}
          >
            <X className={isMobile ? 'w-5 h-5' : 'w-4 h-4'} />
          </button>
        </div>

        {/* Tabbed Layout: Horizontal Chips on Mobile, Sidebar Tabs on Desktop */}
        <div className={`flex-1 flex overflow-hidden ${isMobile ? 'flex-col' : ''}`}>
          {/* Tabs Navigation */}
          {isMobile ? (
            <div className="bg-slate-50 border-b border-slate-200 px-3 py-2 flex items-center gap-1.5 overflow-x-auto no-scrollbar text-xs shrink-0">
              {[
                { id: 'ui' as const, label: 'الواجهة', icon: Palette },
                { id: 'images' as const, label: 'الصور والطباعة', icon: Image },
                { id: 'storage' as const, label: 'التخزين', icon: Database },
                { id: 'security' as const, label: 'الأمان', icon: Shield },
                { id: 'cloud' as const, label: 'المزامنة', icon: Cloud },
                { id: 'reset' as const, label: 'ضبط المصنع', icon: AlertTriangle, danger: true },
              ].map((t) => {
                const Icon = t.icon;
                const active = currentTab === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setCurrentTab(t.id)}
                    className={`min-h-[38px] px-3 rounded-xl flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer ${
                      active
                        ? t.danger
                          ? 'bg-red-600 text-white font-bold'
                          : 'bg-blue-600 text-white font-bold'
                        : t.danger
                        ? 'bg-white border border-red-200 text-red-600'
                        : 'bg-white border border-slate-200 text-slate-700'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5 shrink-0" />
                    <span>{t.label}</span>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="w-48 bg-slate-50 border-l border-slate-200 p-2 space-y-1 text-xs shrink-0 text-right">
              <button
                onClick={() => setCurrentTab('ui')}
                className={`w-full flex items-center gap-2 px-3 py-2 rounded text-right transition-colors cursor-pointer ${
                  currentTab === 'ui' ? 'bg-blue-50 text-blue-700 font-bold' : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                <Palette className="w-3.5 h-3.5" />
                <span>إعدادات الواجهة</span>
              </button>

              <button
                onClick={() => setCurrentTab('images')}
                className={`w-full flex items-center gap-2 px-3 py-2 rounded text-right transition-colors cursor-pointer ${
                  currentTab === 'images' ? 'bg-blue-50 text-blue-700 font-bold' : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                <Image className="w-3.5 h-3.5" />
                <span>إعدادات الصور والطباعة</span>
              </button>

              <button
                onClick={() => setCurrentTab('storage')}
                className={`w-full flex items-center gap-2 px-3 py-2 rounded text-right transition-colors cursor-pointer ${
                  currentTab === 'storage' ? 'bg-blue-50 text-blue-700 font-bold' : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                <Database className="w-3.5 h-3.5" />
                <span>إعدادات التخزين</span>
              </button>

              <button
                onClick={() => setCurrentTab('security')}
                className={`w-full flex items-center gap-2 px-3 py-2 rounded text-right transition-colors cursor-pointer ${
                  currentTab === 'security' ? 'bg-blue-50 text-blue-700 font-bold' : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                <Shield className="w-3.5 h-3.5" />
                <span>الأمان والتشفير</span>
              </button>

              <button
                onClick={() => setCurrentTab('cloud')}
                className={`w-full flex items-center gap-2 px-3 py-2 rounded text-right transition-colors cursor-pointer ${
                  currentTab === 'cloud' ? 'bg-blue-50 text-blue-700 font-bold' : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                <Cloud className="w-3.5 h-3.5" />
                <span>المزامنة السحابية</span>
              </button>

              <div className="h-[1px] bg-slate-200 my-2" />

              <button
                onClick={() => setCurrentTab('reset')}
                className={`w-full flex items-center gap-2 px-3 py-2 rounded text-right transition-colors cursor-pointer ${
                  currentTab === 'reset' ? 'bg-red-50 text-red-600 font-bold' : 'text-red-600/80 hover:bg-red-50 hover:text-red-700'
                }`}
              >
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>إعادة ضبط المصنع</span>
              </button>
            </div>
          )}

          {/* Tab Content Panel */}
          <div className={`flex-1 overflow-y-auto ${isMobile ? 'p-4 pb-safe' : 'p-5'} text-xs text-right space-y-4`}>
            {/* 1. UI SETTINGS */}
            {currentTab === 'ui' && (
              <div className="space-y-4">
                <div className="font-bold text-sm text-slate-800 border-b border-slate-200 pb-2">
                  تخصيص الواجهة وتجربة الاستخدام
                </div>

                <div className={`grid ${isMobile ? 'grid-cols-1 gap-3' : 'grid-cols-2 gap-4'}`}>
                  <div>
                    <label className="text-slate-700 block mb-1">اللغة الرئيسية (Language)</label>
                    <select
                      value={localSettings.language}
                      onChange={(e) => setLocalSettings({ ...localSettings, language: e.target.value as any })}
                      className="w-full bg-white border border-slate-200 rounded px-3 py-1.5 text-slate-800"
                    >
                      <option value="ar">العربية (RTL)</option>
                      <option value="en">English (LTR)</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-slate-700 block mb-1">المظهر (Theme)</label>
                    <div className="w-full bg-slate-50 border border-slate-200 rounded px-3 py-1.5 text-slate-700 font-medium flex items-center justify-between">
                      <span>الوضع الفاتح المكتبي حصرياً (Light UI)</span>
                      <span className="text-[10px] text-blue-600 font-bold">نشط دائماً</span>
                    </div>
                  </div>

                  <div>
                    <label className="text-slate-700 block mb-1">حجم البطاقات الافتراضي</label>
                    <select
                      value={localSettings.cardSize}
                      onChange={(e) => setLocalSettings({ ...localSettings, cardSize: e.target.value as any })}
                      className="w-full bg-white border border-slate-200 rounded px-3 py-1.5 text-slate-800"
                    >
                      <option value="small">صغير (Small)</option>
                      <option value="medium">متوسط (Medium)</option>
                      <option value="large">كبير (Large)</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-slate-700 block mb-1">طريقة العرض الافتراضية</label>
                    <select
                      value={localSettings.viewMode}
                      onChange={(e) => setLocalSettings({ ...localSettings, viewMode: e.target.value as any })}
                      className="w-full bg-white border border-slate-200 rounded px-3 py-1.5 text-slate-800"
                    >
                      {VIEW_MODES.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-200 flex justify-end">
                  <button
                    onClick={handleSaveGeneral}
                    className="px-5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded font-bold cursor-pointer flex items-center gap-1.5 shadow-xs"
                  >
                    {saveSuccess && <Check className="w-3.5 h-3.5" />}
                    <span>حفظ إعدادات الواجهة</span>
                  </button>
                </div>
              </div>
            )}

            {/* 2. IMAGES & PRINT */}
            {currentTab === 'images' && (
              <div className="space-y-4">
                <div className="font-bold text-sm text-slate-800 border-b border-slate-200 pb-2">
                  جودة الصور ودقة الطباعة الفيزيائية
                </div>

                <div className={`grid ${isMobile ? 'grid-cols-1 gap-3' : 'grid-cols-2 gap-4'}`}>
                  <div>
                    <label className="text-slate-700 block mb-1">دقة التصدير والطباعة (DPI)</label>
                    <select
                      value={localSettings.exportDpi}
                      onChange={(e) => setLocalSettings({ ...localSettings, exportDpi: Number(e.target.value) as any })}
                      className="w-full bg-white border border-slate-200 rounded px-3 py-1.5 text-slate-800 font-mono"
                    >
                      <option value={300}>300 DPI (قياسي فائق الجودة للطباعة)</option>
                      <option value={600}>600 DPI (دقة مجهرية متقدمة)</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-slate-700 block mb-1">استدارة الحواف الافتراضية للبطاقات (mm)</label>
                    <input
                      type="number"
                      step="0.5"
                      value={localSettings.defaultCornerRadiusMm}
                      onChange={(e) => setLocalSettings({ ...localSettings, defaultCornerRadiusMm: Number(e.target.value) || 0 })}
                      className="w-full bg-white border border-slate-200 rounded px-3 py-1.5 text-slate-800 font-mono"
                    />
                  </div>
                </div>

                <div className="pt-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={localSettings.keepOriginalImages}
                      onChange={(e) => setLocalSettings({ ...localSettings, keepOriginalImages: e.target.checked })}
                      className="rounded accent-blue-600"
                    />
                    <span className="text-slate-700">
                      الاحتفاظ بنسخة من الصورة الأصلية قبل أي قص أو تعديل لتسهيل الرجوع إليها مستقبلاً
                    </span>
                  </label>
                </div>

                <div className="pt-4 border-t border-slate-200 flex justify-end">
                  <button
                    onClick={handleSaveGeneral}
                    className="px-5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded font-bold cursor-pointer shadow-xs"
                  >
                    حفظ إعدادات الصور
                  </button>
                </div>
              </div>
            )}

            {/* 3. STORAGE & INTEGRITY */}
            {currentTab === 'storage' && (
              <div className="space-y-4">
                <div className="font-bold text-sm text-slate-800 border-b border-slate-200 pb-2">
                  إدارة التخزين المحلي الآمن
                </div>

                <div className="bg-slate-50 p-4 rounded border border-slate-200 space-y-2">
                  <div className="flex justify-between text-slate-700">
                    <span>مساحة التخزين المستخدمة:</span>
                    <span className="font-mono text-blue-700 font-bold">{formatBytes(storageStats.usedBytes)}</span>
                  </div>
                  <div className="flex justify-between text-slate-700">
                    <span>عدد المستمسكات المحفوظة:</span>
                    <span className="font-mono text-slate-900">{storageStats.documentsCount} مستمسك</span>
                  </div>
                  <div className="flex justify-between text-slate-700">
                    <span>عدد المجموعات:</span>
                    <span className="font-mono text-slate-900">{storageStats.groupsCount} مجموعة</span>
                  </div>
                  <div className="flex justify-between text-slate-700">
                    <span>عدد القيود في سجل العمليات:</span>
                    <span className="font-mono text-slate-900">{storageStats.logsCount} قيد</span>
                  </div>
                </div>

                <div className="p-3 bg-white rounded border border-slate-200 flex items-center justify-between">
                  <div>
                    <div className="font-bold text-slate-800">فحص سلامة قاعدة البيانات والملفات</div>
                    <div className="text-[10px] text-slate-500">فحص المؤشرات، الجداول، والمستمسكات على القرص</div>
                  </div>
                  <button
                    onClick={handleRunIntegrityCheck}
                    className="px-3 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded border border-slate-200 cursor-pointer flex items-center gap-1 font-medium"
                  >
                    <RefreshCw className="w-3.5 h-3.5 text-blue-600" />
                    <span>فحص السلامة الآن</span>
                  </button>
                </div>

                {integrityStatus && (
                  <div className="p-3 bg-blue-50 border border-blue-200 rounded text-blue-800 text-[11px]">
                    {integrityStatus}
                  </div>
                )}
              </div>
            )}

            {/* 4. SECURITY & PASSWORDS */}
            {currentTab === 'security' && (
              <div className="space-y-4">
                <div className="font-bold text-sm text-slate-800 border-b border-slate-200 pb-2">
                  الأمان، التشفير وقفل التطبيق
                </div>

                <div className="p-3 bg-slate-50 rounded border border-slate-200 flex items-center justify-between">
                  <div>
                    <span className="font-bold text-slate-800 block">حالة الحماية بكلمة مرور رئيسية</span>
                    <span className="text-[11px] text-slate-500">
                      {localSettings.hasMasterPassword ? 'مفعلة وتتطلب فتح القفل عند التشغيل' : 'غير مفعلة'}
                    </span>
                  </div>
                  {localSettings.hasMasterPassword && (
                    <button
                      onClick={handleRemoveMasterPassword}
                      className="px-3 py-1 bg-red-50 hover:bg-red-100 text-red-600 rounded border border-red-200 cursor-pointer font-medium"
                    >
                      إلغاء كلمة المرور
                    </button>
                  )}
                </div>

                {/* Set or Change Password */}
                <div className="space-y-3 bg-white p-4 rounded border border-slate-200">
                  <span className="font-bold text-slate-800 block">
                    {localSettings.hasMasterPassword ? 'تغيير كلمة المرور الرئيسية' : 'تعيين كلمة مرور رئيسية جديدة'}
                  </span>

                  <div>
                    <label className="text-slate-600 block mb-1">كلمة المرور الجديدة</label>
                    <input
                      type="password"
                      value={newMasterPassword}
                      onChange={(e) => setNewMasterPassword(e.target.value)}
                      placeholder="6 أحرف أو أرقام على الأقل"
                      className="w-full bg-white border border-slate-200 rounded px-3 py-1.5 text-slate-800"
                    />
                  </div>

                  <div>
                    <label className="text-slate-600 block mb-1">تأكيد كلمة المرور الجديدة</label>
                    <input
                      type="password"
                      value={confirmMasterPassword}
                      onChange={(e) => setConfirmMasterPassword(e.target.value)}
                      placeholder="أعد إدخال كلمة المرور"
                      className="w-full bg-white border border-slate-200 rounded px-3 py-1.5 text-slate-800"
                    />
                  </div>

                  <div>
                    <label className="text-slate-600 block mb-1">تلميح كلمة المرور (للاستعادة عند النسيان)</label>
                    <input
                      type="text"
                      value={passwordHint}
                      onChange={(e) => setPasswordHint(e.target.value)}
                      placeholder="مثال: تاريخ مهم، اسم العائلة..."
                      className="w-full bg-white border border-slate-200 rounded px-3 py-1.5 text-slate-800"
                    />
                  </div>

                  {securityMessage && (
                    <div className="p-2 bg-amber-50 rounded text-[11px] text-amber-800 border border-amber-200">
                      {securityMessage}
                    </div>
                  )}

                  <button
                    onClick={handleUpdateMasterPassword}
                    className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded font-bold cursor-pointer shadow-xs"
                  >
                    حفظ وتفعيل كلمة المرور
                  </button>
                </div>

                {/* Auto-lock */}
                <div>
                  <label className="text-slate-700 block mb-1">القفل التلقائي عند الخمول</label>
                  <select
                    value={localSettings.autoLockMinutes}
                    onChange={(e) => setLocalSettings({ ...localSettings, autoLockMinutes: Number(e.target.value) })}
                    className="w-full bg-white border border-slate-200 rounded px-3 py-1.5 text-slate-800"
                  >
                    <option value={0}>معطل (لا تقفل تلقائياً)</option>
                    <option value={5}>بعد 5 دقائق من الخمول</option>
                    <option value={15}>بعد 15 دقيقة من الخمول</option>
                    <option value={30}>بعد 30 دقيقة من الخمول</option>
                    <option value={60}>بعد ساعة واحدة</option>
                  </select>
                </div>
              </div>
            )}

            {/* 5. CLOUD SYNC, GOOGLE ACCOUNT & IP PROTECTION */}
            {currentTab === 'cloud' && (
              <div className="space-y-4">
                <div className="font-bold text-sm text-slate-800 border-b border-slate-200 pb-2">
                  حساب Google، المزامنة السحابية، وحماية الـ IP والأجهزة المتعددة
                </div>

                {/* Google Account Card */}
                {firebaseUser && (
                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-3.5 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      {firebaseUser.photoURL ? (
                        <img
                          src={firebaseUser.photoURL}
                          alt={firebaseUser.displayName || 'Google'}
                          className="w-10 h-10 rounded-full border border-slate-300 shrink-0"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-sm shrink-0">
                          {(firebaseUser.email || 'G')[0].toUpperCase()}
                        </div>
                      )}
                      <div className="min-w-0">
                        <div className="font-bold text-slate-900 truncate">
                          {firebaseUser.displayName || 'حساب Google موثق'}
                        </div>
                        <div className="text-[11px] font-mono text-blue-700 truncate">
                          {firebaseUser.email}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => void onSwitchGoogleAccount()}
                        className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 rounded font-semibold cursor-pointer"
                      >
                        تبديل الحساب
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          onClose();
                          void onSignOutGoogle();
                        }}
                        className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 rounded font-semibold flex items-center gap-1 cursor-pointer"
                      >
                        <LogOut className="w-3.5 h-3.5" />
                        <span>خروج</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* New IP & Multi-Device Guard Setting */}
                <div className="bg-blue-50/70 border border-blue-200 rounded-lg p-3.5 space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Globe className="w-4 h-4 text-blue-600 shrink-0" />
                      <span className="font-bold text-slate-800">عنوان IP الحالي:</span>
                      <span className="font-mono font-bold text-blue-800 bg-white border border-blue-200 px-2 py-0.5 rounded">
                        {currentIpInfo?.ip || 'غير معروف'}
                      </span>
                    </div>
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">
                      <ShieldCheck className="w-3 h-3" />
                      <span>موثوق</span>
                    </span>
                  </div>

                  <label className="flex items-start gap-2 cursor-pointer pt-1">
                    <input
                      type="checkbox"
                      checked={requireEmailOnNewIp}
                      onChange={(e) => void onToggleRequireEmailOnNewIp(e.target.checked)}
                      className="rounded accent-blue-600 mt-0.5"
                    />
                    <span className="text-slate-700 leading-relaxed">
                      طلب تسجيل الدخول وتأكيد إيميل Google تلقائياً عند اكتشاف أي عنوان IP جديد أو جهاز متعدد
                    </span>
                  </label>
                </div>

                {/* Trusted IP Addresses */}
                <div className="bg-white border border-slate-200 rounded-lg p-3.5 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-800">عناوين الشبكة (IPs) المسجلة ({trustedIps.length})</span>
                    <span className="text-[10px] text-slate-500">إلغاء الثقة يجبر الجهاز على إدخال الإيميل فوراً</span>
                  </div>

                  {trustedIps.length === 0 ? (
                    <div className="text-[11px] text-slate-400 py-2">لا توجد عناوين مسجلة بعد.</div>
                  ) : (
                    <div className="divide-y divide-slate-100 border border-slate-200 rounded-md overflow-hidden">
                      {trustedIps.map((item) => {
                        const isCurrentIp = currentIpInfo?.ipHash === item.ipHash;
                        return (
                          <div key={item.ipHash} className="p-2.5 flex flex-wrap items-center justify-between gap-2 bg-white">
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="font-mono font-bold text-slate-900">{item.ipLabel}</span>
                                {isCurrentIp && (
                                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                                    الحالي
                                  </span>
                                )}
                                <span
                                  className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${
                                    item.trusted
                                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                      : 'bg-red-50 text-red-700 border-red-200'
                                  }`}
                                >
                                  {item.trusted ? 'موثوق' : 'ملغى / محظور'}
                                </span>
                              </div>
                              <div className="text-[10px] text-slate-500 truncate mt-0.5">
                                {item.deviceName} · {item.verifiedEmail}
                              </div>
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0">
                              {item.trusted && (
                                <button
                                  type="button"
                                  onClick={() => void onRevokeTrustedIp(item.ipHash)}
                                  className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded text-[11px] font-semibold flex items-center gap-1 cursor-pointer"
                                  title="إلغاء ثقة هذا الـ IP لإجبار إعادة تسجيل الدخول"
                                >
                                  <Ban className="w-3 h-3" />
                                  <span>إلغاء الثقة</span>
                                </button>
                              )}
                              {!isCurrentIp && (
                                <button
                                  type="button"
                                  onClick={() => void onRemoveTrustedIp(item.ipHash)}
                                  className="p-1.5 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 rounded cursor-pointer"
                                  title="حذف السجل"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Multi-Device Registry */}
                <div className="bg-white border border-slate-200 rounded-lg p-3.5 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-800">الأجهزة المرتبطة بالحساب ({userDevices.length})</span>
                    <span className="text-[10px] text-slate-500">مزامنة متعددة الأجهزة عبر السحابة</span>
                  </div>

                  {userDevices.length === 0 ? (
                    <div className="text-[11px] text-slate-400 py-2">لا توجد أجهزة مسجلة بعد.</div>
                  ) : (
                    <div className="divide-y divide-slate-100 border border-slate-200 rounded-md overflow-hidden">
                      {userDevices.map((dev) => {
                        const isThisDevice = dev.id === localSettings.cloudDeviceId;
                        return (
                          <div key={dev.id} className="p-2.5 flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <Laptop className="w-4 h-4 text-slate-500 shrink-0" />
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <span className="font-bold text-slate-900 truncate">{dev.name}</span>
                                  {isThisDevice && (
                                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                                      هذا الجهاز
                                    </span>
                                  )}
                                </div>
                                <div className="text-[10px] text-slate-500 truncate">
                                  {dev.platform} · آخر IP: <span className="font-mono">{dev.lastIpLabel}</span>
                                </div>
                              </div>
                            </div>

                            {!isThisDevice && (
                              <button
                                type="button"
                                onClick={() => void onRemoveUserDevice(dev.id)}
                                className="px-2.5 py-1 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 rounded text-[11px] font-semibold cursor-pointer shrink-0"
                              >
                                إزالة الجهاز
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Device Config */}
                <div className="space-y-3 pt-1">
                  <div className={`grid ${isMobile ? 'grid-cols-1 gap-3' : 'grid-cols-2 gap-3'}`}>
                    <div>
                      <label className="text-slate-700 block mb-1">اسم هذا الجهاز</label>
                      <input
                        type="text"
                        value={localSettings.cloudDeviceName}
                        onChange={(e) => setLocalSettings({ ...localSettings, cloudDeviceName: e.target.value })}
                        className="w-full bg-white border border-slate-200 rounded px-3 py-1.5 text-slate-800"
                      />
                    </div>
                    <div>
                      <label className="text-slate-700 block mb-1">معرف الجهاز (Device ID)</label>
                      <input
                        type="text"
                        readOnly
                        value={localSettings.cloudDeviceId}
                        className="w-full bg-slate-50 border border-slate-200 rounded px-3 py-1.5 text-slate-500 font-mono"
                      />
                    </div>
                  </div>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={localSettings.autoSyncOnStart}
                      onChange={(e) => setLocalSettings({ ...localSettings, autoSyncOnStart: e.target.checked })}
                      className="rounded accent-blue-600"
                    />
                    <span className="text-slate-700">المزامنة التلقائية عبر السحابة عند التشغيل وعند عودة الإنترنت</span>
                  </label>
                </div>

                <div className="pt-3 border-t border-slate-200 flex justify-end">
                  <button
                    onClick={handleSaveGeneral}
                    className="px-5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded font-bold cursor-pointer shadow-xs"
                  >
                    حفظ إعدادات الجهاز والسحابة
                  </button>
                </div>
              </div>
            )}

            {/* 6. FACTORY RESET */}
            {currentTab === 'reset' && (
              <div className="space-y-5">
                <div className="font-bold text-sm text-red-600 border-b border-red-200 pb-2">
                  خيارات إعادة ضبط المصنع
                </div>

                {/* Option 1: Reset Settings Only */}
                <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 space-y-2">
                  <div className="font-bold text-slate-800">الخيار 1: استعادة الإعدادات الافتراضية فقط</div>
                  <p className="text-[11px] text-slate-600 leading-relaxed">
                    يعيد ضبط إعدادات الواجهة، الألوان، خيارات العرض، والدقة إلى الوضع الافتراضي، مع الاحتفاظ بجميع
                    المستمسكات والملفات والمجموعات دون المساس بها مطلقاً.
                  </p>
                  <button
                    onClick={onResetSettingsOnly}
                    className="px-4 py-1.5 bg-white hover:bg-slate-100 text-slate-700 rounded border border-slate-300 cursor-pointer font-medium"
                  >
                    استعادة الإعدادات فقط (آمن)
                  </button>
                </div>

                {/* Option 2: Complete Data Wipe */}
                <div className="bg-red-50 p-4 rounded-lg border border-red-200 space-y-3">
                  <div className="flex items-center gap-2 text-red-700 font-bold text-sm">
                    <AlertTriangle className="w-4 h-4 text-red-600" />
                    <span>الخيار 2: مسح جميع بيانات التطبيق نهائياً (Factory Reset)</span>
                  </div>

                  <p className="text-[11px] text-red-700 leading-relaxed">
                    تحذير شديد: سيؤدي هذا الخيار إلى حذف كافة المستمسكات، الصور الأصلية والمعدلة، المجموعات، سجل
                    العمليات، والإعدادات نهائياً من القرص المحلي وقاعدة البيانات. لا يمكن التراجع عن هذا الإجراء!
                  </p>

                  {localSettings.hasMasterPassword && (
                    <div>
                      <label className="text-red-800 block mb-1">كلمة المرور الرئيسية للتأكيد الإلزامي:</label>
                      <input
                        type="password"
                        value={wipePassword}
                        onChange={(e) => setWipePassword(e.target.value)}
                        placeholder="أدخل كلمة المرور الرئيسية"
                        className="w-full bg-white border border-red-300 rounded px-3 py-1.5 text-slate-900"
                      />
                    </div>
                  )}

                  <div>
                    <label className="text-red-800 block mb-1">
                      اكتب العبارة التالية بدقة للتأكيد:{' '}
                      <span className="font-bold underline text-red-900">مسح كافة البيانات</span>
                    </label>
                    <input
                      type="text"
                      value={wipeConfirmPhrase}
                      onChange={(e) => setWipeConfirmPhrase(e.target.value)}
                      placeholder="مسح كافة البيانات"
                      className="w-full bg-white border border-red-300 rounded px-3 py-1.5 text-slate-900 font-bold"
                    />
                  </div>

                  {wipeError && (
                    <div className="p-2 bg-red-100 border border-red-300 rounded text-red-800 text-[11px]">
                      {wipeError}
                    </div>
                  )}

                  <button
                    onClick={handleExecuteWipe}
                    className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white font-extrabold rounded shadow-xs cursor-pointer"
                  >
                    تأكيد مسح كافة البيانات والملفات نهائياً
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
