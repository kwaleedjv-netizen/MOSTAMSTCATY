import React from 'react';
import {
  Maximize2,
  CreditCard,
  LayoutGrid,
  Grid3x3,
  Images,
  List,
  Rows3,
  Folders,
  Network,
  GalleryHorizontalEnd,
} from 'lucide-react';
import { ViewMode } from '../types';

export interface ViewModeOption {
  id: ViewMode;
  label: string;
}

export const VIEW_MODES: ViewModeOption[] = [
  { id: 'single', label: 'عرض فردي' },
  { id: 'cards', label: 'عرض بطاقة' },
  { id: 'grid', label: 'عرض شبكي' },
  { id: 'compact', label: 'شبكة مصغرة' },
  { id: 'gallery', label: 'معرض الصور' },
  { id: 'list', label: 'عرض قائمة' },
  { id: 'detail', label: 'عرض صفوف' },
  { id: 'grouped', label: 'حسب المجموعة' },
  { id: 'map', label: 'عرض خريطة' },
  { id: 'carousel', label: 'شريط أفقي' },
];

export const ViewModeIcon: React.FC<{ mode: ViewMode; className?: string }> = ({
  mode,
  className = 'w-3.5 h-3.5',
}) => {
  switch (mode) {
    case 'single':
      return React.createElement(Maximize2, { className });
    case 'cards':
      return React.createElement(CreditCard, { className });
    case 'grid':
      return React.createElement(LayoutGrid, { className });
    case 'compact':
      return React.createElement(Grid3x3, { className });
    case 'gallery':
      return React.createElement(Images, { className });
    case 'list':
      return React.createElement(List, { className });
    case 'detail':
      return React.createElement(Rows3, { className });
    case 'grouped':
      return React.createElement(Folders, { className });
    case 'map':
      return React.createElement(Network, { className });
    case 'carousel':
      return React.createElement(GalleryHorizontalEnd, { className });
    default:
      return React.createElement(LayoutGrid, { className });
  }
};
