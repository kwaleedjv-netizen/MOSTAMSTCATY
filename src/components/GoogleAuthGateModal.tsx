import React, { useState } from 'react';
import { User } from 'firebase/auth';
import { RefreshCw, AlertCircle, CheckCircle2 } from 'lucide-react';
import { IpGateReason, NetworkIpInfo } from '../services/firebase';

interface GoogleAuthGateModalProps {
  isLoading: boolean;
  user: User | null;
  reason: IpGateReason;
  ipInfo?: NetworkIpInfo | null;
  onAuthenticateWithGoogle: () => Promise<void>;
  onAuthenticateWithEmail: (
    email: string,
    password: string,
    mode: 'signin' | 'register'
  ) => Promise<void>;
  onSignOut: () => Promise<void>;
  onRetryIpCheck?: () => Promise<void>;
}

const GoogleGIcon: React.FC<{ className?: string }> = ({ className = 'w-5 h-5' }) => (
  <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
    <path
      fill="#4285F4"
      d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17Z"
    />
    <path
      fill="#34A853"
      d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.96H1.29v3.14C3.26 21.3 7.31 24 12 24Z"
    />
    <path
      fill="#FBBC05"
      d="M5.28 14.24c-.24-.72-.38-1.49-.38-2.24s.14-1.52.38-2.24V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.99-3.14Z"
    />
    <path
      fill="#EA4335"
      d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.99 3.14c.95-2.85 3.6-4.96 6.72-4.96Z"
    />
  </svg>
);

export const GoogleAuthGateModal: React.FC<GoogleAuthGateModalProps> = ({
  isLoading,
  user,
  reason,
  onAuthenticateWithGoogle,
  onAuthenticateWithEmail,
  onSignOut,
}) => {
  const [authMode, setAuthMode] = useState<'signin' | 'register'>('signin');
  const [email, setEmail] = useState(user?.email || '');
  const [password, setPassword] = useState('');
  const [isBusy, setIsBusy] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [infoText, setInfoText] = useState<string | null>(null);

  const mapAuthError = (err: unknown): string => {
    const code = (err as { code?: string })?.code;
    if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
      return 'تم إغلاق نافذة تسجيل الدخول قبل الإكمال.';
    }
    if (code === 'auth/popup-blocked') {
      return 'يرجى السماح بالنوافذ المنبثقة لإكمال تسجيل الدخول عبر Google.';
    }
    if (code === 'auth/invalid-credential' || code === 'auth/wrong-password' || code === 'auth/user-not-found') {
      return 'البريد الإلكتروني أو كلمة المرور غير صحيحة.';
    }
    if (code === 'auth/email-already-in-use') {
      return 'هذا البريد الإلكتروني مسجل مسبقاً.';
    }
    if (code === 'auth/weak-password') {
      return 'كلمة المرور ضعيفة (يجب أن تكون 6 أحرف على الأقل).';
    }
    if (code === 'auth/invalid-email') {
      return 'صيغة البريد الإلكتروني غير صحيحة.';
    }
    if (code === 'auth/operation-not-allowed') {
      return 'تسجيل الدخول بالبريد وكلمة المرور غير مفعّل في Firebase Console. يمكنك استخدام زر Google أدناه.';
    }
    if (code === 'auth/unauthorized-domain') {
      const host = typeof window !== 'undefined' ? window.location.hostname : '';
      return `النطاق (${host}) غير مضاف ضمن النطاقات المصرح بها (Authorized domains) في Firebase Console.`;
    }
    if (code === 'auth/too-many-requests') {
      return 'تم إرسال طلبات كثيرة مؤقتاً. يرجى الانتظار قليلاً ثم المحاولة مرة أخرى.';
    }
    if (code === 'auth/user-disabled') {
      return 'تم تعطيل هذا الحساب من قبل الإدارة.';
    }
    if (code === 'auth/account-exists-with-different-credential') {
      return 'هذا البريد مسجل بطريقة دخول أخرى. استخدم زر Google أو البريد وكلمة المرور.';
    }
    if (code === 'auth/network-request-failed') {
      return 'تعذر الاتصال بالشبكة. تحقق من الإنترنت وأعد المحاولة.';
    }
    return err instanceof Error ? err.message : 'تعذر تسجيل الدخول. يرجى المحاولة مرة أخرى.';
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorText(null);
    setInfoText(null);

    if (!email.trim() || !password) {
      setErrorText('يرجى إدخال البريد الإلكتروني وكلمة المرور.');
      return;
    }

    setIsBusy(true);
    try {
      await onAuthenticateWithEmail(email.trim(), password, authMode);
      if (authMode === 'register') {
        setInfoText('تم إنشاء الحساب وإرسال رابط التفعيل لبريدك الإلكتروني. فعّل البريد ثم سجل الدخول.');
        setAuthMode('signin');
        setPassword('');
      }
    } catch (err: unknown) {
      setErrorText(mapAuthError(err));
    } finally {
      setIsBusy(false);
    }
  };

  const handleGoogleClick = async () => {
    setErrorText(null);
    setInfoText(null);
    setIsBusy(true);
    try {
      await onAuthenticateWithGoogle();
    } catch (err: unknown) {
      setErrorText(mapAuthError(err));
    } finally {
      setIsBusy(false);
    }
  };

  if (isLoading) {
    return (
      <div
        className="fixed inset-0 z-[200] bg-slate-50 flex items-center justify-center p-4 font-['Cairo',system-ui,sans-serif]"
        dir="rtl"
      >
        <div className="w-full max-w-sm bg-white border border-slate-200 rounded-2xl shadow-sm p-8 flex flex-col items-center gap-3">
          <RefreshCw className="w-6 h-6 text-blue-600 animate-spin" />
          <span className="text-xs font-semibold text-slate-600">جاري التحقق...</span>
        </div>
      </div>
    );
  }

  const isReverify = Boolean(user && reason && reason !== 'signin');

  return (
    <div
      className="fixed inset-0 z-[200] bg-slate-100 flex items-center justify-center p-4 font-['Cairo',system-ui,sans-serif]"
      dir="rtl"
    >
      <div className="w-full max-w-sm bg-white border border-slate-200 rounded-2xl shadow-lg p-6 space-y-5 text-right">
        <div className="text-center space-y-1">
          <h1 className="text-lg font-extrabold text-slate-900">مستمسكاتي</h1>
          <p className="text-xs text-slate-500">
            {isReverify
              ? 'يرجى تأكيد تسجيل الدخول للمتابعة'
              : authMode === 'signin'
              ? 'تسجيل الدخول إلى حسابك'
              : 'إنشاء حساب جديد'}
          </p>
        </div>

        <form onSubmit={handleEmailSubmit} className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              البريد الإلكتروني
            </label>
            <input
              type="email"
              dir="ltr"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@example.com"
              autoComplete="email"
              className="w-full min-h-[42px] px-3 bg-white border border-slate-300 focus:border-blue-600 rounded-xl text-xs text-slate-900 focus:outline-none text-left"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              كلمة المرور
            </label>
            <input
              type="password"
              dir="ltr"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete={authMode === 'signin' ? 'current-password' : 'new-password'}
              className="w-full min-h-[42px] px-3 bg-white border border-slate-300 focus:border-blue-600 rounded-xl text-xs text-slate-900 focus:outline-none text-left"
            />
          </div>

          {errorText && (
            <div className="p-2.5 bg-red-50 border border-red-200 rounded-xl text-red-700 text-[11px] flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorText}</span>
            </div>
          )}

          {infoText && (
            <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-700 text-[11px] flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{infoText}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={isBusy}
            className="w-full min-h-[44px] bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50 text-white font-bold text-xs rounded-xl cursor-pointer transition-colors"
          >
            {isBusy
              ? 'جاري التنفيذ...'
              : authMode === 'signin'
              ? 'تسجيل الدخول'
              : 'إنشاء حساب'}
          </button>
        </form>

        <div className="flex items-center gap-3">
          <div className="h-[1px] flex-1 bg-slate-200" />
          <span className="text-[11px] text-slate-400 font-medium">أو</span>
          <div className="h-[1px] flex-1 bg-slate-200" />
        </div>

        <button
          type="button"
          disabled={isBusy}
          onClick={handleGoogleClick}
          className="w-full min-h-[44px] px-4 bg-white hover:bg-slate-50 active:bg-slate-100 disabled:opacity-50 border border-slate-300 rounded-xl flex items-center justify-center gap-2.5 text-slate-800 font-bold text-xs cursor-pointer transition-colors"
        >
          <GoogleGIcon className="w-4 h-4 shrink-0" />
          <span>تسجيل الدخول عبر حساب Google</span>
        </button>

        <div className="flex items-center justify-center gap-4 pt-1 text-[11px]">
          <button
            type="button"
            disabled={isBusy}
            onClick={() => {
              setAuthMode((m) => (m === 'signin' ? 'register' : 'signin'));
              setErrorText(null);
              setInfoText(null);
            }}
            className="text-blue-600 hover:text-blue-700 font-semibold cursor-pointer"
          >
            {authMode === 'signin' ? 'إنشاء حساب جديد' : 'لديك حساب؟ تسجيل الدخول'}
          </button>

          {isReverify && (
            <button
              type="button"
              disabled={isBusy}
              onClick={() => void onSignOut()}
              className="text-slate-500 hover:text-red-600 font-semibold cursor-pointer"
            >
              تسجيل الخروج
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
