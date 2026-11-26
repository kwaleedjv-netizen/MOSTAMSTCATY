import React, { useState } from 'react';
import { Upload, Check, AlertCircle, X, Trash2 } from 'lucide-react';
import { DocumentGroup, MostamsakDocument } from '../types';
import { DOCUMENT_PRESETS } from '../constants/presets';
import { readFileAsDataUrl } from '../services/imageProcessing';
import { useLayoutMode } from '../hooks/useViewportMode';

interface ImportWorkspaceProps {
  groups: DocumentGroup[];
  existingDocuments: MostamsakDocument[];
  onImportDocuments: (docs: Omit<MostamsakDocument, 'id' | 'createdAt' | 'updatedAt'>[]) => Promise<void>;
  onDoneNavigateVault: () => void;
}

interface StagedFile {
  id: string;
  file: File;
  dataUrl: string;
  name: string;
  size: number;
  typeId: string;
  groupId: string;
  isDuplicate: boolean;
}

export const ImportWorkspace: React.FC<ImportWorkspaceProps> = ({
  groups,
  existingDocuments,
  onImportDocuments,
  onDoneNavigateVault,
}) => {
  const { isMobile } = useLayoutMode();
  const [stagedFiles, setStagedFiles] = useState<StagedFile[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [importedCount, setImportedCount] = useState<number | null>(null);

  const stageFileList = async (files: File[]) => {
    const newStaged: StagedFile[] = [];
    for (const file of files) {
      if (!file.type.startsWith('image/')) continue;
      const dataUrl = await readFileAsDataUrl(file);
      const cleanName = file.name.replace(/\.[^/.]+$/, '');
      const isDuplicate = existingDocuments.some(
        (d) => d.title.toLowerCase() === cleanName.toLowerCase()
      );
      newStaged.push({
        id: 'staged_' + Math.random().toString(36).substring(2, 7),
        file,
        dataUrl,
        name: cleanName,
        size: file.size,
        typeId: DOCUMENT_PRESETS[0].id,
        groupId: groups[0]?.id || '',
        isDuplicate,
      });
    }
    if (newStaged.length > 0) {
      setImportedCount(null);
      setStagedFiles((prev) => [...prev, ...newStaged]);
    }
  };

  const handleFileInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) await stageFileList(files);
    e.target.value = '';
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const files = Array.from(e.dataTransfer.files || []);
    if (files.length > 0) await stageFileList(files);
  };

  const handleUpdateItem = (id: string, partial: Partial<StagedFile>) => {
    setStagedFiles((prev) => prev.map((item) => (item.id === id ? { ...item, ...partial } : item)));
  };

  const handleRemoveItem = (id: string) => {
    setStagedFiles((prev) => prev.filter((item) => item.id !== id));
  };

  const handleExecuteImport = async () => {
    if (stagedFiles.length === 0) return;
    setIsProcessing(true);

    const docsToSave: Omit<MostamsakDocument, 'id' | 'createdAt' | 'updatedAt'>[] = stagedFiles.map(
      (item) => {
        const preset = DOCUMENT_PRESETS.find((p) => p.id === item.typeId) || DOCUMENT_PRESETS[0];
        return {
          title: item.name.trim() || preset.nameAr,
          typeId: preset.id,
          typeName: preset.nameAr,
          isCustom: false,
          widthMm: preset.widthMm,
          heightMm: preset.heightMm,
          orientation: preset.defaultOrientation,
          sidesCount: 1,
          frontLabel: preset.frontLabel,
          backLabel: preset.backLabel,
          radiusMm: preset.defaultRadiusMm,
          frontImage: item.dataUrl,
          originalFrontImage: item.dataUrl,
          frontTransform: { zoom: 1, panX: 0, panY: 0, rotation: 0, flipH: false, flipV: false },
          backTransform: { zoom: 1, panX: 0, panY: 0, rotation: 0, flipH: false, flipV: false },
          notes: `تم الاستيراد من الملف: ${item.file.name}`,
          groupId: item.groupId || undefined,
          isFavorite: false,
          isArchived: false,
          isDeleted: false,
          isEncrypted: false,
          coverFace: 'front',
        };
      }
    );

    const count = docsToSave.length;
    await onImportDocuments(docsToSave);
    setIsProcessing(false);
    setStagedFiles([]);
    setImportedCount(count);
  };

  if (isMobile) {
    return (
      <div className="flex-1 min-h-0 flex flex-col bg-slate-50 overflow-hidden select-none">
        {/* Top Compact Upload Action Area */}
        <div className="p-3 bg-white border-b border-slate-200 space-y-2.5 shrink-0">
          <label className="w-full min-h-[54px] border-2 border-dashed border-blue-300 bg-blue-50/40 active:bg-blue-50 rounded-xl px-4 py-3 flex items-center justify-between gap-3 cursor-pointer">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-lg bg-blue-600 text-white flex items-center justify-center shrink-0">
                <Upload className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <div className="font-bold text-xs text-slate-900">اختر صور المستمسكات</div>
                <div className="text-[11px] text-slate-500">يمكنك تحديد عدة صور دفعة واحدة</div>
              </div>
            </div>
            <span className="font-mono text-xs font-bold bg-white border border-slate-200 text-slate-700 px-2.5 py-1 rounded-lg shrink-0">
              {stagedFiles.length}
            </span>
            <input
              type="file"
              multiple
              accept="image/*"
              onChange={handleFileInput}
              className="hidden"
            />
          </label>

          {importedCount !== null && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 font-bold">
                <Check className="w-4 h-4 shrink-0" />
                <span>تم حفظ {importedCount} مستمسك بنجاح.</span>
              </div>
              <button
                type="button"
                onClick={onDoneNavigateVault}
                className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-[11px] font-bold cursor-pointer"
              >
                عرض بالخزانة
              </button>
            </div>
          )}
        </div>

        {/* Staged Cards List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
          {stagedFiles.length === 0 ? (
            <div className="py-16 text-center text-xs text-slate-400 px-4 leading-relaxed">
              لم يتم اختيار أي صور بعد. اضغط على الزر أعلاه لاختيار صور الهويات والوثائق وتحديد نوعها ومجموعتها.
            </div>
          ) : (
            stagedFiles.map((item) => (
              <div key={item.id} className="bg-white border border-slate-200 rounded-xl p-3 space-y-2.5 shadow-2xs">
                <div className="flex items-start gap-3">
                  <div className="w-16 h-12 rounded-lg bg-slate-100 border border-slate-200 overflow-hidden shrink-0 flex items-center justify-center p-0.5">
                    <img src={item.dataUrl} alt="" className="max-w-full max-h-full object-contain" />
                  </div>
                  <div className="flex-1 min-w-0 space-y-1">
                    <input
                      type="text"
                      value={item.name}
                      onChange={(e) => handleUpdateItem(item.id, { name: e.target.value })}
                      className="w-full min-h-[40px] bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-900 focus:bg-white focus:border-blue-600 focus:outline-none"
                    />
                    <div className="flex items-center justify-between text-[11px] text-slate-500">
                      <span className="font-mono tabular-nums" dir="ltr">
                        {Math.round(item.size / 1024)} KB
                      </span>
                      {item.isDuplicate && (
                        <span className="text-amber-700 inline-flex items-center gap-1 font-medium">
                          <AlertCircle className="w-3 h-3" />
                          <span>اسم مكرر</span>
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemoveItem(item.id)}
                    className="min-w-[40px] min-h-[40px] flex items-center justify-center text-slate-400 active:text-red-600 rounded-lg cursor-pointer"
                    aria-label="إزالة"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={item.typeId}
                    onChange={(e) => handleUpdateItem(item.id, { typeId: e.target.value })}
                    className="w-full min-h-[40px] bg-slate-50 border border-slate-300 rounded-lg px-2.5 text-xs text-slate-800 focus:border-blue-600 focus:outline-none"
                  >
                    {DOCUMENT_PRESETS.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.nameAr}
                      </option>
                    ))}
                  </select>

                  <select
                    value={item.groupId}
                    onChange={(e) => handleUpdateItem(item.id, { groupId: e.target.value })}
                    className="w-full min-h-[40px] bg-slate-50 border border-slate-300 rounded-lg px-2.5 text-xs text-slate-800 focus:border-blue-600 focus:outline-none"
                  >
                    <option value="">بدون مجموعة</option>
                    {groups.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Sticky Footer Action Bar */}
        <div className="px-3 py-2.5 pb-[calc(0.625rem+env(safe-area-inset-bottom,0px))] bg-white border-t border-slate-200 flex items-center gap-2 shrink-0">
          {stagedFiles.length > 0 && (
            <button
              type="button"
              onClick={() => setStagedFiles([])}
              className="min-h-[44px] px-3.5 bg-red-50 active:bg-red-100 text-red-600 border border-red-200 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer"
            >
              <Trash2 className="w-4 h-4" />
              <span>مسح</span>
            </button>
          )}
          <button
            type="button"
            onClick={handleExecuteImport}
            disabled={isProcessing || stagedFiles.length === 0}
            className="flex-1 min-h-[44px] px-4 bg-blue-600 active:bg-blue-700 disabled:opacity-45 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Check className="w-4 h-4" />
            <span>{isProcessing ? 'جاري الاستيراد...' : `حفظ الكل (${stagedFiles.length}) في الخزانة`}</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 min-h-0 flex flex-col lg:flex-row bg-white overflow-hidden select-none">
      {/* Right Rail (RTL Start): Drop Zone & Instructions */}
      <aside className="w-full lg:w-80 bg-slate-50/70 border-b lg:border-b-0 lg:border-l border-slate-200 p-5 flex flex-col justify-between gap-5 shrink-0">
        <div className="space-y-4">
          <div>
            <h1 className="text-sm font-bold text-slate-900">استيراد دفعة مستمسكات</h1>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
              اسحب صور الهويات والوثائق هنا أو اخترها من جهازك، ثم عيّن نوع القياس والمجموعة لكل ملف قبل الحفظ في الخزانة.
            </p>
          </div>

          <label
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragOver(true);
            }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-lg p-7 flex flex-col items-center justify-center text-center cursor-pointer transition-colors bg-white ${
              isDragOver ? 'border-blue-600 bg-blue-50/40' : 'border-slate-300 hover:border-blue-500'
            }`}
          >
            <Upload className="w-6 h-6 text-slate-400 mb-2.5" />
            <span className="font-bold text-xs text-slate-800 mb-1">اختر صوراً أو اسحبها هنا</span>
            <span className="text-[11px] font-mono text-slate-400">PNG · JPG · WEBP</span>
            <input
              type="file"
              multiple
              accept="image/*"
              onChange={handleFileInput}
              className="hidden"
            />
          </label>

          {importedCount !== null && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-md text-xs text-emerald-800 space-y-2">
              <div className="flex items-center gap-2 font-bold">
                <Check className="w-4 h-4 shrink-0" />
                <span>تم حفظ {importedCount} مستمسك في الخزانة بنجاح.</span>
              </div>
              <button
                type="button"
                onClick={onDoneNavigateVault}
                className="text-xs font-bold text-emerald-900 underline cursor-pointer"
              >
                الانتقال إلى الاستوديو
              </button>
            </div>
          )}
        </div>

        <div className="pt-4 border-t border-slate-200 flex items-center justify-between text-xs text-slate-600">
          <span>الملفات الجاهزة</span>
          <span className="font-mono tabular-nums font-bold text-slate-900">{stagedFiles.length}</span>
        </div>
      </aside>

      {/* Center Stage: Staged Files Table */}
      <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
        <div className="h-12 px-5 bg-white border-b border-slate-200 flex items-center justify-between gap-4 shrink-0">
          <span className="text-xs font-bold text-slate-800">قائمة الملفات المجهزة للاستيراد</span>

          <div className="flex items-center gap-2">
            {stagedFiles.length > 0 && (
              <button
                type="button"
                onClick={() => setStagedFiles([])}
                className="px-3 py-1.5 bg-white hover:bg-red-50 text-red-600 border border-red-200 rounded-md text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>مسح القائمة</span>
              </button>
            )}
            <button
              type="button"
              onClick={handleExecuteImport}
              disabled={isProcessing || stagedFiles.length === 0}
              className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-45 text-white rounded-md text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors"
            >
              <Check className="w-3.5 h-3.5" />
              <span>{isProcessing ? 'جاري الاستيراد...' : 'حفظ الكل في الخزانة'}</span>
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto studio-stage-grid p-5">
          {stagedFiles.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center text-slate-400">
              <p className="text-xs font-medium text-slate-500">
                لم يتم اختيار أي صور بعد. اسحب صوراً إلى المنطقة الجانبية للبدء.
              </p>
            </div>
          ) : (
            <div className="bg-white border border-slate-200 rounded-lg overflow-hidden divide-y divide-slate-200">
              {stagedFiles.map((item) => (
                <div key={item.id} className="p-3.5 flex flex-wrap sm:flex-nowrap items-center justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="w-16 h-11 rounded bg-slate-100 border border-slate-200 overflow-hidden shrink-0 flex items-center justify-center p-0.5">
                      <img src={item.dataUrl} alt="" className="max-w-full max-h-full object-contain" />
                    </div>

                    <div className="min-w-0 flex-1 space-y-1">
                      <input
                        type="text"
                        value={item.name}
                        onChange={(e) => handleUpdateItem(item.id, { name: e.target.value })}
                        className="w-full bg-white border border-slate-300 rounded-md px-2.5 py-1.5 text-xs font-semibold text-slate-900 focus:border-blue-600 focus:outline-none"
                      />
                      <div className="flex items-center gap-2 text-[11px] text-slate-500">
                        <span className="font-mono tabular-nums" dir="ltr">
                          {Math.round(item.size / 1024)} KB
                        </span>
                        {item.isDuplicate && (
                          <span className="text-amber-700 inline-flex items-center gap-1 font-medium">
                            <AlertCircle className="w-3 h-3" />
                            <span>يوجد مستمسك بنفس الاسم مسبقاً</span>
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <select
                      value={item.typeId}
                      onChange={(e) => handleUpdateItem(item.id, { typeId: e.target.value })}
                      className="bg-white border border-slate-300 rounded-md px-2.5 py-1.5 text-xs text-slate-800 focus:border-blue-600 focus:outline-none cursor-pointer"
                    >
                      {DOCUMENT_PRESETS.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.nameAr}
                        </option>
                      ))}
                    </select>

                    <select
                      value={item.groupId}
                      onChange={(e) => handleUpdateItem(item.id, { groupId: e.target.value })}
                      className="bg-white border border-slate-300 rounded-md px-2.5 py-1.5 text-xs text-slate-800 focus:border-blue-600 focus:outline-none cursor-pointer"
                    >
                      <option value="">بدون مجموعة</option>
                      {groups.map((g) => (
                        <option key={g.id} value={g.id}>
                          {g.name}
                        </option>
                      ))}
                    </select>

                    <button
                      type="button"
                      onClick={() => handleRemoveItem(item.id)}
                      className="p-1.5 text-slate-400 hover:text-red-600 rounded cursor-pointer"
                      aria-label="إزالة"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
