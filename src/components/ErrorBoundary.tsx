import React, { Component, ErrorInfo, ReactNode } from 'react';
import { ShieldAlert, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  errorMessage: string;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    errorMessage: '',
  };

  public static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      errorMessage: error.message || 'حدث خطأ غير متوقع في الاتصال أو صلاحيات البيانات',
    };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught error:', error, errorInfo);
  }

  private handleReload = () => {
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      let friendlyMessage = 'حدث خطأ غير متوقع أثناء تحميل البيانات.';
      if (
        this.state.errorMessage.includes('permission') ||
        this.state.errorMessage.includes('PERMISSION_DENIED') ||
        this.state.errorMessage.includes('"operationType"')
      ) {
        friendlyMessage =
          'تعذر الوصول إلى البيانات السحابية. يرجى إعادة تسجيل الدخول بحساب Google الموثق والمحاولة مجدداً.';
      }

      return (
        <div
          className="min-h-[100dvh] w-screen bg-slate-50 flex items-center justify-center p-4 font-['Cairo',system-ui,sans-serif]"
          dir="rtl"
        >
          <div className="w-full max-w-md bg-white border border-slate-200 rounded-xl shadow-lg p-6 text-right space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-red-50 border border-red-200 flex items-center justify-center shrink-0">
                <ShieldAlert className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <h1 className="font-bold text-sm text-slate-900">تنبيه نظام الحماية</h1>
                <p className="text-xs text-slate-500">خزانة مستمسكاتي السحابية</p>
              </div>
            </div>

            <p className="text-xs text-slate-700 leading-relaxed bg-slate-50 border border-slate-200 rounded-lg p-3">
              {friendlyMessage}
            </p>

            <button
              type="button"
              onClick={this.handleReload}
              className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              <span>إعادة تحميل التطبيق</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
