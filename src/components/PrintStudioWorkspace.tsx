import React, { useState, useRef, useMemo, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  Printer,
  Download,
  RotateCw,
  Copy,
  Trash2,
  AlignLeft,
  AlignCenter,
  AlignRight,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Search,
  Lock,
  Unlock,
  FileDown,
  ImageDown,
  Eraser,
  SlidersHorizontal,
  Plus,
  X,
} from 'lucide-react';
import {
  PrintItem,
  PrintSheetSettings,
  MostamsakDocument,
} from '../types';
import { PAPER_PRESETS } from '../constants/presets';
import {
  getSheetDimensions,
  generateDuplexBackItems,
  exportToPdf,
  exportSheetToHighResImage,
  calculateNextPrintItemPosition,
  getPrintCornerRadiusMm,
  PageLayoutData,
} from '../services/printEngine';
import { useLayoutMode } from '../hooks/useViewportMode';

interface PrintStudioWorkspaceProps {
  documents: MostamsakDocument[];
  items: PrintItem[];
  setItems: React.Dispatch<React.SetStateAction<PrintItem[]>>;
  settings: PrintSheetSettings;
  setSettings: React.Dispatch<React.SetStateAction<PrintSheetSettings>>;
}

export const PrintStudioWorkspace: React.FC<PrintStudioWorkspaceProps> = ({
  documents,
  items,
  setItems,
  settings,
  setSettings,
}) => {
  const [activePageIndex, setActivePageIndex] = useState<0 | 1>(0);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [canvasZoom, setCanvasZoom] = useState<number>(0.85);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [pickerQuery, setPickerQuery] = useState<string>('');
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const { isMobile, isTablet, width: viewportWidth } = useLayoutMode();
  const [mobileTab, setMobileTab] = useState<'stage' | 'picker' | 'settings'>('stage');
  const [tabletDrawer, setTabletDrawer] = useState<'none' | 'picker' | 'settings'>('none');

  const isCompactTablet = isTablet && viewportWidth < 1024;

  const docsMap = useMemo(() => {
    const map = new Map<string, MostamsakDocument>();
    for (const d of documents) {
      map.set(d.id, d);
    }
    return map;
  }, [documents]);

  const filteredDocs = useMemo(() => {
    const q = pickerQuery.trim().toLowerCase();
    if (!q) return documents;
    return documents.filter(
      (d) => d.title.toLowerCase().includes(q) || d.typeName.toLowerCase().includes(q)
    );
  }, [documents, pickerQuery]);

  const hasTwoSidedDocument = useMemo(() => {
    return items.some((it) => {
      const doc = docsMap.get(it.documentId);
      return Boolean(doc && doc.sidesCount === 2 && doc.backImage);
    });
  }, [items, docsMap]);

  const { widthMm: sheetWidthMm, heightMm: sheetHeightMm } = getSheetDimensions(settings);
  const mmPx = 3.78 * canvasZoom;

  const getLinkedItems = useCallback(
    (targetId: string, list: PrintItem[]): PrintItem[] => {
      const target = list.find((it) => it.id === targetId);
      if (!target) return [];
      if (!settings.groupTwoSidedLock) return [target];

      if (target.groupId) {
        const byGroup = list.filter(
          (it) => it.groupId === target.groupId && it.pageIndex === target.pageIndex
        );
        if (byGroup.length > 1) return byGroup;
      }

      const doc = docsMap.get(target.documentId);
      if (doc && doc.sidesCount === 2 && doc.backImage) {
        const sameDoc = list.filter(
          (it) => it.documentId === target.documentId && it.pageIndex === target.pageIndex
        );
        if (sameDoc.length === 2 && sameDoc[0].face !== sameDoc[1].face) {
          return sameDoc;
        }
      }

      return [target];
    },
    [settings.groupTwoSidedLock, docsMap]
  );

  const handleDeleteItem = (id: string) => {
    setItems((prev) => prev.filter((it) => it.id !== id));
    if (selectedItemId === id) setSelectedItemId(null);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT') return;
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedItemId) {
        e.preventDefault();
        handleDeleteItem(selectedItemId);
      } else if (e.key === 'Escape' && selectedItemId) {
        setSelectedItemId(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedItemId]);

  const handleFitToScreen = useCallback(() => {
    if (!canvasContainerRef.current) return;
    const container = canvasContainerRef.current;
    const padding = isMobile ? 32 : 64;
    const availableWidth = Math.max(200, container.clientWidth - padding);
    const availableHeight = Math.max(200, container.clientHeight - padding);
    const naturalWidthPx = sheetWidthMm * 3.78;
    const naturalHeightPx = sheetHeightMm * 3.78;
    const zoomW = availableWidth / naturalWidthPx;
    const zoomH = availableHeight / naturalHeightPx;
    const fitZoom = Math.min(zoomW, zoomH, 1.35);
    setCanvasZoom(Math.max(0.32, Number(fitZoom.toFixed(2))));
  }, [sheetWidthMm, sheetHeightMm, isMobile]);

  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      handleFitToScreen();
    });
    return () => cancelAnimationFrame(raf);
  }, [handleFitToScreen, isMobile, isTablet, mobileTab, tabletDrawer, viewportWidth]);

  const handleAddDocumentToSheet = (
    doc: MostamsakDocument,
    faceMode: 'both' | 'front' | 'back' = 'both'
  ) => {
    const isTwoSides = doc.sidesCount === 2 && Boolean(doc.backImage);
    const shouldAddBoth = faceMode === 'both' && isTwoSides;

    const pos = calculateNextPrintItemPosition(
      items,
      doc.widthMm,
      doc.heightMm,
      shouldAddBoth,
      sheetWidthMm,
      sheetHeightMm,
      settings.marginsMm
    );

    const newItemsToAdd: PrintItem[] = [];

    if (shouldAddBoth) {
      const groupId = 'pair_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
      const frontItem: PrintItem = {
        id: 'item_' + Date.now() + '_front_' + Math.random().toString(36).substring(2, 6),
        documentId: doc.id,
        groupId,
        face: 'front',
        pageIndex: 0,
        xMm: pos.front.x,
        yMm: pos.front.y,
        widthMm: doc.widthMm,
        heightMm: doc.heightMm,
        rotation: 0,
        showBorder: false,
        showCutMarks: true,
        showLabel: true,
        label: `${doc.title} (${doc.frontLabel || 'الوجه الأمامي'})`,
      };
      newItemsToAdd.push(frontItem);

      if (pos.back) {
        const backItem: PrintItem = {
          id: 'item_' + Date.now() + '_back_' + Math.random().toString(36).substring(2, 6),
          documentId: doc.id,
          groupId,
          face: 'back',
          pageIndex: 0,
          xMm: pos.back.x,
          yMm: pos.back.y,
          widthMm: doc.widthMm,
          heightMm: doc.heightMm,
          rotation: 0,
          showBorder: false,
          showCutMarks: true,
          showLabel: true,
          label: `${doc.title} (${doc.backLabel || 'الوجه الخلفي'})`,
        };
        newItemsToAdd.push(backItem);
      }
      setSelectedItemId(frontItem.id);
    } else {
      const targetFace: 'front' | 'back' = faceMode === 'back' && doc.backImage ? 'back' : 'front';
      const singleItem: PrintItem = {
        id: 'item_' + Date.now() + '_' + targetFace + '_' + Math.random().toString(36).substring(2, 6),
        documentId: doc.id,
        face: targetFace,
        pageIndex: 0,
        xMm: pos.front.x,
        yMm: pos.front.y,
        widthMm: doc.widthMm,
        heightMm: doc.heightMm,
        rotation: 0,
        showBorder: false,
        showCutMarks: true,
        showLabel: true,
        label: `${doc.title} (${
          targetFace === 'front' ? doc.frontLabel || 'الوجه الأمامي' : doc.backLabel || 'الوجه الخلفي'
        })`,
      };
      newItemsToAdd.push(singleItem);
      setSelectedItemId(singleItem.id);
    }

    setItems((prev) => [...prev, ...newItemsToAdd]);
  };

  const handleDuplicateItem = (item: PrintItem) => {
    const newItem: PrintItem = {
      ...item,
      id: 'item_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      groupId: undefined,
      xMm: Math.min(item.xMm + 8, Math.max(0, sheetWidthMm - item.widthMm)),
      yMm: Math.min(item.yMm + 8, Math.max(0, sheetHeightMm - item.heightMm)),
    };
    setItems((prev) => [...prev, newItem]);
    setSelectedItemId(newItem.id);
  };

  const handleClearSheet = () => {
    if (items.length === 0) return;
    setItems([]);
    setSelectedItemId(null);
  };

  /**
   * Rotate item (and its linked partner if two-sided lock is active).
   * Preserves exact physical size (widthMm & heightMm swap cleanly without shrinking)
   * and rotates around each card's center while preventing overlap between paired cards.
   */
  const handleRotateItem = (id: string) => {
    setItems((prev) => {
      const linked = getLinkedItems(id, prev);
      if (linked.length === 0) return prev;
      const linkedIds = new Set(linked.map((it) => it.id));

      const rotateOne = (it: PrintItem): PrintItem => {
        const nextRotation = ((it.rotation + 90) % 360) as 0 | 90 | 180 | 270;
        const newW = it.heightMm;
        const newH = it.widthMm;
        const cx = it.xMm + it.widthMm / 2;
        const cy = it.yMm + it.heightMm / 2;
        const newX = Math.max(0, Math.min(sheetWidthMm - newW, cx - newW / 2));
        const newY = Math.max(0, Math.min(sheetHeightMm - newH, cy - newH / 2));
        return {
          ...it,
          rotation: nextRotation,
          widthMm: newW,
          heightMm: newH,
          xMm: Number(newX.toFixed(1)),
          yMm: Number(newY.toFixed(1)),
        };
      };

      const rotatedMap = new Map<string, PrintItem>();
      for (const it of linked) {
        rotatedMap.set(it.id, rotateOne(it));
      }

      // If 2 linked cards are rotated together, ensure they never overlap
      if (linked.length === 2) {
        const [origA, origB] = linked;
        const rA = rotatedMap.get(origA.id)!;
        const rB = rotatedMap.get(origB.id)!;

        const origCxA = origA.xMm + origA.widthMm / 2;
        const origCyA = origA.yMm + origA.heightMm / 2;
        const origCxB = origB.xMm + origB.widthMm / 2;
        const origCyB = origB.yMm + origB.heightMm / 2;

        const horizontalPair = Math.abs(origCxA - origCxB) >= Math.abs(origCyA - origCyB);
        const gap = 6;

        if (horizontalPair) {
          const [leftItem, rightItem] = origCxA <= origCxB ? [rA, rB] : [rB, rA];
          const midY = (leftItem.yMm + leftItem.heightMm / 2 + rightItem.yMm + rightItem.heightMm / 2) / 2;
          const alignedY = Math.max(0, Math.min(sheetHeightMm - Math.max(leftItem.heightMm, rightItem.heightMm), midY - leftItem.heightMm / 2));

          if (leftItem.widthMm + rightItem.widthMm + gap <= sheetWidthMm) {
            const totalW = leftItem.widthMm + rightItem.widthMm + gap;
            const currentMidX = (leftItem.xMm + leftItem.widthMm / 2 + rightItem.xMm + rightItem.widthMm / 2) / 2;
            const minRequiredDist = (leftItem.widthMm + rightItem.widthMm) / 2 + gap;
            const currentDist = (rightItem.xMm + rightItem.widthMm / 2) - (leftItem.xMm + leftItem.widthMm / 2);

            let lx = leftItem.xMm;
            let rx = rightItem.xMm;
            if (currentDist < minRequiredDist) {
              lx = currentMidX - totalW / 2;
              if (lx < 0) lx = 0;
              if (lx + totalW > sheetWidthMm) lx = Math.max(0, sheetWidthMm - totalW);
              rx = lx + leftItem.widthMm + gap;
            }
            rotatedMap.set(leftItem.id, {
              ...leftItem,
              xMm: Number(lx.toFixed(1)),
              yMm: Number(alignedY.toFixed(1)),
            });
            rotatedMap.set(rightItem.id, {
              ...rightItem,
              xMm: Number(rx.toFixed(1)),
              yMm: Number(alignedY.toFixed(1)),
            });
          } else {
            // Stack vertically if rotated pair is wider than sheet
            const midX = (leftItem.xMm + leftItem.widthMm / 2 + rightItem.xMm + rightItem.widthMm / 2) / 2;
            const sx = Math.max(0, Math.min(sheetWidthMm - leftItem.widthMm, midX - leftItem.widthMm / 2));
            const topY = Math.max(0, Math.min(sheetHeightMm - (leftItem.heightMm + rightItem.heightMm + 8), alignedY));
            rotatedMap.set(leftItem.id, {
              ...leftItem,
              xMm: Number(sx.toFixed(1)),
              yMm: Number(topY.toFixed(1)),
            });
            rotatedMap.set(rightItem.id, {
              ...rightItem,
              xMm: Number(sx.toFixed(1)),
              yMm: Number((topY + leftItem.heightMm + 8).toFixed(1)),
            });
          }
        } else {
          const [topItem, bottomItem] = origCyA <= origCyB ? [rA, rB] : [rB, rA];
          const midX = (topItem.xMm + topItem.widthMm / 2 + bottomItem.xMm + bottomItem.widthMm / 2) / 2;
          const alignedX = Math.max(0, Math.min(sheetWidthMm - Math.max(topItem.widthMm, bottomItem.widthMm), midX - topItem.widthMm / 2));
          const minRequiredDist = (topItem.heightMm + bottomItem.heightMm) / 2 + 8;
          const currentDist = (bottomItem.yMm + bottomItem.heightMm / 2) - (topItem.yMm + topItem.heightMm / 2);

          let ty = topItem.yMm;
          let by = bottomItem.yMm;
          if (currentDist < minRequiredDist) {
            const totalH = topItem.heightMm + bottomItem.heightMm + 8;
            const currentMidY = (topItem.yMm + topItem.heightMm / 2 + bottomItem.yMm + bottomItem.heightMm / 2) / 2;
            ty = currentMidY - totalH / 2;
            if (ty < 0) ty = 0;
            if (ty + totalH > sheetHeightMm) ty = Math.max(0, sheetHeightMm - totalH);
            by = ty + topItem.heightMm + 8;
          }
          rotatedMap.set(topItem.id, {
            ...topItem,
            xMm: Number(alignedX.toFixed(1)),
            yMm: Number(ty.toFixed(1)),
          });
          rotatedMap.set(bottomItem.id, {
            ...bottomItem,
            xMm: Number(alignedX.toFixed(1)),
            yMm: Number(by.toFixed(1)),
          });
        }
      }

      return prev.map((it) => (linkedIds.has(it.id) ? rotatedMap.get(it.id)! : it));
    });
  };

  const selectedItem = items.find((it) => it.id === selectedItemId);

  const selectedLinkedIds = useMemo(() => {
    if (!selectedItemId) return new Set<string>();
    return new Set(getLinkedItems(selectedItemId, items).map((it) => it.id));
  }, [selectedItemId, items, getLinkedItems]);

  const pages: PageLayoutData[] = useMemo(() => {
    if (settings.duplexMode === 'duplex_aligned') {
      const frontPageItems = items.filter((it) => it.pageIndex === 0);
      const backPageItems = generateDuplexBackItems(frontPageItems, sheetWidthMm, docsMap);
      return [
        { items: frontPageItems, pageIndex: 0, widthMm: sheetWidthMm, heightMm: sheetHeightMm },
        { items: backPageItems, pageIndex: 1, widthMm: sheetWidthMm, heightMm: sheetHeightMm },
      ];
    }
    return [{ items, pageIndex: 0, widthMm: sheetWidthMm, heightMm: sheetHeightMm }];
  }, [items, settings.duplexMode, sheetWidthMm, sheetHeightMm, docsMap]);

  const activePageItems = pages[activePageIndex]?.items || [];

  const [dragState, setDragState] = useState<{
    primaryId: string;
    startMouseX: number;
    startMouseY: number;
    startItems: Array<{
      id: string;
      xMm: number;
      yMm: number;
      widthMm: number;
      heightMm: number;
    }>;
  } | null>(null);

  const handlePointerDownItem = (e: React.PointerEvent, item: PrintItem) => {
    e.stopPropagation();
    setSelectedItemId(item.id);
    if (activePageIndex === 1 && settings.duplexMode === 'duplex_aligned') {
      return;
    }
    const linked = getLinkedItems(item.id, items);
    setDragState({
      primaryId: item.id,
      startMouseX: e.clientX,
      startMouseY: e.clientY,
      startItems: linked.map((it) => ({
        id: it.id,
        xMm: it.xMm,
        yMm: it.yMm,
        widthMm: it.widthMm,
        heightMm: it.heightMm,
      })),
    });
  };

  useEffect(() => {
    if (!dragState) return;
    const handlePointerMove = (e: PointerEvent) => {
      const rawDeltaX = (e.clientX - dragState.startMouseX) / mmPx;
      const rawDeltaY = (e.clientY - dragState.startMouseY) / mmPx;

      const minStartX = Math.min(...dragState.startItems.map((s) => s.xMm));
      const maxEndX = Math.max(...dragState.startItems.map((s) => s.xMm + s.widthMm));
      const minStartY = Math.min(...dragState.startItems.map((s) => s.yMm));
      const maxEndY = Math.max(...dragState.startItems.map((s) => s.yMm + s.heightMm));

      const minDx = -minStartX;
      const maxDx = sheetWidthMm - maxEndX;
      const minDy = -minStartY;
      const maxDy = sheetHeightMm - maxEndY;

      const primaryStart = dragState.startItems.find((s) => s.id === dragState.primaryId) || dragState.startItems[0];

      const snap = (v: number) => {
        if (!settings.gridSnapMm || settings.gridSnapMm <= 0) return Math.round(v * 10) / 10;
        const interval = Math.min(settings.gridSnapMm, 1);
        return Math.round(v / interval) * interval;
      };

      const clampedRawDx = Math.max(minDx, Math.min(maxDx, rawDeltaX));
      const clampedRawDy = Math.max(minDy, Math.min(maxDy, rawDeltaY));

      const snappedPrimaryX = snap(primaryStart.xMm + clampedRawDx);
      const snappedPrimaryY = snap(primaryStart.yMm + clampedRawDy);

      const finalDx = Math.max(minDx, Math.min(maxDx, snappedPrimaryX - primaryStart.xMm));
      const finalDy = Math.max(minDy, Math.min(maxDy, snappedPrimaryY - primaryStart.yMm));

      const startMap = new Map(dragState.startItems.map((s) => [s.id, s]));

      setItems((prev) =>
        prev.map((it) => {
          const s = startMap.get(it.id);
          if (!s) return it;
          return {
            ...it,
            xMm: Number((s.xMm + finalDx).toFixed(1)),
            yMm: Number((s.yMm + finalDy).toFixed(1)),
          };
        })
      );
    };

    const handlePointerUp = () => setDragState(null);
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerUp);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerUp);
    };
  }, [dragState, mmPx, settings.gridSnapMm, sheetWidthMm, sheetHeightMm, setItems]);

  const handleCanvasWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const zoomStep = 0.08;
    const direction = e.deltaY < 0 ? 1 : -1;
    setCanvasZoom((z) => Math.min(3.0, Math.max(0.3, Number((z + direction * zoomStep).toFixed(2)))));
  };

  /**
   * Align horizontally in the middle ("في الوسط") — keeps Y unchanged (NOT dead-center of the page).
   * When groupTwoSidedLock is ON, aligns the entire group bounding box together.
   */
  const alignHorizontalGroup = (mode: 'left' | 'middle' | 'right') => {
    if (!selectedItem) return;
    setItems((prev) => {
      const linked = getLinkedItems(selectedItem.id, prev);
      if (linked.length === 0) return prev;
      const linkedIds = new Set(linked.map((it) => it.id));
      const minX = Math.min(...linked.map((it) => it.xMm));
      const maxX = Math.max(...linked.map((it) => it.xMm + it.widthMm));
      const groupWidth = maxX - minX;

      let targetMinX = minX;
      if (mode === 'middle') {
        targetMinX = (sheetWidthMm - groupWidth) / 2;
      } else if (mode === 'right') {
        targetMinX = sheetWidthMm - groupWidth - settings.marginsMm;
      } else {
        targetMinX = settings.marginsMm;
      }
      targetMinX = Math.max(0, Math.min(sheetWidthMm - groupWidth, targetMinX));
      const dx = targetMinX - minX;

      return prev.map((it) =>
        linkedIds.has(it.id) ? { ...it, xMm: Number((it.xMm + dx).toFixed(1)) } : it
      );
    });
  };

  const alignCenter = () => alignHorizontalGroup('middle');
  const alignRight = () => alignHorizontalGroup('right');
  const alignLeft = () => alignHorizontalGroup('left');

  const updateSelectedAxis = (axis: 'x' | 'y', rawValue: number) => {
    if (!selectedItem) return;
    const val = isNaN(rawValue) ? 0 : rawValue;
    setItems((prev) => {
      const linked = getLinkedItems(selectedItem.id, prev);
      const current = linked.find((it) => it.id === selectedItem.id);
      if (!current) return prev;
      const linkedIds = new Set(linked.map((it) => it.id));

      if (axis === 'x') {
        const minX = Math.min(...linked.map((it) => it.xMm));
        const maxEndX = Math.max(...linked.map((it) => it.xMm + it.widthMm));
        const minDx = -minX;
        const maxDx = sheetWidthMm - maxEndX;
        const dx = Math.max(minDx, Math.min(maxDx, val - current.xMm));
        return prev.map((it) =>
          linkedIds.has(it.id) ? { ...it, xMm: Number((it.xMm + dx).toFixed(1)) } : it
        );
      } else {
        const minY = Math.min(...linked.map((it) => it.yMm));
        const maxEndY = Math.max(...linked.map((it) => it.yMm + it.heightMm));
        const minDy = -minY;
        const maxDy = sheetHeightMm - maxEndY;
        const dy = Math.max(minDy, Math.min(maxDy, val - current.yMm));
        return prev.map((it) =>
          linkedIds.has(it.id) ? { ...it, yMm: Number((it.yMm + dy).toFixed(1)) } : it
        );
      }
    });
  };

  const handleExportPdf = async () => {
    setIsExporting(true);
    try {
      await exportToPdf(pages, settings, docsMap);
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportImage = async () => {
    setIsExporting(true);
    try {
      const dataUrl = await exportSheetToHighResImage(
        pages[activePageIndex],
        settings,
        docsMap,
        settings.targetDpi,
        'png'
      );
      const link = document.createElement('a');
      link.download = `MOSTAMSAKATI_Page_${activePageIndex + 1}_${settings.targetDpi}DPI.png`;
      link.href = dataUrl;
      link.click();
    } finally {
      setIsExporting(false);
    }
  };

  const canvasWidthPx = sheetWidthMm * mmPx;
  const canvasHeightPx = sheetHeightMm * mmPx;

  const renderPaperStageContent = (touchOptimized: boolean) => (
    <div
      className="bg-white relative select-none border border-slate-300 shadow-lg shrink-0"
      style={{
        width: `${canvasWidthPx}px`,
        height: `${canvasHeightPx}px`,
        backgroundImage: settings.showGrid
          ? `radial-gradient(circle, #cbd5e1 1px, transparent 1px)`
          : 'none',
        backgroundSize: `${(settings.gridSnapMm || 5) * mmPx}px ${
          (settings.gridSnapMm || 5) * mmPx
        }px`,
      }}
    >
      {settings.marginsMm > 0 && (
        <div
          className="absolute border border-dashed border-slate-300 pointer-events-none"
          style={{
            top: `${settings.marginsMm * mmPx}px`,
            left: `${settings.marginsMm * mmPx}px`,
            right: `${settings.marginsMm * mmPx}px`,
            bottom: `${settings.marginsMm * mmPx}px`,
          }}
        />
      )}

      {activePageItems.map((item) => {
        const doc = docsMap.get(item.documentId);
        if (!doc) return null;
        const isSelected = item.id === selectedItemId;
        const isPartnerLinked = !isSelected && selectedLinkedIds.has(item.id);
        const imageSrc =
          item.face === 'back' && doc.backImage ? doc.backImage : doc.frontImage;
        const isQuarterTurn = item.rotation === 90 || item.rotation === 270;
        const innerW = (isQuarterTurn ? item.heightMm : item.widthMm) * mmPx;
        const innerH = (isQuarterTurn ? item.widthMm : item.heightMm) * mmPx;
        const radiusPx = getPrintCornerRadiusMm(doc, item.widthMm, item.heightMm) * mmPx;
        const isDragging = Boolean(dragState?.startItems.some((s) => s.id === item.id));

        return (
          <div
            key={item.id}
            onPointerDown={(e) => handlePointerDownItem(e, item)}
            onClick={(e) => e.stopPropagation()}
            style={{
              left: `${item.xMm * mmPx}px`,
              top: `${item.yMm * mmPx}px`,
              width: `${item.widthMm * mmPx}px`,
              height: `${item.heightMm * mmPx}px`,
              borderRadius: `${radiusPx}px`,
            }}
            className={`absolute select-none touch-none ${
              isDragging
                ? 'cursor-grabbing ring-2 ring-blue-600 z-40 shadow-lg'
                : isSelected
                ? 'cursor-grab ring-2 ring-blue-600 z-30 shadow-md'
                : isPartnerLinked
                ? 'cursor-grab ring-2 ring-blue-400/80 ring-dashed z-20 shadow-sm'
                : 'cursor-grab hover:ring-1 hover:ring-slate-400 z-10'
            }`}
          >
            {!isMobile && isSelected && (
              <div
                className={`absolute ${
                  touchOptimized ? '-top-10' : '-top-8'
                } left-1/2 -translate-x-1/2 bg-slate-900 text-white rounded-md px-1.5 py-0.5 flex items-center gap-1 shadow-md z-40`}
                onPointerDown={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
              >
                <button
                  type="button"
                  onClick={() => handleRotateItem(item.id)}
                  className={`${touchOptimized ? 'p-1.5' : 'p-1'} hover:bg-white/15 rounded cursor-pointer`}
                  title="تدوير 90°"
                >
                  <RotateCw className={touchOptimized ? 'w-3.5 h-3.5' : 'w-3 h-3'} />
                </button>
                <button
                  type="button"
                  onClick={() => handleDuplicateItem(item)}
                  className={`${touchOptimized ? 'p-1.5' : 'p-1'} hover:bg-white/15 rounded cursor-pointer`}
                  title="تكرار"
                >
                  <Copy className={touchOptimized ? 'w-3.5 h-3.5' : 'w-3 h-3'} />
                </button>
                <div className="w-px h-3 bg-white/25" />
                <button
                  type="button"
                  onClick={() => handleDeleteItem(item.id)}
                  className={`${touchOptimized ? 'p-1.5' : 'p-1'} hover:bg-red-600 rounded cursor-pointer`}
                  title="حذف من الورقة"
                >
                  <Trash2 className={touchOptimized ? 'w-3.5 h-3.5' : 'w-3 h-3'} />
                </button>
              </div>
            )}

            {isPartnerLinked && settings.groupTwoSidedLock && (
              <div className="absolute -top-2.5 right-1.5 bg-blue-600 text-white rounded-full p-0.5 shadow-xs z-30 pointer-events-none">
                <Lock className="w-2.5 h-2.5" />
              </div>
            )}

            <div
              className="w-full h-full overflow-hidden relative pointer-events-none"
              style={{ borderRadius: `${radiusPx}px` }}
            >
              <img
                src={imageSrc}
                alt={item.label}
                className="object-contain pointer-events-none max-w-none max-h-none"
                style={{
                  position: 'absolute',
                  left: '50%',
                  top: '50%',
                  width: `${innerW}px`,
                  height: `${innerH}px`,
                  maxWidth: 'none',
                  maxHeight: 'none',
                  borderRadius: `${radiusPx}px`,
                  transform: `translate(-50%, -50%) rotate(${item.rotation}deg)`,
                }}
              />
            </div>

            {settings.showCutMarksAll && (
              <>
                <div className="absolute -top-1.5 -left-1.5 w-3 h-3 border-t-2 border-l-2 border-slate-700 pointer-events-none" />
                <div className="absolute -top-1.5 -right-1.5 w-3 h-3 border-t-2 border-r-2 border-slate-700 pointer-events-none" />
                <div className="absolute -bottom-1.5 -left-1.5 w-3 h-3 border-b-2 border-l-2 border-slate-700 pointer-events-none" />
                <div className="absolute -bottom-1.5 -right-1.5 w-3 h-3 border-b-2 border-r-2 border-slate-700 pointer-events-none" />
              </>
            )}

            {settings.showLabelsAll && item.label && (
              <div className="absolute -bottom-4 left-0 right-0 text-center text-[9px] font-medium text-slate-600 truncate pointer-events-none">
                {item.label}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );

  const renderGroupLockButton = (touchSized: boolean) => {
    if (!hasTwoSidedDocument) return null;
    return (
      <label className={`${touchSized ? 'min-h-[38px]' : ''} flex items-center gap-2 cursor-pointer`}>
        <input
          type="checkbox"
          checked={settings.groupTwoSidedLock}
          onChange={(e) =>
            setSettings((prev) => ({
              ...prev,
              groupTwoSidedLock: e.target.checked,
            }))
          }
          className="rounded accent-blue-600"
        />
        <span>قفل الوجه والظهر كمجموعة</span>
      </label>
    );
  };

  const renderPickerList = (touchSized: boolean, onAfterAdd?: () => void) => (
    <>
      <div className="p-3 border-b border-slate-200 space-y-2 shrink-0 bg-white">
        <div className="flex items-center justify-between text-[11px] font-bold text-slate-700">
          <span>إضافة للورقة</span>
          <span className="font-mono tabular-nums text-slate-500">{filteredDocs.length}</span>
        </div>
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={pickerQuery}
            onChange={(e) => setPickerQuery(e.target.value)}
            placeholder="تصفية المستمسكات..."
            className={`w-full bg-slate-50 border border-slate-300 ${
              touchSized ? 'min-h-[40px] rounded-xl pr-9 pl-3' : 'rounded-md pr-8 pl-2.5 py-1.5'
            } text-xs text-slate-900 focus:border-blue-600 focus:outline-none`}
          />
        </div>
      </div>

      <div className={`flex-1 overflow-y-auto ${touchSized ? 'p-3 space-y-2' : 'divide-y divide-slate-200/80'}`}>
        {filteredDocs.map((doc) => {
          const isTwoSides = doc.sidesCount === 2 && Boolean(doc.backImage);
          return (
            <div
              key={doc.id}
              className={
                touchSized
                  ? 'bg-white border border-slate-200 rounded-2xl p-3 space-y-2.5'
                  : 'p-3 hover:bg-white transition-colors space-y-2'
              }
            >
              <div className="min-w-0">
                <div className="font-bold text-xs text-slate-900 truncate">{doc.title}</div>
                <div
                  className="text-[11px] font-mono tabular-nums text-slate-500 mt-0.5"
                  dir="ltr"
                >
                  {doc.widthMm} × {doc.heightMm} mm {isTwoSides ? '· 2 sides' : ''}
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    handleAddDocumentToSheet(doc, 'both');
                    onAfterAdd?.();
                  }}
                  className={
                    touchSized
                      ? 'flex-1 min-h-[40px] px-3 bg-blue-600 active:bg-blue-700 text-white rounded-xl text-xs font-bold cursor-pointer'
                      : 'flex-1 py-1.5 px-2 bg-white hover:bg-blue-600 text-slate-800 hover:text-white border border-slate-300 hover:border-blue-600 rounded-md text-[11px] font-semibold transition-colors cursor-pointer whitespace-nowrap'
                  }
                >
                  {isTwoSides ? '+ إضافة الوجهين' : '+ إضافة للورقة'}
                </button>
                {isTwoSides && (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        handleAddDocumentToSheet(doc, 'front');
                        onAfterAdd?.();
                      }}
                      className={
                        touchSized
                          ? 'min-h-[40px] px-3 bg-slate-100 text-slate-800 rounded-xl text-xs font-semibold cursor-pointer'
                          : 'py-1.5 px-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-md text-[11px] font-medium cursor-pointer'
                      }
                      title="إضافة الوجه الأمامي فقط"
                    >
                      أمامي
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        handleAddDocumentToSheet(doc, 'back');
                        onAfterAdd?.();
                      }}
                      className={
                        touchSized
                          ? 'min-h-[40px] px-3 bg-slate-100 text-slate-800 rounded-xl text-xs font-semibold cursor-pointer'
                          : 'py-1.5 px-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-md text-[11px] font-medium cursor-pointer'
                      }
                      title="إضافة الوجه الخلفي فقط"
                    >
                      خلفي
                    </button>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );

  const renderSettingsAndSelected = (touchSized: boolean) => (
    <div className={`space-y-4 text-xs ${touchSized ? '' : ''}`}>
      <div className={touchSized ? 'bg-white border border-slate-200 rounded-2xl p-3.5 space-y-3' : 'space-y-3'}>
        <div className={touchSized ? 'font-bold text-slate-900' : 'text-[11px] font-bold text-slate-700'}>
          إعدادات الورقة
        </div>

        <div>
          <label className="block text-[11px] text-slate-600 mb-1">قياس الورقة</label>
          <select
            value={settings.paperId}
            onChange={(e) => setSettings({ ...settings, paperId: e.target.value })}
            className={`w-full border border-slate-300 font-mono text-slate-800 focus:border-blue-600 focus:outline-none cursor-pointer ${
              touchSized
                ? 'min-h-[42px] bg-slate-50 rounded-xl px-3 text-xs'
                : 'bg-white rounded-md px-2.5 py-1.5 text-xs'
            }`}
          >
            {PAPER_PRESETS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>

        {settings.paperId === 'custom' && (
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[10px] text-slate-500 mb-1">العرض (mm)</label>
              <input
                type="number"
                value={settings.customWidthMm}
                onChange={(e) => setSettings({ ...settings, customWidthMm: Number(e.target.value) || 210 })}
                className={`w-full border border-slate-300 font-mono tabular-nums text-slate-800 focus:border-blue-600 focus:outline-none ${
                  touchSized ? 'min-h-[40px] bg-slate-50 rounded-xl px-2' : 'bg-white rounded px-2 py-1'
                }`}
              />
            </div>
            <div>
              <label className="block text-[10px] text-slate-500 mb-1">الارتفاع (mm)</label>
              <input
                type="number"
                value={settings.customHeightMm}
                onChange={(e) => setSettings({ ...settings, customHeightMm: Number(e.target.value) || 297 })}
                className={`w-full border border-slate-300 font-mono tabular-nums text-slate-800 focus:border-blue-600 focus:outline-none ${
                  touchSized ? 'min-h-[40px] bg-slate-50 rounded-xl px-2' : 'bg-white rounded px-2 py-1'
                }`}
              />
            </div>
          </div>
        )}

        <div>
          {!touchSized && <label className="block text-[11px] text-slate-600 mb-1">الاتجاه</label>}
          <div
            className={
              touchSized
                ? 'grid grid-cols-2 gap-2'
                : 'grid grid-cols-2 gap-1 p-0.5 bg-slate-200/70 rounded-md border border-slate-200'
            }
          >
            <button
              type="button"
              onClick={() => setSettings({ ...settings, orientation: 'portrait' })}
              className={
                touchSized
                  ? `min-h-[42px] rounded-xl font-bold border cursor-pointer ${
                      settings.orientation === 'portrait'
                        ? 'bg-blue-50 border-blue-600 text-blue-700'
                        : 'bg-slate-50 border-slate-200 text-slate-700'
                    }`
                  : `py-1.5 rounded text-xs font-semibold cursor-pointer transition-colors ${
                      settings.orientation === 'portrait'
                        ? 'bg-white text-slate-900 shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`
              }
            >
              {touchSized ? 'ورقة عمودية' : 'عمودي'}
            </button>
            <button
              type="button"
              onClick={() => setSettings({ ...settings, orientation: 'landscape' })}
              className={
                touchSized
                  ? `min-h-[42px] rounded-xl font-bold border cursor-pointer ${
                      settings.orientation === 'landscape'
                        ? 'bg-blue-50 border-blue-600 text-blue-700'
                        : 'bg-slate-50 border-slate-200 text-slate-700'
                    }`
                  : `py-1.5 rounded text-xs font-semibold cursor-pointer transition-colors ${
                      settings.orientation === 'landscape'
                        ? 'bg-white text-slate-900 shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`
              }
            >
              {touchSized ? 'ورقة أفقية' : 'أفقي'}
            </button>
          </div>
        </div>

        <div>
          <label className="block text-[11px] text-slate-600 mb-1">نمط الطباعة</label>
          <select
            value={settings.duplexMode}
            onChange={(e) => setSettings({ ...settings, duplexMode: e.target.value as any })}
            className={`w-full border border-slate-300 text-slate-800 focus:border-blue-600 focus:outline-none cursor-pointer ${
              touchSized ? 'min-h-[42px] bg-slate-50 rounded-xl px-3 text-xs' : 'bg-white rounded-md px-2.5 py-1.5 text-xs'
            }`}
          >
            <option value="single">صفحة واحدة</option>
            <option value="duplex_aligned">وجهين متطابق (Duplex)</option>
          </select>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-[10px] text-slate-500 mb-1">الهوامش (mm)</label>
            <input
              type="number"
              value={settings.marginsMm}
              onChange={(e) =>
                setSettings({ ...settings, marginsMm: Math.max(0, Number(e.target.value) || 0) })
              }
              className={`w-full border border-slate-300 font-mono tabular-nums text-slate-800 focus:border-blue-600 focus:outline-none ${
                touchSized ? 'min-h-[40px] bg-slate-50 rounded-xl px-2' : 'bg-white rounded px-2 py-1'
              }`}
            />
          </div>
          <div>
            <label className="block text-[10px] text-slate-500 mb-1">الشبكة (mm)</label>
            <input
              type="number"
              value={settings.gridSnapMm}
              onChange={(e) =>
                setSettings({ ...settings, gridSnapMm: Math.max(0, Number(e.target.value) || 0) })
              }
              className={`w-full border border-slate-300 font-mono tabular-nums text-slate-800 focus:border-blue-600 focus:outline-none ${
                touchSized ? 'min-h-[40px] bg-slate-50 rounded-xl px-2' : 'bg-white rounded px-2 py-1'
              }`}
            />
          </div>
        </div>

        <div className="space-y-1.5 pt-1 text-slate-700">
          <label className={`${touchSized ? 'min-h-[38px]' : ''} flex items-center gap-2 cursor-pointer`}>
            <input
              type="checkbox"
              checked={settings.showGrid}
              onChange={(e) => setSettings({ ...settings, showGrid: e.target.checked })}
              className="rounded accent-blue-600"
            />
            <span>إظهار شبكة المحاذاة</span>
          </label>
          <label className={`${touchSized ? 'min-h-[38px]' : ''} flex items-center gap-2 cursor-pointer`}>
            <input
              type="checkbox"
              checked={settings.showCutMarksAll}
              onChange={(e) => setSettings({ ...settings, showCutMarksAll: e.target.checked })}
              className="rounded accent-blue-600"
            />
            <span>إظهار علامات القص</span>
          </label>
          <label className={`${touchSized ? 'min-h-[38px]' : ''} flex items-center gap-2 cursor-pointer`}>
            <input
              type="checkbox"
              checked={settings.showLabelsAll}
              onChange={(e) => setSettings({ ...settings, showLabelsAll: e.target.checked })}
              className="rounded accent-blue-600"
            />
            <span>إظهار أسماء المستمسكات</span>
          </label>

          {renderGroupLockButton(touchSized)}
        </div>
      </div>

      {selectedItem && (
        <>
          {!touchSized && <div className="border-t border-slate-200" />}
          <div className={touchSized ? 'bg-white border border-slate-200 rounded-2xl p-3.5 space-y-3' : 'space-y-3'}>
            <div className="flex items-center justify-between">
              <span className={touchSized ? 'font-bold text-slate-900' : 'text-[11px] font-bold text-slate-700'}>
                العنصر المحدد
              </span>
              <span className="font-mono tabular-nums text-[11px] text-slate-600" dir="ltr">
                {selectedItem.widthMm} × {selectedItem.heightMm} mm
              </span>
            </div>

            <div className="text-xs font-semibold text-slate-900 truncate">
              {selectedItem.label}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] text-slate-500 mb-1">X (mm)</label>
                <input
                  type="number"
                  step="0.5"
                  value={selectedItem.xMm}
                  onChange={(e) => updateSelectedAxis('x', parseFloat(e.target.value) || 0)}
                  className={`w-full border border-slate-300 font-mono tabular-nums text-slate-800 focus:border-blue-600 focus:outline-none ${
                    touchSized ? 'min-h-[40px] bg-slate-50 rounded-xl px-2' : 'bg-white rounded px-2 py-1'
                  }`}
                />
              </div>
              <div>
                <label className="block text-[10px] text-slate-500 mb-1">Y (mm)</label>
                <input
                  type="number"
                  step="0.5"
                  value={selectedItem.yMm}
                  onChange={(e) => updateSelectedAxis('y', parseFloat(e.target.value) || 0)}
                  className={`w-full border border-slate-300 font-mono tabular-nums text-slate-800 focus:border-blue-600 focus:outline-none ${
                    touchSized ? 'min-h-[40px] bg-slate-50 rounded-xl px-2' : 'bg-white rounded px-2 py-1'
                  }`}
                />
              </div>
            </div>

            <div>
              <span className="block text-[10px] text-slate-500 mb-1">المحاذاة الأفقية</span>
              <div className="grid grid-cols-3 gap-1.5">
                <button
                  type="button"
                  onClick={alignRight}
                  className={`${
                    touchSized ? 'min-h-[42px] bg-slate-100 rounded-xl' : 'py-1.5 bg-white hover:bg-slate-100 rounded border border-slate-300'
                  } text-slate-700 flex items-center justify-center cursor-pointer`}
                  title="محاذاة يمين"
                >
                  <AlignRight className={touchSized ? 'w-4 h-4' : 'w-3.5 h-3.5'} />
                </button>
                <button
                  type="button"
                  onClick={alignCenter}
                  className={`${
                    touchSized ? 'min-h-[42px] bg-slate-100 rounded-xl' : 'py-1.5 bg-white hover:bg-slate-100 rounded border border-slate-300'
                  } text-slate-700 flex items-center justify-center cursor-pointer`}
                  title="محاذاة في الوسط"
                >
                  <AlignCenter className={touchSized ? 'w-4 h-4' : 'w-3.5 h-3.5'} />
                </button>
                <button
                  type="button"
                  onClick={alignLeft}
                  className={`${
                    touchSized ? 'min-h-[42px] bg-slate-100 rounded-xl' : 'py-1.5 bg-white hover:bg-slate-100 rounded border border-slate-300'
                  } text-slate-700 flex items-center justify-center cursor-pointer`}
                  title="محاذاة يسار"
                >
                  <AlignLeft className={touchSized ? 'w-4 h-4' : 'w-3.5 h-3.5'} />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-1.5">
              <button
                type="button"
                onClick={() => handleRotateItem(selectedItem.id)}
                className={`${
                  touchSized ? 'min-h-[42px] bg-slate-100 rounded-xl' : 'py-1.5 bg-white hover:bg-slate-100 rounded border border-slate-300'
                } text-slate-700 flex items-center justify-center gap-1 cursor-pointer`}
                title="تدوير 90° (بدون تغيير الحجم)"
              >
                <RotateCw className={touchSized ? 'w-4 h-4' : 'w-3.5 h-3.5'} />
                {touchSized && <span className="text-[11px] font-semibold">تدوير</span>}
              </button>
              <button
                type="button"
                onClick={() => handleDuplicateItem(selectedItem)}
                className={`${
                  touchSized ? 'min-h-[42px] bg-slate-100 rounded-xl' : 'py-1.5 bg-white hover:bg-slate-100 rounded border border-slate-300'
                } text-slate-700 flex items-center justify-center gap-1 cursor-pointer`}
                title="تكرار"
              >
                <Copy className={touchSized ? 'w-4 h-4' : 'w-3.5 h-3.5'} />
                {touchSized && <span className="text-[11px] font-semibold">تكرار</span>}
              </button>
              <button
                type="button"
                onClick={() => handleDeleteItem(selectedItem.id)}
                className={`${
                  touchSized ? 'min-h-[42px] bg-red-50 rounded-xl border border-red-200' : 'py-1.5 bg-white hover:bg-red-50 rounded border border-red-200'
                } text-red-600 flex items-center justify-center gap-1 cursor-pointer`}
                title="حذف"
              >
                <Trash2 className={touchSized ? 'w-4 h-4' : 'w-3.5 h-3.5'} />
                {touchSized && <span className="text-[11px] font-semibold">حذف</span>}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );

  return (
    <>
      {isMobile ? (
        <div className="flex-1 min-h-0 flex flex-col bg-white overflow-hidden select-none">
          {/* Mobile Action Bar: 8 Icon Buttons (Sheet Export/Print + Item Rotate/Duplicate/Lock/Delete) */}
          <div className="bg-slate-50 border-b border-slate-200 px-3 py-2 shrink-0">
            <div className="grid grid-cols-8 gap-1.5 w-full">
              <button
                type="button"
                onClick={handleClearSheet}
                disabled={items.length === 0}
                title="إفراغ الورقة"
                aria-label="إفراغ الورقة"
                className="h-9 bg-white active:bg-red-50 border border-slate-200 disabled:opacity-40 text-red-600 rounded-lg flex items-center justify-center cursor-pointer transition-colors"
              >
                <Eraser className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={handleExportImage}
                disabled={isExporting || items.length === 0}
                title="تصدير صورة PNG"
                aria-label="تصدير صورة PNG"
                className="h-9 bg-white active:bg-slate-100 border border-slate-200 disabled:opacity-40 text-slate-700 rounded-lg flex items-center justify-center cursor-pointer transition-colors"
              >
                <ImageDown className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={handleExportPdf}
                disabled={isExporting || items.length === 0}
                title="تصدير PDF"
                aria-label="تصدير PDF"
                className="h-9 bg-white active:bg-slate-100 border border-slate-200 disabled:opacity-40 text-slate-700 rounded-lg flex items-center justify-center cursor-pointer transition-colors"
              >
                <FileDown className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                disabled={items.length === 0}
                title="طباعة فورية"
                aria-label="طباعة فورية"
                className="h-9 bg-blue-600 active:bg-blue-700 disabled:opacity-40 text-white rounded-lg flex items-center justify-center cursor-pointer transition-colors shadow-2xs"
              >
                <Printer className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => selectedItem && handleRotateItem(selectedItem.id)}
                disabled={!selectedItem}
                title="تدوير 90°"
                aria-label="تدوير 90°"
                className="h-9 bg-white active:bg-slate-100 border border-slate-200 disabled:opacity-40 text-slate-700 rounded-lg flex items-center justify-center cursor-pointer transition-colors"
              >
                <RotateCw className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => selectedItem && handleDuplicateItem(selectedItem)}
                disabled={!selectedItem}
                title="تكرار"
                aria-label="تكرار"
                className="h-9 bg-white active:bg-slate-100 border border-slate-200 disabled:opacity-40 text-slate-700 rounded-lg flex items-center justify-center cursor-pointer transition-colors"
              >
                <Copy className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() =>
                  setSettings((prev) => ({
                    ...prev,
                    groupTwoSidedLock: !prev.groupTwoSidedLock,
                  }))
                }
                title={settings.groupTwoSidedLock ? 'فك قفل المجموعة' : 'قفل الوجه والظهر كمجموعة'}
                aria-label="قفل الوجه والظهر كمجموعة"
                aria-pressed={settings.groupTwoSidedLock}
                className={`h-9 rounded-lg border flex items-center justify-center cursor-pointer transition-colors ${
                  settings.groupTwoSidedLock
                    ? 'bg-blue-50 border-blue-300 text-blue-700'
                    : 'bg-white border-slate-200 text-slate-600 active:bg-slate-100'
                }`}
              >
                {settings.groupTwoSidedLock ? (
                  <Lock className="w-4 h-4" />
                ) : (
                  <Unlock className="w-4 h-4" />
                )}
              </button>
              <button
                type="button"
                onClick={() => selectedItem && handleDeleteItem(selectedItem.id)}
                disabled={!selectedItem}
                title="حذف من الورقة"
                aria-label="حذف من الورقة"
                className="h-9 bg-white active:bg-red-50 border border-red-200 disabled:opacity-40 text-red-600 rounded-lg flex items-center justify-center cursor-pointer transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Mobile 3-Tab Switcher */}
          <div className="px-3 py-1.5 bg-white border-b border-slate-200 grid grid-cols-3 gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => setMobileTab('stage')}
              className={`min-h-[38px] rounded-xl text-xs font-bold cursor-pointer ${
                mobileTab === 'stage' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-700'
              }`}
            >
              الورقة ({items.length})
            </button>
            <button
              type="button"
              onClick={() => setMobileTab('picker')}
              className={`min-h-[38px] rounded-xl text-xs font-bold cursor-pointer ${
                mobileTab === 'picker' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-700'
              }`}
            >
              + إضافة مستمسك
            </button>
            <button
              type="button"
              onClick={() => setMobileTab('settings')}
              className={`min-h-[38px] rounded-xl text-xs font-bold cursor-pointer ${
                mobileTab === 'settings' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-700'
              }`}
            >
              الإعدادات والعنصر
            </button>
          </div>

          {/* Tab 1: Interactive Sheet Stage */}
          {mobileTab === 'stage' && (
            <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
              {settings.duplexMode === 'duplex_aligned' && (
                <div className="px-3 py-1.5 bg-slate-50 border-b border-slate-200 grid grid-cols-2 gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => setActivePageIndex(0)}
                    className={`min-h-[34px] rounded-lg text-xs font-bold cursor-pointer ${
                      activePageIndex === 0 ? 'bg-white text-slate-900 shadow-2xs border border-slate-200' : 'text-slate-600'
                    }`}
                  >
                    الوجه الأمامي
                  </button>
                  <button
                    type="button"
                    onClick={() => setActivePageIndex(1)}
                    className={`min-h-[34px] rounded-lg text-xs font-bold cursor-pointer ${
                      activePageIndex === 1 ? 'bg-white text-slate-900 shadow-2xs border border-slate-200' : 'text-slate-600'
                    }`}
                  >
                    الوجه الخلفي
                  </button>
                </div>
              )}

              <div
                ref={canvasContainerRef}
                onClick={() => setSelectedItemId(null)}
                className="flex-1 studio-stage-grid overflow-auto flex items-center justify-center p-4 relative"
              >
                {renderPaperStageContent(true)}
              </div>
            </div>
          )}

          {/* Tab 2: Document Picker */}
          {mobileTab === 'picker' && (
            <div className="flex-1 min-h-0 flex flex-col bg-slate-50 overflow-hidden pb-safe">
              {renderPickerList(true, () => setMobileTab('stage'))}
            </div>
          )}

          {/* Tab 3: Sheet Settings & Selected Item Properties */}
          {mobileTab === 'settings' && (
            <div className="flex-1 min-h-0 overflow-y-auto bg-slate-50 p-3 pb-safe">
              {renderSettingsAndSelected(true)}
            </div>
          )}
        </div>
      ) : (
        <div className="flex-1 min-h-0 flex flex-col bg-white overflow-hidden select-none">
          {/* Sub-bar: Physical Sheet Dimensions + Export/Print Controls */}
          <div
            className={`${
              isTablet ? 'min-h-[52px] py-1.5 px-3' : 'h-12 px-4'
            } bg-slate-50/70 border-b border-slate-200 flex items-center justify-between gap-3 shrink-0 overflow-x-auto no-scrollbar`}
          >
            <div className="flex items-center gap-3 shrink-0">
              <span className="font-mono tabular-nums text-xs font-semibold text-slate-700" dir="ltr">
                {sheetWidthMm} × {sheetHeightMm} mm · 1:1
              </span>

              {settings.duplexMode === 'duplex_aligned' && (
                <div className="flex items-center gap-0.5 p-0.5 bg-slate-200/70 rounded-md border border-slate-200 shrink-0">
                  <button
                    type="button"
                    onClick={() => setActivePageIndex(0)}
                    className={`px-3 py-1 text-xs font-semibold rounded transition-colors cursor-pointer whitespace-nowrap ${
                      activePageIndex === 0
                        ? 'bg-white text-slate-900 shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    الوجه الأمامي
                  </button>
                  <button
                    type="button"
                    onClick={() => setActivePageIndex(1)}
                    className={`px-3 py-1 text-xs font-semibold rounded transition-colors cursor-pointer whitespace-nowrap ${
                      activePageIndex === 1
                        ? 'bg-white text-slate-900 shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    الوجه الخلفي
                  </button>
                </div>
              )}

              {isCompactTablet && (
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => setTabletDrawer((d) => (d === 'picker' ? 'none' : 'picker'))}
                    className={`min-h-[36px] px-2.5 rounded-lg border text-xs font-bold flex items-center gap-1 cursor-pointer ${
                      tabletDrawer === 'picker'
                        ? 'bg-blue-600 border-blue-600 text-white'
                        : 'bg-white border-slate-300 text-slate-800'
                    }`}
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>المستمسكات</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setTabletDrawer((d) => (d === 'settings' ? 'none' : 'settings'))}
                    className={`min-h-[36px] px-2.5 rounded-lg border text-xs font-bold flex items-center gap-1 cursor-pointer ${
                      tabletDrawer === 'settings'
                        ? 'bg-blue-600 border-blue-600 text-white'
                        : 'bg-white border-slate-300 text-slate-800'
                    }`}
                  >
                    <SlidersHorizontal className="w-3.5 h-3.5" />
                    <span>الإعدادات</span>
                  </button>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {items.length > 0 && (
                <button
                  type="button"
                  onClick={handleClearSheet}
                  className={`${
                    isTablet ? 'min-h-[36px] px-3' : 'px-2.5 py-1.5'
                  } bg-white hover:bg-red-50 text-slate-700 hover:text-red-600 border border-slate-300 hover:border-red-200 rounded-md text-xs font-semibold flex items-center gap-1.5 cursor-pointer whitespace-nowrap transition-colors`}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>إفراغ الورقة</span>
                </button>
              )}

              <button
                type="button"
                onClick={handleExportImage}
                disabled={isExporting || items.length === 0}
                className={`${
                  isTablet ? 'min-h-[36px] px-3' : 'px-3 py-1.5'
                } bg-white hover:bg-slate-50 disabled:opacity-45 text-slate-800 border border-slate-300 rounded-md text-xs font-semibold flex items-center gap-1.5 cursor-pointer whitespace-nowrap transition-colors`}
              >
                <Download className="w-3.5 h-3.5 text-slate-600" />
                <span>صورة {settings.targetDpi} DPI</span>
              </button>

              <button
                type="button"
                onClick={handleExportPdf}
                disabled={isExporting || items.length === 0}
                className={`${
                  isTablet ? 'min-h-[36px] px-3' : 'px-3 py-1.5'
                } bg-white hover:bg-slate-50 disabled:opacity-45 text-slate-800 border border-slate-300 rounded-md text-xs font-semibold flex items-center gap-1.5 cursor-pointer whitespace-nowrap transition-colors`}
              >
                <Download className="w-3.5 h-3.5 text-slate-600" />
                <span>تصدير PDF</span>
              </button>

              <button
                type="button"
                onClick={() => window.print()}
                disabled={items.length === 0}
                className={`${
                  isTablet ? 'min-h-[36px] px-4' : 'px-4 py-1.5'
                } bg-blue-600 hover:bg-blue-700 disabled:opacity-45 text-white rounded-md text-xs font-bold flex items-center gap-1.5 cursor-pointer whitespace-nowrap transition-colors`}
              >
                <Printer className="w-3.5 h-3.5" />
                <span>طباعة فورية</span>
              </button>
            </div>
          </div>

          {/* Main Workspace: 3-Panel on Desktop / Landscape Tablet, Drawer-assisted on Portrait Tablet */}
          <div className="flex-1 min-h-0 flex overflow-hidden relative">
            {/* 1. Document Picker Rail (Right in RTL) */}
            {!isCompactTablet && (
              <aside
                className={`${
                  isTablet ? 'w-56' : 'w-64'
                } bg-slate-50/70 border-l border-slate-200 flex flex-col shrink-0`}
              >
                {renderPickerList(isTablet)}
              </aside>
            )}

            {/* 2. Center Interactive Print Stage */}
            <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
              <div
                ref={canvasContainerRef}
                onWheel={handleCanvasWheel}
                onClick={() => setSelectedItemId(null)}
                className="flex-1 studio-stage-grid overflow-auto flex items-center justify-center p-6 sm:p-8 relative"
              >
                {renderPaperStageContent(isTablet)}
              </div>

              {/* Bottom Canvas Dock */}
              <div className="h-12 px-4 bg-white border-t border-slate-200 flex items-center justify-between gap-3 shrink-0 text-xs">
                <span className="text-[11px] text-slate-500 truncate">
                  {isTablet
                    ? 'اسحب المستمسك على الورقة لتغيير موضعه'
                    : 'اسحب المستمسك على الورقة لتغيير موضعه · عجلة الفأرة للتكبير والتصغير'}
                </span>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => setCanvasZoom((z) => Math.max(0.35, Number((z - 0.1).toFixed(2))))}
                    className="p-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded cursor-pointer"
                    aria-label="تصغير"
                  >
                    <ZoomOut className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setCanvasZoom(1.0)}
                    className={`px-2.5 py-1 rounded border text-[11px] font-mono tabular-nums font-bold cursor-pointer ${
                      canvasZoom === 1.0
                        ? 'bg-blue-50 border-blue-300 text-blue-700'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    {Math.round(canvasZoom * 100)}%
                  </button>
                  <button
                    type="button"
                    onClick={() => setCanvasZoom((z) => Math.min(2.5, Number((z + 0.1).toFixed(2))))}
                    className="p-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded cursor-pointer"
                    aria-label="تكبير"
                  >
                    <ZoomIn className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={handleFitToScreen}
                    className="px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded text-[11px] font-semibold flex items-center gap-1 cursor-pointer whitespace-nowrap"
                  >
                    <Maximize2 className="w-3 h-3" />
                    <span>ملاءمة</span>
                  </button>
                </div>
              </div>
            </div>

            {/* 3. Sheet & Item Properties Rail (Left in RTL) */}
            {!isCompactTablet && (
              <aside
                className={`${
                  isTablet ? 'w-64 p-3' : 'w-72 p-4'
                } bg-slate-50/70 border-r border-slate-200 overflow-y-auto shrink-0`}
              >
                {renderSettingsAndSelected(isTablet)}
              </aside>
            )}

            {/* Compact Tablet Slide-Over Drawer for Picker or Settings */}
            {isCompactTablet && tabletDrawer !== 'none' && (
              <div className="absolute inset-y-0 left-0 w-80 max-w-[85vw] bg-slate-50 border-r border-slate-200 shadow-2xl z-40 flex flex-col overflow-hidden">
                <div className="h-11 px-3 bg-white border-b border-slate-200 flex items-center justify-between shrink-0">
                  <span className="font-bold text-xs text-slate-900">
                    {tabletDrawer === 'picker' ? 'إضافة مستمسك للورقة' : 'إعدادات الورقة والعنصر'}
                  </span>
                  <button
                    type="button"
                    onClick={() => setTabletDrawer('none')}
                    className="min-w-[34px] min-h-[34px] rounded-lg flex items-center justify-center text-slate-500 hover:bg-slate-100 cursor-pointer"
                    aria-label="إغلاق اللوحة"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {tabletDrawer === 'picker' ? (
                  <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
                    {renderPickerList(true, () => setTabletDrawer('none'))}
                  </div>
                ) : (
                  <div className="flex-1 overflow-y-auto p-3">
                    {renderSettingsAndSelected(true)}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* True 1:1 Physical Millimeter Print Portal */}
      {createPortal(
        <div id="mostamsakati-print-portal">
          {pages.map((page) => (
            <div
              key={page.pageIndex}
              className="mostamsakati-physical-sheet"
              style={{
                width: `${page.widthMm}mm`,
                height: `${page.heightMm}mm`,
              }}
            >
              {page.items.map((item) => {
                const doc = docsMap.get(item.documentId);
                if (!doc) return null;
                const imageSrc =
                  item.face === 'back' && doc.backImage ? doc.backImage : doc.frontImage;
                const isQuarterTurn = item.rotation === 90 || item.rotation === 270;
                const innerW = isQuarterTurn ? item.heightMm : item.widthMm;
                const innerH = isQuarterTurn ? item.widthMm : item.heightMm;
                const radiusMm = getPrintCornerRadiusMm(doc, item.widthMm, item.heightMm);
                return (
                  <div
                    key={item.id}
                    style={{
                      position: 'absolute',
                      left: `${item.xMm}mm`,
                      top: `${item.yMm}mm`,
                      width: `${item.widthMm}mm`,
                      height: `${item.heightMm}mm`,
                    }}
                  >
                    <div
                      style={{
                        position: 'relative',
                        width: '100%',
                        height: '100%',
                        overflow: 'hidden',
                        borderRadius: `${radiusMm}mm`,
                      }}
                    >
                      <img
                        src={imageSrc}
                        alt={item.label || doc.title}
                        className="max-w-none max-h-none"
                        style={{
                          position: 'absolute',
                          left: '50%',
                          top: '50%',
                          width: `${innerW}mm`,
                          height: `${innerH}mm`,
                          maxWidth: 'none',
                          maxHeight: 'none',
                          objectFit: 'contain',
                          borderRadius: `${radiusMm}mm`,
                          transform: `translate(-50%, -50%) rotate(${item.rotation}deg)`,
                        }}
                      />
                    </div>
                    {settings.showCutMarksAll && (
                      <>
                        <div style={{ position: 'absolute', top: '-1.5mm', left: '-1.5mm', width: '3mm', height: '3mm', borderTop: '0.35mm solid #334155', borderLeft: '0.35mm solid #334155' }} />
                        <div style={{ position: 'absolute', top: '-1.5mm', right: '-1.5mm', width: '3mm', height: '3mm', borderTop: '0.35mm solid #334155', borderRight: '0.35mm solid #334155' }} />
                        <div style={{ position: 'absolute', bottom: '-1.5mm', left: '-1.5mm', width: '3mm', height: '3mm', borderBottom: '0.35mm solid #334155', borderLeft: '0.35mm solid #334155' }} />
                        <div style={{ position: 'absolute', bottom: '-1.5mm', right: '-1.5mm', width: '3mm', height: '3mm', borderBottom: '0.35mm solid #334155', borderRight: '0.35mm solid #334155' }} />
                      </>
                    )}
                    {settings.showLabelsAll && item.label && (
                      <div
                        style={{
                          position: 'absolute',
                          bottom: '-4.2mm',
                          left: 0,
                          right: 0,
                          textAlign: 'center',
                          fontSize: '7.5pt',
                          color: '#334155',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {item.label}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>,
        document.body
      )}
    </>
  );
};
