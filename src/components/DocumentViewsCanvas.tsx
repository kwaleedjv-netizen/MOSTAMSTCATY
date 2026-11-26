import React, { useState, useRef, useMemo, useEffect } from 'react';
import {
  Printer,
  Download,
  Info,
  Star,
  Check,
  ChevronLeft,
  ChevronRight,
  FlipHorizontal,
  ZoomIn,
  ZoomOut,
  Maximize2,
  FolderOpen,
} from 'lucide-react';
import { MostamsakDocument, DocumentGroup, ViewMode, CardSize } from '../types';
import { DocumentCard } from './DocumentCard';
import { DocumentListItem } from './DocumentListItem';
import { GroupIcon } from './GroupIcon';
import { useLayoutMode } from '../hooks/useViewportMode';

interface DocumentViewsCanvasProps {
  documents: MostamsakDocument[];
  groups: DocumentGroup[];
  viewMode: ViewMode;
  cardSize: CardSize;
  selectedDocIds: Set<string>;
  isMultiSelectMode: boolean;
  onSelect: (doc: MostamsakDocument, isMulti: boolean) => void;
  onOpen: (doc: MostamsakDocument) => void;
  onToggleFavorite: (doc: MostamsakDocument, e: React.MouseEvent) => void;
  onContextMenu: (e: React.MouseEvent, doc: MostamsakDocument) => void;
  onDirectPrint: (doc: MostamsakDocument) => void;
  onDownload: (doc: MostamsakDocument) => void;
}

const DocActionIcons: React.FC<{
  doc: MostamsakDocument;
  onDirectPrint: (doc: MostamsakDocument) => void;
  onDownload: (doc: MostamsakDocument) => void;
  onOpen: (doc: MostamsakDocument) => void;
  compact?: boolean;
}> = ({ doc, onDirectPrint, onDownload, onOpen, compact = false }) => {
  const btnPad = compact ? 'p-1' : 'p-1.5';
  const iconCls = compact ? 'w-3 h-3' : 'w-3.5 h-3.5';

  return (
    <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        onClick={() => onDirectPrint(doc)}
        aria-label="طباعة"
        className={`${btnPad} bg-white hover:bg-blue-600 text-slate-700 hover:text-white border border-slate-200 hover:border-blue-600 rounded-md transition-colors cursor-pointer`}
      >
        <Printer className={iconCls} />
      </button>
      <button
        type="button"
        onClick={() => onDownload(doc)}
        aria-label="تنزيل"
        className={`${btnPad} bg-white hover:bg-emerald-600 text-slate-700 hover:text-white border border-slate-200 hover:border-emerald-600 rounded-md transition-colors cursor-pointer`}
      >
        <Download className={iconCls} />
      </button>
      <button
        type="button"
        onClick={() => onOpen(doc)}
        aria-label="تفاصيل"
        className={`${btnPad} bg-white hover:bg-slate-900 text-slate-700 hover:text-white border border-slate-200 hover:border-slate-900 rounded-md transition-colors cursor-pointer`}
      >
        <Info className={iconCls} />
      </button>
    </div>
  );
};

export const DocumentViewsCanvas: React.FC<DocumentViewsCanvasProps> = ({
  documents,
  groups,
  viewMode,
  cardSize,
  selectedDocIds,
  isMultiSelectMode,
  onSelect,
  onOpen,
  onToggleFavorite,
  onContextMenu,
  onDirectPrint,
  onDownload,
}) => {
  const { isTablet } = useLayoutMode();
  // Single view state
  const [singleIndex, setSingleIndex] = useState(0);
  const [singleShowBack, setSingleShowBack] = useState(false);

  // Carousel scroll ref
  const carouselRef = useRef<HTMLDivElement>(null);

  // Map view pan/zoom state
  const [mapZoom, setMapZoom] = useState(1);
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

  // Sync singleIndex when a single doc is selected
  useEffect(() => {
    if (viewMode === 'single' && selectedDocIds.size === 1) {
      const id = Array.from(selectedDocIds)[0];
      const idx = documents.findIndex((d) => d.id === id);
      if (idx !== -1) setSingleIndex(idx);
    }
  }, [selectedDocIds, viewMode, documents]);

  const gridColsClass =
    cardSize === 'small'
      ? 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6'
      : cardSize === 'large'
      ? 'grid-cols-1 sm:grid-cols-2 xl:grid-cols-3'
      : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4';

  const getActiveImage = (doc: MostamsakDocument) =>
    doc.coverFace === 'back' && doc.backImage ? doc.backImage : doc.frontImage;

  const getCornerRadius = (doc: MostamsakDocument) =>
    Math.min(14, Math.max(4, (doc.radiusMm || 2) * 1.5));

  // === GROUPED DATA FOR 'grouped' & 'map' ===
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

  // === MAP LAYOUT COMPUTATION ===
  const mapLayout = useMemo(() => {
    const width = 1400;
    const height = 900;
    const cx = width / 2;
    const cy = height / 2;

    const clusters: Array<{
      id: string;
      name: string;
      color: string;
      x: number;
      y: number;
      nodes: Array<{
        doc: MostamsakDocument;
        x: number;
        y: number;
      }>;
    }> = [];

    const secCount = groupedSections.length;
    const hubRadius = secCount <= 1 ? 0 : secCount === 2 ? 240 : 250;

    groupedSections.forEach((sec, sIdx) => {
      const hubAngle = (sIdx / Math.max(1, secCount)) * Math.PI * 2 - Math.PI / 2;
      const hx = secCount <= 1 ? cx : cx + Math.cos(hubAngle) * hubRadius;
      const hy = secCount <= 1 ? cy : cy + Math.sin(hubAngle) * hubRadius;

      const docCount = sec.docs.length;
      const nodeRadius = docCount <= 2 ? 175 : Math.min(260, 150 + docCount * 16);

      const nodes = sec.docs.map((doc, dIdx) => {
        let angle: number;
        if (secCount <= 1) {
          angle = (dIdx / Math.max(1, docCount)) * Math.PI * 2 - Math.PI / 2;
        } else {
          const spread = Math.min(Math.PI * 1.45, Math.max(Math.PI * 0.65, docCount * 0.52));
          const offset =
            docCount === 1
              ? 0
              : ((dIdx / (docCount - 1)) - 0.5) * spread;
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

    return { width, height, cx, cy, clusters };
  }, [groupedSections]);

  // ============================================================================
  // 1. SINGLE VIEW (عرض فردي)
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
      <div className="h-full flex flex-col bg-slate-50/50 overflow-hidden">
        {/* Top bar: Title + Actions */}
        <div className="h-12 px-5 bg-white border-b border-slate-200 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <h2 className="text-sm font-bold text-slate-900 truncate">{doc.title}</h2>
            <button
              type="button"
              onClick={(e) => onToggleFavorite(doc, e)}
              aria-label="المفضلة"
              className={`p-1 rounded transition-colors cursor-pointer ${
                doc.isFavorite ? 'text-amber-500' : 'text-slate-300 hover:text-amber-500'
              }`}
            >
              <Star className={`w-4 h-4 ${doc.isFavorite ? 'fill-amber-400' : ''}`} />
            </button>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {hasBack && (
              <button
                type="button"
                onClick={() => setSingleShowBack((v) => !v)}
                aria-label="قلب الوجه"
                className={`p-1.5 rounded-md border transition-colors cursor-pointer ${
                  singleShowBack
                    ? 'bg-blue-50 border-blue-300 text-blue-700'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
              >
                <FlipHorizontal className="w-3.5 h-3.5" />
              </button>
            )}
            <DocActionIcons
              doc={doc}
              onDirectPrint={onDirectPrint}
              onDownload={onDownload}
              onOpen={onOpen}
            />
          </div>
        </div>

        {/* Center Spotlight Stage */}
        <div className="flex-1 relative studio-stage-grid flex items-center justify-center p-6 overflow-hidden">
          {documents.length > 1 && (
            <>
              <button
                type="button"
                onClick={() =>
                  setSingleIndex((i) => (i - 1 + documents.length) % documents.length)
                }
                aria-label="السابق"
                className="absolute right-4 top-1/2 -translate-y-1/2 z-10 w-9 h-9 rounded-full bg-white/95 hover:bg-white border border-slate-200 shadow-sm flex items-center justify-center text-slate-700 hover:text-blue-600 cursor-pointer transition-all"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
              <button
                type="button"
                onClick={() => setSingleIndex((i) => (i + 1) % documents.length)}
                aria-label="التالي"
                className="absolute left-4 top-1/2 -translate-y-1/2 z-10 w-9 h-9 rounded-full bg-white/95 hover:bg-white border border-slate-200 shadow-sm flex items-center justify-center text-slate-700 hover:text-blue-600 cursor-pointer transition-all"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
            </>
          )}

          <div
            onClick={(e) => onSelect(doc, e.ctrlKey || e.metaKey)}
            onDoubleClick={() => onOpen(doc)}
            onContextMenu={(e) => onContextMenu(e, doc)}
            className="max-w-full max-h-full flex items-center justify-center cursor-pointer"
          >
            <img
              src={displayImg}
              alt={doc.title}
              style={{ borderRadius: `${getCornerRadius(doc)}px` }}
              className="max-w-[78vw] max-h-[54vh] w-auto h-auto object-contain bg-white border border-slate-300 shadow-lg p-1.5"
              draggable={false}
            />
          </div>
        </div>

        {/* Bottom Switcher Strip */}
        <div className="h-20 px-4 bg-white border-t border-slate-200 flex items-center gap-2.5 overflow-x-auto shrink-0">
          {documents.map((item, idx) => {
            const isActive = idx === singleIndex;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setSingleIndex(idx);
                  onSelect(item, false);
                }}
                onContextMenu={(e) => onContextMenu(e, item)}
                className={`h-14 w-44 px-2 rounded-md border flex items-center gap-2 shrink-0 cursor-pointer transition-all text-right ${
                  isActive
                    ? 'border-blue-600 ring-2 ring-blue-600/20 bg-blue-50/40'
                    : 'border-slate-200 hover:border-slate-300 bg-white'
                }`}
              >
                <div className="w-12 h-10 rounded bg-slate-100 border border-slate-200 overflow-hidden shrink-0 flex items-center justify-center p-0.5">
                  <img
                    src={getActiveImage(item)}
                    alt={item.title}
                    className="w-full h-full object-contain"
                    draggable={false}
                  />
                </div>
                <span className="text-xs font-bold text-slate-900 truncate flex-1">
                  {item.title}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  // ============================================================================
  // 2. CARDS VIEW (عرض بطاقة - بطاقات عريضة تعرض الوجهين)
  // ============================================================================
  if (viewMode === 'cards') {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {documents.map((doc) => {
          const isSelected = selectedDocIds.has(doc.id);
          const hasBack = doc.sidesCount === 2 && Boolean(doc.backImage);
          return (
            <div
              key={doc.id}
              onClick={(e) => onSelect(doc, e.ctrlKey || e.metaKey)}
              onDoubleClick={() => onOpen(doc)}
              onContextMenu={(e) => onContextMenu(e, doc)}
              className={`document-card-item group relative bg-white border rounded-xl overflow-hidden transition-all cursor-pointer flex flex-col ${
                isSelected
                  ? 'border-blue-600 ring-2 ring-blue-600/20 shadow-sm'
                  : 'border-slate-200 hover:border-slate-300 shadow-2xs hover:shadow-md'
              }`}
            >
              <div className="relative h-52 studio-stage-grid border-b border-slate-200 p-4 flex items-center justify-center gap-3 overflow-hidden">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelect(doc, true);
                  }}
                  aria-label="تحديد"
                  className={`absolute top-2.5 right-2.5 z-10 ${
                    isTablet ? 'w-6 h-6' : 'w-5 h-5'
                  } rounded border flex items-center justify-center transition-opacity cursor-pointer ${
                    isSelected
                      ? 'bg-blue-600 border-blue-600 text-white opacity-100'
                      : isMultiSelectMode || isTablet
                      ? 'bg-white border-slate-300 text-transparent opacity-100'
                      : 'bg-white/95 border-slate-300 text-transparent opacity-0 group-hover:opacity-100'
                  }`}
                >
                  <Check className="w-3 h-3 stroke-[3]" />
                </button>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleFavorite(doc, e);
                  }}
                  aria-label="المفضلة"
                  className={`absolute top-2.5 left-2.5 z-10 p-1 rounded border bg-white/95 transition-opacity cursor-pointer ${
                    doc.isFavorite
                      ? 'border-amber-200 text-amber-500 opacity-100'
                      : isTablet
                      ? 'border-slate-200 text-slate-400 opacity-100'
                      : 'border-slate-200 text-slate-400 hover:text-amber-500 opacity-0 group-hover:opacity-100'
                  }`}
                >
                  <Star className={`w-3.5 h-3.5 ${doc.isFavorite ? 'fill-amber-400' : ''}`} />
                </button>

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

              <div className="px-3.5 py-3 bg-white flex items-center justify-between gap-2">
                <h3
                  className={`font-bold text-[13px] truncate flex-1 ${
                    isSelected ? 'text-blue-700' : 'text-slate-900 group-hover:text-blue-600'
                  }`}
                >
                  {doc.title}
                </h3>
                <DocActionIcons
                  doc={doc}
                  onDirectPrint={onDirectPrint}
                  onDownload={onDownload}
                  onOpen={onOpen}
                />
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  // ============================================================================
  // 3. GRID VIEW (عرض شبكي)
  // ============================================================================
  if (viewMode === 'grid') {
    return (
      <div className={`grid ${gridColsClass} gap-3.5`}>
        {documents.map((doc) => {
          const grp = groups.find((g) => g.id === doc.groupId);
          return (
            <div key={doc.id} className="document-card-item flex">
              <DocumentCard
                document={doc}
                groupName={grp?.name}
                groupColor={grp?.color}
                cardSize={cardSize}
                isSelected={selectedDocIds.has(doc.id)}
                isMultiSelectMode={isMultiSelectMode}
                onSelect={onSelect}
                onOpen={onOpen}
                onToggleFavorite={onToggleFavorite}
                onContextMenu={onContextMenu}
                onDirectPrint={onDirectPrint}
                onDownload={onDownload}
              />
            </div>
          );
        })}
      </div>
    );
  }

  // ============================================================================
  // 4. COMPACT VIEW (شبكة مصغرة)
  // ============================================================================
  if (viewMode === 'compact') {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 xl:grid-cols-6 gap-2.5">
        {documents.map((doc) => {
          const isSelected = selectedDocIds.has(doc.id);
          return (
            <div
              key={doc.id}
              onClick={(e) => onSelect(doc, e.ctrlKey || e.metaKey)}
              onDoubleClick={() => onOpen(doc)}
              onContextMenu={(e) => onContextMenu(e, doc)}
              className={`document-card-item group bg-white border rounded-lg overflow-hidden cursor-pointer transition-all flex flex-col ${
                isSelected
                  ? 'border-blue-600 ring-2 ring-blue-600/20 shadow-xs'
                  : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <div className="relative h-24 studio-stage-grid border-b border-slate-100 p-2 flex items-center justify-center overflow-hidden">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleFavorite(doc, e);
                  }}
                  aria-label="المفضلة"
                  className={`absolute top-1.5 left-1.5 p-0.5 rounded bg-white/90 transition-opacity cursor-pointer ${
                    doc.isFavorite
                      ? 'text-amber-500 opacity-100'
                      : isTablet
                      ? 'text-slate-400 opacity-100'
                      : 'text-slate-300 hover:text-amber-500 opacity-0 group-hover:opacity-100'
                  }`}
                >
                  <Star className={`w-3 h-3 ${doc.isFavorite ? 'fill-amber-400' : ''}`} />
                </button>
                <img
                  src={getActiveImage(doc)}
                  alt={doc.title}
                  className="max-w-full max-h-full object-contain bg-white border border-slate-200 rounded-xs"
                  loading="lazy"
                />
              </div>

              <div className="p-2 flex flex-col gap-1.5">
                <h3 className="font-bold text-[11px] text-slate-900 truncate">{doc.title}</h3>
                <div className="flex items-center justify-end">
                  <DocActionIcons
                    doc={doc}
                    onDirectPrint={onDirectPrint}
                    onDownload={onDownload}
                    onOpen={onOpen}
                    compact
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  // ============================================================================
  // 5. GALLERY VIEW (معرض الصور)
  // ============================================================================
  if (viewMode === 'gallery') {
    return (
      <div className="columns-1 sm:columns-2 lg:columns-3 xl:columns-4 gap-4 space-y-4">
        {documents.map((doc) => {
          const isSelected = selectedDocIds.has(doc.id);
          return (
            <div
              key={doc.id}
              onClick={(e) => onSelect(doc, e.ctrlKey || e.metaKey)}
              onDoubleClick={() => onOpen(doc)}
              onContextMenu={(e) => onContextMenu(e, doc)}
              className={`document-card-item break-inside-avoid group bg-white border rounded-xl overflow-hidden cursor-pointer transition-all ${
                isSelected
                  ? 'border-blue-600 ring-2 ring-blue-600/20 shadow-sm'
                  : 'border-slate-200 hover:border-slate-300 shadow-2xs hover:shadow-md'
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
                  className={`absolute top-2.5 left-2.5 z-10 p-1 rounded border bg-white/95 transition-opacity cursor-pointer ${
                    doc.isFavorite
                      ? 'border-amber-200 text-amber-500 opacity-100'
                      : isTablet
                      ? 'border-slate-200 text-slate-400 opacity-100'
                      : 'border-slate-200 text-slate-400 hover:text-amber-500 opacity-0 group-hover:opacity-100'
                  }`}
                >
                  <Star className={`w-3.5 h-3.5 ${doc.isFavorite ? 'fill-amber-400' : ''}`} />
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
                <DocActionIcons
                  doc={doc}
                  onDirectPrint={onDirectPrint}
                  onDownload={onDownload}
                  onOpen={onOpen}
                />
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  // ============================================================================
  // 6. LIST VIEW (عرض قائمة)
  // ============================================================================
  if (viewMode === 'list') {
    return (
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden divide-y divide-slate-100 shadow-2xs">
        {documents.map((doc) => {
          const grp = groups.find((g) => g.id === doc.groupId);
          return (
            <div key={doc.id} className="document-card-item">
              <DocumentListItem
                document={doc}
                groupName={grp?.name}
                groupColor={grp?.color}
                viewMode={viewMode}
                isSelected={selectedDocIds.has(doc.id)}
                onSelect={onSelect}
                onOpen={onOpen}
                onToggleFavorite={onToggleFavorite}
                onContextMenu={onContextMenu}
                onDirectPrint={onDirectPrint}
                onDownload={onDownload}
              />
            </div>
          );
        })}
      </div>
    );
  }

  // ============================================================================
  // 7. DETAIL / WIDE ROWS VIEW (عرض صفوف)
  // ============================================================================
  if (viewMode === 'detail') {
    return (
      <div className="space-y-2">
        {documents.map((doc) => {
          const isSelected = selectedDocIds.has(doc.id);
          const hasBack = doc.sidesCount === 2 && Boolean(doc.backImage);
          return (
            <div
              key={doc.id}
              onClick={(e) => onSelect(doc, e.ctrlKey || e.metaKey)}
              onDoubleClick={() => onOpen(doc)}
              onContextMenu={(e) => onContextMenu(e, doc)}
              className={`document-card-item group bg-white border rounded-lg px-3.5 py-2.5 flex items-center justify-between gap-4 cursor-pointer transition-all ${
                isSelected
                  ? 'border-blue-600 ring-2 ring-blue-600/20 bg-blue-50/30'
                  : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50/60'
              }`}
            >
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelect(doc, true);
                  }}
                  aria-label="تحديد"
                  className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 cursor-pointer ${
                    isSelected
                      ? 'bg-blue-600 border-blue-600 text-white'
                      : 'bg-white border-slate-300 text-transparent hover:border-blue-500'
                  }`}
                >
                  <Check className="w-2.5 h-2.5 stroke-[3]" />
                </button>

                <div className="flex items-center gap-1.5 shrink-0">
                  <div className="w-20 h-13 rounded bg-slate-100 border border-slate-200 p-0.5 flex items-center justify-center overflow-hidden">
                    <img
                      src={doc.frontImage}
                      alt={doc.title}
                      className="w-full h-full object-contain"
                      loading="lazy"
                    />
                  </div>
                  {hasBack && doc.backImage && (
                    <div className="w-20 h-13 rounded bg-slate-100 border border-slate-200 p-0.5 flex items-center justify-center overflow-hidden">
                      <img
                        src={doc.backImage}
                        alt={doc.title}
                        className="w-full h-full object-contain"
                        loading="lazy"
                      />
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <h3
                    className={`font-bold text-sm truncate ${
                      isSelected ? 'text-blue-700' : 'text-slate-900 group-hover:text-blue-600'
                    }`}
                  >
                    {doc.title}
                  </h3>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleFavorite(doc, e);
                    }}
                    aria-label="المفضلة"
                    className={`p-1 rounded transition-opacity cursor-pointer shrink-0 ${
                      doc.isFavorite
                        ? 'text-amber-500 opacity-100'
                        : isTablet
                        ? 'text-slate-400 opacity-100'
                        : 'text-slate-300 hover:text-amber-500 opacity-0 group-hover:opacity-100'
                    }`}
                  >
                    <Star className={`w-3.5 h-3.5 ${doc.isFavorite ? 'fill-amber-400' : ''}`} />
                  </button>
                </div>
              </div>

              <DocActionIcons
                doc={doc}
                onDirectPrint={onDirectPrint}
                onDownload={onDownload}
                onOpen={onOpen}
              />
            </div>
          );
        })}
      </div>
    );
  }

  // ============================================================================
  // 8. GROUPED VIEW (حسب المجموعة)
  // ============================================================================
  if (viewMode === 'grouped') {
    return (
      <div className="space-y-6">
        {groupedSections.map((sec) => (
          <section key={sec.id} className="space-y-3">
            <div className="flex items-center gap-2 pb-1.5 border-b border-slate-200">
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ backgroundColor: sec.color }}
              />
              <GroupIcon icon={sec.icon} className="w-4 h-4 text-slate-600" />
              <h3 className="text-xs font-bold text-slate-900">{sec.name}</h3>
              <span className="text-[11px] font-mono text-slate-400">({sec.docs.length})</span>
            </div>

            <div className={`grid ${gridColsClass} gap-3.5`}>
              {sec.docs.map((doc) => (
                <div key={doc.id} className="document-card-item flex">
                  <DocumentCard
                    document={doc}
                    cardSize={cardSize}
                    isSelected={selectedDocIds.has(doc.id)}
                    isMultiSelectMode={isMultiSelectMode}
                    onSelect={onSelect}
                    onOpen={onOpen}
                    onToggleFavorite={onToggleFavorite}
                    onContextMenu={onContextMenu}
                    onDirectPrint={onDirectPrint}
                    onDownload={onDownload}
                  />
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    );
  }

  // ============================================================================
  // 9. MAP VIEW (عرض خريطة المستمسكات التفاعلية)
  // ============================================================================
  if (viewMode === 'map') {
    return (
      <div
        className="relative w-full h-full min-h-[500px] studio-stage-grid border border-slate-200 rounded-xl overflow-hidden select-none"
        onWheel={(e) => {
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            setMapZoom((z) =>
              Math.max(0.55, Math.min(1.6, Number((z + (e.deltaY < 0 ? 0.1 : -0.1)).toFixed(2))))
            );
          }
        }}
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
        onPointerLeave={() => setIsPanning(false)}
      >
        {/* Floating Zoom Controls */}
        <div className="absolute top-3 left-3 z-20 flex items-center gap-1 bg-white/95 border border-slate-200 rounded-lg p-1 shadow-sm">
          <button
            type="button"
            onClick={() => setMapZoom((z) => Math.min(1.6, Number((z + 0.15).toFixed(2))))}
            aria-label="تكبير"
            className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded cursor-pointer"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => {
              setMapZoom(1);
              setMapPan({ x: 0, y: 0 });
            }}
            aria-label="إعادة ضبط"
            className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded cursor-pointer"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setMapZoom((z) => Math.max(0.55, Number((z - 0.15).toFixed(2))))}
            aria-label="تصغير"
            className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded cursor-pointer"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Interactive Map Surface */}
        <div
          style={{
            width: `${mapLayout.width}px`,
            height: `${mapLayout.height}px`,
            transform: `translate(calc(50% - ${mapLayout.width / 2}px + ${mapPan.x}px), calc(50% - ${
              mapLayout.height / 2
            }px + ${mapPan.y}px)) scale(${mapZoom})`,
            transformOrigin: 'center center',
          }}
          className={`relative transition-transform ${
            isPanning ? 'duration-0 cursor-grabbing' : 'duration-150 cursor-grab'
          }`}
        >
          {/* SVG Connection Edges */}
          <svg
            width={mapLayout.width}
            height={mapLayout.height}
            className="absolute inset-0 pointer-events-none"
          >
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

          {/* Center Vault Hub (when multiple clusters) */}
          {mapLayout.clusters.length > 1 && (
            <div
              style={{ left: `${mapLayout.cx}px`, top: `${mapLayout.cy}px` }}
              className="absolute -translate-x-1/2 -translate-y-1/2 px-4 py-2 rounded-full bg-slate-900 text-white text-xs font-bold shadow-md flex items-center gap-2 z-10"
            >
              <FolderOpen className="w-3.5 h-3.5 text-blue-400" />
              <span>الخزانة</span>
            </div>
          )}

          {/* Group Hubs & Document Nodes */}
          {mapLayout.clusters.map((cluster) => (
            <React.Fragment key={cluster.id}>
              <div
                style={{
                  left: `${cluster.x}px`,
                  top: `${cluster.y}px`,
                  borderColor: cluster.color,
                }}
                className="absolute -translate-x-1/2 -translate-y-1/2 px-3.5 py-1.5 rounded-full bg-white border-2 shadow-sm flex items-center gap-1.5 z-10"
              >
                <span
                  className="w-2.5 h-2.5 rounded-full"
                  style={{ backgroundColor: cluster.color }}
                />
                <span className="text-xs font-bold text-slate-900 whitespace-nowrap">
                  {cluster.name}
                </span>
              </div>

              {cluster.nodes.map(({ doc, x, y }) => {
                const isSelected = selectedDocIds.has(doc.id);
                return (
                  <div
                    key={doc.id}
                    style={{ left: `${x}px`, top: `${y}px` }}
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelect(doc, e.ctrlKey || e.metaKey);
                    }}
                    onDoubleClick={(e) => {
                      e.stopPropagation();
                      onOpen(doc);
                    }}
                    onContextMenu={(e) => onContextMenu(e, doc)}
                    className={`map-doc-node document-card-item absolute -translate-x-1/2 -translate-y-1/2 w-52 bg-white border rounded-xl overflow-hidden shadow-md transition-all cursor-pointer z-10 ${
                      isSelected
                        ? 'border-blue-600 ring-2 ring-blue-600/25 scale-[1.03]'
                        : 'border-slate-200 hover:border-blue-400 hover:shadow-lg'
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
                    <div className="px-2.5 py-2 flex items-center justify-between gap-1.5 bg-white">
                      <span className="text-xs font-bold text-slate-900 truncate flex-1">
                        {doc.title}
                      </span>
                      <DocActionIcons
                        doc={doc}
                        onDirectPrint={onDirectPrint}
                        onDownload={onDownload}
                        onOpen={onOpen}
                        compact
                      />
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
  // 10. CAROUSEL VIEW (شريط أفقي)
  // ============================================================================
  return (
    <div className="h-full flex flex-col justify-center relative">
      <div className="flex items-center justify-end gap-1.5 mb-3">
        <button
          type="button"
          onClick={() => carouselRef.current?.scrollBy({ left: 340, behavior: 'smooth' })}
          aria-label="السابق"
          className="p-1.5 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg text-slate-700 cursor-pointer shadow-2xs"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => carouselRef.current?.scrollBy({ left: -340, behavior: 'smooth' })}
          aria-label="التالي"
          className="p-1.5 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg text-slate-700 cursor-pointer shadow-2xs"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
      </div>

      <div
        ref={carouselRef}
        className="flex gap-4 overflow-x-auto pb-4 snap-x snap-mandatory items-stretch"
      >
        {documents.map((doc) => {
          const isSelected = selectedDocIds.has(doc.id);
          return (
            <div
              key={doc.id}
              onClick={(e) => onSelect(doc, e.ctrlKey || e.metaKey)}
              onDoubleClick={() => onOpen(doc)}
              onContextMenu={(e) => onContextMenu(e, doc)}
              className={`document-card-item snap-center w-72 sm:w-80 shrink-0 group bg-white border rounded-xl overflow-hidden cursor-pointer transition-all flex flex-col ${
                isSelected
                  ? 'border-blue-600 ring-2 ring-blue-600/20 shadow-md'
                  : 'border-slate-200 hover:border-slate-300 shadow-xs hover:shadow-md'
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
                  className={`absolute top-2.5 left-2.5 z-10 p-1 rounded border bg-white/95 transition-opacity cursor-pointer ${
                    doc.isFavorite
                      ? 'border-amber-200 text-amber-500 opacity-100'
                      : isTablet
                      ? 'border-slate-200 text-slate-400 opacity-100'
                      : 'border-slate-200 text-slate-400 hover:text-amber-500 opacity-0 group-hover:opacity-100'
                  }`}
                >
                  <Star className={`w-3.5 h-3.5 ${doc.isFavorite ? 'fill-amber-400' : ''}`} />
                </button>
                <img
                  src={getActiveImage(doc)}
                  alt={doc.title}
                  style={{ borderRadius: `${getCornerRadius(doc)}px` }}
                  className="max-w-full max-h-full object-contain bg-white border border-slate-300/80 shadow-xs"
                  loading="lazy"
                />
              </div>

              <div className="px-3.5 py-3 bg-white flex items-center justify-between gap-2">
                <h3
                  className={`font-bold text-sm truncate flex-1 ${
                    isSelected ? 'text-blue-700' : 'text-slate-900 group-hover:text-blue-600'
                  }`}
                >
                  {doc.title}
                </h3>
                <DocActionIcons
                  doc={doc}
                  onDirectPrint={onDirectPrint}
                  onDownload={onDownload}
                  onOpen={onOpen}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
