import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  Printer,
  Download,
  Star,
  Check,
  ChevronLeft,
  ChevronRight,
  FlipHorizontal,
  ZoomIn,
  ZoomOut,
  Maximize2,
  FolderOpen,
  MoreVertical,
  Shield,
  Info,
} from 'lucide-react';
import { MostamsakDocument, DocumentGroup, ViewMode, CardSize } from '../../types';
import { GroupIcon } from '../GroupIcon';
import { useLayoutMode } from '../../hooks/useViewportMode';

interface MobileDocumentViewsProps {
  documents: MostamsakDocument[];
  groups: DocumentGroup[];
  viewMode: ViewMode;
  cardSize: CardSize;
  selectedDocIds: Set<string>;
  isMultiSelectMode: boolean;
  onSelect: (doc: MostamsakDocument, isMulti: boolean) => void;
  onOpen: (doc: MostamsakDocument) => void;
  onToggleFavorite: (doc: MostamsakDocument, e?: React.MouseEvent) => void;
  onOpenDocActions: (doc: MostamsakDocument) => void;
  onDirectPrint: (doc: MostamsakDocument) => void;
  onDownload: (doc: MostamsakDocument) => void;
}

export const MobileDocumentViews: React.FC<MobileDocumentViewsProps> = ({
  documents,
  groups,
  viewMode,
  cardSize,
  selectedDocIds,
  isMultiSelectMode,
  onSelect,
  onOpen,
  onToggleFavorite,
  onOpenDocActions,
  onDirectPrint,
  onDownload,
}) => {
  const { isLandscape, width } = useLayoutMode();

  // Single view state
  const [singleIndex, setSingleIndex] = useState(0);
  const [singleShowBack, setSingleShowBack] = useState(false);

  // Carousel ref
  const carouselRef = useRef<HTMLDivElement>(null);

  // Map view touch pan/zoom state
  const [mapZoom, setMapZoom] = useState(0.75);
  const [mapPan, setMapPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const panStartRef = useRef({ x: 0, y: 0, panX: 0, panY: 0 });

  useEffect(() => {
    if (singleIndex >= documents.length) {
      setSingleIndex(Math.max(0, documents.length - 1));
    }
  }, [documents.length, singleIndex]);

  useEffect(() => {
    setSingleShowBack(false);
  }, [singleIndex]);

  useEffect(() => {
    if (viewMode === 'single' && selectedDocIds.size === 1) {
      const id = Array.from(selectedDocIds)[0];
      const idx = documents.findIndex((d) => d.id === id);
      if (idx !== -1) setSingleIndex(idx);
    }
  }, [selectedDocIds, viewMode, documents]);

  const getActiveImage = (doc: MostamsakDocument) =>
    doc.coverFace === 'back' && doc.backImage ? doc.backImage : doc.frontImage;

  const getCornerRadius = (doc: MostamsakDocument) =>
    Math.min(14, Math.max(4, (doc.radiusMm || 2) * 1.5));

  const getGroupName = (groupId?: string) =>
    groups.find((g) => g.id === groupId)?.name;

  const groupedSections = useMemo(() => {
    const sections: Array<{
      id: string;
      name: string;
      color: string;
      icon: string;
      docs: MostamsakDocument[];
    }> = [];

    for (const grp of groups) {
      const grpDocs = documents.filter((d) => d.groupId === grp.id);
      if (grpDocs.length > 0) {
        sections.push({
          id: grp.id,
          name: grp.name,
          color: grp.color || '#3b82f6',
          icon: grp.icon || 'folder',
          docs: grpDocs,
        });
      }
    }

    const ungrouped = documents.filter(
      (d) => !d.groupId || !groups.some((g) => g.id === d.groupId)
    );
    if (ungrouped.length > 0) {
      sections.push({
        id: 'ungrouped',
        name: 'بدون مجموعة',
        color: '#64748b',
        icon: 'folder',
        docs: ungrouped,
      });
    }

    return sections;
  }, [documents, groups]);

  const mapLayout = useMemo(() => {
    const mapW = 1100;
    const mapH = 760;
    const cx = mapW / 2;
    const cy = mapH / 2;

    const clusters: Array<{
      id: string;
      name: string;
      color: string;
      x: number;
      y: number;
      nodes: Array<{ doc: MostamsakDocument; x: number; y: number }>;
    }> = [];

    const secCount = groupedSections.length;
    const hubRadius = secCount <= 1 ? 0 : secCount === 2 ? 190 : 210;

    groupedSections.forEach((sec, sIdx) => {
      const hubAngle = (sIdx / Math.max(1, secCount)) * Math.PI * 2 - Math.PI / 2;
      const hx = secCount <= 1 ? cx : cx + Math.cos(hubAngle) * hubRadius;
      const hy = secCount <= 1 ? cy : cy + Math.sin(hubAngle) * hubRadius;

      const docCount = sec.docs.length;
      const nodeRadius = docCount <= 2 ? 145 : Math.min(220, 130 + docCount * 15);

      const nodes = sec.docs.map((doc, dIdx) => {
        let angle: number;
        if (secCount <= 1) {
          angle = (dIdx / Math.max(1, docCount)) * Math.PI * 2 - Math.PI / 2;
        } else {
          const spread = Math.min(Math.PI * 1.4, Math.max(Math.PI * 0.65, docCount * 0.52));
          const offset = docCount === 1 ? 0 : (dIdx / (docCount - 1) - 0.5) * spread;
          angle = hubAngle + offset;
        }
        return {
          doc,
          x: hx + Math.cos(angle) * nodeRadius,
          y: hy + Math.sin(angle) * nodeRadius,
        };
      });

      clusters.push({
        id: sec.id,
        name: sec.name,
        color: sec.color,
        x: hx,
        y: hy,
        nodes,
      });
    });

    return { width: mapW, height: mapH, cx, cy, clusters };
  }, [groupedSections]);

  // Responsive grid columns tuned for mobile portrait (small/medium/large) & landscape
  const gridColsClass = useMemo(() => {
    if (cardSize === 'small') {
      return isLandscape ? 'grid-cols-4' : 'grid-cols-2 sm:grid-cols-3';
    }
    if (cardSize === 'large') {
      return isLandscape ? 'grid-cols-2' : 'grid-cols-1';
    }
    // medium
    return isLandscape ? 'grid-cols-3' : width >= 410 ? 'grid-cols-2' : 'grid-cols-1 sm:grid-cols-2';
  }, [cardSize, isLandscape, width]);

  const handleCardPrimaryTap = (doc: MostamsakDocument) => {
    if (isMultiSelectMode || selectedDocIds.size > 0) {
      onSelect(doc, true);
    } else {
      onOpen(doc);
    }
  };

  // ============================================================================
  // 1. SINGLE VIEW (Mobile Full-Stage Viewer)
  // ============================================================================
  if (viewMode === 'single') {
    const doc = documents[singleIndex] || documents[0];
    if (!doc) return null;
    const hasBack = doc.sidesCount === 2 && Boolean(doc.backImage);
    const displayImg =
      singleShowBack && doc.backImage
        ? doc.backImage
        : !singleShowBack && doc.frontImage
        ? doc.frontImage
        : getActiveImage(doc);

    return (
      <div className="h-full flex flex-col bg-slate-50 overflow-hidden">
        {/* Compact Header */}
        <div className="px-3 py-2 bg-white border-b border-slate-200 flex items-center justify-between gap-2 shrink-0">
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-bold text-slate-900 truncate">{doc.title}</h2>
            <div className="text-[11px] text-slate-500 font-mono tabular-nums flex items-center gap-1.5" dir="ltr">
              <span>{doc.widthMm} × {doc.heightMm} mm</span>
              <span>·</span>
              <span>{singleIndex + 1}/{documents.length}</span>
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {hasBack && (
              <button
                type="button"
                onClick={() => setSingleShowBack((v) => !v)}
                aria-label="قلب الوجه"
                className={`min-w-[44px] min-h-[44px] rounded-xl border flex items-center justify-center cursor-pointer transition-colors ${
                  singleShowBack
                    ? 'bg-blue-50 border-blue-300 text-blue-700'
                    : 'bg-white border-slate-200 text-slate-700 active:bg-slate-100'
                }`}
              >
                <FlipHorizontal className="w-4 h-4" />
              </button>
            )}
            <button
              type="button"
              onClick={(e) => onToggleFavorite(doc, e)}
              aria-label="المفضلة"
              className={`min-w-[44px] min-h-[44px] rounded-xl border flex items-center justify-center cursor-pointer ${
                doc.isFavorite
                  ? 'bg-amber-50 border-amber-200 text-amber-500'
                  : 'bg-white border-slate-200 text-slate-400'
              }`}
            >
              <Star className={`w-4 h-4 ${doc.isFavorite ? 'fill-amber-400' : ''}`} />
            </button>
            <button
              type="button"
              onClick={() => onOpenDocActions(doc)}
              aria-label="المزيد من الإجراءات"
              className="min-w-[44px] min-h-[44px] rounded-xl border border-slate-200 bg-white text-slate-700 flex items-center justify-center active:bg-slate-100 cursor-pointer"
            >
              <MoreVertical className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Center Stage */}
        <div className="flex-1 relative studio-stage-grid flex items-center justify-center p-4 overflow-hidden min-h-[200px]">
          {documents.length > 1 && (
            <>
              <button
                type="button"
                onClick={() => setSingleIndex((i) => (i - 1 + documents.length) % documents.length)}
                aria-label="السابق"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 z-10 w-11 h-11 rounded-full bg-white/95 border border-slate-200 shadow-md flex items-center justify-center text-slate-700 active:scale-95 cursor-pointer"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
              <button
                type="button"
                onClick={() => setSingleIndex((i) => (i + 1) % documents.length)}
                aria-label="التالي"
                className="absolute left-2.5 top-1/2 -translate-y-1/2 z-10 w-11 h-11 rounded-full bg-white/95 border border-slate-200 shadow-md flex items-center justify-center text-slate-700 active:scale-95 cursor-pointer"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
            </>
          )}

          <div
            onClick={() => onOpen(doc)}
            className="max-w-full max-h-full flex items-center justify-center cursor-pointer"
          >
            <img
              src={displayImg}
              alt={doc.title}
              style={{ borderRadius: `${getCornerRadius(doc)}px` }}
              className="max-w-[82vw] max-h-[42vh] w-auto h-auto object-contain bg-white border border-slate-300 shadow-lg p-1.5"
              draggable={false}
            />
          </div>
        </div>

        {/* Quick Touch Action Bar */}
        <div className="px-3 py-2 bg-white border-t border-slate-200 grid grid-cols-3 gap-2 shrink-0">
          <button
            type="button"
            onClick={() => onDirectPrint(doc)}
            className="min-h-[44px] rounded-xl bg-blue-600 active:bg-blue-700 text-white text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>طباعة 1:1</span>
          </button>
          <button
            type="button"
            onClick={() => onDownload(doc)}
            className="min-h-[44px] rounded-xl bg-slate-100 active:bg-slate-200 text-slate-800 text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>تنزيل</span>
          </button>
          <button
            type="button"
            onClick={() => onOpen(doc)}
            className="min-h-[44px] rounded-xl bg-slate-100 active:bg-slate-200 text-slate-800 text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Info className="w-4 h-4" />
            <span>التفاصيل</span>
          </button>
        </div>

        {/* Bottom Switcher Strip (hidden in compact landscape to preserve stage space) */}
        {!isLandscape && (
          <div className="h-18 px-3 bg-slate-50 border-t border-slate-200 flex items-center gap-2 overflow-x-auto no-scrollbar shrink-0">
            {documents.map((item, idx) => {
              const isActive = idx === singleIndex;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSingleIndex(idx)}
                  className={`h-13 w-36 px-2 rounded-xl border flex items-center gap-2 shrink-0 cursor-pointer text-right transition-all ${
                    isActive
                      ? 'border-blue-600 ring-2 ring-blue-600/20 bg-white'
                      : 'border-slate-200 bg-white/80'
                  }`}
                >
                  <div className="w-10 h-9 rounded-lg bg-slate-100 border border-slate-200 overflow-hidden shrink-0 flex items-center justify-center p-0.5">
                    <img
                      src={getActiveImage(item)}
                      alt={item.title}
                      className="w-full h-full object-contain"
                      draggable={false}
                    />
                  </div>
                  <span className="text-[11px] font-bold text-slate-900 truncate flex-1">
                    {item.title}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // ============================================================================
  // 2. CARDS VIEW (Both Faces Card Stack)
  // ============================================================================
  if (viewMode === 'cards') {
    return (
      <div className={`grid ${isLandscape ? 'grid-cols-2' : 'grid-cols-1 sm:grid-cols-2'} gap-3`}>
        {documents.map((doc) => {
          const isSelected = selectedDocIds.has(doc.id);
          const hasBack = doc.sidesCount === 2 && Boolean(doc.backImage);
          const grpName = getGroupName(doc.groupId);
          return (
            <div
              key={doc.id}
              onClick={() => handleCardPrimaryTap(doc)}
              className={`bg-white border rounded-2xl overflow-hidden transition-all cursor-pointer flex flex-col ${
                isSelected ? 'border-blue-600 ring-2 ring-blue-600/20' : 'border-slate-200 shadow-2xs'
              }`}
            >
              <div className="relative h-44 studio-stage-grid border-b border-slate-200 p-3 flex items-center justify-center gap-2.5 overflow-hidden">
                {(isMultiSelectMode || isSelected) && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelect(doc, true);
                    }}
                    aria-label="تحديد"
                    className={`absolute top-2.5 right-2.5 z-10 w-7 h-7 rounded-lg border flex items-center justify-center cursor-pointer ${
                      isSelected ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white border-slate-300 text-transparent'
                    }`}
                  >
                    <Check className="w-4 h-4 stroke-[3]" />
                  </button>
                )}

                <img
                  src={doc.frontImage}
                  alt={doc.title}
                  style={{ borderRadius: `${getCornerRadius(doc)}px` }}
                  className={`${
                    hasBack ? 'max-w-[48%]' : 'max-w-full'
                  } max-h-full w-auto h-auto object-contain bg-white border border-slate-300/80 shadow-xs`}
                  loading="lazy"
                />
                {hasBack && doc.backImage && (
                  <img
                    src={doc.backImage}
                    alt={doc.title}
                    style={{ borderRadius: `${getCornerRadius(doc)}px` }}
                    className="max-w-[48%] max-h-full w-auto h-auto object-contain bg-white border border-slate-300/80 shadow-xs"
                    loading="lazy"
                  />
                )}
              </div>

              <div className="p-3 bg-white flex items-center justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <h3 className="font-bold text-sm text-slate-900 truncate">{doc.title}</h3>
                    {doc.isEncrypted && <Shield className="w-3.5 h-3.5 text-blue-600 shrink-0" />}
                  </div>
                  {grpName && (
                    <div className="text-[11px] text-slate-500 mt-0.5 truncate">{grpName}</div>
                  )}
                </div>

                <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                  <button
                    type="button"
                    onClick={() => onDirectPrint(doc)}
                    aria-label="طباعة"
                    className="min-w-[42px] min-h-[42px] rounded-xl bg-slate-50 active:bg-blue-50 text-slate-700 border border-slate-200 flex items-center justify-center cursor-pointer"
                  >
                    <Printer className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onOpenDocActions(doc)}
                    aria-label="خيارات المستمسك"
                    className="min-w-[42px] min-h-[42px] rounded-xl bg-slate-50 active:bg-slate-200 text-slate-700 border border-slate-200 flex items-center justify-center cursor-pointer"
                  >
                    <MoreVertical className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  // ============================================================================
  // 3. GRID VIEW (Touch-Optimized Document Cards)
  // ============================================================================
  if (viewMode === 'grid') {
    return (
      <div className={`grid ${gridColsClass} gap-3`}>
        {documents.map((doc) => {
          const isSelected = selectedDocIds.has(doc.id);
          return (
            <div
              key={doc.id}
              onClick={() => handleCardPrimaryTap(doc)}
              className={`bg-white border rounded-2xl overflow-hidden transition-all cursor-pointer flex flex-col ${
                isSelected ? 'border-blue-600 ring-2 ring-blue-600/20' : 'border-slate-200 shadow-2xs'
              }`}
            >
              <div
                className={`relative ${
                  cardSize === 'small' ? 'h-28' : cardSize === 'large' ? 'h-48' : 'h-36'
                } studio-stage-grid border-b border-slate-200 p-3 flex items-center justify-center overflow-hidden`}
              >
                {(isMultiSelectMode || isSelected) && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelect(doc, true);
                    }}
                    aria-label="تحديد"
                    className={`absolute top-2 right-2 z-10 w-7 h-7 rounded-lg border flex items-center justify-center cursor-pointer ${
                      isSelected ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white border-slate-300 text-transparent'
                    }`}
                  >
                    <Check className="w-4 h-4 stroke-[3]" />
                  </button>
                )}

                <img
                  src={getActiveImage(doc)}
                  alt={doc.title}
                  style={{ borderRadius: `${getCornerRadius(doc)}px` }}
                  className="max-w-full max-h-full w-auto h-auto object-contain bg-white border border-slate-300/80 shadow-xs"
                  loading="lazy"
                />
              </div>

              <div className="px-3 py-2.5 bg-white flex items-center justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1">
                    <h3 className="font-bold text-[13px] text-slate-900 truncate">{doc.title}</h3>
                    {doc.isEncrypted && <Shield className="w-3.5 h-3.5 text-blue-600 shrink-0" />}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenDocActions(doc);
                  }}
                  aria-label="خيارات المستمسك"
                  className="min-w-[40px] min-h-[40px] -ml-1 rounded-xl text-slate-500 active:bg-slate-100 flex items-center justify-center cursor-pointer shrink-0"
                >
                  <MoreVertical className="w-4 h-4" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  // ============================================================================
  // 4. COMPACT VIEW (High-Density Thumb Grid)
  // ============================================================================
  if (viewMode === 'compact') {
    return (
      <div className={`grid ${isLandscape ? 'grid-cols-4' : 'grid-cols-2 sm:grid-cols-3'} gap-2.5`}>
        {documents.map((doc) => {
          const isSelected = selectedDocIds.has(doc.id);
          return (
            <div
              key={doc.id}
              onClick={() => handleCardPrimaryTap(doc)}
              className={`bg-white border rounded-xl overflow-hidden cursor-pointer flex flex-col ${
                isSelected ? 'border-blue-600 ring-2 ring-blue-600/20' : 'border-slate-200'
              }`}
            >
              <div className="relative h-24 studio-stage-grid border-b border-slate-100 p-2 flex items-center justify-center overflow-hidden">
                {(isMultiSelectMode || isSelected) && (
                  <div
                    className={`absolute top-1.5 right-1.5 w-5 h-5 rounded border flex items-center justify-center ${
                      isSelected ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white border-slate-300 text-transparent'
                    }`}
                  >
                    <Check className="w-3 h-3 stroke-[3]" />
                  </div>
                )}
                <img
                  src={getActiveImage(doc)}
                  alt={doc.title}
                  className="max-w-full max-h-full object-contain bg-white border border-slate-200 rounded-xs"
                  loading="lazy"
                />
              </div>

              <div className="px-2.5 py-2 flex items-center justify-between gap-1">
                <span className="font-bold text-xs text-slate-900 truncate flex-1">{doc.title}</span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenDocActions(doc);
                  }}
                  aria-label="خيارات"
                  className="min-w-[36px] min-h-[36px] -ml-1.5 rounded-lg text-slate-500 active:bg-slate-100 flex items-center justify-center cursor-pointer shrink-0"
                >
                  <MoreVertical className="w-4 h-4" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  // ============================================================================
  // 5. GALLERY VIEW (Masonry / Visual Feed)
  // ============================================================================
  if (viewMode === 'gallery') {
    return (
      <div className={`columns-1 ${isLandscape ? 'columns-2' : 'sm:columns-2'} gap-3 space-y-3`}>
        {documents.map((doc) => {
          const isSelected = selectedDocIds.has(doc.id);
          return (
            <div
              key={doc.id}
              onClick={() => handleCardPrimaryTap(doc)}
              className={`break-inside-avoid bg-white border rounded-2xl overflow-hidden cursor-pointer ${
                isSelected ? 'border-blue-600 ring-2 ring-blue-600/20' : 'border-slate-200 shadow-2xs'
              }`}
            >
              <div className="relative p-3 bg-slate-50/70 border-b border-slate-100 flex items-center justify-center">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleFavorite(doc, e);
                  }}
                  aria-label="المفضلة"
                  className={`absolute top-2.5 left-2.5 z-10 min-w-[38px] min-h-[38px] rounded-xl border bg-white/95 flex items-center justify-center cursor-pointer ${
                    doc.isFavorite ? 'border-amber-200 text-amber-500' : 'border-slate-200 text-slate-400'
                  }`}
                >
                  <Star className={`w-4 h-4 ${doc.isFavorite ? 'fill-amber-400' : ''}`} />
                </button>
                <img
                  src={getActiveImage(doc)}
                  alt={doc.title}
                  style={{ borderRadius: `${getCornerRadius(doc)}px` }}
                  className="w-full h-auto object-contain bg-white border border-slate-200 shadow-xs"
                  loading="lazy"
                />
              </div>

              <div className="px-3 py-2.5 flex items-center justify-between gap-2 bg-white">
                <h3 className="font-bold text-xs text-slate-900 truncate flex-1">{doc.title}</h3>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenDocActions(doc);
                  }}
                  aria-label="خيارات"
                  className="min-w-[40px] min-h-[40px] -ml-1 rounded-xl text-slate-600 active:bg-slate-100 flex items-center justify-center cursor-pointer"
                >
                  <MoreVertical className="w-4 h-4" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  // ============================================================================
  // 6. LIST VIEW (Touch List Rows >= 64px height)
  // ============================================================================
  if (viewMode === 'list') {
    return (
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden divide-y divide-slate-100">
        {documents.map((doc) => {
          const isSelected = selectedDocIds.has(doc.id);
          const grpName = getGroupName(doc.groupId);
          return (
            <div
              key={doc.id}
              onClick={() => handleCardPrimaryTap(doc)}
              className={`min-h-[68px] px-3 py-2.5 flex items-center justify-between gap-3 cursor-pointer transition-colors ${
                isSelected ? 'bg-blue-50/70' : 'bg-white active:bg-slate-50'
              }`}
            >
              <div className="flex items-center gap-3 min-w-0 flex-1">
                {(isMultiSelectMode || isSelected) && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelect(doc, true);
                    }}
                    aria-label="تحديد"
                    className={`w-6 h-6 rounded-md border flex items-center justify-center shrink-0 cursor-pointer ${
                      isSelected ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white border-slate-300 text-transparent'
                    }`}
                  >
                    <Check className="w-3.5 h-3.5 stroke-[3]" />
                  </button>
                )}

                <div className="w-16 h-11 rounded-lg bg-slate-100 border border-slate-200 overflow-hidden shrink-0 flex items-center justify-center p-0.5">
                  <img src={getActiveImage(doc)} alt={doc.title} className="w-full h-full object-contain" />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-xs text-slate-900 truncate">{doc.title}</span>
                    {doc.isFavorite && <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-400 shrink-0" />}
                  </div>
                  <div className="text-[11px] text-slate-500 flex items-center gap-1.5 mt-0.5 truncate">
                    <span className="font-mono tabular-nums" dir="ltr">
                      {doc.widthMm}×{doc.heightMm} mm
                    </span>
                    {grpName && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className="truncate">{grpName}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                <button
                  type="button"
                  onClick={() => onDirectPrint(doc)}
                  aria-label="طباعة"
                  className="min-w-[42px] min-h-[42px] rounded-xl text-slate-600 active:bg-blue-50 flex items-center justify-center cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => onOpenDocActions(doc)}
                  aria-label="خيارات"
                  className="min-w-[42px] min-h-[42px] rounded-xl text-slate-600 active:bg-slate-100 flex items-center justify-center cursor-pointer"
                >
                  <MoreVertical className="w-4 h-4" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  // ============================================================================
  // 7. DETAIL / WIDE ROWS VIEW
  // ============================================================================
  if (viewMode === 'detail') {
    return (
      <div className="space-y-2.5">
        {documents.map((doc) => {
          const isSelected = selectedDocIds.has(doc.id);
          const hasBack = doc.sidesCount === 2 && Boolean(doc.backImage);
          const grpName = getGroupName(doc.groupId);
          return (
            <div
              key={doc.id}
              onClick={() => handleCardPrimaryTap(doc)}
              className={`bg-white border rounded-2xl p-3 flex flex-col gap-2.5 cursor-pointer ${
                isSelected ? 'border-blue-600 ring-2 ring-blue-600/20 bg-blue-50/20' : 'border-slate-200'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  {(isMultiSelectMode || isSelected) && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelect(doc, true);
                      }}
                      aria-label="تحديد"
                      className={`w-6 h-6 rounded-md border flex items-center justify-center shrink-0 cursor-pointer ${
                        isSelected ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white border-slate-300 text-transparent'
                      }`}
                    >
                      <Check className="w-3.5 h-3.5 stroke-[3]" />
                    </button>
                  )}
                  <div className="min-w-0 flex-1">
                    <h3 className="font-bold text-sm text-slate-900 truncate">{doc.title}</h3>
                    <div className="text-[11px] text-slate-500 flex items-center gap-1.5 truncate">
                      <span>{doc.typeName}</span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono tabular-nums" dir="ltr">
                        {doc.widthMm}×{doc.heightMm} mm
                      </span>
                      {grpName && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="truncate">{grpName}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenDocActions(doc);
                  }}
                  aria-label="خيارات"
                  className="min-w-[42px] min-h-[42px] rounded-xl bg-slate-50 border border-slate-200 text-slate-700 flex items-center justify-center cursor-pointer shrink-0"
                >
                  <MoreVertical className="w-4 h-4" />
                </button>
              </div>

              <div className="flex items-center gap-2">
                <div className="flex-1 h-24 rounded-xl bg-slate-50 border border-slate-200 p-1.5 flex items-center justify-center overflow-hidden">
                  <img src={doc.frontImage} alt={doc.title} className="max-w-full max-h-full object-contain" />
                </div>
                {hasBack && doc.backImage && (
                  <div className="flex-1 h-24 rounded-xl bg-slate-50 border border-slate-200 p-1.5 flex items-center justify-center overflow-hidden">
                    <img src={doc.backImage} alt={doc.title} className="max-w-full max-h-full object-contain" />
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  // ============================================================================
  // 8. GROUPED VIEW
  // ============================================================================
  if (viewMode === 'grouped') {
    return (
      <div className="space-y-5">
        {groupedSections.map((sec) => (
          <section key={sec.id} className="space-y-2.5">
            <div className="flex items-center gap-2 pb-1.5 border-b border-slate-200">
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: sec.color }} />
              <GroupIcon icon={sec.icon} className="w-4 h-4 text-slate-700" />
              <h3 className="text-xs font-bold text-slate-900">{sec.name}</h3>
              <span className="text-[11px] font-mono tabular-nums text-slate-400">({sec.docs.length})</span>
            </div>

            <div className={`grid ${gridColsClass} gap-3`}>
              {sec.docs.map((doc) => {
                const isSelected = selectedDocIds.has(doc.id);
                return (
                  <div
                    key={doc.id}
                    onClick={() => handleCardPrimaryTap(doc)}
                    className={`bg-white border rounded-2xl overflow-hidden cursor-pointer flex flex-col ${
                      isSelected ? 'border-blue-600 ring-2 ring-blue-600/20' : 'border-slate-200 shadow-2xs'
                    }`}
                  >
                    <div className="relative h-32 studio-stage-grid border-b border-slate-200 p-2.5 flex items-center justify-center overflow-hidden">
                      <img
                        src={getActiveImage(doc)}
                        alt={doc.title}
                        style={{ borderRadius: `${getCornerRadius(doc)}px` }}
                        className="max-w-full max-h-full object-contain bg-white border border-slate-200 shadow-xs"
                        loading="lazy"
                      />
                    </div>
                    <div className="px-3 py-2 flex items-center justify-between gap-2">
                      <span className="font-bold text-xs text-slate-900 truncate flex-1">{doc.title}</span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenDocActions(doc);
                        }}
                        aria-label="خيارات"
                        className="min-w-[40px] min-h-[40px] -ml-1 rounded-xl text-slate-500 active:bg-slate-100 flex items-center justify-center cursor-pointer"
                      >
                        <MoreVertical className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    );
  }

  // ============================================================================
  // 9. MAP VIEW (Touch-Pan Interactive Document Map)
  // ============================================================================
  if (viewMode === 'map') {
    return (
      <div
        className="relative w-full h-full min-h-[380px] studio-stage-grid border border-slate-200 rounded-2xl overflow-hidden select-none touch-none"
        onPointerDown={(e) => {
          if ((e.target as HTMLElement).closest('button, .map-doc-node')) return;
          setIsPanning(true);
          panStartRef.current = {
            x: e.clientX,
            y: e.clientY,
            panX: mapPan.x,
            panY: mapPan.y,
          };
        }}
        onPointerMove={(e) => {
          if (!isPanning) return;
          setMapPan({
            x: panStartRef.current.panX + (e.clientX - panStartRef.current.x),
            y: panStartRef.current.panY + (e.clientY - panStartRef.current.y),
          });
        }}
        onPointerUp={() => setIsPanning(false)}
        onPointerCancel={() => setIsPanning(false)}
      >
        {/* Touch-sized Zoom Controls */}
        <div className="absolute top-3 left-3 z-20 flex items-center gap-1 bg-white/95 border border-slate-200 rounded-xl p-1 shadow-md">
          <button
            type="button"
            onClick={() => setMapZoom((z) => Math.min(1.5, Number((z + 0.15).toFixed(2))))}
            aria-label="تكبير"
            className="min-w-[40px] min-h-[40px] flex items-center justify-center text-slate-700 active:bg-slate-100 rounded-lg cursor-pointer"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => {
              setMapZoom(0.75);
              setMapPan({ x: 0, y: 0 });
            }}
            aria-label="إعادة ضبط"
            className="min-w-[40px] min-h-[40px] flex items-center justify-center text-slate-700 active:bg-slate-100 rounded-lg cursor-pointer"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => setMapZoom((z) => Math.max(0.4, Number((z - 0.15).toFixed(2))))}
            aria-label="تصغير"
            className="min-w-[40px] min-h-[40px] flex items-center justify-center text-slate-700 active:bg-slate-100 rounded-lg cursor-pointer"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
        </div>

        <div
          style={{
            width: `${mapLayout.width}px`,
            height: `${mapLayout.height}px`,
            transform: `translate(calc(50% - ${mapLayout.width / 2}px + ${mapPan.x}px), calc(50% - ${
              mapLayout.height / 2
            }px + ${mapPan.y}px)) scale(${mapZoom})`,
            transformOrigin: 'center center',
          }}
          className={`relative ${isPanning ? '' : 'transition-transform duration-150'}`}
        >
          <svg width={mapLayout.width} height={mapLayout.height} className="absolute inset-0 pointer-events-none">
            {mapLayout.clusters.map((cluster) => (
              <g key={cluster.id}>
                {mapLayout.clusters.length > 1 && (
                  <line
                    x1={mapLayout.cx}
                    y1={mapLayout.cy}
                    x2={cluster.x}
                    y2={cluster.y}
                    stroke={cluster.color}
                    strokeOpacity={0.35}
                    strokeWidth={2}
                    strokeDasharray="6 4"
                  />
                )}
                {cluster.nodes.map((n) => (
                  <line
                    key={n.doc.id}
                    x1={cluster.x}
                    y1={cluster.y}
                    x2={n.x}
                    y2={n.y}
                    stroke={cluster.color}
                    strokeOpacity={0.45}
                    strokeWidth={1.75}
                  />
                ))}
              </g>
            ))}
          </svg>

          {mapLayout.clusters.length > 1 && (
            <div
              style={{ left: `${mapLayout.cx}px`, top: `${mapLayout.cy}px` }}
              className="absolute -translate-x-1/2 -translate-y-1/2 px-4 py-2 rounded-full bg-slate-900 text-white text-xs font-bold shadow-md flex items-center gap-2 z-10"
            >
              <FolderOpen className="w-3.5 h-3.5 text-blue-400" />
              <span>الخزانة</span>
            </div>
          )}

          {mapLayout.clusters.map((cluster) => (
            <React.Fragment key={cluster.id}>
              <div
                style={{ left: `${cluster.x}px`, top: `${cluster.y}px`, borderColor: cluster.color }}
                className="absolute -translate-x-1/2 -translate-y-1/2 px-3.5 py-1.5 rounded-full bg-white border-2 shadow-sm flex items-center gap-1.5 z-10"
              >
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: cluster.color }} />
                <span className="text-xs font-bold text-slate-900 whitespace-nowrap">{cluster.name}</span>
              </div>

              {cluster.nodes.map(({ doc, x, y }) => {
                const isSelected = selectedDocIds.has(doc.id);
                return (
                  <div
                    key={doc.id}
                    style={{ left: `${x}px`, top: `${y}px` }}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCardPrimaryTap(doc);
                    }}
                    className={`map-doc-node absolute -translate-x-1/2 -translate-y-1/2 w-48 bg-white border rounded-2xl overflow-hidden shadow-md cursor-pointer z-10 ${
                      isSelected ? 'border-blue-600 ring-2 ring-blue-600/25' : 'border-slate-200'
                    }`}
                  >
                    <div className="h-24 bg-slate-50 border-b border-slate-100 p-2 flex items-center justify-center">
                      <img
                        src={getActiveImage(doc)}
                        alt={doc.title}
                        className="max-w-full max-h-full object-contain bg-white border border-slate-200 rounded-xs"
                        draggable={false}
                      />
                    </div>
                    <div className="px-2.5 py-1.5 flex items-center justify-between gap-1 bg-white">
                      <span className="text-xs font-bold text-slate-900 truncate flex-1">{doc.title}</span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenDocActions(doc);
                        }}
                        aria-label="خيارات"
                        className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-600 active:bg-slate-100 cursor-pointer"
                      >
                        <MoreVertical className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </React.Fragment>
          ))}
        </div>
      </div>
    );
  }

  // ============================================================================
  // 10. CAROUSEL VIEW (Snap-Scroll Touch Carousel)
  // ============================================================================
  return (
    <div className="h-full flex flex-col justify-center">
      <div
        ref={carouselRef}
        className="flex gap-3.5 overflow-x-auto pb-4 snap-x snap-mandatory items-stretch no-scrollbar"
      >
        {documents.map((doc) => {
          const isSelected = selectedDocIds.has(doc.id);
          return (
            <div
              key={doc.id}
              onClick={() => handleCardPrimaryTap(doc)}
              className={`snap-center w-[80vw] max-w-[320px] shrink-0 bg-white border rounded-2xl overflow-hidden cursor-pointer flex flex-col ${
                isSelected ? 'border-blue-600 ring-2 ring-blue-600/20 shadow-md' : 'border-slate-200 shadow-xs'
              }`}
            >
              <div className="relative h-56 studio-stage-grid border-b border-slate-200 p-4 flex items-center justify-center overflow-hidden">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleFavorite(doc, e);
                  }}
                  aria-label="المفضلة"
                  className={`absolute top-2.5 left-2.5 z-10 min-w-[40px] min-h-[40px] rounded-xl border bg-white/95 flex items-center justify-center cursor-pointer ${
                    doc.isFavorite ? 'border-amber-200 text-amber-500' : 'border-slate-200 text-slate-400'
                  }`}
                >
                  <Star className={`w-4 h-4 ${doc.isFavorite ? 'fill-amber-400' : ''}`} />
                </button>
                <img
                  src={getActiveImage(doc)}
                  alt={doc.title}
                  style={{ borderRadius: `${getCornerRadius(doc)}px` }}
                  className="max-w-full max-h-full object-contain bg-white border border-slate-300/80 shadow-xs"
                  loading="lazy"
                />
              </div>

              <div className="p-3 bg-white flex items-center justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <h3 className="font-bold text-sm text-slate-900 truncate">{doc.title}</h3>
                  <div className="text-[11px] font-mono tabular-nums text-slate-500 mt-0.5" dir="ltr">
                    {doc.widthMm} × {doc.heightMm} mm
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                  <button
                    type="button"
                    onClick={() => onDirectPrint(doc)}
                    aria-label="طباعة"
                    className="min-w-[42px] min-h-[42px] rounded-xl bg-slate-50 border border-slate-200 text-slate-700 flex items-center justify-center cursor-pointer"
                  >
                    <Printer className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onOpenDocActions(doc)}
                    aria-label="خيارات"
                    className="min-w-[42px] min-h-[42px] rounded-xl bg-slate-50 border border-slate-200 text-slate-700 flex items-center justify-center cursor-pointer"
                  >
                    <MoreVertical className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
