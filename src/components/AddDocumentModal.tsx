import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  X,
  Check,
  Upload,
  Camera,
  Clipboard,
  RotateCw,
  RotateCcw,
  FlipHorizontal,
  FlipVertical,
  ZoomIn,
  ZoomOut,
  Crop,
  SlidersHorizontal,
  ArrowLeftRight,
  Trash2,
  Star,
  Shield,
  RefreshCw,
  ChevronDown,
  Maximize2,
  ScanLine,
  Eye,
} from 'lucide-react';
import {
  StandardDocumentPreset,
  DocumentGroup,
  MostamsakDocument,
  ImageTransform,
  DocumentAdjustments,
  DocumentFilterType,
  CustomTemplate,
  UnitType,
  DocumentOrientation,
} from '../types';
import { DOCUMENT_PRESETS, convertToMm, convertFromMm } from '../constants/presets';
import {
  readFileAsDataUrl,
  readClipboardImage,
  startCameraStream,
  captureCameraFrame,
  DEFAULT_ADJUSTMENTS,
  DOCUMENT_FILTER_OPTIONS,
  applyAdjustmentsToDataUrl,
  detectDeskewAngle,
  detectDocumentCorners,
  warpPerspectiveImage,
  renderTransformedImage,
  loadImage,
  Point2D,
} from '../services/imageProcessing';
import { useLayoutMode } from '../hooks/useViewportMode';

interface AddDocumentModalProps {
  isOpen: boolean;
  onClose: () => void;
  groups: DocumentGroup[];
  onSaveDocument: (docData: Omit<MostamsakDocument, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  onUpdateDocument?: (doc: MostamsakDocument) => Promise<void>;
  initialGroup?: string;
  editingDocument?: MostamsakDocument | null;
  initialTemplate?: CustomTemplate | null;
}

const DEFAULT_TRANSFORM: ImageTransform = {
  zoom: 1,
  panX: 0,
  panY: 0,
  rotation: 0,
  flipH: false,
  flipV: false,
  adjustments: { ...DEFAULT_ADJUSTMENTS },
};

const PRESET_GROUPS: { label: string; category: StandardDocumentPreset['category'] }[] = [
  { label: 'الهوية والسفر', category: 'id' },
  { label: 'الوثائق الرسمية', category: 'official' },
  { label: 'السفر', category: 'travel' },
  { label: 'العقارات', category: 'property' },
  { label: 'المالية', category: 'financial' },
];

export const AddDocumentModal: React.FC<AddDocumentModalProps> = ({
  isOpen,
  onClose,
  groups,
  onSaveDocument,
  onUpdateDocument,
  initialGroup,
  editingDocument,
  initialTemplate,
}) => {
  // === Document Type & Physical Specs ===
  const [selectedTypeId, setSelectedTypeId] = useState<string>(DOCUMENT_PRESETS[0].id);
  const [isCustomDimsOpen, setIsCustomDimsOpen] = useState(false);
  const [unit, setUnit] = useState<UnitType>('mm');
  const [widthMm, setWidthMm] = useState<number>(DOCUMENT_PRESETS[0].widthMm);
  const [heightMm, setHeightMm] = useState<number>(DOCUMENT_PRESETS[0].heightMm);
  const [orientation, setOrientation] = useState<DocumentOrientation>(DOCUMENT_PRESETS[0].defaultOrientation);
  const [sidesCount, setSidesCount] = useState<1 | 2>(DOCUMENT_PRESETS[0].defaultSides);
  const [radiusMm, setRadiusMm] = useState<number>(DOCUMENT_PRESETS[0].defaultRadiusMm);
  const [frontLabel, setFrontLabel] = useState<string>(DOCUMENT_PRESETS[0].frontLabel);
  const [backLabel, setBackLabel] = useState<string>(DOCUMENT_PRESETS[0].backLabel);

  // === Metadata ===
  const [title, setTitle] = useState<string>(DOCUMENT_PRESETS[0].nameAr);
  const [titleEditedManually, setTitleEditedManually] = useState(false);
  const [selectedGroupId, setSelectedGroupId] = useState<string>(initialGroup || groups[0]?.id || '');
  const [notes, setNotes] = useState<string>('');
  const [isFavorite, setIsFavorite] = useState<boolean>(false);
  const [isEncrypted, setIsEncrypted] = useState<boolean>(false);
  const [coverFace, setCoverFace] = useState<'front' | 'back'>('front');

  // === Face Images & Transforms ===
  const [activeFace, setActiveFace] = useState<'front' | 'back'>('front');
  const [frontRawImage, setFrontRawImage] = useState<string>('');
  const [backRawImage, setBackRawImage] = useState<string>('');
  const [frontOriginalImage, setFrontOriginalImage] = useState<string>('');
  const [backOriginalImage, setBackOriginalImage] = useState<string>('');
  const [frontTransform, setFrontTransform] = useState<ImageTransform>({
    ...DEFAULT_TRANSFORM,
    adjustments: { ...DEFAULT_ADJUSTMENTS },
  });
  const [backTransform, setBackTransform] = useState<ImageTransform>({
    ...DEFAULT_TRANSFORM,
    adjustments: { ...DEFAULT_ADJUSTMENTS },
  });

  // Filtered preview URLs for active faces
  const [frontFilteredPreview, setFrontFilteredPreview] = useState<string>('');
  const [backFilteredPreview, setBackFilteredPreview] = useState<string>('');

  // === Interactive Modes ===
  const [isAddMenuOpen, setIsAddMenuOpen] = useState(false);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraFacing, setCameraFacing] = useState<'environment' | 'user'>('environment');
  const [isCropMode, setIsCropMode] = useState(false);
  const [cropCorners, setCropCorners] = useState<[Point2D, Point2D, Point2D, Point2D]>([
    { x: 0.05, y: 0.05 },
    { x: 0.95, y: 0.05 },
    { x: 0.95, y: 0.95 },
    { x: 0.05, y: 0.95 },
  ]);
  const [draggingCornerIdx, setDraggingCornerIdx] = useState<number | null>(null);
  const [isComparingOriginal, setIsComparingOriginal] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [inlineNotice, setInlineNotice] = useState<string | null>(null);
  const { isMobile, isLandscape } = useLayoutMode();
  const [mobileTab, setMobileTab] = useState<'specs' | 'filters' | 'notes'>('specs');

  // Refs
  const fileInputRef = useRef<HTMLInputElement>(null);
  const addMenuRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const cropBoxRef = useRef<HTMLDivElement>(null);
  const stageContainerRef = useRef<HTMLDivElement>(null);
  const previewFrameRef = useRef<HTMLDivElement>(null);
  const [stageSize, setStageSize] = useState<{ w: number; h: number }>({ w: 520, h: 380 });

  // Panning state
  const [isDraggingImage, setIsDraggingImage] = useState(false);
  const dragStartRef = useRef<{
    clientX: number;
    clientY: number;
    startPanX: number;
    startPanY: number;
  } | null>(null);

  const showNotice = useCallback((msg: string) => {
    setInlineNotice(msg);
    setTimeout(() => {
      setInlineNotice((prev) => (prev === msg ? null : prev));
    }, 3000);
  }, []);

  // Initialize from editingDocument or initialTemplate
  useEffect(() => {
    if (!isOpen) return;

    if (editingDocument) {
      setSelectedTypeId(editingDocument.isCustom ? 'custom' : editingDocument.typeId);
      setIsCustomDimsOpen(editingDocument.isCustom);
      setWidthMm(editingDocument.widthMm);
      setHeightMm(editingDocument.heightMm);
      setOrientation(editingDocument.orientation);
      setSidesCount(editingDocument.sidesCount);
      setRadiusMm(editingDocument.radiusMm);
      setFrontLabel(editingDocument.frontLabel);
      setBackLabel(editingDocument.backLabel);
      setTitle(editingDocument.title);
      setTitleEditedManually(true);
      setSelectedGroupId(editingDocument.groupId || '');
      setNotes(editingDocument.notes || '');
      setIsFavorite(editingDocument.isFavorite);
      setIsEncrypted(editingDocument.isEncrypted);
      setCoverFace(editingDocument.coverFace);

      const fImg = editingDocument.originalFrontImage || editingDocument.frontImage;
      const bImg = editingDocument.originalBackImage || editingDocument.backImage || '';
      setFrontRawImage(fImg);
      setFrontOriginalImage(fImg);
      setBackRawImage(bImg);
      setBackOriginalImage(bImg);
      setFrontTransform({
        ...DEFAULT_TRANSFORM,
        ...editingDocument.frontTransform,
        adjustments: { ...DEFAULT_ADJUSTMENTS, ...editingDocument.frontTransform?.adjustments },
      });
      setBackTransform({
        ...DEFAULT_TRANSFORM,
        ...editingDocument.backTransform,
        adjustments: { ...DEFAULT_ADJUSTMENTS, ...editingDocument.backTransform?.adjustments },
      });
    } else if (initialTemplate) {
      setSelectedTypeId('custom');
      setIsCustomDimsOpen(true);
      setUnit(initialTemplate.unit);
      setWidthMm(initialTemplate.widthMm);
      setHeightMm(initialTemplate.heightMm);
      setOrientation(initialTemplate.orientation);
      setSidesCount(initialTemplate.sidesCount);
      setRadiusMm(initialTemplate.radiusMm);
      setFrontLabel(initialTemplate.frontLabel);
      setBackLabel(initialTemplate.backLabel);
      setTitle(initialTemplate.name);
      setTitleEditedManually(true);
      setNotes(initialTemplate.notes || '');
    } else {
      const def = DOCUMENT_PRESETS[0];
      setSelectedTypeId(def.id);
      setIsCustomDimsOpen(false);
      setUnit('mm');
      setWidthMm(def.widthMm);
      setHeightMm(def.heightMm);
      setOrientation(def.defaultOrientation);
      setSidesCount(def.defaultSides);
      setRadiusMm(def.defaultRadiusMm);
      setFrontLabel(def.frontLabel);
      setBackLabel(def.backLabel);
      setTitle(def.nameAr);
      setTitleEditedManually(false);
      setSelectedGroupId(initialGroup || groups[0]?.id || '');
      setNotes('');
      setIsFavorite(false);
      setIsEncrypted(false);
      setCoverFace('front');
      setFrontRawImage('');
      setBackRawImage('');
      setFrontOriginalImage('');
      setBackOriginalImage('');
      setFrontTransform({ ...DEFAULT_TRANSFORM, adjustments: { ...DEFAULT_ADJUSTMENTS } });
      setBackTransform({ ...DEFAULT_TRANSFORM, adjustments: { ...DEFAULT_ADJUSTMENTS } });
    }
    setActiveFace('front');
    setIsCropMode(false);
    setIsCameraActive(false);
  }, [isOpen, editingDocument, initialTemplate, initialGroup, groups]);

  // Measure viewport stage to compute exact frame pixel dimensions
  useEffect(() => {
    if (!isOpen || !stageContainerRef.current) return;
    const el = stageContainerRef.current;
    const updateSize = () => {
      const rect = el.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        setStageSize({ w: rect.width, h: rect.height });
      }
    };
    updateSize();
    const ro = new ResizeObserver(updateSize);
    ro.observe(el);
    return () => ro.disconnect();
  }, [isOpen, isMobile, isLandscape]);

  // Close Add dropdown on outside click
  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (addMenuRef.current && !addMenuRef.current.contains(e.target as Node)) {
        setIsAddMenuOpen(false);
      }
    };
    if (isAddMenuOpen) {
      window.addEventListener('mousedown', handleOutside);
    }
    return () => window.removeEventListener('mousedown', handleOutside);
  }, [isAddMenuOpen]);

  // Stop camera on unmount or close
  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setIsCameraActive(false);
  }, []);

  useEffect(() => {
    if (!isOpen) stopCamera();
    return () => stopCamera();
  }, [isOpen, stopCamera]);

  useEffect(() => {
    if (!isOpen) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (isAddMenuOpen) {
        setIsAddMenuOpen(false);
      } else if (isCropMode) {
        setIsCropMode(false);
      } else if (isCameraActive) {
        stopCamera();
      } else {
        onClose();
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isOpen, isAddMenuOpen, isCropMode, isCameraActive, stopCamera, onClose]);

  // Active face accessors
  const activeRawImage = activeFace === 'front' ? frontRawImage : backRawImage;
  const activeOriginalImage = activeFace === 'front' ? frontOriginalImage : backOriginalImage;
  const activeTransform = activeFace === 'front' ? frontTransform : backTransform;
  const activeAdjustments = activeTransform.adjustments || DEFAULT_ADJUSTMENTS;
  const activeFilteredPreview =
    activeFace === 'front' ? frontFilteredPreview || frontRawImage : backFilteredPreview || backRawImage;

  const setFaceRawImage = useCallback(
    (face: 'front' | 'back', dataUrl: string, resetOriginal = false) => {
      if (face === 'front') {
        setFrontRawImage(dataUrl);
        if (resetOriginal || !frontOriginalImage) setFrontOriginalImage(dataUrl);
      } else {
        setBackRawImage(dataUrl);
        if (resetOriginal || !backOriginalImage) setBackOriginalImage(dataUrl);
      }
    },
    [frontOriginalImage, backOriginalImage]
  );

  const updateActiveTransform = useCallback(
    (updater: (prev: ImageTransform) => ImageTransform) => {
      if (activeFace === 'front') {
        setFrontTransform(updater);
      } else {
        setBackTransform(updater);
      }
    },
    [activeFace]
  );

  const updateActiveAdjustments = useCallback(
    (partial: Partial<DocumentAdjustments>) => {
      updateActiveTransform((prev) => ({
        ...prev,
        adjustments: {
          ...DEFAULT_ADJUSTMENTS,
          ...prev.adjustments,
          ...partial,
        },
      }));
    },
    [updateActiveTransform]
  );

  // Live filtered preview generation for Front
  useEffect(() => {
    let cancelled = false;
    if (!frontRawImage) {
      setFrontFilteredPreview('');
      return;
    }
    const adj = frontTransform.adjustments || DEFAULT_ADJUSTMENTS;
    applyAdjustmentsToDataUrl(frontRawImage, adj, 960).then((url) => {
      if (!cancelled) setFrontFilteredPreview(url);
    });
    return () => {
      cancelled = true;
    };
  }, [frontRawImage, frontTransform.adjustments]);

  // Live filtered preview generation for Back
  useEffect(() => {
    let cancelled = false;
    if (!backRawImage) {
      setBackFilteredPreview('');
      return;
    }
    const adj = backTransform.adjustments || DEFAULT_ADJUSTMENTS;
    applyAdjustmentsToDataUrl(backRawImage, adj, 960).then((url) => {
      if (!cancelled) setBackFilteredPreview(url);
    });
    return () => {
      cancelled = true;
    };
  }, [backRawImage, backTransform.adjustments]);

  // Global Ctrl+V paste into active face when modal is open
  useEffect(() => {
    if (!isOpen) return;
    const handlePasteEvent = async (e: ClipboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of Array.from(items)) {
        if (item.type.startsWith('image/')) {
          const blob = item.getAsFile();
          if (blob) {
            e.preventDefault();
            const url = await readFileAsDataUrl(blob);
            setFaceRawImage(activeFace, url, true);
            updateActiveTransform(() => ({
              ...DEFAULT_TRANSFORM,
              adjustments: { ...DEFAULT_ADJUSTMENTS },
            }));
            setIsCropMode(false);
            break;
          }
        }
      }
    };
    window.addEventListener('paste', handlePasteEvent);
    return () => window.removeEventListener('paste', handlePasteEvent);
  }, [isOpen, activeFace, setFaceRawImage, updateActiveTransform]);

  // Preset Selection
  const handleSelectType = (typeId: string) => {
    setSelectedTypeId(typeId);
    if (typeId === 'custom') {
      setIsCustomDimsOpen(true);
      return;
    }
    const preset = DOCUMENT_PRESETS.find((p) => p.id === typeId);
    if (!preset) return;
    setIsCustomDimsOpen(false);
    setWidthMm(preset.widthMm);
    setHeightMm(preset.heightMm);
    setOrientation(preset.defaultOrientation);
    setSidesCount(preset.defaultSides);
    setRadiusMm(preset.defaultRadiusMm);
    setFrontLabel(preset.frontLabel);
    setBackLabel(preset.backLabel);
    if (!titleEditedManually) {
      setTitle(preset.nameAr);
    }
    if (preset.defaultSides === 1 && activeFace === 'back') {
      setActiveFace('front');
    }
  };

  const handleToggleOrientation = (newOrient: DocumentOrientation) => {
    if (newOrient === orientation) return;
    setOrientation(newOrient);
    setWidthMm(heightMm);
    setHeightMm(widthMm);
  };

  // File Input & Drag-Drop
  const handleLoadFile = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      showNotice('يرجى اختيار ملف صورة صالح');
      return;
    }
    const url = await readFileAsDataUrl(file);
    setFaceRawImage(activeFace, url, true);
    updateActiveTransform(() => ({ ...DEFAULT_TRANSFORM, adjustments: { ...DEFAULT_ADJUSTMENTS } }));
    setIsCropMode(false);
    setIsAddMenuOpen(false);
  };

  const handleClipboardButton = async () => {
    setIsAddMenuOpen(false);
    const url = await readClipboardImage();
    if (!url) {
      showNotice('لا توجد صورة في الحافظة');
      return;
    }
    setFaceRawImage(activeFace, url, true);
    updateActiveTransform(() => ({ ...DEFAULT_TRANSFORM, adjustments: { ...DEFAULT_ADJUSTMENTS } }));
    setIsCropMode(false);
  };

  const handleStartCamera = async (facing: 'environment' | 'user' = cameraFacing) => {
    setIsAddMenuOpen(false);
    setIsCropMode(false);
    stopCamera();
    setIsCameraActive(true);
    try {
      const stream = await startCameraStream(null, facing);
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
    } catch {
      setIsCameraActive(false);
      showNotice('تعذر الوصول إلى الكاميرا');
    }
  };

  const handleCaptureCamera = () => {
    if (!videoRef.current) return;
    const url = captureCameraFrame(videoRef.current);
    setFaceRawImage(activeFace, url, true);
    updateActiveTransform(() => ({ ...DEFAULT_TRANSFORM, adjustments: { ...DEFAULT_ADJUSTMENTS } }));
    stopCamera();
  };

  const handleClearFace = () => {
    setIsAddMenuOpen(false);
    setIsCropMode(false);
    if (activeFace === 'front') {
      setFrontRawImage('');
      setFrontOriginalImage('');
      setFrontTransform({ ...DEFAULT_TRANSFORM, adjustments: { ...DEFAULT_ADJUSTMENTS } });
    } else {
      setBackRawImage('');
      setBackOriginalImage('');
      setBackTransform({ ...DEFAULT_TRANSFORM, adjustments: { ...DEFAULT_ADJUSTMENTS } });
    }
  };

  const handleSwapFaces = () => {
    setIsAddMenuOpen(false);
    const fRaw = frontRawImage;
    const fOrig = frontOriginalImage;
    const fTrans = frontTransform;
    setFrontRawImage(backRawImage);
    setFrontOriginalImage(backOriginalImage);
    setFrontTransform(backTransform);
    setBackRawImage(fRaw);
    setBackOriginalImage(fOrig);
    setBackTransform(fTrans);
  };

  // === Rotation & Geometry ===
  const rotateStep = (delta: 90 | -90) => {
    const next = (((activeTransform.rotation + delta) % 360) + 360) % 360 as 0 | 90 | 180 | 270;
    updateActiveTransform((prev) => ({ ...prev, rotation: next }));
  };

  const handleFitImage = async () => {
    if (!activeRawImage || !previewFrameRef.current) return;
    const img = await loadImage(activeRawImage);
    const rect = previewFrameRef.current.getBoundingClientRect();
    const imgW = img.naturalWidth || 800;
    const imgH = img.naturalHeight || 600;
    const coverScale = Math.max(rect.width / imgW, rect.height / imgH);
    const containScale = Math.min(rect.width / imgW, rect.height / imgH);
    const fitZoom = Number(Math.max(0.25, Math.min(1, containScale / coverScale)).toFixed(2));
    updateActiveTransform((prev) => ({
      ...prev,
      zoom: fitZoom,
      panX: 0,
      panY: 0,
    }));
  };

  const handleResetAll = () => {
    if (activeOriginalImage && activeOriginalImage !== activeRawImage) {
      setFaceRawImage(activeFace, activeOriginalImage, false);
    }
    updateActiveTransform(() => ({
      ...DEFAULT_TRANSFORM,
      adjustments: { ...DEFAULT_ADJUSTMENTS },
    }));
  };

  // === Algorithmic Auto-Correct (Zero AI) ===
  const handleAutoCorrect = async () => {
    if (!activeRawImage || isProcessing) return;
    if (activeAdjustments.autoCorrected) {
      updateActiveAdjustments({
        autoCorrected: false,
        fineAngle: 0,
        brightness: 0,
        contrast: 0,
        sharpness: 0,
      });
      return;
    }

    setIsProcessing(true);
    try {
      const detectedAngle = await detectDeskewAngle(activeRawImage);
      updateActiveAdjustments({
        autoCorrected: true,
        fineAngle: detectedAngle,
        sharpness: Math.max(activeAdjustments.sharpness, 25),
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // === 4-Corner Perspective Crop Mode ===
  const handleEnterCropMode = async () => {
    if (!activeRawImage) return;
    setIsCropMode(true);
    setIsProcessing(true);
    try {
      const detected = await detectDocumentCorners(activeRawImage);
      setCropCorners(detected);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleAutoDetectCorners = async () => {
    if (!activeRawImage) return;
    setIsProcessing(true);
    try {
      const detected = await detectDocumentCorners(activeRawImage);
      setCropCorners(detected);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleApplyPerspectiveCrop = async () => {
    if (!activeRawImage) return;
    setIsProcessing(true);
    try {
      const targetRatio = widthMm / Math.max(1, heightMm);
      const warped = await warpPerspectiveImage(activeRawImage, cropCorners, targetRatio, 1800);
      setFaceRawImage(activeFace, warped, false);
      updateActiveTransform((prev) => ({
        ...prev,
        zoom: 1,
        panX: 0,
        panY: 0,
        rotation: 0,
        adjustments: {
          ...DEFAULT_ADJUSTMENTS,
          ...prev.adjustments,
          fineAngle: 0,
        },
      }));
      setIsCropMode(false);
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle dragging perspective crop corner handles (Mouse + Touch Pointer Events)
  useEffect(() => {
    if (draggingCornerIdx === null) return;
    const handleMove = (e: PointerEvent) => {
      if (!cropBoxRef.current) return;
      const rect = cropBoxRef.current.getBoundingClientRect();
      const nx = Math.max(0.01, Math.min(0.99, (e.clientX - rect.left) / rect.width));
      const ny = Math.max(0.01, Math.min(0.99, (e.clientY - rect.top) / rect.height));
      setCropCorners((prev) => {
        const next = [...prev] as [Point2D, Point2D, Point2D, Point2D];
        next[draggingCornerIdx] = { x: nx, y: ny };
        return next;
      });
    };
    const handleUp = () => setDraggingCornerIdx(null);
    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
    window.addEventListener('pointercancel', handleUp);
    return () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
      window.removeEventListener('pointercancel', handleUp);
    };
  }, [draggingCornerIdx]);

  // === Pan & Wheel Zoom (Mouse + Touch Pointer Events) ===
  const handleImagePointerDown = (e: React.PointerEvent) => {
    if (!activeRawImage || isCropMode) return;
    e.preventDefault();
    setIsDraggingImage(true);
    dragStartRef.current = {
      clientX: e.clientX,
      clientY: e.clientY,
      startPanX: activeTransform.panX,
      startPanY: activeTransform.panY,
    };
  };

  useEffect(() => {
    if (!isDraggingImage) return;
    const handleMove = (e: PointerEvent) => {
      if (!dragStartRef.current) return;
      const zoomFactor = activeTransform.zoom || 1;
      const dx = (e.clientX - dragStartRef.current.clientX) / zoomFactor;
      const dy = (e.clientY - dragStartRef.current.clientY) / zoomFactor;
      updateActiveTransform((prev) => ({
        ...prev,
        panX: Math.round(dragStartRef.current!.startPanX + dx),
        panY: Math.round(dragStartRef.current!.startPanY + dy),
      }));
    };
    const handleUp = () => {
      setIsDraggingImage(false);
      dragStartRef.current = null;
    };
    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
    window.addEventListener('pointercancel', handleUp);
    return () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
      window.removeEventListener('pointercancel', handleUp);
    };
  }, [isDraggingImage, activeTransform.zoom, updateActiveTransform]);

  const handleWheelZoom = (e: React.WheelEvent) => {
    if (!activeRawImage || isCropMode) return;
    e.preventDefault();
    e.stopPropagation();
    const step = 0.08;
    const dir = e.deltaY < 0 ? 1 : -1;
    const nextZoom = Math.min(4.0, Math.max(0.25, Number((activeTransform.zoom + dir * step).toFixed(2))));
    updateActiveTransform((prev) => ({ ...prev, zoom: nextZoom }));
  };

  // === Frame Geometry inside Viewport ===
  const computeFrameDimensions = () => {
    const availW = Math.max(240, stageSize.w - 48);
    const availH = Math.max(180, stageSize.h - 48);
    const docRatio = Math.max(0.15, widthMm / Math.max(1, heightMm));
    let frameW = availW;
    let frameH = frameW / docRatio;
    if (frameH > availH) {
      frameH = availH;
      frameW = frameH * docRatio;
    }
    return {
      width: Math.round(frameW),
      height: Math.round(frameH),
    };
  };
  const frameDims = computeFrameDimensions();

  // === Save Final Rendered Document ===
  const handleSave = async () => {
    if (!title.trim() || !frontRawImage || isSaving) return;
    setIsSaving(true);
    try {
      // Compute crisp output resolution (proportional to mm, 1200..2200px long edge)
      const longMm = Math.max(widthMm, heightMm);
      const pxPerMm = Math.min(18, Math.max(8, 1500 / Math.max(1, longMm)));
      const outW = Math.round(widthMm * pxPerMm);
      const outH = Math.round(heightMm * pxPerMm);
      const outRadiusPx = Math.round(radiusMm * pxPerMm);

      const renderedFront = await renderTransformedImage(frontRawImage, frontTransform, {
        widthPx: outW,
        heightPx: outH,
        borderRadiusPx: outRadiusPx,
        previewFrameWidth: frameDims.width,
        format: 'image/png',
      });

      let renderedBack: string | undefined;
      if (sidesCount === 2 && backRawImage) {
        renderedBack = await renderTransformedImage(backRawImage, backTransform, {
          widthPx: outW,
          heightPx: outH,
          borderRadiusPx: outRadiusPx,
          previewFrameWidth: frameDims.width,
          format: 'image/png',
        });
      }

      const preset = DOCUMENT_PRESETS.find((p) => p.id === selectedTypeId);
      const isCustom = selectedTypeId === 'custom' || isCustomDimsOpen;

      const payload: Omit<MostamsakDocument, 'id' | 'createdAt' | 'updatedAt'> = {
        title: title.trim(),
        typeId: isCustom ? 'custom' : selectedTypeId,
        typeName: isCustom ? title.trim() : preset?.nameAr || title.trim(),
        isCustom,
        widthMm: Number(widthMm.toFixed(2)),
        heightMm: Number(heightMm.toFixed(2)),
        orientation,
        sidesCount,
        frontLabel: frontLabel.trim() || 'الوجه الأمامي',
        backLabel: backLabel.trim() || 'الوجه الخلفي',
        radiusMm,
        frontImage: renderedFront,
        backImage: renderedBack,
        originalFrontImage: frontOriginalImage || frontRawImage,
        originalBackImage: sidesCount === 2 ? backOriginalImage || backRawImage || undefined : undefined,
        frontTransform,
        backTransform,
        notes: notes.slice(0, 500),
        groupId: selectedGroupId || undefined,
        isFavorite,
        isArchived: editingDocument?.isArchived || false,
        isDeleted: false,
        isEncrypted,
        coverFace: sidesCount === 2 && renderedBack ? coverFace : 'front',
      };

      if (editingDocument && onUpdateDocument) {
        await onUpdateDocument({
          ...editingDocument,
          ...payload,
          updatedAt: new Date().toISOString(),
        });
      } else {
        await onSaveDocument(payload);
      }

      onClose();
    } catch {
      showNotice('حدث خطأ أثناء معالجة المستمسك');
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  const totalPreviewRotation = (activeTransform.rotation || 0) + (activeAdjustments.fineAngle || 0);
  const displayWidthVal = convertFromMm(widthMm, unit);
  const displayHeightVal = convertFromMm(heightMm, unit);

  // ============================================================================
  // MOBILE LAYOUT BRANCH (Full-Screen Touch Studio — Zero Desktop Regression)
  // ============================================================================
  if (isMobile) {
    return (
      <div
        className="fixed inset-0 z-50 bg-white flex flex-col h-[100dvh] w-screen select-none overflow-hidden"
        dir="rtl"
      >
        {/* Hidden File Input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleLoadFile(file);
            e.target.value = '';
          }}
          className="hidden"
        />

        {/* Mobile Header */}
        <header className="min-h-[48px] pt-safe px-3 bg-white border-b border-slate-200 flex items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <h2 className="font-bold text-xs text-slate-900 whitespace-nowrap">
              {editingDocument ? 'تعديل المستمسك' : 'إضافة مستمسك'}
            </h2>
            {sidesCount === 2 ? (
              <div className="flex items-center gap-0.5 p-0.5 bg-slate-100 rounded-lg border border-slate-200">
                <button
                  type="button"
                  onClick={() => {
                    setActiveFace('front');
                    setIsCropMode(false);
                  }}
                  className={`min-h-[30px] px-2.5 text-[11px] font-bold rounded-md flex items-center gap-1 cursor-pointer ${
                    activeFace === 'front' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600'
                  }`}
                >
                  <span>أمامي</span>
                  {frontRawImage && <Check className="w-3 h-3 text-emerald-600" />}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setActiveFace('back');
                    setIsCropMode(false);
                  }}
                  className={`min-h-[30px] px-2.5 text-[11px] font-bold rounded-md flex items-center gap-1 cursor-pointer ${
                    activeFace === 'back' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600'
                  }`}
                >
                  <span>خلفي</span>
                  {backRawImage && <Check className="w-3 h-3 text-emerald-600" />}
                </button>
              </div>
            ) : (
              <span className="text-[11px] text-slate-500 font-mono" dir="ltr">
                {Number(widthMm.toFixed(1))}×{Number(heightMm.toFixed(1))}mm
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق"
            className="min-w-[42px] min-h-[42px] rounded-xl text-slate-600 active:bg-slate-100 flex items-center justify-center cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </header>

        {inlineNotice && (
          <div className="px-3 py-1.5 bg-red-50 border-b border-red-200 text-xs font-semibold text-red-600 text-center shrink-0">
            {inlineNotice}
          </div>
        )}

        {/* Body: Split Row in Landscape, Column in Portrait */}
        <div className={`flex-1 min-h-0 flex ${isLandscape ? 'flex-row' : 'flex-col'} overflow-hidden`}>
          {/* Visual Stage + Quick Touch Toolbar */}
          <div
            className={`flex flex-col bg-slate-100 overflow-hidden ${
              isLandscape
                ? 'flex-1 min-w-0 border-l border-slate-200'
                : 'h-[40dvh] min-h-[210px] max-h-[340px] shrink-0 border-b border-slate-200'
            }`}
          >
            <div
              ref={stageContainerRef}
              className="flex-1 relative flex items-center justify-center p-3 overflow-hidden"
            >
              {isCameraActive ? (
                <div className="flex flex-col items-center gap-2 w-full h-full justify-center">
                  <div className="w-full flex-1 min-h-0 bg-slate-950 rounded-xl overflow-hidden border border-slate-300">
                    <video
                      ref={videoRef}
                      className="w-full h-full object-contain"
                      autoPlay
                      playsInline
                      muted
                    />
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={handleCaptureCamera}
                      className="min-h-[42px] px-4 bg-blue-600 active:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                    >
                      <Camera className="w-4 h-4" />
                      <span>التقاط</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const next = cameraFacing === 'environment' ? 'user' : 'environment';
                        setCameraFacing(next);
                        handleStartCamera(next);
                      }}
                      className="min-h-[42px] px-3 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-700 flex items-center gap-1 cursor-pointer"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>تبديل</span>
                    </button>
                    <button
                      type="button"
                      onClick={stopCamera}
                      className="min-h-[42px] px-3 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-700 cursor-pointer"
                    >
                      إلغاء
                    </button>
                  </div>
                </div>
              ) : isCropMode && activeRawImage ? (
                <div className="flex flex-col items-center gap-2 w-full h-full justify-center">
                  <div
                    ref={cropBoxRef}
                    className="relative inline-block max-w-full max-h-[calc(100%-48px)] select-none shadow-md bg-slate-900 touch-none"
                  >
                    <img
                      src={activeRawImage}
                      alt={title}
                      className="block max-w-full max-h-[28dvh] object-contain pointer-events-none"
                      draggable={false}
                    />
                    <svg
                      viewBox="0 0 100 100"
                      preserveAspectRatio="none"
                      className="absolute inset-0 w-full h-full pointer-events-none"
                    >
                      <polygon
                        points={cropCorners.map((p) => `${p.x * 100},${p.y * 100}`).join(' ')}
                        fill="rgba(37, 99, 235, 0.16)"
                        stroke="#2563eb"
                        strokeWidth="0.9"
                      />
                    </svg>
                    {cropCorners.map((pt, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onPointerDown={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setDraggingCornerIdx(idx);
                        }}
                        style={{
                          left: `${pt.x * 100}%`,
                          top: `${pt.y * 100}%`,
                        }}
                        className="absolute -translate-x-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-blue-600 border-2 border-white shadow-lg touch-none"
                        aria-label={`زاوية ${idx + 1}`}
                      />
                    ))}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={handleApplyPerspectiveCrop}
                      disabled={isProcessing}
                      className="min-h-[38px] px-3.5 bg-blue-600 text-white rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>تطبيق القص</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleAutoDetectCorners}
                      disabled={isProcessing}
                      className="min-h-[38px] px-3 bg-white border border-slate-300 text-slate-800 rounded-xl text-xs font-semibold flex items-center gap-1 cursor-pointer"
                    >
                      <ScanLine className="w-3.5 h-3.5" />
                      <span>تلقائي</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsCropMode(false)}
                      className="min-h-[38px] px-3 bg-white border border-slate-300 text-slate-700 rounded-xl text-xs font-semibold cursor-pointer"
                    >
                      إلغاء
                    </button>
                  </div>
                </div>
              ) : !activeRawImage ? (
                <div
                  style={{
                    width: `${frameDims.width}px`,
                    height: `${frameDims.height}px`,
                    borderRadius: `${Math.min(22, radiusMm * 2.2)}px`,
                  }}
                  className="bg-white border-2 border-dashed border-slate-300 flex flex-col items-center justify-center gap-3 p-3 shadow-xs"
                >
                  <div className="text-xs font-bold text-slate-700">
                    {activeFace === 'front' ? frontLabel : backLabel}
                  </div>
                  <div className="flex flex-wrap items-center justify-center gap-2">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="min-h-[42px] px-3.5 bg-blue-600 active:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>ملف</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleStartCamera()}
                      className="min-h-[42px] px-3.5 bg-white border border-slate-300 text-slate-800 rounded-xl text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                    >
                      <Camera className="w-3.5 h-3.5 text-blue-600" />
                      <span>كاميرا</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleClipboardButton}
                      className="min-h-[42px] px-3 bg-white border border-slate-300 text-slate-800 rounded-xl text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                    >
                      <Clipboard className="w-3.5 h-3.5 text-slate-600" />
                      <span>لصق</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="relative flex items-center justify-center w-full h-full">
                  <div
                    ref={previewFrameRef}
                    onPointerDown={handleImagePointerDown}
                    style={{
                      width: `${frameDims.width}px`,
                      height: `${frameDims.height}px`,
                      borderRadius: `${Math.min(22, radiusMm * 2.2)}px`,
                    }}
                    className={`relative bg-white border border-slate-300 overflow-hidden shadow-md touch-none ${
                      isDraggingImage ? 'ring-2 ring-blue-500' : ''
                    }`}
                  >
                    <img
                      src={isComparingOriginal ? activeOriginalImage || activeRawImage : activeFilteredPreview}
                      alt={title}
                      draggable={false}
                      className="w-full h-full object-cover select-none pointer-events-none"
                      style={{
                        transform: `scale(${activeTransform.zoom}) translate(${activeTransform.panX}px, ${activeTransform.panY}px) rotate(${totalPreviewRotation}deg) scaleX(${
                          activeTransform.flipH ? -1 : 1
                        }) scaleY(${activeTransform.flipV ? -1 : 1})`,
                      }}
                    />
                  </div>

                  {/* Floating Touch Zoom Pill */}
                  <div className="absolute bottom-1 left-1 bg-white/95 border border-slate-200 rounded-xl shadow-sm px-1.5 py-0.5 flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() =>
                        updateActiveTransform((prev) => ({
                          ...prev,
                          zoom: Math.max(0.25, Number((prev.zoom - 0.15).toFixed(2))),
                        }))
                      }
                      aria-label="تصغير"
                      className="w-8 h-8 flex items-center justify-center text-slate-700 active:bg-slate-100 rounded-lg cursor-pointer"
                    >
                      <ZoomOut className="w-3.5 h-3.5" />
                    </button>
                    <span className="font-mono tabular-nums text-[10px] font-bold text-slate-700 min-w-[34px] text-center" dir="ltr">
                      {Math.round(activeTransform.zoom * 100)}%
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        updateActiveTransform((prev) => ({
                          ...prev,
                          zoom: Math.min(4.0, Number((prev.zoom + 0.15).toFixed(2))),
                        }))
                      }
                      aria-label="تكبير"
                      className="w-8 h-8 flex items-center justify-center text-slate-700 active:bg-slate-100 rounded-lg cursor-pointer"
                    >
                      <ZoomIn className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={handleFitImage}
                      aria-label="احتواء"
                      className="w-8 h-8 flex items-center justify-center text-blue-600 active:bg-blue-50 rounded-lg cursor-pointer"
                    >
                      <Maximize2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Scrollable Mobile Image Quick-Tools Bar */}
            <div className="h-12 bg-white border-t border-slate-200 px-2 flex items-center gap-1.5 overflow-x-auto no-scrollbar shrink-0">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="min-h-[36px] px-2.5 rounded-lg bg-slate-900 text-white text-[11px] font-semibold flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>صورة</span>
              </button>
              <button
                type="button"
                onClick={() => handleStartCamera()}
                className="min-h-[36px] px-2.5 rounded-lg bg-white border border-slate-200 text-slate-800 text-[11px] font-semibold flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Camera className="w-3.5 h-3.5 text-blue-600" />
                <span>كاميرا</span>
              </button>
              <button
                type="button"
                onClick={handleClipboardButton}
                className="min-h-[36px] px-2.5 rounded-lg bg-white border border-slate-200 text-slate-800 text-[11px] font-semibold flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Clipboard className="w-3.5 h-3.5 text-slate-600" />
                <span>لصق</span>
              </button>

              {activeRawImage && !isCropMode && !isCameraActive && (
                <>
                  <button
                    type="button"
                    onClick={handleEnterCropMode}
                    className="min-h-[36px] px-2.5 rounded-lg bg-blue-50 border border-blue-200 text-blue-700 text-[11px] font-bold flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <Crop className="w-3.5 h-3.5" />
                    <span>الزوايا</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => rotateStep(-90)}
                    aria-label="تدوير يسار"
                    className="min-w-[36px] min-h-[36px] rounded-lg bg-white border border-slate-200 text-slate-700 flex items-center justify-center shrink-0 cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => rotateStep(90)}
                    aria-label="تدوير يمين"
                    className="min-w-[36px] min-h-[36px] rounded-lg bg-white border border-slate-200 text-slate-700 flex items-center justify-center shrink-0 cursor-pointer"
                  >
                    <RotateCw className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => updateActiveTransform((prev) => ({ ...prev, flipH: !prev.flipH }))}
                    aria-label="قلب أفقي"
                    className={`min-w-[36px] min-h-[36px] rounded-lg border flex items-center justify-center shrink-0 cursor-pointer ${
                      activeTransform.flipH ? 'bg-blue-50 border-blue-400 text-blue-700' : 'bg-white border-slate-200 text-slate-700'
                    }`}
                  >
                    <FlipHorizontal className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => updateActiveTransform((prev) => ({ ...prev, flipV: !prev.flipV }))}
                    aria-label="قلب عمودي"
                    className={`min-w-[36px] min-h-[36px] rounded-lg border flex items-center justify-center shrink-0 cursor-pointer ${
                      activeTransform.flipV ? 'bg-blue-50 border-blue-400 text-blue-700' : 'bg-white border-slate-200 text-slate-700'
                    }`}
                  >
                    <FlipVertical className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onPointerDown={() => setIsComparingOriginal(true)}
                    onPointerUp={() => setIsComparingOriginal(false)}
                    onPointerLeave={() => setIsComparingOriginal(false)}
                    onPointerCancel={() => setIsComparingOriginal(false)}
                    className="min-h-[36px] px-2.5 rounded-lg bg-white border border-slate-200 text-slate-700 text-[11px] font-semibold flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>الأصل</span>
                  </button>
                  {sidesCount === 2 && (frontRawImage || backRawImage) && (
                    <button
                      type="button"
                      onClick={handleSwapFaces}
                      className="min-h-[36px] px-2.5 rounded-lg bg-white border border-slate-200 text-slate-700 text-[11px] font-semibold flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      <ArrowLeftRight className="w-3.5 h-3.5" />
                      <span>تبديل</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleResetAll}
                    className="min-h-[36px] px-2.5 rounded-lg bg-white border border-slate-200 text-slate-700 text-[11px] font-semibold flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <SlidersHorizontal className="w-3.5 h-3.5" />
                    <span>ضبط</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleClearFace}
                    aria-label="حذف الصورة"
                    className="min-w-[36px] min-h-[36px] rounded-lg bg-white border border-red-200 text-red-600 flex items-center justify-center shrink-0 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Controls Panel (Tabbed for Mobile) */}
          <div className="flex-1 min-h-0 flex flex-col bg-slate-50/70 overflow-hidden">
            {/* 3 Control Tabs */}
            <div className="px-3 pt-2 pb-1.5 bg-white border-b border-slate-200 grid grid-cols-3 gap-1.5 shrink-0">
              {[
                { id: 'specs' as const, label: 'البيانات والقياس' },
                { id: 'filters' as const, label: 'الفلاتر والتصحيح' },
                { id: 'notes' as const, label: 'الملاحظات والأمان' },
              ].map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setMobileTab(t.id)}
                  className={`min-h-[36px] px-2 rounded-xl text-[11px] font-bold cursor-pointer transition-colors ${
                    mobileTab === t.id
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-100 text-slate-700'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-3 text-xs">
              {mobileTab === 'specs' && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">نوع المستمسك</label>
                    <select
                      value={selectedTypeId}
                      onChange={(e) => handleSelectType(e.target.value)}
                      className="w-full min-h-[44px] bg-white border border-slate-300 rounded-xl px-3 text-xs font-medium text-slate-800 focus:border-blue-600 focus:outline-none"
                    >
                      {PRESET_GROUPS.map((grp) => {
                        const items = DOCUMENT_PRESETS.filter((p) => p.category === grp.category);
                        if (items.length === 0) return null;
                        return (
                          <optgroup key={grp.category} label={grp.label}>
                            {items.map((preset) => (
                              <option key={preset.id} value={preset.id}>
                                {preset.nameAr}
                              </option>
                            ))}
                          </optgroup>
                        );
                      })}
                      <optgroup label="أخرى">
                        <option value="custom">مستمسك مخصص</option>
                      </optgroup>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">اسم المستمسك</label>
                    <input
                      type="text"
                      value={title}
                      onChange={(e) => {
                        setTitle(e.target.value);
                        setTitleEditedManually(true);
                      }}
                      className="w-full min-h-[44px] bg-white border border-slate-300 rounded-xl px-3 text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">المجموعة</label>
                    <select
                      value={selectedGroupId}
                      onChange={(e) => setSelectedGroupId(e.target.value)}
                      className="w-full min-h-[44px] bg-white border border-slate-300 rounded-xl px-3 text-xs text-slate-800 focus:border-blue-600 focus:outline-none"
                    >
                      <option value="">بدون مجموعة</option>
                      {groups.map((g) => (
                        <option key={g.id} value={g.id}>
                          {g.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="bg-white border border-slate-200 rounded-2xl p-3 space-y-2.5">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-mono tabular-nums font-bold text-slate-800" dir="ltr">
                        {Number(widthMm.toFixed(1))} × {Number(heightMm.toFixed(1))} mm · {sidesCount === 2 ? 'وجهان' : 'وجه'}
                      </span>
                      <button
                        type="button"
                        onClick={() => setIsCustomDimsOpen((v) => !v)}
                        className="text-blue-600 font-bold cursor-pointer py-1 px-2"
                      >
                        {isCustomDimsOpen ? 'إخفاء الأبعاد' : 'تعديل القياس'}
                      </button>
                    </div>

                    {isCustomDimsOpen && (
                      <div className="pt-2 border-t border-slate-100 space-y-2.5">
                        <div className="grid grid-cols-3 gap-2">
                          <div>
                            <label className="block text-[10px] text-slate-500 mb-1">العرض</label>
                            <input
                              type="number"
                              step="0.1"
                              min="1"
                              value={displayWidthVal}
                              onChange={(e) => setWidthMm(convertToMm(parseFloat(e.target.value) || 1, unit))}
                              className="w-full min-h-[40px] bg-slate-50 border border-slate-300 rounded-xl px-2 font-mono tabular-nums text-slate-800"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] text-slate-500 mb-1">الارتفاع</label>
                            <input
                              type="number"
                              step="0.1"
                              min="1"
                              value={displayHeightVal}
                              onChange={(e) => setHeightMm(convertToMm(parseFloat(e.target.value) || 1, unit))}
                              className="w-full min-h-[40px] bg-slate-50 border border-slate-300 rounded-xl px-2 font-mono tabular-nums text-slate-800"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] text-slate-500 mb-1">الوحدة</label>
                            <select
                              value={unit}
                              onChange={(e) => setUnit(e.target.value as UnitType)}
                              className="w-full min-h-[40px] bg-slate-50 border border-slate-300 rounded-xl px-2 font-mono text-slate-800"
                            >
                              <option value="mm">mm</option>
                              <option value="cm">cm</option>
                              <option value="inch">inch</option>
                              <option value="px">px</option>
                            </select>
                          </div>
                        </div>

                        <div className="grid grid-cols-3 gap-2">
                          <div>
                            <label className="block text-[10px] text-slate-500 mb-1">الأوجه</label>
                            <select
                              value={sidesCount}
                              onChange={(e) => {
                                const s = Number(e.target.value) as 1 | 2;
                                setSidesCount(s);
                                if (s === 1 && activeFace === 'back') setActiveFace('front');
                              }}
                              className="w-full min-h-[40px] bg-slate-50 border border-slate-300 rounded-xl px-2 text-slate-800"
                            >
                              <option value={1}>وجه واحد</option>
                              <option value={2}>وجهان</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-[10px] text-slate-500 mb-1">الاتجاه</label>
                            <select
                              value={orientation}
                              onChange={(e) => handleToggleOrientation(e.target.value as DocumentOrientation)}
                              className="w-full min-h-[40px] bg-slate-50 border border-slate-300 rounded-xl px-2 text-slate-800"
                            >
                              <option value="landscape">أفقي</option>
                              <option value="portrait">عمودي</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-[10px] text-slate-500 mb-1">الحواف (mm)</label>
                            <input
                              type="number"
                              step="0.5"
                              min="0"
                              max="20"
                              value={radiusMm}
                              onChange={(e) => setRadiusMm(Math.max(0, parseFloat(e.target.value) || 0))}
                              className="w-full min-h-[40px] bg-slate-50 border border-slate-300 rounded-xl px-2 font-mono tabular-nums text-slate-800"
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {mobileTab === 'filters' && (
                <div className="space-y-3 bg-white border border-slate-200 rounded-2xl p-3.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-slate-800">فلاتر ومعالجة المستند</span>
                    <button
                      type="button"
                      disabled={!activeRawImage || isProcessing}
                      onClick={handleAutoCorrect}
                      className={`min-h-[38px] px-3 rounded-xl text-[11px] font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-40 ${
                        activeAdjustments.autoCorrected
                          ? 'bg-blue-600 text-white'
                          : 'bg-slate-100 text-slate-800 border border-slate-200'
                      }`}
                    >
                      <ScanLine className="w-3.5 h-3.5" />
                      <span>{isProcessing ? 'جاري المعالجة...' : 'تصحيح تلقائي'}</span>
                    </button>
                  </div>

                  <select
                    value={activeAdjustments.filter}
                    disabled={!activeRawImage}
                    onChange={(e) => updateActiveAdjustments({ filter: e.target.value as DocumentFilterType })}
                    className="w-full min-h-[44px] bg-slate-50 border border-slate-300 rounded-xl px-3 text-xs font-medium text-slate-800 disabled:opacity-50"
                  >
                    {DOCUMENT_FILTER_OPTIONS.map((opt) => (
                      <option key={opt.id} value={opt.id}>
                        {opt.label}
                      </option>
                    ))}
                  </select>

                  <div className="space-y-3 pt-1">
                    <div>
                      <div className="flex items-center justify-between text-[11px] mb-1">
                        <span className="font-semibold text-slate-700">زاوية الاستقامة</span>
                        <span className="font-mono tabular-nums text-blue-700 font-bold" dir="ltr">
                          {activeAdjustments.fineAngle.toFixed(1)}°
                        </span>
                      </div>
                      <input
                        type="range"
                        min="-45"
                        max="45"
                        step="0.5"
                        disabled={!activeRawImage}
                        value={activeAdjustments.fineAngle}
                        onChange={(e) => updateActiveAdjustments({ fineAngle: parseFloat(e.target.value) })}
                        className="w-full h-7 accent-blue-600 cursor-pointer disabled:opacity-40"
                      />
                    </div>

                    <div>
                      <div className="flex items-center justify-between text-[11px] mb-1">
                        <span className="font-semibold text-slate-700">السطوع</span>
                        <span className="font-mono tabular-nums text-slate-600" dir="ltr">
                          {activeAdjustments.brightness > 0 ? `+${activeAdjustments.brightness}` : activeAdjustments.brightness}
                        </span>
                      </div>
                      <input
                        type="range"
                        min="-60"
                        max="60"
                        step="2"
                        disabled={!activeRawImage}
                        value={activeAdjustments.brightness}
                        onChange={(e) => updateActiveAdjustments({ brightness: parseInt(e.target.value, 10) })}
                        className="w-full h-7 accent-blue-600 cursor-pointer disabled:opacity-40"
                      />
                    </div>

                    <div>
                      <div className="flex items-center justify-between text-[11px] mb-1">
                        <span className="font-semibold text-slate-700">التباين</span>
                        <span className="font-mono tabular-nums text-slate-600" dir="ltr">
                          {activeAdjustments.contrast > 0 ? `+${activeAdjustments.contrast}` : activeAdjustments.contrast}
                        </span>
                      </div>
                      <input
                        type="range"
                        min="-60"
                        max="60"
                        step="2"
                        disabled={!activeRawImage}
                        value={activeAdjustments.contrast}
                        onChange={(e) => updateActiveAdjustments({ contrast: parseInt(e.target.value, 10) })}
                        className="w-full h-7 accent-blue-600 cursor-pointer disabled:opacity-40"
                      />
                    </div>

                    <div>
                      <div className="flex items-center justify-between text-[11px] mb-1">
                        <span className="font-semibold text-slate-700">الحدة</span>
                        <span className="font-mono tabular-nums text-slate-600" dir="ltr">
                          {activeAdjustments.sharpness}
                        </span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        step="5"
                        disabled={!activeRawImage}
                        value={activeAdjustments.sharpness}
                        onChange={(e) => updateActiveAdjustments({ sharpness: parseInt(e.target.value, 10) })}
                        className="w-full h-7 accent-blue-600 cursor-pointer disabled:opacity-40"
                      />
                    </div>
                  </div>
                </div>
              )}

              {mobileTab === 'notes' && (
                <div className="space-y-3 bg-white border border-slate-200 rounded-2xl p-3.5">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[11px] font-bold text-slate-700">ملاحظات</label>
                      <span className="text-[10px] font-mono tabular-nums text-slate-400">
                        {notes.length}/500
                      </span>
                    </div>
                    <textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value.slice(0, 500))}
                      rows={3}
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-800 focus:border-blue-600 focus:outline-none resize-none"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <label className="min-h-[44px] px-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center gap-2 cursor-pointer text-slate-800 font-semibold">
                      <input
                        type="checkbox"
                        checked={isFavorite}
                        onChange={(e) => setIsFavorite(e.target.checked)}
                        className="rounded accent-amber-500"
                      />
                      <Star className={`w-4 h-4 ${isFavorite ? 'text-amber-500 fill-amber-400' : 'text-slate-400'}`} />
                      <span>مفضلة</span>
                    </label>

                    <label className="min-h-[44px] px-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center gap-2 cursor-pointer text-slate-800 font-semibold">
                      <input
                        type="checkbox"
                        checked={isEncrypted}
                        onChange={(e) => setIsEncrypted(e.target.checked)}
                        className="rounded accent-blue-600"
                      />
                      <Shield className={`w-4 h-4 ${isEncrypted ? 'text-blue-600' : 'text-slate-400'}`} />
                      <span>AES-256</span>
                    </label>
                  </div>

                  {sidesCount === 2 && backRawImage && (
                    <div className="flex items-center justify-between gap-2 pt-1">
                      <span className="text-[11px] font-semibold text-slate-700">صورة الغلاف</span>
                      <select
                        value={coverFace}
                        onChange={(e) => setCoverFace(e.target.value as 'front' | 'back')}
                        className="min-h-[40px] bg-slate-50 border border-slate-300 rounded-xl px-3 text-xs text-slate-800"
                      >
                        <option value="front">{frontLabel}</option>
                        <option value="back">{backLabel}</option>
                      </select>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Sticky Bottom Footer */}
        <footer className="bg-white/95 backdrop-blur-md border-t border-slate-200 px-3 pb-safe shrink-0">
          <div className="h-[60px] flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="min-h-[44px] px-4 bg-white border border-slate-300 text-slate-700 rounded-xl text-xs font-semibold cursor-pointer"
            >
              إلغاء
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={!title.trim() || !frontRawImage || isSaving}
              className="flex-1 min-h-[44px] px-4 bg-blue-600 active:bg-blue-700 disabled:opacity-45 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Check className="w-4 h-4" />
              <span>{isSaving ? 'جاري الحفظ...' : 'حفظ المستمسك'}</span>
            </button>
          </div>
        </footer>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 backdrop-blur-[1px] p-3 md:p-5 select-none"
      dir="rtl"
    >
      <div className="w-full max-w-6xl h-[92vh] max-h-[840px] bg-white border border-slate-200 rounded-lg shadow-2xl overflow-hidden flex flex-col">
        {/* Top Bar */}
        <header className="h-12 px-4 bg-white border-b border-slate-200 flex items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-4 min-w-0">
            <h2 className="font-bold text-sm text-slate-900 whitespace-nowrap shrink-0">
              {editingDocument ? 'تعديل المستمسك' : 'إضافة مستمسك'}
            </h2>

            {/* Face Switcher Segmented Control */}
            <div className="flex items-center gap-1 p-0.5 bg-slate-100 rounded-md border border-slate-200 shrink-0">
              <button
                type="button"
                onClick={() => {
                  setActiveFace('front');
                  setIsCropMode(false);
                }}
                className={`px-3 py-1 text-xs font-semibold rounded transition-colors cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                  activeFace === 'front'
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <span>{frontLabel}</span>
                {frontRawImage && <Check className="w-3 h-3 text-emerald-600" />}
              </button>

              {sidesCount === 2 && (
                <button
                  type="button"
                  onClick={() => {
                    setActiveFace('back');
                    setIsCropMode(false);
                  }}
                  className={`px-3 py-1 text-xs font-semibold rounded transition-colors cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                    activeFace === 'back'
                      ? 'bg-white text-slate-900 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <span>{backLabel}</span>
                  {backRawImage && <Check className="w-3 h-3 text-emerald-600" />}
                </button>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {inlineNotice && (
              <span className="text-xs font-medium text-red-600 bg-red-50 border border-red-200 px-2.5 py-1 rounded">
                {inlineNotice}
              </span>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded cursor-pointer transition-colors"
              aria-label="إغلاق"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* Main Studio Split */}
        <div className="flex-1 min-h-0 flex flex-col lg:flex-row overflow-hidden">
          {/* Controls & Dropdowns Sidebar (350px) */}
          <aside className="w-full lg:w-[340px] shrink-0 bg-slate-50/70 border-b lg:border-b-0 lg:border-l border-slate-200 overflow-y-auto p-4 space-y-4 text-xs">
            {/* Section 1: Document Type & Identity */}
            <div className="space-y-2.5">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">نوع المستمسك</label>
                <select
                  value={selectedTypeId}
                  onChange={(e) => handleSelectType(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-md px-2.5 py-2 text-xs font-medium text-slate-800 focus:border-blue-600 focus:outline-none cursor-pointer"
                >
                  {PRESET_GROUPS.map((grp) => {
                    const items = DOCUMENT_PRESETS.filter((p) => p.category === grp.category);
                    if (items.length === 0) return null;
                    return (
                      <optgroup key={grp.category} label={grp.label}>
                        {items.map((preset) => (
                          <option key={preset.id} value={preset.id}>
                            {preset.nameAr}
                          </option>
                        ))}
                      </optgroup>
                    );
                  })}
                  <optgroup label="أخرى">
                    <option value="custom">مستمسك مخصص</option>
                  </optgroup>
                </select>
              </div>

              {/* Compact Dimension Line + Inline Toggle */}
              <div className="flex items-center justify-between text-[11px] text-slate-600 pt-0.5">
                <span className="font-mono tabular-nums text-slate-800 font-semibold" dir="ltr">
                  {Number(widthMm.toFixed(1))} × {Number(heightMm.toFixed(1))} mm
                </span>
                <div className="flex items-center gap-2">
                  <span>{sidesCount === 2 ? 'وجهان' : 'وجه واحد'}</span>
                  <span aria-hidden="true">·</span>
                  <button
                    type="button"
                    onClick={() => setIsCustomDimsOpen((v) => !v)}
                    className="text-blue-600 hover:text-blue-800 font-semibold cursor-pointer"
                  >
                    {isCustomDimsOpen ? 'إخفاء الأبعاد' : 'تعديل القياس'}
                  </button>
                </div>
              </div>

              {/* Inline Custom Dimensions Drawer */}
              {isCustomDimsOpen && (
                <div className="pt-2 pb-1 border-t border-slate-200 space-y-2.5">
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="block text-[10px] text-slate-500 mb-1">العرض</label>
                      <input
                        type="number"
                        step="0.1"
                        min="1"
                        value={displayWidthVal}
                        onChange={(e) => {
                          const v = parseFloat(e.target.value) || 1;
                          setWidthMm(convertToMm(v, unit));
                        }}
                        className="w-full bg-white border border-slate-300 rounded px-2 py-1 font-mono tabular-nums text-slate-800 focus:border-blue-600 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-slate-500 mb-1">الارتفاع</label>
                      <input
                        type="number"
                        step="0.1"
                        min="1"
                        value={displayHeightVal}
                        onChange={(e) => {
                          const v = parseFloat(e.target.value) || 1;
                          setHeightMm(convertToMm(v, unit));
                        }}
                        className="w-full bg-white border border-slate-300 rounded px-2 py-1 font-mono tabular-nums text-slate-800 focus:border-blue-600 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-slate-500 mb-1">الوحدة</label>
                      <select
                        value={unit}
                        onChange={(e) => setUnit(e.target.value as UnitType)}
                        className="w-full bg-white border border-slate-300 rounded px-1.5 py-1 font-mono text-slate-800 focus:border-blue-600 focus:outline-none cursor-pointer"
                      >
                        <option value="mm">mm</option>
                        <option value="cm">cm</option>
                        <option value="inch">inch</option>
                        <option value="px">px</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="block text-[10px] text-slate-500 mb-1">الأوجه</label>
                      <select
                        value={sidesCount}
                        onChange={(e) => {
                          const s = Number(e.target.value) as 1 | 2;
                          setSidesCount(s);
                          if (s === 1 && activeFace === 'back') setActiveFace('front');
                        }}
                        className="w-full bg-white border border-slate-300 rounded px-1.5 py-1 text-slate-800 focus:border-blue-600 focus:outline-none cursor-pointer"
                      >
                        <option value={1}>وجه واحد</option>
                        <option value={2}>وجهان</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] text-slate-500 mb-1">الاتجاه</label>
                      <select
                        value={orientation}
                        onChange={(e) => handleToggleOrientation(e.target.value as DocumentOrientation)}
                        className="w-full bg-white border border-slate-300 rounded px-1.5 py-1 text-slate-800 focus:border-blue-600 focus:outline-none cursor-pointer"
                      >
                        <option value="landscape">أفقي</option>
                        <option value="portrait">عمودي</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] text-slate-500 mb-1">الحواف (mm)</label>
                      <input
                        type="number"
                        step="0.5"
                        min="0"
                        max="20"
                        value={radiusMm}
                        onChange={(e) => setRadiusMm(Math.max(0, parseFloat(e.target.value) || 0))}
                        className="w-full bg-white border border-slate-300 rounded px-2 py-1 font-mono tabular-nums text-slate-800 focus:border-blue-600 focus:outline-none"
                      />
                    </div>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">اسم المستمسك</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => {
                    setTitle(e.target.value);
                    setTitleEditedManually(true);
                  }}
                  className="w-full bg-white border border-slate-300 rounded-md px-2.5 py-1.5 text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">المجموعة</label>
                <select
                  value={selectedGroupId}
                  onChange={(e) => setSelectedGroupId(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-md px-2.5 py-1.5 text-xs text-slate-800 focus:border-blue-600 focus:outline-none cursor-pointer"
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

            <div className="border-t border-slate-200" />

            {/* Section 2: Document Filters & Auto-Correction */}
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-bold text-slate-700">فلاتر المستند</span>
                <button
                  type="button"
                  disabled={!activeRawImage || isProcessing}
                  onClick={handleAutoCorrect}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-bold flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-40 whitespace-nowrap ${
                    activeAdjustments.autoCorrected
                      ? 'bg-blue-600 text-white'
                      : 'bg-white hover:bg-slate-100 text-slate-800 border border-slate-300'
                  }`}
                >
                  <ScanLine className="w-3.5 h-3.5" />
                  <span>{isProcessing ? 'جاري المعالجة...' : 'تصحيح تلقائي'}</span>
                </button>
              </div>

              <select
                value={activeAdjustments.filter}
                disabled={!activeRawImage}
                onChange={(e) =>
                  updateActiveAdjustments({ filter: e.target.value as DocumentFilterType })
                }
                className="w-full bg-white border border-slate-300 rounded-md px-2.5 py-2 text-xs font-medium text-slate-800 focus:border-blue-600 focus:outline-none cursor-pointer disabled:opacity-50"
              >
                {DOCUMENT_FILTER_OPTIONS.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.label}
                  </option>
                ))}
              </select>

              {/* Precision Rotation & Image Sliders */}
              <div className="space-y-2.5 pt-1">
                <div>
                  <div className="flex items-center justify-between text-[11px] text-slate-700 mb-1">
                    <span className="font-semibold">زاوية الاستقامة</span>
                    <div className="flex items-center gap-2">
                      <span className="font-mono tabular-nums text-blue-700 font-bold" dir="ltr">
                        {activeAdjustments.fineAngle.toFixed(1)}°
                      </span>
                      {activeAdjustments.fineAngle !== 0 && (
                        <button
                          type="button"
                          onClick={() => updateActiveAdjustments({ fineAngle: 0 })}
                          className="text-[10px] text-slate-500 hover:text-slate-900 cursor-pointer"
                        >
                          0°
                        </button>
                      )}
                    </div>
                  </div>
                  <input
                    type="range"
                    min="-45"
                    max="45"
                    step="0.5"
                    disabled={!activeRawImage}
                    value={activeAdjustments.fineAngle}
                    onChange={(e) =>
                      updateActiveAdjustments({ fineAngle: parseFloat(e.target.value) })
                    }
                    className="w-full accent-blue-600 cursor-pointer disabled:opacity-40"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between text-[11px] text-slate-700 mb-1">
                    <span className="font-semibold">السطوع</span>
                    <span className="font-mono tabular-nums text-slate-600" dir="ltr">
                      {activeAdjustments.brightness > 0
                        ? `+${activeAdjustments.brightness}`
                        : activeAdjustments.brightness}
                    </span>
                  </div>
                  <input
                    type="range"
                    min="-60"
                    max="60"
                    step="2"
                    disabled={!activeRawImage}
                    value={activeAdjustments.brightness}
                    onChange={(e) =>
                      updateActiveAdjustments({ brightness: parseInt(e.target.value, 10) })
                    }
                    className="w-full accent-blue-600 cursor-pointer disabled:opacity-40"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between text-[11px] text-slate-700 mb-1">
                    <span className="font-semibold">التباين</span>
                    <span className="font-mono tabular-nums text-slate-600" dir="ltr">
                      {activeAdjustments.contrast > 0
                        ? `+${activeAdjustments.contrast}`
                        : activeAdjustments.contrast}
                    </span>
                  </div>
                  <input
                    type="range"
                    min="-60"
                    max="60"
                    step="2"
                    disabled={!activeRawImage}
                    value={activeAdjustments.contrast}
                    onChange={(e) =>
                      updateActiveAdjustments({ contrast: parseInt(e.target.value, 10) })
                    }
                    className="w-full accent-blue-600 cursor-pointer disabled:opacity-40"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between text-[11px] text-slate-700 mb-1">
                    <span className="font-semibold">الحدة</span>
                    <span className="font-mono tabular-nums text-slate-600" dir="ltr">
                      {activeAdjustments.sharpness}
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="5"
                    disabled={!activeRawImage}
                    value={activeAdjustments.sharpness}
                    onChange={(e) =>
                      updateActiveAdjustments({ sharpness: parseInt(e.target.value, 10) })
                    }
                    className="w-full accent-blue-600 cursor-pointer disabled:opacity-40"
                  />
                </div>
              </div>
            </div>

            <div className="border-t border-slate-200" />

            {/* Section 3: Notes & Options */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-bold text-slate-700">ملاحظات</label>
                <span className="text-[10px] font-mono tabular-nums text-slate-400">
                  {notes.length}/500
                </span>
              </div>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value.slice(0, 500))}
                rows={2}
                className="w-full bg-white border border-slate-300 rounded-md px-2.5 py-1.5 text-xs text-slate-800 focus:border-blue-600 focus:outline-none resize-none"
              />

              <div className="flex items-center justify-between gap-2 pt-1">
                <label className="flex items-center gap-1.5 cursor-pointer text-slate-700">
                  <input
                    type="checkbox"
                    checked={isFavorite}
                    onChange={(e) => setIsFavorite(e.target.checked)}
                    className="rounded accent-amber-500"
                  />
                  <Star
                    className={`w-3.5 h-3.5 ${
                      isFavorite ? 'text-amber-500 fill-amber-400' : 'text-slate-400'
                    }`}
                  />
                  <span>مفضلة</span>
                </label>

                <label className="flex items-center gap-1.5 cursor-pointer text-slate-700">
                  <input
                    type="checkbox"
                    checked={isEncrypted}
                    onChange={(e) => setIsEncrypted(e.target.checked)}
                    className="rounded accent-blue-600"
                  />
                  <Shield
                    className={`w-3.5 h-3.5 ${isEncrypted ? 'text-blue-600' : 'text-slate-400'}`}
                  />
                  <span>تشفير AES-256</span>
                </label>
              </div>

              {sidesCount === 2 && backRawImage && (
                <div className="flex items-center justify-between gap-2 pt-1">
                  <span className="text-[11px] font-semibold text-slate-700">صورة الغلاف</span>
                  <select
                    value={coverFace}
                    onChange={(e) => setCoverFace(e.target.value as 'front' | 'back')}
                    className="bg-white border border-slate-300 rounded px-2 py-1 text-xs text-slate-800 focus:border-blue-600 focus:outline-none cursor-pointer"
                  >
                    <option value="front">{frontLabel}</option>
                    <option value="back">{backLabel}</option>
                  </select>
                </div>
              )}
            </div>
          </aside>

          {/* Main Visual Stage & Action Dock */}
          <div className="flex-1 min-w-0 flex flex-col bg-slate-100 overflow-hidden">
            {/* Hidden File Input */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleLoadFile(file);
                e.target.value = '';
              }}
              className="hidden"
            />

            {/* Viewport Canvas */}
            <div
              ref={stageContainerRef}
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragOver(true);
              }}
              onDragLeave={() => setIsDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragOver(false);
                const file = e.dataTransfer.files?.[0];
                if (file) handleLoadFile(file);
              }}
              onWheel={handleWheelZoom}
              className={`flex-1 relative flex items-center justify-center p-6 overflow-hidden transition-colors ${
                isDragOver ? 'bg-blue-50/70' : 'bg-slate-100'
              }`}
            >
              {/* Mode 1: Camera Live Capture */}
              {isCameraActive ? (
                <div className="flex flex-col items-center gap-3 w-full max-w-xl">
                  <div className="w-full aspect-video bg-slate-950 rounded-md overflow-hidden border border-slate-300 shadow-lg">
                    <video
                      ref={videoRef}
                      className="w-full h-full object-contain"
                      autoPlay
                      playsInline
                      muted
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleCaptureCamera}
                      className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-xs font-bold flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                    >
                      <Camera className="w-4 h-4" />
                      <span>التقاط</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const next = cameraFacing === 'environment' ? 'user' : 'environment';
                        setCameraFacing(next);
                        handleStartCamera(next);
                      }}
                      className="px-3 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded-md text-xs font-semibold flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>تبديل الكاميرا</span>
                    </button>
                    <button
                      type="button"
                      onClick={stopCamera}
                      className="px-3 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded-md text-xs font-semibold cursor-pointer whitespace-nowrap"
                    >
                      إلغاء
                    </button>
                  </div>
                </div>
              ) : isCropMode && activeRawImage ? (
                /* Mode 2: 4-Corner Perspective Rectification */
                <div className="flex flex-col items-center gap-3 w-full h-full justify-center">
                  <div
                    ref={cropBoxRef}
                    className="relative inline-block max-w-full max-h-[calc(100%-48px)] select-none shadow-lg bg-slate-900"
                  >
                    <img
                      src={activeRawImage}
                      alt={title}
                      className="block max-w-full max-h-[calc(92vh-240px)] object-contain pointer-events-none"
                      draggable={false}
                    />

                    {/* Polygon Overlay */}
                    <svg
                      viewBox="0 0 100 100"
                      preserveAspectRatio="none"
                      className="absolute inset-0 w-full h-full pointer-events-none"
                    >
                      <polygon
                        points={cropCorners.map((p) => `${p.x * 100},${p.y * 100}`).join(' ')}
                        fill="rgba(37, 99, 235, 0.14)"
                        stroke="#2563eb"
                        strokeWidth="0.6"
                      />
                    </svg>

                    {/* 4 Corner Handles */}
                    {cropCorners.map((pt, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onPointerDown={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setDraggingCornerIdx(idx);
                        }}
                        style={{
                          left: `${pt.x * 100}%`,
                          top: `${pt.y * 100}%`,
                        }}
                        className="absolute -translate-x-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-blue-600 border-2 border-white shadow-md cursor-move hover:scale-110 transition-transform"
                        aria-label={`زاوية ${idx + 1}`}
                      />
                    ))}
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleApplyPerspectiveCrop}
                      disabled={isProcessing}
                      className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-xs font-bold flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>تطبيق القص</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleAutoDetectCorners}
                      disabled={isProcessing}
                      className="px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 rounded-md text-xs font-semibold flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                    >
                      <ScanLine className="w-3.5 h-3.5" />
                      <span>تحديد تلقائي</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsCropMode(false)}
                      className="px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded-md text-xs font-semibold cursor-pointer whitespace-nowrap"
                    >
                      إلغاء
                    </button>
                  </div>
                </div>
              ) : !activeRawImage ? (
                /* Mode 3: Empty Document Frame with Direct Add Controls */
                <div
                  style={{
                    width: `${frameDims.width}px`,
                    height: `${frameDims.height}px`,
                    borderRadius: `${Math.min(28, radiusMm * 2.5)}px`,
                  }}
                  className={`bg-white border-2 border-dashed flex flex-col items-center justify-center gap-4 transition-colors shadow-sm ${
                    isDragOver ? 'border-blue-600 bg-blue-50/40' : 'border-slate-300'
                  }`}
                >
                  <div className="text-xs font-bold text-slate-700">
                    {activeFace === 'front' ? frontLabel : backLabel}
                  </div>
                  <div className="flex flex-wrap items-center justify-center gap-2 px-4">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-xs font-semibold flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>ملف</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleClipboardButton}
                      className="px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 rounded-md text-xs font-semibold flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                    >
                      <Clipboard className="w-3.5 h-3.5 text-slate-600" />
                      <span>لصق</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleStartCamera()}
                      className="px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 rounded-md text-xs font-semibold flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                    >
                      <Camera className="w-3.5 h-3.5 text-slate-600" />
                      <span>كاميرا</span>
                    </button>
                  </div>
                </div>
              ) : (
                /* Mode 4: Active Document Frame with Live Preview, Drag Pan & Wheel Zoom */
                <div
                  ref={previewFrameRef}
                  onPointerDown={handleImagePointerDown}
                  onDoubleClick={() =>
                    updateActiveTransform((prev) => ({ ...prev, zoom: 1, panX: 0, panY: 0 }))
                  }
                  style={{
                    width: `${frameDims.width}px`,
                    height: `${frameDims.height}px`,
                    borderRadius: `${Math.min(28, radiusMm * 2.5)}px`,
                  }}
                  className={`relative bg-white border border-slate-300 overflow-hidden shadow-md touch-none ${
                    isDraggingImage ? 'cursor-grabbing ring-2 ring-blue-500' : 'cursor-grab'
                  }`}
                >
                  <img
                    src={isComparingOriginal ? activeOriginalImage || activeRawImage : activeFilteredPreview}
                    alt={title}
                    draggable={false}
                    className="w-full h-full object-cover select-none pointer-events-none"
                    style={{
                      transform: `scale(${activeTransform.zoom}) translate(${activeTransform.panX}px, ${activeTransform.panY}px) rotate(${totalPreviewRotation}deg) scaleX(${
                        activeTransform.flipH ? -1 : 1
                      }) scaleY(${activeTransform.flipV ? -1 : 1})`,
                    }}
                  />
                </div>
              )}
            </div>

            {/* Bottom Studio Toolbar Dock */}
            <div className="h-12 px-3 bg-white border-t border-slate-200 flex items-center justify-between gap-2 shrink-0">
              {/* Left Group: Add / Replace Dropdown & Swap */}
              <div className="flex items-center gap-1.5">
                <div className="relative" ref={addMenuRef}>
                  <button
                    type="button"
                    onClick={() => setIsAddMenuOpen((v) => !v)}
                    className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-md text-xs font-semibold flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>إضافة</span>
                    <ChevronDown className="w-3.5 h-3.5" />
                  </button>

                  {isAddMenuOpen && (
                    <div className="absolute bottom-full right-0 mb-1.5 w-44 bg-white border border-slate-200 rounded-md shadow-lg py-1 z-30 text-xs">
                      <button
                        type="button"
                        onClick={() => {
                          setIsAddMenuOpen(false);
                          fileInputRef.current?.click();
                        }}
                        className="w-full px-3 py-2 text-right hover:bg-slate-50 text-slate-800 flex items-center gap-2 cursor-pointer"
                      >
                        <Upload className="w-3.5 h-3.5 text-slate-500" />
                        <span>اختيار ملف</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleClipboardButton}
                        className="w-full px-3 py-2 text-right hover:bg-slate-50 text-slate-800 flex items-center gap-2 cursor-pointer"
                      >
                        <Clipboard className="w-3.5 h-3.5 text-slate-500" />
                        <span>لصق من الحافظة</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleStartCamera()}
                        className="w-full px-3 py-2 text-right hover:bg-slate-50 text-slate-800 flex items-center gap-2 cursor-pointer"
                      >
                        <Camera className="w-3.5 h-3.5 text-slate-500" />
                        <span>التقاط كاميرا</span>
                      </button>
                      {sidesCount === 2 && (frontRawImage || backRawImage) && (
                        <>
                          <div className="my-1 border-t border-slate-100" />
                          <button
                            type="button"
                            onClick={handleSwapFaces}
                            className="w-full px-3 py-2 text-right hover:bg-slate-50 text-slate-800 flex items-center gap-2 cursor-pointer"
                          >
                            <ArrowLeftRight className="w-3.5 h-3.5 text-slate-500" />
                            <span>تبديل الوجهين</span>
                          </button>
                        </>
                      )}
                      {activeRawImage && (
                        <>
                          <div className="my-1 border-t border-slate-100" />
                          <button
                            type="button"
                            onClick={handleClearFace}
                            className="w-full px-3 py-2 text-right hover:bg-red-50 text-red-600 flex items-center gap-2 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>حذف الصورة</span>
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>

                {activeRawImage && !isCropMode && !isCameraActive && (
                  <button
                    type="button"
                    onClick={handleEnterCropMode}
                    className="px-2.5 py-1.5 bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 rounded-md text-xs font-semibold flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                  >
                    <Crop className="w-3.5 h-3.5 text-blue-600" />
                    <span>تحديد الزوايا</span>
                  </button>
                )}
              </div>

              {/* Center Group: Rotation & Flip Tools */}
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  disabled={!activeRawImage || isCropMode}
                  onClick={() => rotateStep(-90)}
                  className="p-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded cursor-pointer disabled:opacity-40"
                  aria-label="تدوير يسار 90 درجة"
                  title="تدوير -90°"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  disabled={!activeRawImage || isCropMode}
                  onClick={() => rotateStep(90)}
                  className="p-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded cursor-pointer disabled:opacity-40"
                  aria-label="تدوير يمين 90 درجة"
                  title="تدوير +90°"
                >
                  <RotateCw className="w-3.5 h-3.5" />
                </button>

                <div className="h-4 w-px bg-slate-200 mx-0.5" />

                <button
                  type="button"
                  disabled={!activeRawImage || isCropMode}
                  onClick={() =>
                    updateActiveTransform((prev) => ({ ...prev, flipH: !prev.flipH }))
                  }
                  className={`p-1.5 border rounded cursor-pointer disabled:opacity-40 ${
                    activeTransform.flipH
                      ? 'bg-blue-50 border-blue-400 text-blue-700'
                      : 'bg-white hover:bg-slate-100 border-slate-200 text-slate-700'
                  }`}
                  aria-label="قلب أفقي"
                  title="قلب أفقي"
                >
                  <FlipHorizontal className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  disabled={!activeRawImage || isCropMode}
                  onClick={() =>
                    updateActiveTransform((prev) => ({ ...prev, flipV: !prev.flipV }))
                  }
                  className={`p-1.5 border rounded cursor-pointer disabled:opacity-40 ${
                    activeTransform.flipV
                      ? 'bg-blue-50 border-blue-400 text-blue-700'
                      : 'bg-white hover:bg-slate-100 border-slate-200 text-slate-700'
                  }`}
                  aria-label="قلب عمودي"
                  title="قلب عمودي"
                >
                  <FlipVertical className="w-3.5 h-3.5" />
                </button>

                <div className="h-4 w-px bg-slate-200 mx-0.5 hidden sm:block" />

                <button
                  type="button"
                  disabled={!activeRawImage || isCropMode}
                  onClick={() =>
                    updateActiveTransform((prev) => ({
                      ...prev,
                      zoom: Math.max(0.25, Number((prev.zoom - 0.1).toFixed(2))),
                    }))
                  }
                  className="p-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded cursor-pointer disabled:opacity-40 hidden sm:inline-flex"
                  aria-label="تصغير"
                >
                  <ZoomOut className="w-3.5 h-3.5" />
                </button>
                <span
                  className="font-mono tabular-nums text-[11px] font-semibold text-slate-700 min-w-[42px] text-center hidden sm:inline-block"
                  dir="ltr"
                >
                  {Math.round(activeTransform.zoom * 100)}%
                </span>
                <button
                  type="button"
                  disabled={!activeRawImage || isCropMode}
                  onClick={() =>
                    updateActiveTransform((prev) => ({
                      ...prev,
                      zoom: Math.min(4.0, Number((prev.zoom + 0.1).toFixed(2))),
                    }))
                  }
                  className="p-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded cursor-pointer disabled:opacity-40 hidden sm:inline-flex"
                  aria-label="تكبير"
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  disabled={!activeRawImage || isCropMode}
                  onClick={handleFitImage}
                  className="px-2 py-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded text-[11px] font-medium cursor-pointer disabled:opacity-40 hidden md:inline-flex items-center gap-1 whitespace-nowrap"
                >
                  <Maximize2 className="w-3 h-3" />
                  <span>احتواء</span>
                </button>
              </div>

              {/* Right Group: Compare Original & Reset */}
              <div className="flex items-center gap-1.5">
                {activeRawImage && !isCropMode && (
                  <>
                    <button
                      type="button"
                      onMouseDown={() => setIsComparingOriginal(true)}
                      onMouseUp={() => setIsComparingOriginal(false)}
                      onMouseLeave={() => setIsComparingOriginal(false)}
                      onTouchStart={() => setIsComparingOriginal(true)}
                      onTouchEnd={() => setIsComparingOriginal(false)}
                      className="px-2.5 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-md text-xs font-medium flex items-center gap-1 cursor-pointer whitespace-nowrap"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>الأصل</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleResetAll}
                      className="px-2.5 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-md text-xs font-medium flex items-center gap-1 cursor-pointer whitespace-nowrap"
                    >
                      <SlidersHorizontal className="w-3.5 h-3.5" />
                      <span>إعادة ضبط</span>
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <footer className="h-13 px-4 bg-white border-t border-slate-200 flex items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-2 text-xs text-slate-600 font-mono tabular-nums" dir="ltr">
            <span>
              {Number(widthMm.toFixed(1))} × {Number(heightMm.toFixed(1))} mm
            </span>
            <span aria-hidden="true">·</span>
            <span>{activeTransform.rotation}°</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-md text-xs font-semibold cursor-pointer whitespace-nowrap"
            >
              إلغاء
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={!title.trim() || !frontRawImage || isSaving}
              className="px-5 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-45 text-white rounded-md text-xs font-bold flex items-center gap-1.5 cursor-pointer whitespace-nowrap transition-colors"
            >
              <Check className="w-3.5 h-3.5" />
              <span>{isSaving ? 'جاري الحفظ...' : 'حفظ المستمسك'}</span>
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
};
