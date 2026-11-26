import React, { useState, useEffect } from 'react';
import {
  X,
  Printer,
  Download,
  Edit3,
  Copy,
  Trash2,
  Star,
  Check,
  FlipHorizontal,
  Shield,
  ZoomIn,
  ZoomOut,
  RotateCcw,
} from 'lucide-react';
import { MostamsakDocument, DocumentGroup } from '../types';
import { useLayoutMode } from '../hooks/useViewportMode';

interface DocumentDetailsModalProps {
  document: MostamsakDocument;
  groups: DocumentGroup[];
  isOpen: boolean;
  onClose: () => void;
  onUpdate: (doc: MostamsakDocument) => Promise<void>;
  onDuplicate: (doc: MostamsakDocument) => Promise<void>;
  onPrint: (doc: MostamsakDocument) => void;
  onExport: (doc: MostamsakDocument) => void;
  onTrash: (doc: MostamsakDocument) => Promise<void>;
  onOpenEditor: (doc: MostamsakDocument) => void;
}

export const DocumentDetailsModal: React.FC<DocumentDetailsModalProps> = ({
  document: doc,
  groups,
  isOpen,
  onClose,
  onUpdate,
  onDuplicate,
  onPrint,
  onTrash,
  onOpenEditor,
}) => {
  const [faceMode, setFaceMode] = useState<'front' | 'back' | 'both'>('front');
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(doc.title);
  const [notesDraft, setNotesDraft] = useState(doc.notes || '');
  const [savedNotice, setSavedNotice] = useState(false);
  const [mobileZoom, setMobileZoom] = useState(1);
  const pinchRef = React.useRef<{ startDist: number; startZoom: number } | null>(null);
  const { isMobile } = useLayoutMode();

  useEffect(() => {
    setTitleDraft(doc.title);
    setNotesDraft(doc.notes || '');
    setIsEditingTitle(false);
    setMobileZoom(1);
    setFaceMode(doc.sidesCount === 2 && doc.backImage ? 'both' : 'front');
  }, [doc]);

  const handleTouchStartZoom = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      pinchRef.current = { startDist: Math.hypot(dx, dy), startZoom: mobileZoom };
    }
  };

  const handleTouchMoveZoom = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && pinchRef.current && pinchRef.current.startDist > 0) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.hypot(dx, dy);
      const next = Math.min(3.5, Math.max(1, Number((pinchRef.current.startZoom * (dist / pinchRef.current.startDist)).toFixed(2))));
      setMobileZoom(next);
    }
  };

  const handleTouchEndZoom = () => {
    pinchRef.current = null;
  };

  if (!isOpen) return null;

  const hasBack = doc.sidesCount === 2 && Boolean(doc.backImage);

  const handleSaveTitle = async () => {
    const trimmed = titleDraft.trim();
    if (!trimmed || trimmed === doc.title) {
      setTitleDraft(doc.title);
      setIsEditingTitle(false);
      return;
    }
    await onUpdate({ ...doc, title: trimmed });
    setIsEditingTitle(false);
  };

  const handleSaveNotes = async () => {
    if (notesDraft === (doc.notes || '')) return;
    await onUpdate({ ...doc, notes: notesDraft.slice(0, 500) });
    setSavedNotice(true);
    setTimeout(() => setSavedNotice(false), 1800);
  };

  const handleDownloadPng = () => {
    const src =
      faceMode === 'back' && doc.backImage
        ? doc.backImage
        : doc.coverFace === 'back' && doc.backImage && faceMode !== 'front'
        ? doc.backImage
        : doc.frontImage;

    const triggerDownload = (href: string, filename: string) => {
      const link = window.document.createElement('a');
      link.download = filename;
      link.href = href;
      window.document.body.appendChild(link);
      link.click();
      window.document.body.removeChild(link);
    };

    if (src.startsWith('data:image/svg+xml')) {
      const img = new Image();
      img.onload = () => {
        const canvas = window.document.createElement('canvas');
        canvas.width = img.naturalWidth || 856;
        canvas.height = img.naturalHeight || 540;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          triggerDownload(canvas.toDataURL('image/png'), `${doc.title}.png`);
        } else {
          triggerDownload(src, `${doc.title}.svg`);
        }
      };
      img.onerror = () => triggerDownload(src, `${doc.title}.svg`);
      img.src = src;
    } else {
      triggerDownload(src, `${doc.title}.png`);
    }
  };

  const formatDate = (iso?: string) => {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('ar-IQ', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  if (isMobile) {
    return (
      <div
        className="fixed inset-0 z-50 bg-white flex flex-col h-[100dvh] w-screen select-none"
        style={{ touchAction: 'pan-x pan-y pinch-zoom' }}
        dir="rtl"
      >
        {/* Mobile Header */}
        <header className="min-h-[50px] pt-safe px-3 bg-white border-b border-slate-200 flex items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-1.5 min-w-0 flex-1">
            {isEditingTitle ? (
              <div className="flex items-center gap-1.5 flex-1">
                <input
                  type="text"
                  value={titleDraft}
                  onChange={(e) => setTitleDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSaveTitle();
                    if (e.key === 'Escape') {
                      setTitleDraft(doc.title);
                      setIsEditingTitle(false);
                    }
                  }}
                  className="flex-1 min-h-[38px] bg-white border border-blue-600 rounded-xl px-2.5 text-xs font-bold text-slate-900 focus:outline-none"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={handleSaveTitle}
                  className="min-w-[38px] min-h-[38px] bg-blue-600 text-white rounded-xl flex items-center justify-center cursor-pointer"
                >
                  <Check className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <>
                <h2 className="font-bold text-sm text-slate-900 truncate">{doc.title}</h2>
                <button
                  type="button"
                  onClick={() => setIsEditingTitle(true)}
                  aria-label="تعديل الاسم"
                  className="min-w-[38px] min-h-[38px] text-slate-500 active:bg-slate-100 rounded-xl flex items-center justify-center cursor-pointer shrink-0"
                >
                  <Edit3 className="w-4 h-4" />
                </button>
              </>
            )}
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={() => onUpdate({ ...doc, isFavorite: !doc.isFavorite })}
              aria-label="المفضلة"
              className={`min-w-[40px] min-h-[40px] rounded-xl flex items-center justify-center cursor-pointer ${
                doc.isFavorite ? 'bg-amber-50 text-amber-500' : 'text-slate-400 active:bg-slate-100'
              }`}
            >
              <Star className={`w-4 h-4 ${doc.isFavorite ? 'fill-amber-400' : ''}`} />
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="إغلاق"
              className="min-w-[40px] min-h-[40px] text-slate-600 active:bg-slate-100 rounded-xl flex items-center justify-center cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </header>

        {/* Scrollable Content */}
        <div className="flex-1 min-h-0 overflow-y-auto bg-slate-50" style={{ touchAction: 'pan-x pan-y pinch-zoom' }}>
          {/* Preview Stage */}
          <div className="studio-stage-grid p-4 flex flex-col items-center gap-3 border-b border-slate-200">
            <div className="w-full max-w-md flex items-center justify-between gap-2">
              {hasBack ? (
                <div className="flex items-center bg-white p-0.5 rounded-xl border border-slate-200 shadow-2xs">
                  {[
                    { id: 'front' as const, label: 'الأمامي' },
                    { id: 'back' as const, label: 'الخلفي' },
                    { id: 'both' as const, label: 'كلا الوجهين' },
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setFaceMode(tab.id)}
                      className={`min-h-[34px] px-2.5 rounded-lg text-xs font-bold cursor-pointer ${
                        faceMode === tab.id ? 'bg-slate-900 text-white' : 'text-slate-600'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              ) : (
                <div />
              )}

              <div className="flex items-center bg-white p-0.5 rounded-xl border border-slate-200 shadow-2xs">
                <button
                  type="button"
                  onClick={() => setMobileZoom((z) => Math.max(1, Number((z - 0.5).toFixed(2))))}
                  aria-label="تصغير"
                  className="min-w-[34px] min-h-[34px] rounded-lg flex items-center justify-center text-slate-700 active:bg-slate-100 cursor-pointer"
                >
                  <ZoomOut className="w-4 h-4" />
                </button>
                <span className="px-1.5 text-[11px] font-mono tabular-nums text-slate-700">
                  {Math.round(mobileZoom * 100)}%
                </span>
                <button
                  type="button"
                  onClick={() => setMobileZoom((z) => Math.min(3.5, Number((z + 0.5).toFixed(2))))}
                  aria-label="تكبير"
                  className="min-w-[34px] min-h-[34px] rounded-lg flex items-center justify-center text-slate-700 active:bg-slate-100 cursor-pointer"
                >
                  <ZoomIn className="w-4 h-4" />
                </button>
                {mobileZoom > 1 && (
                  <button
                    type="button"
                    onClick={() => setMobileZoom(1)}
                    aria-label="إعادة ضبط التكبير"
                    className="min-w-[34px] min-h-[34px] rounded-lg flex items-center justify-center text-blue-600 active:bg-blue-50 cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {faceMode === 'both' && hasBack && doc.backImage ? (
              <div
                className="grid grid-cols-1 gap-3 w-full max-w-md rounded-2xl"
                onTouchStart={handleTouchStartZoom}
                onTouchMove={handleTouchMoveZoom}
                onTouchEnd={handleTouchEndZoom}
                onDoubleClick={() => setMobileZoom((z) => (z > 1 ? 1 : 2))}
              >
                <div
                  className={`bg-white border border-slate-300 rounded-2xl p-2 shadow-sm overflow-auto ${
                    mobileZoom > 1 ? 'block max-h-80' : 'flex items-center justify-center'
                  }`}
                >
                  <img
                    src={doc.frontImage}
                    alt={doc.title}
                    style={mobileZoom > 1 ? { width: `${mobileZoom * 100}%`, maxWidth: 'none' } : undefined}
                    className={mobileZoom > 1 ? 'object-contain' : 'max-h-52 max-w-full w-auto object-contain'}
                  />
                </div>
                <div
                  className={`bg-white border border-slate-300 rounded-2xl p-2 shadow-sm overflow-auto ${
                    mobileZoom > 1 ? 'block max-h-80' : 'flex items-center justify-center'
                  }`}
                >
                  <img
                    src={doc.backImage}
                    alt={doc.title}
                    style={mobileZoom > 1 ? { width: `${mobileZoom * 100}%`, maxWidth: 'none' } : undefined}
                    className={mobileZoom > 1 ? 'object-contain' : 'max-h-52 max-w-full w-auto object-contain'}
                  />
                </div>
              </div>
            ) : (
              <div
                className={`bg-white border border-slate-300 rounded-2xl p-2 shadow-sm w-full max-w-md overflow-auto ${
                  mobileZoom > 1 ? 'block max-h-96' : 'flex items-center justify-center'
                }`}
                onTouchStart={handleTouchStartZoom}
                onTouchMove={handleTouchMoveZoom}
                onTouchEnd={handleTouchEndZoom}
                onDoubleClick={() => setMobileZoom((z) => (z > 1 ? 1 : 2))}
              >
                <img
                  src={faceMode === 'back' && doc.backImage ? doc.backImage : doc.frontImage}
                  alt={doc.title}
                  style={mobileZoom > 1 ? { width: `${mobileZoom * 100}%`, maxWidth: 'none' } : undefined}
                  className={mobileZoom > 1 ? 'object-contain' : 'max-h-60 max-w-full w-auto object-contain'}
                />
              </div>
            )}
          </div>

          {/* Info & Properties */}
          <div className="p-4 space-y-4 text-xs">
            <div className="bg-white border border-slate-200 rounded-2xl p-3.5 space-y-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">المجموعة</label>
                <select
                  value={doc.groupId || ''}
                  onChange={(e) => onUpdate({ ...doc, groupId: e.target.value || undefined })}
                  className="w-full min-h-[42px] bg-slate-50 border border-slate-300 rounded-xl px-3 text-xs text-slate-900"
                >
                  <option value="">بدون مجموعة</option>
                  {groups.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] font-bold text-slate-700">ملاحظات</label>
                  {savedNotice && <span className="text-[10px] text-emerald-600 font-bold">تم الحفظ</span>}
                </div>
                <textarea
                  rows={3}
                  maxLength={500}
                  value={notesDraft}
                  onChange={(e) => setNotesDraft(e.target.value)}
                  onBlur={handleSaveNotes}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-800 resize-none focus:border-blue-600 focus:outline-none"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Sticky Touch Action Footer */}
        <footer className="bg-white/95 backdrop-blur-md border-t border-slate-200 px-1.5 pb-safe shrink-0">
          <div className="h-[60px] flex items-center justify-around gap-0.5">
            <button
              type="button"
              onClick={() => {
                onPrint(doc);
                onClose();
              }}
              aria-label="طباعة 1:1"
              title="طباعة 1:1"
              className="flex-1 min-w-0 min-h-[48px] px-1 rounded-xl text-slate-500 active:bg-slate-100 flex items-center justify-center cursor-pointer transition-colors"
            >
              <Printer className="w-5 h-5" />
            </button>
            <button
              type="button"
              onClick={handleDownloadPng}
              aria-label="تنزيل"
              title="تنزيل"
              className="flex-1 min-w-0 min-h-[48px] px-1 rounded-xl text-slate-500 active:bg-slate-100 flex items-center justify-center cursor-pointer transition-colors"
            >
              <Download className="w-5 h-5" />
            </button>
            <button
              type="button"
              onClick={() => onOpenEditor(doc)}
              aria-label="تعديل وقص"
              title="تعديل وقص"
              className="flex-1 min-w-0 min-h-[48px] px-1 rounded-xl text-slate-500 active:bg-slate-100 flex items-center justify-center cursor-pointer transition-colors"
            >
              <Edit3 className="w-5 h-5" />
            </button>
            <button
              type="button"
              onClick={() => onDuplicate(doc)}
              aria-label="تكرار"
              title="تكرار"
              className="flex-1 min-w-0 min-h-[48px] px-1 rounded-xl text-slate-500 active:bg-slate-100 flex items-center justify-center cursor-pointer transition-colors"
            >
              <Copy className="w-5 h-5" />
            </button>
            {hasBack && (
              <button
                type="button"
                onClick={() => onUpdate({ ...doc, coverFace: doc.coverFace === 'front' ? 'back' : 'front' })}
                aria-label="تبديل الغلاف"
                title="تبديل الغلاف"
                className="flex-1 min-w-0 min-h-[48px] px-1 rounded-xl text-slate-500 active:bg-slate-100 flex items-center justify-center cursor-pointer transition-colors"
              >
                <FlipHorizontal className="w-5 h-5" />
              </button>
            )}
            <button
              type="button"
              onClick={async () => {
                await onTrash(doc);
                onClose();
              }}
              aria-label="حذف"
              title="حذف"
              className="flex-1 min-w-0 min-h-[48px] px-1 rounded-xl text-slate-500 active:bg-slate-100 flex items-center justify-center cursor-pointer transition-colors"
            >
              <Trash2 className="w-5 h-5" />
            </button>
          </div>
        </footer>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 backdrop-blur-[1px] p-4 select-none"
      dir="rtl"
    >
      <div className="w-full max-w-4xl max-h-[90vh] bg-white border border-slate-200 rounded-xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="h-12 px-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            {isEditingTitle ? (
              <div className="flex items-center gap-1 flex-1 max-w-md">
                <input
                  type="text"
                  value={titleDraft}
                  onChange={(e) => setTitleDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSaveTitle();
                    if (e.key === 'Escape') {
                      setTitleDraft(doc.title);
                      setIsEditingTitle(false);
                    }
                  }}
                  className="flex-1 bg-white border border-blue-600 rounded px-2 py-1 text-xs font-bold text-slate-900 focus:outline-none"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={handleSaveTitle}
                  className="p-1 bg-blue-600 text-white rounded cursor-pointer"
                >
                  <Check className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <>
                <h2 className="font-bold text-sm text-slate-900 truncate">{doc.title}</h2>
                <button
                  type="button"
                  onClick={() => setIsEditingTitle(true)}
                  aria-label="تعديل الاسم"
                  className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded cursor-pointer"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                </button>
              </>
            )}
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => onUpdate({ ...doc, isFavorite: !doc.isFavorite })}
              aria-label="المفضلة"
              className={`p-1.5 rounded-md border cursor-pointer ${
                doc.isFavorite
                  ? 'bg-amber-50 border-amber-200 text-amber-500'
                  : 'bg-white border-slate-200 text-slate-400 hover:text-amber-500'
              }`}
            >
              <Star className={`w-3.5 h-3.5 ${doc.isFavorite ? 'fill-amber-400' : ''}`} />
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="إغلاق"
              className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-200 rounded-md cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 min-h-0 flex flex-col md:flex-row overflow-y-auto">
          {/* Preview Stage */}
          <div className="flex-1 studio-stage-grid p-6 flex flex-col items-center justify-center gap-4 min-h-[280px]">
            {hasBack && (
              <div className="flex items-center bg-white p-0.5 rounded-md border border-slate-200 shadow-2xs">
                <button
                  type="button"
                  onClick={() => setFaceMode('front')}
                  className={`px-2.5 py-1 rounded text-[11px] font-semibold cursor-pointer ${
                    faceMode === 'front' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  الأمامي
                </button>
                <button
                  type="button"
                  onClick={() => setFaceMode('back')}
                  className={`px-2.5 py-1 rounded text-[11px] font-semibold cursor-pointer ${
                    faceMode === 'back' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  الخلفي
                </button>
                <button
                  type="button"
                  onClick={() => setFaceMode('both')}
                  className={`px-2.5 py-1 rounded text-[11px] font-semibold cursor-pointer ${
                    faceMode === 'both' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  كلا الوجهين
                </button>
              </div>
            )}

            {faceMode === 'both' && hasBack && doc.backImage ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full max-w-2xl">
                <div className="bg-white border border-slate-300 rounded-lg p-1.5 shadow-sm flex items-center justify-center">
                  <img src={doc.frontImage} alt={doc.title} className="max-h-60 w-auto object-contain" />
                </div>
                <div className="bg-white border border-slate-300 rounded-lg p-1.5 shadow-sm flex items-center justify-center">
                  <img src={doc.backImage} alt={doc.title} className="max-h-60 w-auto object-contain" />
                </div>
              </div>
            ) : (
              <div className="bg-white border border-slate-300 rounded-lg p-2 shadow-md flex items-center justify-center">
                <img
                  src={faceMode === 'back' && doc.backImage ? doc.backImage : doc.frontImage}
                  alt={doc.title}
                  className="max-h-72 max-w-full w-auto object-contain"
                />
              </div>
            )}
          </div>

          {/* Info & Properties Panel */}
          <aside className="w-full md:w-72 bg-white border-t md:border-t-0 md:border-r border-slate-200 p-4 space-y-4 shrink-0 text-xs">
            <dl className="grid grid-cols-2 gap-3 pb-3 border-b border-slate-200">
              <div>
                <dt className="text-[11px] text-slate-500">الأبعاد الفعلية</dt>
                <dd className="font-mono font-bold text-slate-900 mt-0.5" dir="ltr">
                  {doc.widthMm} × {doc.heightMm} mm
                </dd>
              </div>
              <div>
                <dt className="text-[11px] text-slate-500">عدد الأوجه</dt>
                <dd className="font-semibold text-slate-900 mt-0.5">
                  {hasBack ? 'وجهان' : 'وجه واحد'}
                </dd>
              </div>
              <div>
                <dt className="text-[11px] text-slate-500">النوع</dt>
                <dd className="font-semibold text-slate-900 mt-0.5 truncate">{doc.typeName}</dd>
              </div>
              <div>
                <dt className="text-[11px] text-slate-500">الحالة</dt>
                <dd className="font-semibold text-emerald-700 mt-0.5 flex items-center gap-1">
                  <Shield className="w-3 h-3" />
                  <span>{doc.isEncrypted ? 'مشفر' : 'جاهز'}</span>
                </dd>
              </div>
              <div>
                <dt className="text-[11px] text-slate-500">تاريخ الإضافة</dt>
                <dd className="font-mono text-[11px] text-slate-700 mt-0.5">{formatDate(doc.createdAt)}</dd>
              </div>
              <div>
                <dt className="text-[11px] text-slate-500">آخر تعديل</dt>
                <dd className="font-mono text-[11px] text-slate-700 mt-0.5">{formatDate(doc.updatedAt)}</dd>
              </div>
            </dl>

            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">المجموعة</label>
              <select
                value={doc.groupId || ''}
                onChange={(e) => onUpdate({ ...doc, groupId: e.target.value || undefined })}
                className="w-full bg-white border border-slate-300 rounded-md px-2.5 py-1.5 text-xs text-slate-900 cursor-pointer"
              >
                <option value="">بدون مجموعة</option>
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[11px] font-bold text-slate-600">ملاحظات</label>
                {savedNotice && <span className="text-[10px] text-emerald-600 font-semibold">تم الحفظ</span>}
              </div>
              <textarea
                rows={3}
                maxLength={500}
                value={notesDraft}
                onChange={(e) => setNotesDraft(e.target.value)}
                onBlur={handleSaveNotes}
                className="w-full bg-white border border-slate-300 rounded-md px-2.5 py-1.5 text-xs text-slate-800 resize-none focus:border-blue-600 focus:outline-none"
              />
            </div>
          </aside>
        </div>

        {/* Footer Action Bar */}
        <div className="h-12 px-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-2 shrink-0 overflow-x-auto">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => {
                onPrint(doc);
                onClose();
              }}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-xs font-bold flex items-center gap-1.5 cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>طباعة 1:1</span>
            </button>
            <button
              type="button"
              onClick={handleDownloadPng}
              className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 rounded-md text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>تنزيل PNG</span>
            </button>
            <button
              type="button"
              onClick={() => onOpenEditor(doc)}
              className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 rounded-md text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>تعديل وقص</span>
            </button>
            <button
              type="button"
              onClick={() => onDuplicate(doc)}
              className="px-2.5 py-1.5 bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 rounded-md text-xs font-semibold flex items-center gap-1 cursor-pointer"
            >
              <Copy className="w-3.5 h-3.5" />
              <span>تكرار</span>
            </button>
            {hasBack && (
              <button
                type="button"
                onClick={() =>
                  onUpdate({ ...doc, coverFace: doc.coverFace === 'front' ? 'back' : 'front' })
                }
                className="px-2.5 py-1.5 bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 rounded-md text-xs font-semibold flex items-center gap-1 cursor-pointer"
              >
                <FlipHorizontal className="w-3.5 h-3.5" />
                <span>تبديل الغلاف</span>
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={async () => {
              await onTrash(doc);
              onClose();
            }}
            className="px-3 py-1.5 bg-white hover:bg-red-50 text-red-600 border border-red-200 rounded-md text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>نقل للسلة</span>
          </button>
        </div>
      </div>
    </div>
  );
};
