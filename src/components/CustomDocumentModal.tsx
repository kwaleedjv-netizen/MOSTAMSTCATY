import React, { useState, useEffect } from 'react';
import { X, Check, Ruler } from 'lucide-react';
import { UnitType, DocumentOrientation, CustomTemplate } from '../types';
import { convertToMm, convertFromMm } from '../constants/presets';
import { useLayoutMode } from '../hooks/useViewportMode';

interface CustomDocumentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (template: CustomTemplate) => void;
  initialTemplate?: Partial<CustomTemplate>;
}

export const CustomDocumentModal: React.FC<CustomDocumentModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  initialTemplate,
}) => {
  const { isMobile } = useLayoutMode();
  const [name, setName] = useState(initialTemplate?.name || 'مستمسك مخصص جديد');
  const [category, setCategory] = useState(initialTemplate?.category || 'عام');
  const [unit, setUnit] = useState<UnitType>(initialTemplate?.unit || 'mm');
  const [widthInput, setWidthInput] = useState<number>(
    initialTemplate?.widthMm ? convertFromMm(initialTemplate.widthMm, initialTemplate.unit || 'mm') : 85.6
  );
  const [heightInput, setHeightInput] = useState<number>(
    initialTemplate?.heightMm ? convertFromMm(initialTemplate.heightMm, initialTemplate.unit || 'mm') : 54
  );
  const [dpi, setDpi] = useState<number>(300);
  const [orientation, setOrientation] = useState<DocumentOrientation>(initialTemplate?.orientation || 'landscape');
  const [sidesCount, setSidesCount] = useState<1 | 2>(initialTemplate?.sidesCount || 2);
  const [frontLabel, setFrontLabel] = useState(initialTemplate?.frontLabel || 'الوجه الأول');
  const [backLabel, setBackLabel] = useState(initialTemplate?.backLabel || 'الوجه الثاني');
  const [radiusMm, setRadiusMm] = useState<number>(initialTemplate?.radiusMm ?? 3);
  const [previewBgColor, setPreviewBgColor] = useState(initialTemplate?.previewBgColor || '#2563eb');
  const [notes, setNotes] = useState(initialTemplate?.notes || '');

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const calculatedWidthMm = Math.max(5, Number(convertToMm(widthInput || 10, unit, dpi).toFixed(2)));
  const calculatedHeightMm = Math.max(5, Number(convertToMm(heightInput || 10, unit, dpi).toFixed(2)));

  const handleUnitChange = (newUnit: UnitType) => {
    const currentMmW = convertToMm(widthInput, unit, dpi);
    const currentMmH = convertToMm(heightInput, unit, dpi);
    setUnit(newUnit);
    setWidthInput(convertFromMm(currentMmW, newUnit, dpi));
    setHeightInput(convertFromMm(currentMmH, newUnit, dpi));
  };

  const handleOrientationChange = (nextOri: DocumentOrientation) => {
    setOrientation(nextOri);
    if (
      (nextOri === 'portrait' && widthInput > heightInput) ||
      (nextOri === 'landscape' && heightInput > widthInput)
    ) {
      setWidthInput(heightInput);
      setHeightInput(widthInput);
    }
  };

  const handleSave = () => {
    if (!name.trim()) return;

    const template: CustomTemplate = {
      id: 'custom_tmpl_' + Date.now(),
      name: name.trim(),
      category: category.trim(),
      widthMm: calculatedWidthMm,
      heightMm: calculatedHeightMm,
      unit,
      orientation,
      sidesCount,
      frontLabel: frontLabel.trim() || 'الوجه الأول',
      backLabel: backLabel.trim() || 'الوجه الثاني',
      radiusMm,
      previewBgColor,
      notes: notes.slice(0, 500),
      createdAt: new Date().toISOString(),
    };

    onConfirm(template);
    onClose();
  };

  // Proportional frame size inside the preview stage
  const ratio = calculatedWidthMm / Math.max(1, calculatedHeightMm);
  const maxStageW = 240;
  const maxStageH = 190;
  let frameW = maxStageW;
  let frameH = frameW / ratio;
  if (frameH > maxStageH) {
    frameH = maxStageH;
    frameW = frameH * ratio;
  }
  const radiusPx = Math.round((radiusMm / Math.max(1, calculatedWidthMm)) * frameW);

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
            : 'max-w-3xl border border-slate-200 rounded-lg shadow-2xl max-h-[90vh]'
        }`}
      >
        {/* Header */}
        <header
          className={`px-4 bg-white border-b border-slate-200 flex items-center justify-between gap-4 shrink-0 ${
            isMobile ? 'min-h-[50px] pt-safe' : 'h-12'
          }`}
        >
          <div className="flex items-center gap-2.5">
            <Ruler className="w-4 h-4 text-blue-600" />
            <h2 className="font-bold text-sm text-slate-900">إنشاء قالب مستمسك مخصص</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className={`text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded cursor-pointer transition-colors flex items-center justify-center ${
              isMobile ? 'min-w-[44px] min-h-[44px]' : 'p-1.5'
            }`}
            aria-label="إغلاق"
          >
            <X className={isMobile ? 'w-5 h-5' : 'w-4 h-4'} />
          </button>
        </header>

        {/* Body */}
        <div
          className={`flex-1 flex min-h-0 ${
            isMobile ? 'flex-col overflow-y-auto' : 'flex-col md:flex-row overflow-hidden'
          }`}
        >
          {/* Form Column */}
          <div className={`p-4 space-y-4 text-xs ${isMobile ? '' : 'flex-1 overflow-y-auto'}`}>
            {/* Name & Category */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">اسم القالب</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="مثال: بطاقة نقابة المهندسين..."
                  className="w-full bg-white border border-slate-300 rounded-md px-2.5 py-1.5 text-slate-900 focus:border-blue-600 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">التصنيف</label>
                <input
                  type="text"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  placeholder="مثال: نقابي، وظيفي، تأمين..."
                  className="w-full bg-white border border-slate-300 rounded-md px-2.5 py-1.5 text-slate-900 focus:border-blue-600 focus:outline-none"
                />
              </div>
            </div>

            {/* Physical Dimensions */}
            <div className="border-t border-slate-200 pt-3.5 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-bold text-slate-700">القياسات الفيزيائية الحقيقية</span>

                <div className="flex items-center gap-0.5 p-0.5 bg-slate-100 rounded-md border border-slate-200">
                  {(['mm', 'cm', 'inch', 'px'] as UnitType[]).map((u) => (
                    <button
                      key={u}
                      type="button"
                      onClick={() => handleUnitChange(u)}
                      className={`px-2 py-0.5 rounded text-[11px] font-mono cursor-pointer transition-colors ${
                        unit === u
                          ? 'bg-white text-slate-900 font-bold shadow-2xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {u}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] text-slate-600 mb-1">العرض ({unit})</label>
                  <input
                    type="number"
                    step="0.1"
                    min="1"
                    value={widthInput}
                    onChange={(e) => setWidthInput(parseFloat(e.target.value) || 0)}
                    className="w-full bg-white border border-slate-300 rounded-md px-2.5 py-1.5 text-slate-900 focus:border-blue-600 focus:outline-none font-mono tabular-nums"
                    dir="ltr"
                  />
                </div>

                <div>
                  <label className="block text-[11px] text-slate-600 mb-1">الارتفاع ({unit})</label>
                  <input
                    type="number"
                    step="0.1"
                    min="1"
                    value={heightInput}
                    onChange={(e) => setHeightInput(parseFloat(e.target.value) || 0)}
                    className="w-full bg-white border border-slate-300 rounded-md px-2.5 py-1.5 text-slate-900 focus:border-blue-600 focus:outline-none font-mono tabular-nums"
                    dir="ltr"
                  />
                </div>

                {unit === 'px' && (
                  <div>
                    <label className="block text-[11px] text-slate-600 mb-1">دقة الطباعة (DPI)</label>
                    <select
                      value={dpi}
                      onChange={(e) => setDpi(Number(e.target.value))}
                      className="w-full bg-white border border-slate-300 rounded-md px-2.5 py-1.5 text-slate-900 focus:border-blue-600 focus:outline-none font-mono tabular-nums"
                    >
                      <option value={96}>96 DPI</option>
                      <option value={150}>150 DPI</option>
                      <option value={300}>300 DPI</option>
                      <option value={600}>600 DPI</option>
                    </select>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between text-[11px] text-slate-600 bg-slate-50 px-3 py-1.5 rounded-md border border-slate-200">
                <span>المقاس الفعلي للطباعة:</span>
                <span className="font-mono tabular-nums font-bold text-blue-700" dir="ltr">
                  {calculatedWidthMm} × {calculatedHeightMm} mm
                </span>
              </div>
            </div>

            {/* Orientation & Sides */}
            <div className="border-t border-slate-200 pt-3.5 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1.5">الاتجاه</label>
                <div className="flex items-center gap-0.5 p-0.5 bg-slate-100 rounded-md border border-slate-200">
                  <button
                    type="button"
                    onClick={() => handleOrientationChange('landscape')}
                    className={`flex-1 py-1.5 rounded text-xs font-semibold cursor-pointer transition-colors ${
                      orientation === 'landscape'
                        ? 'bg-white text-slate-900 shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    أفقي
                  </button>
                  <button
                    type="button"
                    onClick={() => handleOrientationChange('portrait')}
                    className={`flex-1 py-1.5 rounded text-xs font-semibold cursor-pointer transition-colors ${
                      orientation === 'portrait'
                        ? 'bg-white text-slate-900 shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    عمودي
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1.5">عدد الأوجه</label>
                <div className="flex items-center gap-0.5 p-0.5 bg-slate-100 rounded-md border border-slate-200">
                  <button
                    type="button"
                    onClick={() => setSidesCount(1)}
                    className={`flex-1 py-1.5 rounded text-xs font-semibold cursor-pointer transition-colors ${
                      sidesCount === 1
                        ? 'bg-white text-slate-900 shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    وجه واحد
                  </button>
                  <button
                    type="button"
                    onClick={() => setSidesCount(2)}
                    className={`flex-1 py-1.5 rounded text-xs font-semibold cursor-pointer transition-colors ${
                      sidesCount === 2
                        ? 'bg-white text-slate-900 shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    وجهان
                  </button>
                </div>
              </div>
            </div>

            {/* Face Labels */}
            {sidesCount === 2 && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] text-slate-600 mb-1">تسمية الوجه الأمامي</label>
                  <input
                    type="text"
                    value={frontLabel}
                    onChange={(e) => setFrontLabel(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-md px-2.5 py-1.5 text-slate-900 focus:border-blue-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-600 mb-1">تسمية الوجه الخلفي</label>
                  <input
                    type="text"
                    value={backLabel}
                    onChange={(e) => setBackLabel(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-md px-2.5 py-1.5 text-slate-900 focus:border-blue-600 focus:outline-none"
                  />
                </div>
              </div>
            )}

            {/* Radius & Color */}
            <div className="border-t border-slate-200 pt-3.5 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] font-bold text-slate-700">استدارة الحواف</label>
                  <span className="font-mono tabular-nums text-[11px] text-slate-500" dir="ltr">
                    {radiusMm} mm
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="15"
                  step="0.5"
                  value={radiusMm}
                  onChange={(e) => setRadiusMm(parseFloat(e.target.value))}
                  className="w-full accent-blue-600 cursor-pointer"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">لون المعاينة</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={previewBgColor}
                    onChange={(e) => setPreviewBgColor(e.target.value)}
                    className="w-8 h-8 rounded border border-slate-300 bg-white p-0.5 cursor-pointer"
                  />
                  <span className="font-mono text-xs text-slate-600" dir="ltr">
                    {previewBgColor}
                  </span>
                </div>
              </div>
            </div>

            {/* Notes */}
            <div className="border-t border-slate-200 pt-3.5">
              <label className="block text-[11px] font-bold text-slate-700 mb-1">ملاحظات افتراضية</label>
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="ملاحظات اختيارية تُضاف عند استخدام هذا القالب..."
                className="w-full bg-white border border-slate-300 rounded-md px-2.5 py-1.5 text-xs text-slate-900 focus:border-blue-600 focus:outline-none resize-none"
              />
            </div>
          </div>

          {/* Live Proportional Stage */}
          <aside className="w-full md:w-72 bg-slate-50/70 border-t md:border-t-0 md:border-r border-slate-200 p-4 flex flex-col justify-between shrink-0">
            <div>
              <div className="text-[11px] font-bold text-slate-700 mb-2">معاينة النسبة الفيزيائية</div>
              <div className="h-56 studio-stage-grid border border-slate-200 rounded-md flex items-center justify-center p-4">
                <div
                  className="border border-slate-900/15 shadow-md flex flex-col items-center justify-center text-center p-3 transition-all"
                  style={{
                    width: `${Math.round(frameW)}px`,
                    height: `${Math.round(frameH)}px`,
                    borderRadius: `${radiusPx}px`,
                    backgroundColor: previewBgColor,
                  }}
                >
                  <div className="text-xs font-bold text-white truncate max-w-full">
                    {name || 'مستمسك مخصص'}
                  </div>
                  <div className="font-mono tabular-nums text-[10px] text-white/90 mt-1" dir="ltr">
                    {calculatedWidthMm} × {calculatedHeightMm} mm
                  </div>
                </div>
              </div>
            </div>

            <dl className="mt-4 pt-3 border-t border-slate-200 space-y-1.5 text-[11px]">
              <div className="flex items-center justify-between">
                <dt className="text-slate-500">الأبعاد بالملم</dt>
                <dd className="font-mono tabular-nums font-semibold text-slate-800" dir="ltr">
                  {calculatedWidthMm} × {calculatedHeightMm} mm
                </dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-slate-500">الأوجه</dt>
                <dd className="font-semibold text-slate-800">
                  {sidesCount === 2 ? 'وجهان' : 'وجه واحد'}
                </dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-slate-500">استدارة الحواف</dt>
                <dd className="font-mono tabular-nums font-semibold text-slate-800" dir="ltr">
                  {radiusMm} mm
                </dd>
              </div>
            </dl>
          </aside>
        </div>

        {/* Footer */}
        <footer
          className={`px-4 border-t border-slate-200 flex items-center justify-between gap-3 shrink-0 ${
            isMobile ? 'bg-white/95 backdrop-blur-md pb-safe h-[calc(60px+env(safe-area-inset-bottom,0px))]' : 'bg-white h-13 gap-4'
          }`}
        >
          <button
            type="button"
            onClick={onClose}
            className={`px-4 bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 text-xs font-semibold cursor-pointer transition-colors ${
              isMobile ? 'min-h-[44px] rounded-xl' : 'py-1.5 rounded-md'
            }`}
          >
            إلغاء
          </button>

          <button
            type="button"
            onClick={handleSave}
            disabled={!name.trim()}
            className={`px-5 bg-blue-600 hover:bg-blue-700 disabled:opacity-45 disabled:cursor-not-allowed text-white text-xs font-bold transition-colors cursor-pointer flex items-center justify-center gap-1.5 ${
              isMobile ? 'min-h-[44px] flex-1 rounded-xl' : 'py-1.5 rounded-md'
            }`}
          >
            <Check className="w-3.5 h-3.5" />
            <span>حفظ القالب واستخدامه</span>
          </button>
        </footer>
      </div>
    </div>
  );
};
