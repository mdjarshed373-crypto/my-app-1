import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, ZoomIn, ZoomOut, RotateCw, Check } from 'lucide-react';
import { useLockBodyScroll } from '../../utils/scrollLock';

interface AvatarCropModalProps {
  imageSrc: string | null;
  onCancel: () => void;
  onSave: (croppedBase64: string) => Promise<void> | void;
}

const CROP_BOX_SIZE = 256;

export const AvatarCropModal: React.FC<AvatarCropModalProps> = ({
  imageSrc,
  onCancel,
  onSave,
}) => {
  useLockBodyScroll(Boolean(imageSrc));
  const [imgEl, setImgEl] = useState<HTMLImageElement | null>(null);
  const [zoom, setZoom] = useState<number>(1);
  const [rotation, setRotation] = useState<number>(0);
  const [offset, setOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [saving, setSaving] = useState<boolean>(false);

  const dragStartRef = useRef<{
    clientX: number;
    clientY: number;
    origX: number;
    origY: number;
  } | null>(null);

  useEffect(() => {
    if (!imageSrc) {
      setImgEl(null);
      return;
    }
    let cancelled = false;
    const img = new Image();
    img.onload = () => {
      if (!cancelled) {
        setImgEl(img);
        setZoom(1);
        setRotation(0);
        setOffset({ x: 0, y: 0 });
      }
    };
    img.src = imageSrc;
    return () => {
      cancelled = true;
    };
  }, [imageSrc]);

  if (!imageSrc) return null;

  const isRotatedOdd = Math.abs(rotation % 180) === 90;
  const naturalW = imgEl ? (isRotatedOdd ? imgEl.naturalHeight : imgEl.naturalWidth) : CROP_BOX_SIZE;
  const naturalH = imgEl ? (isRotatedOdd ? imgEl.naturalWidth : imgEl.naturalHeight) : CROP_BOX_SIZE;

  const baseCoverScale = imgEl
    ? Math.max(CROP_BOX_SIZE / naturalW, CROP_BOX_SIZE / naturalH)
    : 1;
  const totalScale = baseCoverScale * zoom;

  const renderedW = naturalW * totalScale;
  const renderedH = naturalH * totalScale;
  const maxPanX = Math.max(0, (renderedW - CROP_BOX_SIZE) / 2);
  const maxPanY = Math.max(0, (renderedH - CROP_BOX_SIZE) / 2);

  const clampOffset = (nx: number, ny: number, nextZoom = zoom) => {
    const scale = baseCoverScale * nextZoom;
    const rW = naturalW * scale;
    const rH = naturalH * scale;
    const limitX = Math.max(0, (rW - CROP_BOX_SIZE) / 2);
    const limitY = Math.max(0, (rH - CROP_BOX_SIZE) / 2);
    return {
      x: Math.max(-limitX, Math.min(limitX, nx)),
      y: Math.max(-limitY, Math.min(limitY, ny)),
    };
  };

  const clampedX = Math.max(-maxPanX, Math.min(maxPanX, offset.x));
  const clampedY = Math.max(-maxPanY, Math.min(maxPanY, offset.y));

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    dragStartRef.current = {
      clientX: e.clientX,
      clientY: e.clientY,
      origX: clampedX,
      origY: clampedY,
    };
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragStartRef.current) return;
    const dx = e.clientX - dragStartRef.current.clientX;
    const dy = e.clientY - dragStartRef.current.clientY;
    setOffset(
      clampOffset(dragStartRef.current.origX + dx, dragStartRef.current.origY + dy)
    );
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (dragStartRef.current) {
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        // ignore
      }
      dragStartRef.current = null;
    }
  };

  const handleZoomChange = (nextZoom: number) => {
    const z = Math.max(1, Math.min(3, Number(nextZoom.toFixed(2))));
    setZoom(z);
    setOffset((prev) => clampOffset(prev.x, prev.y, z));
  };

  const handleRotate = () => {
    setRotation((prev) => (prev + 90) % 360);
    setOffset({ x: 0, y: 0 });
  };

  const handleConfirmCrop = async () => {
    if (!imgEl || saving) return;
    setSaving(true);
    try {
      const outputSize = 256;
      const canvas = document.createElement('canvas');
      canvas.width = outputSize;
      canvas.height = outputSize;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.fillStyle = '#070B18';
      ctx.fillRect(0, 0, outputSize, outputSize);

      ctx.save();
      ctx.translate(outputSize / 2 + clampedX, outputSize / 2 + clampedY);
      ctx.rotate((rotation * Math.PI) / 180);
      ctx.scale(totalScale, totalScale);
      ctx.drawImage(
        imgEl,
        -imgEl.naturalWidth / 2,
        -imgEl.naturalHeight / 2,
        imgEl.naturalWidth,
        imgEl.naturalHeight
      );
      ctx.restore();

      const croppedDataUrl = canvas.toDataURL('image/jpeg', 0.85);
      await onSave(croppedDataUrl);
    } finally {
      setSaving(false);
    }
  };

  return createPortal(
    <div
      onClick={onCancel}
      className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="keep-dark-surface bg-[#0D1428] border border-sky-500/35 rounded-3xl max-w-sm w-full overflow-hidden shadow-2xl"
      >
        {/* Header */}
        <div className="bg-[#111D35] px-5 py-3.5 border-b border-slate-800 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-black font-gaming text-white uppercase tracking-wide">
              Crop Profile Photo
            </h3>
            <p className="text-[11px] text-slate-400">
              Drag &amp; zoom to fit inside the circle
            </p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            aria-label="Close"
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Square & Circle Cropper Viewport */}
        <div className="p-5 flex flex-col items-center space-y-4">
          <div
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            style={{ width: CROP_BOX_SIZE, height: CROP_BOX_SIZE }}
            className="relative rounded-xl overflow-hidden bg-[#050811] border-2 border-sky-500/60 cursor-grab active:cursor-grabbing touch-none select-none shadow-inner"
          >
            {imgEl && (
              <img
                src={imageSrc}
                alt="Crop preview"
                draggable={false}
                style={{
                  position: 'absolute',
                  left: '50%',
                  top: '50%',
                  width: `${imgEl.naturalWidth}px`,
                  height: `${imgEl.naturalHeight}px`,
                  maxWidth: 'none',
                  maxHeight: 'none',
                  transform: `translate(-50%, -50%) translate(${clampedX}px, ${clampedY}px) rotate(${rotation}deg) scale(${totalScale})`,
                  transformOrigin: 'center center',
                }}
                className="pointer-events-none select-none"
              />
            )}

            {/* Circular Overlay Spotlight Mask inside Square Frame */}
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
              <div
                style={{ width: CROP_BOX_SIZE - 8, height: CROP_BOX_SIZE - 8 }}
                className="rounded-full border-2 border-white shadow-[0_0_0_9999px_rgba(4,7,15,0.62)]"
              />
            </div>
          </div>

          {/* Zoom & Rotate Controls */}
          <div className="w-full space-y-2.5">
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => handleZoomChange(zoom - 0.15)}
                aria-label="Zoom out"
                className="p-2 rounded-lg bg-[#111D35] hover:bg-slate-800 border border-slate-700 text-slate-300 cursor-pointer"
              >
                <ZoomOut className="w-4 h-4" />
              </button>

              <input
                type="range"
                min="1"
                max="3"
                step="0.02"
                value={zoom}
                onChange={(e) => handleZoomChange(parseFloat(e.target.value))}
                aria-label="Zoom"
                className="flex-1 accent-blue-500 cursor-pointer"
              />

              <button
                type="button"
                onClick={() => handleZoomChange(zoom + 0.15)}
                aria-label="Zoom in"
                className="p-2 rounded-lg bg-[#111D35] hover:bg-slate-800 border border-slate-700 text-slate-300 cursor-pointer"
              >
                <ZoomIn className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={handleRotate}
                aria-label="Rotate 90 degrees"
                title="Rotate"
                className="p-2 rounded-lg bg-[#111D35] hover:bg-slate-800 border border-slate-700 text-sky-400 cursor-pointer"
              >
                <RotateCw className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="w-full flex items-center gap-2.5 pt-1">
            <button
              type="button"
              onClick={onCancel}
              disabled={saving}
              className="flex-1 py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs cursor-pointer transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirmCrop}
              disabled={saving || !imgEl}
              className="flex-1 py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold font-gaming text-xs tracking-wider uppercase flex items-center justify-center gap-1.5 shadow-lg shadow-blue-600/30 cursor-pointer transition-all disabled:opacity-50"
            >
              <Check className="w-4 h-4" />
              <span>{saving ? 'Saving...' : 'Set Photo'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};
