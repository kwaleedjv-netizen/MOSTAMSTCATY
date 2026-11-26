import React, { useState } from 'react';
import { Lock, AlertCircle, HelpCircle, Eye, EyeOff } from 'lucide-react';
import { verifyPassword } from '../services/crypto';
import { useLayoutMode } from '../hooks/useViewportMode';

interface LockScreenModalProps {
  isOpen: boolean;
  expectedHash?: string;
  salt?: string;
  passwordHint?: string;
  onUnlock: () => void;
}

export const LockScreenModal: React.FC<LockScreenModalProps> = ({
  isOpen,
  expectedHash,
  salt,
  passwordHint,
  onUnlock,
}) => {
  const { isMobile } = useLayoutMode();
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showHint, setShowHint] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);

  if (!isOpen) return null;

  const handleAttemptUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) return;

    setIsVerifying(true);
    setError(null);

    if (!expectedHash || !salt) {
      onUnlock();
      setIsVerifying(false);
      return;
    }

    const isValid = await verifyPassword(password, expectedHash, salt);
    setIsVerifying(false);

    if (isValid) {
      setPassword('');
      onUnlock();
    } else {
      setError('كلمة المرور غير صحيحة، يرجى المحاولة مرة أخرى.');
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-[2px] p-4 select-none"
      dir="rtl"
    >
      <div
        className={`w-full max-w-sm bg-white border border-slate-200 shadow-2xl overflow-hidden text-xs ${
          isMobile ? 'rounded-2xl' : 'rounded-lg'
        }`}
      >
        <div className="p-6 text-center space-y-5">
          <div className="w-11 h-11 bg-blue-50 text-blue-600 rounded-md flex items-center justify-center mx-auto border border-blue-200">
            <Lock className="w-5 h-5" />
          </div>

          <div className="space-y-1">
            <h2 className="text-base font-bold text-slate-900">الخزانة مقفلة</h2>
            <p className="text-xs text-slate-500">
              أدخل كلمة المرور الرئيسية للوصول إلى المستمسكات
            </p>
          </div>

          <form onSubmit={handleAttemptUnlock} className="space-y-3 text-right">
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                autoFocus
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="كلمة المرور الرئيسية"
                className={`w-full bg-white border border-slate-300 focus:border-blue-600 rounded-md text-sm text-slate-900 text-center font-mono focus:outline-none ${
                  isMobile ? 'min-h-[46px] pl-11 pr-3 py-2.5' : 'pl-9 pr-3 py-2'
                }`}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className={`absolute left-1 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer flex items-center justify-center ${
                  isMobile ? 'min-w-[40px] min-h-[40px]' : 'left-2.5'
                }`}
                aria-label={showPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            {error && (
              <div className="text-[11px] text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2 flex items-center justify-center gap-1.5 font-medium">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={isVerifying || !password}
              className={`w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-45 disabled:cursor-not-allowed text-white font-bold rounded-md cursor-pointer transition-colors ${
                isMobile ? 'min-h-[46px] py-2.5 text-sm' : 'py-2'
              }`}
            >
              {isVerifying ? 'جارِ التحقق...' : 'فتح الخزانة'}
            </button>
          </form>

          {passwordHint && (
            <div className="pt-3 border-t border-slate-200">
              {!showHint ? (
                <button
                  type="button"
                  onClick={() => setShowHint(true)}
                  className={`text-[11px] text-slate-500 hover:text-blue-600 flex items-center justify-center gap-1 mx-auto cursor-pointer font-medium ${
                    isMobile ? 'min-h-[40px] px-3' : ''
                  }`}
                >
                  <HelpCircle className="w-3.5 h-3.5" />
                  <span>عرض تلميح كلمة المرور</span>
                </button>
              ) : (
                <div className="px-3 py-2 bg-amber-50 rounded-md border border-amber-200 text-amber-800 text-[11px]">
                  تلميح: {passwordHint}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
