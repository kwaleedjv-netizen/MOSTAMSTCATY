/**
 * Deterministic Image Processing & Document Enhancement Engine
 * Zero AI: Pure Canvas 2D, Integral Image illumination normalization,
 * adaptive thresholding, projection-profile deskew, and 3x3 homography perspective warp.
 */

import { DocumentAdjustments, DocumentFilterType, ImageTransform } from '../types';

export interface Point2D {
  x: number; // normalized 0..1
  y: number; // normalized 0..1
}

export interface RenderTransformOptions {
  widthPx: number;
  heightPx: number;
  borderRadiusPx?: number;
  quality?: number;
  format?: 'image/jpeg' | 'image/png' | 'image/webp';
  previewFrameWidth?: number;
}

export const DEFAULT_ADJUSTMENTS: DocumentAdjustments = {
  filter: 'original',
  brightness: 0,
  contrast: 0,
  sharpness: 0,
  fineAngle: 0,
  autoCorrected: false,
};

export const DOCUMENT_FILTER_OPTIONS: { id: DocumentFilterType; label: string }[] = [
  { id: 'original', label: 'أصلي' },
  { id: 'magic_color', label: 'تحسين الألوان' },
  { id: 'bw_adaptive', label: 'مستند أبيض وأسود' },
  { id: 'grayscale_crisp', label: 'رمادي واضح' },
  { id: 'high_contrast', label: 'تباين عالٍ' },
  { id: 'print_clean', label: 'تنظيف للطباعة' },
];

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = (e) => reject(new Error('Failed to load image: ' + e));
    img.src = src;
  });
}

export function readFileAsDataUrl(file: File | Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export async function readClipboardImage(): Promise<string | null> {
  try {
    const items = await navigator.clipboard.read();
    for (const item of items) {
      for (const type of item.types) {
        if (type.startsWith('image/')) {
          const blob = await item.getType(type);
          return await readFileAsDataUrl(blob);
        }
      }
    }
  } catch {
    // Clipboard access denied or empty
  }
  return null;
}

export async function startCameraStream(
  videoElement?: HTMLVideoElement | null,
  facingMode: 'user' | 'environment' = 'environment'
): Promise<MediaStream> {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: {
      facingMode,
      width: { ideal: 1920 },
      height: { ideal: 1080 },
    },
    audio: false,
  });
  if (videoElement) {
    videoElement.srcObject = stream;
    await videoElement.play().catch(() => {});
  }
  return stream;
}

export function captureCameraFrame(videoElement: HTMLVideoElement): string {
  const canvas = document.createElement('canvas');
  canvas.width = videoElement.videoWidth || 1280;
  canvas.height = videoElement.videoHeight || 720;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Cannot get canvas context');
  ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', 0.95);
}

/**
 * Computes a 2D Integral Image (summed-area table) over a single-channel Float32/Uint8 array
 * for O(1) local window mean calculation.
 */
function buildIntegralImage(lum: Uint8Array, w: number, h: number): Float64Array {
  const stride = w + 1;
  const sat = new Float64Array((w + 1) * (h + 1));
  for (let y = 1; y <= h; y++) {
    let rowSum = 0;
    const srcRow = (y - 1) * w;
    const dstRow = y * stride;
    const prevRow = (y - 1) * stride;
    for (let x = 1; x <= w; x++) {
      rowSum += lum[srcRow + x - 1];
      sat[dstRow + x] = sat[prevRow + x] + rowSum;
    }
  }
  return sat;
}

function getBoxMean(
  sat: Float64Array,
  w: number,
  h: number,
  cx: number,
  cy: number,
  radius: number
): number {
  const stride = w + 1;
  const x1 = Math.max(0, cx - radius);
  const y1 = Math.max(0, cy - radius);
  const x2 = Math.min(w - 1, cx + radius);
  const y2 = Math.min(h - 1, cy + radius);
  const area = (x2 - x1 + 1) * (y2 - y1 + 1);
  const sum =
    sat[(y2 + 1) * stride + (x2 + 1)] -
    sat[y1 * stride + (x2 + 1)] -
    sat[(y2 + 1) * stride + x1] +
    sat[y1 * stride + x1];
  return sum / area;
}

function clamp255(v: number): number {
  return v < 0 ? 0 : v > 255 ? 255 : v | 0;
}

/**
 * Computes low/high percentile bounds (e.g., 1.5% and 98.5%) on luminance for auto-levels.
 */
function computePercentileBounds(lum: Uint8Array, lowPct = 0.015, highPct = 0.985): [number, number] {
  const hist = new Uint32Array(256);
  for (let i = 0; i < lum.length; i++) hist[lum[i]]++;
  const total = lum.length;
  const lowTarget = total * lowPct;
  const highTarget = total * highPct;

  let acc = 0;
  let low = 0;
  for (let v = 0; v < 256; v++) {
    acc += hist[v];
    if (acc >= lowTarget) {
      low = v;
      break;
    }
  }

  acc = 0;
  let high = 255;
  for (let v = 255; v >= 0; v--) {
    acc += hist[255 - v]; // unused; compute from top cleanly
  }
  acc = 0;
  const topTarget = total * (1 - highPct);
  for (let v = 255; v >= 0; v--) {
    acc += hist[v];
    if (acc >= topTarget) {
      high = v;
      break;
    }
  }

  if (high - low < 16) return [0, 255];
  return [low, high];
}

/**
 * Pure algorithmic pixel processing pipeline:
 * - Illumination / shadow normalization (Integral Image division)
 * - Auto-levels percentile stretch
 * - Document filters (magic_color, bw_adaptive, grayscale_crisp, high_contrast, print_clean)
 * - Brightness, Contrast, Unsharp Mask sharpness
 */
export function processDocumentImageData(
  imageData: ImageData,
  adjustments: DocumentAdjustments
): ImageData {
  const { width: w, height: h, data } = imageData;
  const pixelCount = w * h;
  const out = new Uint8ClampedArray(data);
  const { filter, brightness, contrast, sharpness, autoCorrected } = adjustments;

  const isDefault =
    filter === 'original' &&
    !autoCorrected &&
    brightness === 0 &&
    contrast === 0 &&
    sharpness === 0;

  if (isDefault) {
    return new ImageData(out, w, h);
  }

  // Extract luminance channel
  const lum = new Uint8Array(pixelCount);
  for (let i = 0, p = 0; i < pixelCount; i++, p += 4) {
    lum[i] = clamp255(0.299 * out[p] + 0.587 * out[p + 1] + 0.114 * out[p + 2]);
  }

  const needsLocalBg =
    Boolean(autoCorrected) ||
    filter === 'bw_adaptive' ||
    filter === 'magic_color' ||
    filter === 'print_clean';

  const sat = needsLocalBg ? buildIntegralImage(lum, w, h) : null;
  const bgRadius = Math.max(16, Math.round(Math.min(w, h) * 0.045));

  // Step 1: Illumination normalization when autoCorrected or magic_color/print_clean
  if ((autoCorrected || filter === 'magic_color' || filter === 'print_clean') && sat) {
    const strength = filter === 'print_clean' ? 0.85 : filter === 'magic_color' ? 0.65 : 0.7;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const idx = y * w + x;
        const p = idx * 4;
        const localMean = Math.max(30, getBoxMean(sat, w, h, x, y, bgRadius));
        const gain = 232 / localMean;
        const blendedGain = 1 + (gain - 1) * strength;
        out[p] = clamp255(out[p] * blendedGain);
        out[p + 1] = clamp255(out[p + 1] * blendedGain);
        out[p + 2] = clamp255(out[p + 2] * blendedGain);
        lum[idx] = clamp255(0.299 * out[p] + 0.587 * out[p + 1] + 0.114 * out[p + 2]);
      }
    }
  }

  // Step 2: Filter-specific transforms
  if (filter === 'bw_adaptive' && sat) {
    // Recompute SAT on raw lum if we hadn't modified lum, or use current sat
    const bwRadius = Math.max(12, Math.round(Math.min(w, h) * 0.03));
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const idx = y * w + x;
        const p = idx * 4;
        const localMean = getBoxMean(sat, w, h, x, y, bwRadius);
        const l = lum[idx];
        const threshold = localMean * 0.86;
        // Soft transition band around threshold for crisp anti-aliased text
        const diff = l - threshold;
        let v: number;
        if (diff <= -10) v = 12;
        else if (diff >= 10) v = 255;
        else v = clamp255(12 + ((diff + 10) / 20) * 243);
        out[p] = v;
        out[p + 1] = v;
        out[p + 2] = v;
      }
    }
  } else if (filter === 'grayscale_crisp') {
    const [low, high] = computePercentileBounds(lum, 0.02, 0.98);
    const scale = 255 / Math.max(1, high - low);
    for (let i = 0, p = 0; i < pixelCount; i++, p += 4) {
      const stretched = clamp255((lum[i] - low) * scale);
      out[p] = stretched;
      out[p + 1] = stretched;
      out[p + 2] = stretched;
    }
  } else if (filter === 'high_contrast') {
    const [low, high] = computePercentileBounds(lum, 0.04, 0.94);
    const range = Math.max(1, high - low);
    for (let i = 0, p = 0; i < pixelCount; i++, p += 4) {
      const rN = clamp255(((out[p] - low) / range) * 255);
      const gN = clamp255(((out[p + 1] - low) / range) * 255);
      const bN = clamp255(((out[p + 2] - low) / range) * 255);
      // S-curve boost
      out[p] = clamp255(128 + (rN - 128) * 1.28);
      out[p + 1] = clamp255(128 + (gN - 128) * 1.28);
      out[p + 2] = clamp255(128 + (bN - 128) * 1.28);
    }
  } else if (filter === 'magic_color') {
    const [low, high] = computePercentileBounds(lum, 0.015, 0.975);
    const scale = 255 / Math.max(1, high - low);
    const satBoost = 1.22;
    for (let i = 0, p = 0; i < pixelCount; i++, p += 4) {
      const r = (out[p] - low) * scale;
      const g = (out[p + 1] - low) * scale;
      const b = (out[p + 2] - low) * scale;
      const avg = 0.299 * r + 0.587 * g + 0.114 * b;
      out[p] = clamp255(avg + (r - avg) * satBoost);
      out[p + 1] = clamp255(avg + (g - avg) * satBoost);
      out[p + 2] = clamp255(avg + (b - avg) * satBoost);
    }
  } else if (filter === 'print_clean') {
    // Push light paper backgrounds cleanly to pure white while keeping ink & photos vivid
    for (let i = 0, p = 0; i < pixelCount; i++, p += 4) {
      const r = out[p];
      const g = out[p + 1];
      const b = out[p + 2];
      const maxC = Math.max(r, g, b);
      const minC = Math.min(r, g, b);
      const chroma = maxC - minC;
      const l = 0.299 * r + 0.587 * g + 0.114 * b;
      if (l > 195 && chroma < 32) {
        out[p] = 255;
        out[p + 1] = 255;
        out[p + 2] = 255;
      } else {
        out[p] = clamp255((r - 12) * 1.06);
        out[p + 1] = clamp255((g - 12) * 1.06);
        out[p + 2] = clamp255((b - 12) * 1.06);
      }
    }
  } else if (autoCorrected) {
    // Auto-levels stretch on 'original' + autoCorrected
    const [low, high] = computePercentileBounds(lum, 0.015, 0.985);
    const scale = 255 / Math.max(1, high - low);
    for (let i = 0, p = 0; i < pixelCount; i++, p += 4) {
      out[p] = clamp255((out[p] - low) * scale);
      out[p + 1] = clamp255((out[p + 1] - low) * scale);
      out[p + 2] = clamp255((out[p + 2] - low) * scale);
    }
  }

  // Step 3: Manual Brightness & Contrast
  if (brightness !== 0 || contrast !== 0) {
    const bOffset = brightness * 1.8;
    const cFactor = (259 * (contrast * 1.5 + 255)) / (255 * (259 - contrast * 1.5));
    for (let i = 0, p = 0; i < pixelCount; i++, p += 4) {
      out[p] = clamp255(cFactor * (out[p] + bOffset - 128) + 128);
      out[p + 1] = clamp255(cFactor * (out[p + 1] + bOffset - 128) + 128);
      out[p + 2] = clamp255(cFactor * (out[p + 2] + bOffset - 128) + 128);
    }
  }

  // Step 4: Unsharp Mask Sharpening (3x3 Laplacian high-pass)
  const effectiveSharpness = sharpness > 0 ? sharpness : autoCorrected ? 22 : 0;
  if (effectiveSharpness > 0) {
    const amount = (effectiveSharpness / 100) * 1.25;
    const srcCopy = new Uint8ClampedArray(out);
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const idx = (y * w + x) * 4;
        const top = ((y - 1) * w + x) * 4;
        const bot = ((y + 1) * w + x) * 4;
        const left = (y * w + (x - 1)) * 4;
        const right = (y * w + (x + 1)) * 4;

        for (let c = 0; c < 3; c++) {
          const center = srcCopy[idx + c];
          const avgNeighbor =
            (srcCopy[top + c] + srcCopy[bot + c] + srcCopy[left + c] + srcCopy[right + c]) * 0.25;
          out[idx + c] = clamp255(center + (center - avgNeighbor) * amount);
        }
      }
    }
  }

  return new ImageData(out, w, h);
}

/**
 * Generates a filtered Data URL from a source image at controlled working resolution for fast live preview.
 */
export async function applyAdjustmentsToDataUrl(
  imageSrc: string,
  adjustments: DocumentAdjustments,
  maxDim: number = 960
): Promise<string> {
  const isNoOp =
    adjustments.filter === 'original' &&
    !adjustments.autoCorrected &&
    adjustments.brightness === 0 &&
    adjustments.contrast === 0 &&
    adjustments.sharpness === 0;

  if (isNoOp) return imageSrc;

  const img = await loadImage(imageSrc);
  const srcW = img.naturalWidth || 800;
  const srcH = img.naturalHeight || 600;
  const scale = Math.min(1, maxDim / Math.max(srcW, srcH));
  const w = Math.max(1, Math.round(srcW * scale));
  const h = Math.max(1, Math.round(srcH * scale));

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return imageSrc;

  ctx.drawImage(img, 0, 0, w, h);
  const imgData = ctx.getImageData(0, 0, w, h);
  const processed = processDocumentImageData(imgData, adjustments);
  ctx.putImageData(processed, 0, 0);

  return canvas.toDataURL('image/jpeg', 0.92);
}

/**
 * Deterministic Algorithmic Auto-Deskew Angle Detector (Zero AI):
 * Tests candidate angles -12°..+12° on horizontal projection profile variance of vertical gradients.
 */
export async function detectDeskewAngle(imageSrc: string): Promise<number> {
  const img = await loadImage(imageSrc);
  const maxDim = 280;
  const scale = Math.min(1, maxDim / Math.max(img.naturalWidth || 800, img.naturalHeight || 600));
  const w = Math.max(40, Math.round((img.naturalWidth || 800) * scale));
  const h = Math.max(40, Math.round((img.naturalHeight || 600) * scale));

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return 0;

  ctx.drawImage(img, 0, 0, w, h);
  const { data } = ctx.getImageData(0, 0, w, h);

  // Convert to grayscale & vertical edge energy
  const gray = new Float32Array(w * h);
  for (let i = 0, p = 0; i < w * h; i++, p += 4) {
    gray[i] = 0.299 * data[p] + 0.587 * data[p + 1] + 0.114 * data[p + 2];
  }

  const edge = new Float32Array(w * h);
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const gx = Math.abs(gray[y * w + x + 1] - gray[y * w + x - 1]);
      const gy = Math.abs(gray[(y + 1) * w + x] - gray[(y - 1) * w + x]);
      const mag = gx + gy;
      edge[y * w + x] = mag > 22 ? mag : 0;
    }
  }

  const scoreAngle = (deg: number): number => {
    const rad = (deg * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    const cx = w / 2;
    const cy = h / 2;
    const rowSums = new Float64Array(h);

    for (let y = 2; y < h - 2; y += 2) {
      for (let x = 2; x < w - 2; x += 2) {
        const val = edge[y * w + x];
        if (val === 0) continue;
        const ry = Math.round((x - cx) * sin + (y - cy) * cos + cy);
        if (ry >= 0 && ry < h) {
          rowSums[ry] += val;
        }
      }
    }

    let mean = 0;
    for (let i = 0; i < h; i++) mean += rowSums[i];
    mean /= h;
    let variance = 0;
    for (let i = 0; i < h; i++) {
      const d = rowSums[i] - mean;
      variance += d * d;
    }
    return variance;
  };

  let bestAngle = 0;
  let bestScore = scoreAngle(0);
  const zeroScore = bestScore;

  // Coarse search (-12 to +12 step 1)
  for (let a = -12; a <= 12; a += 1) {
    const s = scoreAngle(a);
    if (s > bestScore) {
      bestScore = s;
      bestAngle = a;
    }
  }

  // Fine search around bestAngle (+/- 1.5 step 0.25)
  const coarseBest = bestAngle;
  for (let a = coarseBest - 1.25; a <= coarseBest + 1.25; a += 0.25) {
    const s = scoreAngle(a);
    if (s > bestScore) {
      bestScore = s;
      bestAngle = a;
    }
  }

  // Require meaningful confidence gain over 0° so already-straight docs stay at 0°
  if (Math.abs(bestAngle) < 0.5 || bestScore < zeroScore * 1.03) {
    return 0;
  }

  return Number(bestAngle.toFixed(1));
}

/**
 * Deterministic Document Edge Quad Detector (Zero AI):
 * Finds the 4 extreme corners of the dominant high-contrast document region.
 */
export async function detectDocumentCorners(
  imageSrc: string
): Promise<[Point2D, Point2D, Point2D, Point2D]> {
  const fallback: [Point2D, Point2D, Point2D, Point2D] = [
    { x: 0.05, y: 0.05 },
    { x: 0.95, y: 0.05 },
    { x: 0.95, y: 0.95 },
    { x: 0.05, y: 0.95 },
  ];

  try {
    const img = await loadImage(imageSrc);
    const maxDim = 240;
    const scale = Math.min(1, maxDim / Math.max(img.naturalWidth || 800, img.naturalHeight || 600));
    const w = Math.max(32, Math.round((img.naturalWidth || 800) * scale));
    const h = Math.max(32, Math.round((img.naturalHeight || 600) * scale));

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return fallback;

    ctx.drawImage(img, 0, 0, w, h);
    const { data } = ctx.getImageData(0, 0, w, h);

    const gray = new Float32Array(w * h);
    for (let i = 0, p = 0; i < w * h; i++, p += 4) {
      gray[i] = 0.299 * data[p] + 0.587 * data[p + 1] + 0.114 * data[p + 2];
    }

    // Sobel magnitude
    const mags = new Float32Array(w * h);
    let sumMag = 0;
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const gx =
          -gray[(y - 1) * w + (x - 1)] +
          gray[(y - 1) * w + (x + 1)] -
          2 * gray[y * w + (x - 1)] +
          2 * gray[y * w + (x + 1)] -
          gray[(y + 1) * w + (x - 1)] +
          gray[(y + 1) * w + (x + 1)];
        const gy =
          -gray[(y - 1) * w + (x - 1)] -
          2 * gray[(y - 1) * w + x] -
          gray[(y - 1) * w + (x + 1)] +
          gray[(y + 1) * w + (x - 1)] +
          2 * gray[(y + 1) * w + x] +
          gray[(y + 1) * w + (x + 1)];
        const m = Math.hypot(gx, gy);
        mags[y * w + x] = m;
        sumMag += m;
      }
    }

    const thresh = (sumMag / (w * h)) * 2.4;

    // Find extreme diagonal points among strong edge pixels in each quadrant
    let tl = { x: w * 0.05, y: h * 0.05, score: Infinity };
    let tr = { x: w * 0.95, y: h * 0.05, score: -Infinity };
    let br = { x: w * 0.95, y: h * 0.95, score: -Infinity };
    let bl = { x: w * 0.05, y: h * 0.95, score: Infinity };
    let found = 0;

    const marginX = Math.max(2, Math.floor(w * 0.02));
    const marginY = Math.max(2, Math.floor(h * 0.02));

    for (let y = marginY; y < h - marginY; y++) {
      for (let x = marginX; x < w - marginX; x++) {
        if (mags[y * w + x] < thresh) continue;
        found++;
        const sPlus = x + y;
        const sMinus = x - y;
        if (x < w * 0.55 && y < h * 0.55 && sPlus < tl.score) {
          tl = { x, y, score: sPlus };
        }
        if (x > w * 0.45 && y < h * 0.55 && sMinus > tr.score) {
          tr = { x, y, score: sMinus };
        }
        if (x > w * 0.45 && y > h * 0.45 && sPlus > br.score) {
          br = { x, y, score: sPlus };
        }
        if (x < w * 0.55 && y > h * 0.45 && sMinus < bl.score) {
          bl = { x, y, score: sMinus };
        }
      }
    }

    if (found < 25) return fallback;

    const areaRatio =
      Math.abs((tr.x - tl.x) * (bl.y - tl.y) - (bl.x - tl.x) * (tr.y - tl.y)) / (w * h);
    if (areaRatio < 0.12) return fallback;

    return [
      { x: Number((tl.x / w).toFixed(3)), y: Number((tl.y / h).toFixed(3)) },
      { x: Number((tr.x / w).toFixed(3)), y: Number((tr.y / h).toFixed(3)) },
      { x: Number((br.x / w).toFixed(3)), y: Number((br.y / h).toFixed(3)) },
      { x: Number((bl.x / w).toFixed(3)), y: Number((bl.y / h).toFixed(3)) },
    ];
  } catch {
    return fallback;
  }
}

/**
 * Solves an 8x8 linear system Ax = b via Gaussian elimination with partial pivoting.
 */
function solve8x8(A: number[][], b: number[]): number[] {
  const n = 8;
  const M = A.map((row, i) => [...row, b[i]]);

  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let row = col + 1; row < n; row++) {
      if (Math.abs(M[row][col]) > Math.abs(M[pivot][col])) {
        pivot = row;
      }
    }
    [M[col], M[pivot]] = [M[pivot], M[col]];

    const div = M[col][col] || 1e-10;
    for (let j = col; j <= n; j++) M[col][j] /= div;

    for (let row = 0; row < n; row++) {
      if (row === col) continue;
      const factor = M[row][col];
      for (let j = col; j <= n; j++) {
        M[row][j] -= factor * M[col][j];
      }
    }
  }

  return M.map((row) => row[n]);
}

/**
 * Computes 3x3 projective homography mapping dst (0..dw, 0..dh) -> src quad [TL, TR, BR, BL].
 */
function computeHomographyDstToSrc(
  dstW: number,
  dstH: number,
  srcPts: [{ x: number; y: number }, { x: number; y: number }, { x: number; y: number }, { x: number; y: number }]
): number[] {
  const dstPts = [
    { x: 0, y: 0 },
    { x: dstW, y: 0 },
    { x: dstW, y: dstH },
    { x: 0, y: dstH },
  ];

  const A: number[][] = [];
  const b: number[] = [];

  for (let i = 0; i < 4; i++) {
    const u = dstPts[i].x;
    const v = dstPts[i].y;
    const x = srcPts[i].x;
    const y = srcPts[i].y;

    A.push([u, v, 1, 0, 0, 0, -u * x, -v * x]);
    b.push(x);
    A.push([0, 0, 0, u, v, 1, -u * y, -v * y]);
    b.push(y);
  }

  const h = solve8x8(A, b);
  return [...h, 1];
}

/**
 * Applies exact 4-corner perspective warp (homography + bilinear interpolation)
 * producing a crisp, straightened rectangular image matching targetAspectRatio.
 */
export async function warpPerspectiveImage(
  imageSrc: string,
  corners: [Point2D, Point2D, Point2D, Point2D],
  targetAspectRatio: number,
  maxLongEdge: number = 1800
): Promise<string> {
  const img = await loadImage(imageSrc);
  const srcW = img.naturalWidth || 800;
  const srcH = img.naturalHeight || 600;

  const srcCanvas = document.createElement('canvas');
  srcCanvas.width = srcW;
  srcCanvas.height = srcH;
  const srcCtx = srcCanvas.getContext('2d');
  if (!srcCtx) return imageSrc;
  srcCtx.drawImage(img, 0, 0, srcW, srcH);
  const srcData = srcCtx.getImageData(0, 0, srcW, srcH).data;

  // Estimate output size from selected quad dimensions, snapped to target aspect ratio
  const srcPts: [{ x: number; y: number }, { x: number; y: number }, { x: number; y: number }, { x: number; y: number }] = [
    { x: corners[0].x * srcW, y: corners[0].y * srcH },
    { x: corners[1].x * srcW, y: corners[1].y * srcH },
    { x: corners[2].x * srcW, y: corners[2].y * srcH },
    { x: corners[3].x * srcW, y: corners[3].y * srcH },
  ];

  const topW = Math.hypot(srcPts[1].x - srcPts[0].x, srcPts[1].y - srcPts[0].y);
  const botW = Math.hypot(srcPts[2].x - srcPts[3].x, srcPts[2].y - srcPts[3].y);
  const leftH = Math.hypot(srcPts[3].x - srcPts[0].x, srcPts[3].y - srcPts[0].y);
  const rightH = Math.hypot(srcPts[2].x - srcPts[1].x, srcPts[2].y - srcPts[1].y);

  const estW = Math.max(topW, botW);
  const estH = Math.max(leftH, rightH);
  const baseLong = Math.min(maxLongEdge, Math.max(900, Math.max(estW, estH)));

  let dstW: number;
  let dstH: number;
  if (targetAspectRatio >= 1) {
    dstW = Math.round(baseLong);
    dstH = Math.max(100, Math.round(baseLong / targetAspectRatio));
  } else {
    dstH = Math.round(baseLong);
    dstW = Math.max(100, Math.round(baseLong * targetAspectRatio));
  }

  const H = computeHomographyDstToSrc(dstW, dstH, srcPts);
  const dstCanvas = document.createElement('canvas');
  dstCanvas.width = dstW;
  dstCanvas.height = dstH;
  const dstCtx = dstCanvas.getContext('2d');
  if (!dstCtx) return imageSrc;

  const dstImg = dstCtx.createImageData(dstW, dstH);
  const dst = dstImg.data;

  const h0 = H[0], h1 = H[1], h2 = H[2];
  const h3 = H[3], h4 = H[4], h5 = H[5];
  const h6 = H[6], h7 = H[7], h8 = H[8];

  for (let v = 0; v < dstH; v++) {
    for (let u = 0; u < dstW; u++) {
      const denom = h6 * u + h7 * v + h8;
      if (Math.abs(denom) < 1e-8) continue;
      const sx = (h0 * u + h1 * v + h2) / denom;
      const sy = (h3 * u + h4 * v + h5) / denom;

      const x0 = Math.floor(sx);
      const y0 = Math.floor(sy);
      const dstIdx = (v * dstW + u) * 4;

      if (x0 < 0 || y0 < 0 || x0 >= srcW - 1 || y0 >= srcH - 1) {
        const cx = Math.min(srcW - 1, Math.max(0, Math.round(sx)));
        const cy = Math.min(srcH - 1, Math.max(0, Math.round(sy)));
        const sIdx = (cy * srcW + cx) * 4;
        dst[dstIdx] = srcData[sIdx];
        dst[dstIdx + 1] = srcData[sIdx + 1];
        dst[dstIdx + 2] = srcData[sIdx + 2];
        dst[dstIdx + 3] = 255;
        continue;
      }

      const fx = sx - x0;
      const fy = sy - y0;
      const w00 = (1 - fx) * (1 - fy);
      const w10 = fx * (1 - fy);
      const w01 = (1 - fx) * fy;
      const w11 = fx * fy;

      const i00 = (y0 * srcW + x0) * 4;
      const i10 = i00 + 4;
      const i01 = ((y0 + 1) * srcW + x0) * 4;
      const i11 = i01 + 4;

      dst[dstIdx] = srcData[i00] * w00 + srcData[i10] * w10 + srcData[i01] * w01 + srcData[i11] * w11;
      dst[dstIdx + 1] =
        srcData[i00 + 1] * w00 + srcData[i10 + 1] * w10 + srcData[i01 + 1] * w01 + srcData[i11 + 1] * w11;
      dst[dstIdx + 2] =
        srcData[i00 + 2] * w00 + srcData[i10 + 2] * w10 + srcData[i01 + 2] * w01 + srcData[i11 + 2] * w11;
      dst[dstIdx + 3] = 255;
    }
  }

  dstCtx.putImageData(dstImg, 0, 0);
  return dstCanvas.toDataURL('image/png');
}

/**
 * Renders the final high-resolution document face with exact physical aspect ratio,
 * rotation (90° steps + fineAngle), flips, zoom, pan, and pixel filters/adjustments.
 */
export async function renderTransformedImage(
  imageSrc: string,
  transform: ImageTransform,
  options?: Partial<RenderTransformOptions>
): Promise<string> {
  const img = await loadImage(imageSrc);

  const width = options?.widthPx || Math.max(img.naturalWidth || 1000, 1000);
  const height = options?.heightPx || Math.max(img.naturalHeight || 700, 700);
  const previewFrameWidth = options?.previewFrameWidth || width;
  const panScale = width / Math.max(1, previewFrameWidth);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context not available');

  // Clean white document paper background
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  if (options?.borderRadiusPx && options.borderRadiusPx > 0) {
    const r = options.borderRadiusPx;
    ctx.beginPath();
    ctx.moveTo(r, 0);
    ctx.lineTo(width - r, 0);
    ctx.quadraticCurveTo(width, 0, width, r);
    ctx.lineTo(width, height - r);
    ctx.quadraticCurveTo(width, height, width - r, height);
    ctx.lineTo(r, height);
    ctx.quadraticCurveTo(0, height, 0, height - r);
    ctx.lineTo(0, r);
    ctx.quadraticCurveTo(0, 0, r, 0);
    ctx.closePath();
    ctx.clip();
  }

  // Apply pixel adjustments on source image first so rotation/zoom stay crisp
  let sourceDrawable: HTMLImageElement | HTMLCanvasElement = img;
  if (transform.adjustments) {
    const adj = transform.adjustments;
    const hasAdj =
      adj.filter !== 'original' ||
      adj.autoCorrected ||
      adj.brightness !== 0 ||
      adj.contrast !== 0 ||
      adj.sharpness !== 0;

    if (hasAdj) {
      const workScale = Math.min(1, 2000 / Math.max(img.naturalWidth || 800, img.naturalHeight || 600));
      const sw = Math.max(1, Math.round((img.naturalWidth || 800) * workScale));
      const sh = Math.max(1, Math.round((img.naturalHeight || 600) * workScale));
      const workCanvas = document.createElement('canvas');
      workCanvas.width = sw;
      workCanvas.height = sh;
      const wCtx = workCanvas.getContext('2d');
      if (wCtx) {
        wCtx.drawImage(img, 0, 0, sw, sh);
        const processed = processDocumentImageData(wCtx.getImageData(0, 0, sw, sh), adj);
        wCtx.putImageData(processed, 0, 0);
        sourceDrawable = workCanvas;
      }
    }
  }

  ctx.save();

  const totalAngle = (transform.rotation || 0) + (transform.adjustments?.fineAngle || 0);
  const zoom = transform.zoom || 1;

  // Match CSS transform order: translate center -> scale(zoom) -> translate(panX, panY) -> rotate -> flip
  ctx.translate(width / 2, height / 2);
  ctx.scale(zoom, zoom);
  ctx.translate(transform.panX * panScale, transform.panY * panScale);

  if (totalAngle) {
    ctx.rotate((totalAngle * Math.PI) / 180);
  }

  ctx.scale(transform.flipH ? -1 : 1, transform.flipV ? -1 : 1);

  // Draw cover-fit equivalent matching CSS object-cover inside the frame
  const srcW = sourceDrawable instanceof HTMLImageElement ? sourceDrawable.naturalWidth : sourceDrawable.width;
  const srcH = sourceDrawable instanceof HTMLImageElement ? sourceDrawable.naturalHeight : sourceDrawable.height;
  const coverScale = Math.max(width / Math.max(1, srcW), height / Math.max(1, srcH));
  const drawW = srcW * coverScale;
  const drawH = srcH * coverScale;

  ctx.drawImage(sourceDrawable, -drawW / 2, -drawH / 2, drawW, drawH);
  ctx.restore();

  const format = options?.format || 'image/png';
  const quality = options?.quality ?? 0.95;
  return canvas.toDataURL(format, quality);
}
