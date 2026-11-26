import React from 'react';
import {
  Star,
  Printer,
  Download,
  Info,
  Check,
  Shield,
  RotateCcw,
  Trash2,
} from 'lucide-react';
import { MostamsakDocument, CardSize } from '../types';
import { useLayoutMode } from '../hooks/useViewportMode';

interface DocumentCardProps {
  document: MostamsakDocument;
  groupName?: string;
  groupColor?: string;
  cardSize: CardSize;
  isSelected: boolean;
  isMultiSelectMode?: boolean;
  isTrashView?: boolean;
  onSelect: (doc: MostamsakDocument, isMulti: boolean) => void;
  onOpen: (doc: MostamsakDocument) => void;
  onEdit?: (doc: MostamsakDocument) => void;
  onToggleFavorite?: (doc: MostamsakDocument, e: React.MouseEvent) => void;
  onContextMenu: (e: React.MouseEvent, doc: MostamsakDocument) => void;
  onDirectPrint?: (doc: MostamsakDocument) => void;
  onDownload?: (doc: MostamsakDocument) => void;
  onRestore?: (docId: string) => void;
  onPermanentDelete?: (docId: string) => void;
}

export const DocumentCard: React.FC<DocumentCardProps> = ({
  document,
  cardSize,
  isSelected,
  isMultiSelectMode,
  isTrashView = false,
  onSelect,
  onOpen,
  onToggleFavorite,
  onContextMenu,
  onDirectPrint,
  onDownload,
  onRestore,
  onPermanentDelete,
}) => {
  const { isTablet } = useLayoutMode();
  const activeImage =
    document.coverFace === 'back' && document.backImage
      ? document.backImage
      : document.frontImage;

  const stageHeightClass =
    cardSize === 'small' ? 'h-36' : cardSize === 'large' ? 'h-56' : 'h-44';

  const cornerRadiusPx = Math.min(12, Math.max(3, (document.radiusMm || 2) * 1.5));

  return (
    <div
      onClick={(e) => onSelect(document, e.ctrlKey || e.metaKey)}
      onDoubleClick={() => onOpen(document)}
      onContextMenu={(e) => onContextMenu(e, document)}
      className={`group relative w-full bg-white border rounded-lg overflow-hidden transition-all duration-150 select-none cursor-pointer flex flex-col ${
        isSelected
          ? 'border-blue-600 ring-2 ring-blue-600/20 shadow-sm'
          : 'border-slate-200 hover:border-slate-300 shadow-2xs hover:shadow-sm'
      }`}
    >
      {/* Document Image Stage */}
      <div
        className={`relative w-full ${stageHeightClass} studio-stage-grid border-b border-slate-200/90 p-3.5 flex items-center justify-center overflow-hidden`}
      >
        {!isTrashView && (
          <>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onSelect(document, true);
              }}
              aria-label="تحديد"
              className={`absolute top-2.5 right-2.5 z-10 ${
                isTablet ? 'w-6 h-6' : 'w-5 h-5'
              } rounded border flex items-center justify-center transition-opacity cursor-pointer ${
                isSelected
                  ? 'bg-blue-600 border-blue-600 text-white opacity-100'
                  : isMultiSelectMode || isTablet
                  ? 'bg-white border-slate-300 text-transparent opacity-100 hover:border-blue-500'
                  : 'bg-white/95 border-slate-300 text-transparent opacity-0 group-hover:opacity-100 hover:border-blue-500'
              }`}
            >
              <Check className="w-3 h-3 stroke-[3]" />
            </button>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onToggleFavorite?.(document, e);
              }}
              aria-label="المفضلة"
              className={`absolute top-2.5 left-2.5 z-10 ${
                isTablet ? 'p-1.5' : 'p-1'
              } rounded border bg-white/95 transition-opacity cursor-pointer ${
                document.isFavorite
                  ? 'border-amber-200 text-amber-500 opacity-100'
                  : isTablet
                  ? 'border-slate-200 text-slate-400 opacity-100'
                  : 'border-slate-200 text-slate-400 hover:text-amber-500 opacity-0 group-hover:opacity-100'
              }`}
            >
              <Star className={`w-3.5 h-3.5 ${document.isFavorite ? 'fill-amber-400' : ''}`} />
            </button>
          </>
        )}

        <img
          src={activeImage}
          alt={document.title}
          className="max-w-full max-h-full w-auto h-auto object-contain bg-white border border-slate-300/80 shadow-xs select-none pointer-events-none"
          style={{ borderRadius: `${cornerRadiusPx}px` }}
          loading="lazy"
        />
      </div>

      {/* Title Only + Icon-Only Actions */}
      <div className="px-3 py-2.5 bg-white flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0 flex-1">
          <h3
            className={`font-bold text-[13px] leading-snug truncate transition-colors ${
              isSelected ? 'text-blue-700' : 'text-slate-900 group-hover:text-blue-600'
            }`}
          >
            {document.title}
          </h3>
          {document.isEncrypted && (
            <Shield className="w-3.5 h-3.5 text-slate-400 shrink-0" aria-label="مشفر" />
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
          {isTrashView ? (
            <>
              <button
                type="button"
                onClick={() => onRestore?.(document.id)}
                aria-label="استعادة"
                className="p-1.5 bg-white hover:bg-emerald-50 text-emerald-700 border border-slate-200 hover:border-emerald-300 rounded-md transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => onPermanentDelete?.(document.id)}
                aria-label="حذف نهائي"
                className="p-1.5 bg-white hover:bg-red-50 text-red-600 border border-red-200 rounded-md transition-colors cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => onDirectPrint?.(document)}
                aria-label="طباعة"
                className="p-1.5 bg-white hover:bg-blue-600 text-slate-700 hover:text-white border border-slate-200 hover:border-blue-600 rounded-md transition-colors cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => onDownload?.(document)}
                aria-label="تنزيل"
                className="p-1.5 bg-white hover:bg-emerald-600 text-slate-700 hover:text-white border border-slate-200 hover:border-emerald-600 rounded-md transition-colors cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => onOpen(document)}
                aria-label="تفاصيل"
                className="p-1.5 bg-white hover:bg-slate-900 text-slate-700 hover:text-white border border-slate-200 hover:border-slate-900 rounded-md transition-colors cursor-pointer"
              >
                <Info className="w-3.5 h-3.5" />
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
