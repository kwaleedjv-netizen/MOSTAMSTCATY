import React from 'react';
import { Star, Printer, Download, Info } from 'lucide-react';
import { MostamsakDocument, ViewMode } from '../types';

interface DocumentListItemProps {
  document: MostamsakDocument;
  groupName?: string;
  groupColor?: string;
  viewMode: ViewMode;
  isSelected: boolean;
  onSelect: (doc: MostamsakDocument, isMulti: boolean) => void;
  onOpen: (doc: MostamsakDocument) => void;
  onToggleFavorite: (doc: MostamsakDocument, e: React.MouseEvent) => void;
  onContextMenu: (e: React.MouseEvent, doc: MostamsakDocument) => void;
  onDirectPrint?: (doc: MostamsakDocument) => void;
  onDownload?: (doc: MostamsakDocument) => void;
}

export const DocumentListItem: React.FC<DocumentListItemProps> = ({
  document,
  isSelected,
  onSelect,
  onOpen,
  onToggleFavorite,
  onContextMenu,
  onDirectPrint,
  onDownload,
}) => {
  const activeImage =
    document.coverFace === 'back' && document.backImage
      ? document.backImage
      : document.frontImage;

  return (
    <div
      onClick={(e) => onSelect(document, e.ctrlKey || e.metaKey)}
      onDoubleClick={() => onOpen(document)}
      onContextMenu={(e) => onContextMenu(e, document)}
      className={`group flex items-center justify-between px-3 py-2 transition-colors select-none cursor-pointer border-b border-slate-100 ${
        isSelected
          ? 'bg-blue-50/70 text-blue-900 border-b-blue-200'
          : 'bg-white hover:bg-slate-50 text-slate-800'
      }`}
    >
      {/* Thumbnail + Title Only */}
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <div className="relative w-12 h-8 rounded-xs bg-slate-100 border border-slate-200 overflow-hidden shrink-0 flex items-center justify-center p-0.5">
          <img src={activeImage} alt={document.title} className="w-full h-full object-contain" />
        </div>

        <div className="min-w-0 flex-1 flex items-center gap-2 text-right">
          <span
            className={`font-bold text-xs truncate ${
              isSelected ? 'text-blue-700' : 'text-slate-900 group-hover:text-blue-600'
            }`}
          >
            {document.title}
          </span>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleFavorite(document, e);
            }}
            aria-label="المفضلة"
            className={`p-0.5 rounded transition-opacity cursor-pointer shrink-0 ${
              document.isFavorite
                ? 'text-amber-500 opacity-100'
                : 'text-slate-300 hover:text-amber-500 opacity-0 group-hover:opacity-100'
            }`}
          >
            <Star className={`w-3.5 h-3.5 ${document.isFavorite ? 'fill-amber-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* Icon-Only Actions: Print, Download, Details */}
      <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
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
      </div>
    </div>
  );
};
