/**
 * High-Precision Physical Print & PDF Engine
 * Guarantees exact millimeter dimensions on physical paper (A4, A3, Letter, etc.)
 * Supports Duplex double-sided alignment, cut marks, high-DPI export
 */

import { jsPDF } from 'jspdf';
import { PrintItem, PrintSheetSettings, MostamsakDocument } from '../types';
import { PAPER_PRESETS } from '../constants/presets';

export interface PageLayoutData {
  items: PrintItem[];
  pageIndex: number; // 0 = Front Page, 1 = Back Page
  widthMm: number;
  heightMm: number;
}

/**
 * Get sheet dimensions based on preset, orientation, or custom dimensions
 */
export function getSheetDimensions(settings: PrintSheetSettings): { widthMm: number; heightMm: number } {
  let baseWidth: number;
  let baseHeight: number;

  if (settings.paperId === 'custom') {
    baseWidth = settings.customWidthMm || 210;
    baseHeight = settings.customHeightMm || 297;
  } else {
    const preset = PAPER_PRESETS.find((p) => p.id === settings.paperId) || PAPER_PRESETS[0];
    baseWidth = preset.widthMm;
    baseHeight = preset.heightMm;
  }

  if (settings.orientation === 'landscape') {
    return {
      widthMm: Math.max(baseWidth, baseHeight),
      heightMm: Math.min(baseWidth, baseHeight),
    };
  } else {
    return {
      widthMm: Math.min(baseWidth, baseHeight),
      heightMm: Math.max(baseWidth, baseHeight),
    };
  }
}

export function getPrintCornerRadiusMm(doc?: MostamsakDocument, fallbackWidthMm: number = 85.6, fallbackHeightMm: number = 54): number {
  const w = doc?.widthMm || fallbackWidthMm;
  const h = doc?.heightMm || fallbackHeightMm;
  const maxR = Math.max(0.5, Math.min(w, h) / 4);
  if (doc && typeof doc.radiusMm === 'number' && doc.radiusMm > 0) {
    return Math.min(doc.radiusMm, maxR);
  }
  return Math.min(2.5, maxR);
}

function traceRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  const radius = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

/**
 * Calculates the exact physical mm coordinates for adding a new document to the print sheet.
 * - Places the item (or front+back pair) centered horizontally in the middle ("الوسط") at top margin or below existing items.
 * - Does NOT dead-center vertically on the sheet.
 */
export function calculateNextPrintItemPosition(
  existingItems: PrintItem[],
  docWidthMm: number,
  docHeightMm: number,
  isTwoSides: boolean,
  sheetWidthMm: number,
  sheetHeightMm: number,
  marginsMm: number = 10
): { front: { x: number; y: number }; back?: { x: number; y: number } } {
  const horizontalGap = 6; // 6mm spacing between front and back
  const verticalGap = 8; // 8mm spacing underneath existing document
  const minMargin = Math.max(5, marginsMm);

  const sideBySideWidth = docWidthMm * 2 + horizontalGap;
  const fitsSideBySide = isTwoSides && sideBySideWidth <= sheetWidthMm - minMargin * 2;
  const centeredSingleX = Math.max(minMargin, (sheetWidthMm - docWidthMm) / 2);
  const centeredPairX = Math.max(minMargin, (sheetWidthMm - sideBySideWidth) / 2);

  let startY = minMargin;
  if (existingItems && existingItems.length > 0) {
    const maxBottom = Math.max(...existingItems.map((it) => it.yMm + it.heightMm));
    startY = maxBottom + verticalGap;
    if (startY + docHeightMm > sheetHeightMm - minMargin) {
      startY = Math.max(minMargin, sheetHeightMm - docHeightMm - minMargin);
    }
  }

  if (isTwoSides) {
    if (fitsSideBySide) {
      const frontX = centeredPairX;
      const backX = frontX + docWidthMm + horizontalGap;
      return {
        front: { x: Number(frontX.toFixed(1)), y: Number(startY.toFixed(1)) },
        back: { x: Number(backX.toFixed(1)), y: Number(startY.toFixed(1)) },
      };
    } else {
      const backY = Math.min(sheetHeightMm - docHeightMm - minMargin, startY + docHeightMm + verticalGap);
      return {
        front: { x: Number(centeredSingleX.toFixed(1)), y: Number(startY.toFixed(1)) },
        back: { x: Number(centeredSingleX.toFixed(1)), y: Number(Math.max(minMargin, backY).toFixed(1)) },
      };
    }
  }

  return { front: { x: Number(centeredSingleX.toFixed(1)), y: Number(startY.toFixed(1)) } };
}

/**
 * Generates mirrored back page items for Duplex Printing
 * When printing double-sided, the back item must align directly behind the front item!
 * If front is at xMm from left, on the back page it is placed at (sheetWidth - xMm - itemWidth)!
 */
export function generateDuplexBackItems(
  frontItems: PrintItem[],
  sheetWidthMm: number,
  documentsMap: Map<string, MostamsakDocument>
): PrintItem[] {
  return frontItems.map((item) => {
    const doc = documentsMap.get(item.documentId);
    const mirroredX = sheetWidthMm - item.xMm - item.widthMm;

    return {
      ...item,
      id: 'back_' + item.id,
      face: 'back' as const,
      pageIndex: 1,
      xMm: Number(mirroredX.toFixed(2)),
      yMm: item.yMm, // Y stays at identical height!
      label: (doc?.title || '') + ' - ' + (doc?.backLabel || 'الوجه الخلفي'),
    };
  });
}

/**
 * Rasterizes an image (including SVG data URLs and rotated orientations) to a PNG data URL
 * at the target physical dimensions, rounded corner radius, and DPI.
 */
async function rasterizePrintItemToPng(
  imageSrc: string,
  widthMm: number,
  heightMm: number,
  rotation: 0 | 90 | 180 | 270,
  dpi: number = 300,
  radiusMm: number = 2.5
): Promise<string> {
  const mmToPx = (mm: number) => Math.max(1, Math.round((mm / 25.4) * dpi));
  const wPx = mmToPx(widthMm);
  const hPx = mmToPx(heightMm);
  const rPx = radiusMm > 0 ? Math.round((radiusMm / 25.4) * dpi) : 0;

  const img = new Image();
  img.crossOrigin = 'anonymous';
  await new Promise((resolve) => {
    img.onload = resolve;
    img.onerror = resolve;
    img.src = imageSrc;
  });

  const canvas = document.createElement('canvas');
  canvas.width = wPx;
  canvas.height = hPx;
  const ctx = canvas.getContext('2d');
  if (!ctx) return imageSrc;

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, wPx, hPx);

  ctx.save();
  if (rPx > 0) {
    traceRoundedRect(ctx, 0, 0, wPx, hPx, rPx);
    ctx.clip();
  }
  ctx.translate(wPx / 2, hPx / 2);
  ctx.rotate((rotation * Math.PI) / 180);
  const drawW = rotation === 90 || rotation === 270 ? hPx : wPx;
  const drawH = rotation === 90 || rotation === 270 ? wPx : hPx;
  ctx.drawImage(img, -drawW / 2, -drawH / 2, drawW, drawH);
  ctx.restore();

  return canvas.toDataURL('image/png', 0.98);
}

/**
 * Export high-resolution Physical PDF with jsPDF
 * Every element is rendered at 100% Actual Scale (1mm on PDF = 1mm physical)
 */
export async function exportToPdf(
  pages: PageLayoutData[],
  settings: PrintSheetSettings,
  documentsMap: Map<string, MostamsakDocument>,
  fileName: string = 'MOSTAMSAKATI_Print_Sheet.pdf'
): Promise<void> {
  const { widthMm, heightMm } = pages[0] || getSheetDimensions(settings);

  const doc = new jsPDF({
    orientation: widthMm > heightMm ? 'landscape' : 'portrait',
    unit: 'mm',
    format: [widthMm, heightMm],
    compress: true,
  });

  for (let pageIdx = 0; pageIdx < pages.length; pageIdx++) {
    if (pageIdx > 0) {
      doc.addPage([widthMm, heightMm], widthMm > heightMm ? 'landscape' : 'portrait');
    }

    const page = pages[pageIdx];

    for (const item of page.items) {
      const docData = documentsMap.get(item.documentId);
      if (!docData) continue;

      const rawImageSrc = item.face === 'back' && docData.backImage ? docData.backImage : docData.frontImage;
      const radiusMm = getPrintCornerRadiusMm(docData, item.widthMm, item.heightMm);

      if (settings.showCutMarksAll) {
        drawPdfCutMarks(doc, item.xMm, item.yMm, item.widthMm, item.heightMm);
      }

      try {
        const pngDataUrl = await rasterizePrintItemToPng(
          rawImageSrc,
          item.widthMm,
          item.heightMm,
          item.rotation || 0,
          settings.targetDpi || 300,
          radiusMm
        );
        doc.addImage(
          pngDataUrl,
          'PNG',
          item.xMm,
          item.yMm,
          item.widthMm,
          item.heightMm,
          undefined,
          'FAST'
        );
      } catch (err) {
        console.warn('Error adding image to PDF:', err);
      }

      if (item.showBorder) {
        doc.setDrawColor(200, 200, 200);
        doc.setLineWidth(0.2);
        doc.roundedRect(item.xMm, item.yMm, item.widthMm, item.heightMm, radiusMm, radiusMm);
      }
    }

    doc.setFontSize(7);
    doc.setTextColor(150, 150, 150);
    const footerText = `MOSTAMSAKATI · ${widthMm}×${heightMm} mm · 1:1 Scale · Page ${pageIdx + 1}/${pages.length}`;
    doc.text(footerText, widthMm / 2, heightMm - 3, { align: 'center' });
  }

  doc.save(fileName);
}

/**
 * Helper to draw standard 4mm crop/cut marks at corners
 */
function drawPdfCutMarks(doc: jsPDF, x: number, y: number, w: number, h: number) {
  const markLen = 4;
  const gap = 1;
  doc.setDrawColor(80, 80, 80);
  doc.setLineWidth(0.15);

  doc.line(x - gap - markLen, y, x - gap, y);
  doc.line(x, y - gap - markLen, x, y - gap);

  doc.line(x + w + gap, y, x + w + gap + markLen, y);
  doc.line(x + w, y - gap - markLen, x + w, y - gap);

  doc.line(x - gap - markLen, y + h, x - gap, y + h);
  doc.line(x, y + h + gap, x, y + h + gap + markLen);

  doc.line(x + w + gap, y + h, x + w + gap + markLen, y + h);
  doc.line(x + w, y + h + gap, x + w, y + h + gap + markLen);
}

/**
 * Export high-resolution image (PNG/JPEG) of a sheet at 300 or 600 DPI
 */
export async function exportSheetToHighResImage(
  page: PageLayoutData,
  settings: PrintSheetSettings,
  documentsMap: Map<string, MostamsakDocument>,
  dpi: 300 | 600 = 300,
  format: 'png' | 'jpeg' = 'png'
): Promise<string> {
  const mmToPx = (mm: number) => Math.round((mm / 25.4) * dpi);

  const canvasWidth = mmToPx(page.widthMm);
  const canvasHeight = mmToPx(page.heightMm);

  const canvas = document.createElement('canvas');
  canvas.width = canvasWidth;
  canvas.height = canvasHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Cannot get canvas context');

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);

  for (const item of page.items) {
    const docData = documentsMap.get(item.documentId);
    if (!docData) continue;

    const imageSrc = item.face === 'back' && docData.backImage ? docData.backImage : docData.frontImage;

    const xPx = mmToPx(item.xMm);
    const yPx = mmToPx(item.yMm);
    const wPx = mmToPx(item.widthMm);
    const hPx = mmToPx(item.heightMm);
    const radiusMm = getPrintCornerRadiusMm(docData, item.widthMm, item.heightMm);
    const rPx = mmToPx(radiusMm);

    const img = new Image();
    img.crossOrigin = 'anonymous';
    await new Promise((resolve) => {
      img.onload = resolve;
      img.onerror = resolve;
      img.src = imageSrc;
    });

    const rot = item.rotation || 0;
    ctx.save();
    if (rPx > 0) {
      traceRoundedRect(ctx, xPx, yPx, wPx, hPx, rPx);
      ctx.clip();
    }
    ctx.translate(xPx + wPx / 2, yPx + hPx / 2);
    ctx.rotate((rot * Math.PI) / 180);
    const drawW = rot === 90 || rot === 270 ? hPx : wPx;
    const drawH = rot === 90 || rot === 270 ? wPx : hPx;
    ctx.drawImage(img, -drawW / 2, -drawH / 2, drawW, drawH);
    ctx.restore();

    if (item.showBorder) {
      ctx.strokeStyle = '#cbd5e1';
      ctx.lineWidth = Math.max(1, Math.round(dpi / 300));
      traceRoundedRect(ctx, xPx, yPx, wPx, hPx, rPx);
      ctx.stroke();
    }

    if (settings.showCutMarksAll) {
      const mark = mmToPx(4);
      const gap = mmToPx(1);
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = Math.max(1, Math.round(dpi / 250));
      ctx.beginPath();
      ctx.moveTo(xPx - gap - mark, yPx); ctx.lineTo(xPx - gap, yPx);
      ctx.moveTo(xPx, yPx - gap - mark); ctx.lineTo(xPx, yPx - gap);
      ctx.moveTo(xPx + wPx + gap, yPx); ctx.lineTo(xPx + wPx + gap + mark, yPx);
      ctx.moveTo(xPx + wPx, yPx - gap - mark); ctx.lineTo(xPx + wPx, yPx - gap);
      ctx.moveTo(xPx - gap - mark, yPx + hPx); ctx.lineTo(xPx - gap, yPx + hPx);
      ctx.moveTo(xPx, yPx + hPx + gap); ctx.lineTo(xPx, yPx + hPx + gap + mark);
      ctx.moveTo(xPx + wPx + gap, yPx + hPx); ctx.lineTo(xPx + wPx + gap + mark, yPx + hPx);
      ctx.moveTo(xPx + wPx, yPx + hPx + gap); ctx.lineTo(xPx + wPx, yPx + hPx + gap + mark);
      ctx.stroke();
    }
  }

  const mime = format === 'jpeg' ? 'image/jpeg' : 'image/png';
  return canvas.toDataURL(mime, 0.98);
}
