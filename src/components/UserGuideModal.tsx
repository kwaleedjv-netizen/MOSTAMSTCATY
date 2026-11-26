import React, { useState, useEffect } from 'react';
import { X, HelpCircle, FilePlus, Printer, Shield, Folder } from 'lucide-react';
import { useLayoutMode } from '../hooks/useViewportMode';

interface UserGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const UserGuideModal: React.FC<UserGuideModalProps> = ({ isOpen, onClose }) => {
  const [activeTopic, setActiveTopic] = useState<'basics' | 'print' | 'groups' | 'security'>('basics');
  const { isMobile } = useLayoutMode();

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const topics = [
    { id: 'basics' as const, label: 'إضافة وإدارة المستمسك', icon: FilePlus },
    { id: 'print' as const, label: 'استوديو الطباعة والأوراق', icon: Printer },
    { id: 'groups' as const, label: 'المجموعات والتنظيم', icon: Folder },
    { id: 'security' as const, label: 'الأمان والتشفير', icon: Shield },
  ];

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
            : 'w-full max-w-2xl bg-white border border-slate-200 rounded-lg shadow-2xl overflow-hidden flex flex-col h-[520px]'
        }
      >
        {/* Header */}
        <header className={`${isMobile ? 'min-h-[50px] pt-safe px-3' : 'h-12 px-4'} bg-white border-b border-slate-200 flex items-center justify-between gap-4 shrink-0`}>
          <div className="flex items-center gap-2.5">
            <HelpCircle className="w-4 h-4 text-blue-600" />
            <h2 className="font-bold text-sm text-slate-900">دليل استخدام مستمسكاتي</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className={`${isMobile ? 'min-w-[42px] min-h-[42px] rounded-xl flex items-center justify-center' : 'p-1.5 rounded'} text-slate-500 hover:text-slate-900 hover:bg-slate-100 cursor-pointer transition-colors`}
            aria-label="إغلاق"
          >
            <X className={isMobile ? 'w-5 h-5' : 'w-4 h-4'} />
          </button>
        </header>

        {/* Body */}
        <div className={`flex-1 flex min-h-0 overflow-hidden ${isMobile ? 'flex-col' : ''}`}>
          {/* Sidebar or Horizontal Chips on Mobile */}
          <aside
            className={
              isMobile
                ? 'bg-slate-50 border-b border-slate-200 px-3 py-2 flex items-center gap-1.5 overflow-x-auto no-scrollbar shrink-0'
                : 'w-52 bg-slate-50/70 border-l border-slate-200 p-2.5 space-y-0.5 shrink-0'
            }
          >
            {topics.map((topic) => {
              const Icon = topic.icon;
              const isActive = activeTopic === topic.id;
              return (
                <button
                  key={topic.id}
                  type="button"
                  onClick={() => setActiveTopic(topic.id)}
                  className={
                    isMobile
                      ? `min-h-[38px] px-3 rounded-xl text-xs whitespace-nowrap flex items-center gap-1.5 shrink-0 cursor-pointer ${
                          isActive
                            ? 'bg-blue-600 text-white font-bold'
                            : 'bg-white border border-slate-200 text-slate-700'
                        }`
                      : `w-full flex items-center gap-2 px-3 py-2 rounded-md text-xs text-right cursor-pointer transition-colors ${
                          isActive
                            ? 'bg-white text-slate-900 font-bold border border-slate-200 shadow-2xs'
                            : 'text-slate-700 hover:bg-slate-100'
                        }`
                  }
                >
                  <Icon
                    className={`w-3.5 h-3.5 shrink-0 ${
                      isMobile ? (isActive ? 'text-white' : 'text-blue-600') : isActive ? 'text-blue-600' : 'text-slate-500'
                    }`}
                  />
                  <span>{topic.label}</span>
                </button>
              );
            })}
          </aside>

          {/* Content */}
          <div className="flex-1 p-5 overflow-y-auto text-xs text-slate-700 leading-relaxed">
            {activeTopic === 'basics' && (
              <div className="space-y-3">
                <h3 className="font-bold text-sm text-slate-900 pb-2 border-b border-slate-200">
                  إضافة وإدارة المستمسكات
                </h3>
                <div className="divide-y divide-slate-100">
                  <p className="py-2.5">
                    <strong className="text-slate-900">إضافة مستمسك جديد: </strong>
                    انقر على زر «إضافة مستمسك» في الشريط العلوي أو اضغط{' '}
                    <kbd dir="ltr" className="bg-slate-50 px-1.5 py-0.5 rounded border border-slate-300 font-mono text-[11px]">
                      Ctrl+N
                    </kbd>
                    .
                  </p>
                  <p className="py-2.5">
                    <strong className="text-slate-900">تحديد القياس الحقيقي: </strong>
                    اختر القالب الرسمي المناسب (مثل البطاقة الوطنية{' '}
                    <span className="font-mono tabular-nums" dir="ltr">85.6 × 54 mm</span>) ليتم حفظ الصورة ومعالجتها وفق أبعادها الدقيقة.
                  </p>
                  <p className="py-2.5">
                    <strong className="text-slate-900">المستمسكات ذات الوجهين: </strong>
                    يمكنك إضافة الوجه الأمامي والخلفي والتبديل بينهما مباشرة من الشريط العلوي لنافذة الإضافة والتفاصيل.
                  </p>
                  <p className="py-2.5">
                    <strong className="text-slate-900">المعاينة والتعديل: </strong>
                    انقر نقراً مزدوجاً على أي مستمسك لفتح نافذة التفاصيل أو التعديل، أو استخدم الزر الأيمن للوصول السريع للأوامر.
                  </p>
                </div>
              </div>
            )}

            {activeTopic === 'print' && (
              <div className="space-y-3">
                <h3 className="font-bold text-sm text-slate-900 pb-2 border-b border-slate-200">
                  استوديو الطباعة والأوراق
                </h3>
                <div className="divide-y divide-slate-100">
                  <p className="py-2.5">
                    <strong className="text-slate-900">الطباعة بمقياس 1:1: </strong>
                    يضمن استوديو الطباعة إخراج الوثائق بأبعادها الرسمية تماماً دون أي تصغير أو تشويه تلقائي.
                  </p>
                  <p className="py-2.5">
                    <strong className="text-slate-900">ترتيب العناصر على الورقة: </strong>
                    يمكنك وضع أكثر من مستمسك على ورقة A4 أو قياس مخصص، وسحبها وتدويرها وضبط إحداثياتها بالمليمتر.
                  </p>
                  <p className="py-2.5">
                    <strong className="text-slate-900">الطباعة المزدوجة (Duplex): </strong>
                    محاذاة معكوسة تلقائياً للوجه الخلفي خلف الوجه الأمامي عند الطباعة على وجهي الورقة.
                  </p>
                </div>
              </div>
            )}

            {activeTopic === 'groups' && (
              <div className="space-y-3">
                <h3 className="font-bold text-sm text-slate-900 pb-2 border-b border-slate-200">
                  المجموعات والتنظيم
                </h3>
                <div className="divide-y divide-slate-100">
                  <p className="py-2.5">
                    <strong className="text-slate-900">إنشاء المجموعات: </strong>
                    صنّف المستمسكات إلى مجموعات عائلية أو شخصية أو وظيفية بألوان مميزة.
                  </p>
                  <p className="py-2.5">
                    <strong className="text-slate-900">النقل السريع: </strong>
                    انقل أي مستمسك بين المجموعات عبر القائمة السياقية بالزر الأيمن أو من شريط الخصائص في نافذة التفاصيل.
                  </p>
                  <p className="py-2.5">
                    <strong className="text-slate-900">سلة المحذوفات: </strong>
                    تتيح استعادة المستمسكات المحذوفة بالخطأ أو إفراغها نهائياً عند الحاجة.
                  </p>
                </div>
              </div>
            )}

            {activeTopic === 'security' && (
              <div className="space-y-3">
                <h3 className="font-bold text-sm text-slate-900 pb-2 border-b border-slate-200">
                  الأمان والتشفير المحلي
                </h3>
                <div className="divide-y divide-slate-100">
                  <p className="py-2.5">
                    <strong className="text-slate-900">حفظ البيانات محلياً: </strong>
                    تُخزّن جميع الصور والبيانات محلياً داخل متصفحك مع خيارات القفل التلقائي.
                  </p>
                  <p className="py-2.5">
                    <strong className="text-slate-900">كلمة المرور الرئيسية: </strong>
                    يمكنك تفعيل القفل الآلي بكلمة مرور رئيسية من «الإعدادات ← إعدادات الأمان».
                  </p>
                  <p className="py-2.5">
                    <strong className="text-slate-900">النسخ الاحتياطي المشفر: </strong>
                    احفظ نسخة احتياطية مشفرة بصيغة{' '}
                    <kbd dir="ltr" className="bg-slate-50 px-1.5 py-0.5 rounded border border-slate-300 font-mono text-[11px]">
                      .mostamsak
                    </kbd>{' '}
                    بشكل دوري لحماية مستمسكاتك.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <footer
          className={`px-4 border-t border-slate-200 flex justify-end items-center shrink-0 ${
            isMobile ? 'bg-white/95 backdrop-blur-md pb-safe h-[calc(60px+env(safe-area-inset-bottom,0px))]' : 'bg-white h-13'
          }`}
        >
          <button
            type="button"
            onClick={onClose}
            className={`px-5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs transition-colors cursor-pointer ${
              isMobile ? 'min-h-[44px] w-full rounded-xl' : 'py-1.5 rounded-md'
            }`}
          >
            إغلاق
          </button>
        </footer>
      </div>
    </div>
  );
};
