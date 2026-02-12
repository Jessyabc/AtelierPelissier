"use client";

import { useRef, useCallback, useEffect } from "react";

type Props = {
  value: string | null;
  onChange: (dataUrl: string | null) => void;
  label: string;
  disabled?: boolean;
};

/** Canvas-based signature capture. Outputs base64 PNG data URL. */
export function SignaturePad({ value, onChange, label, disabled }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawingRef = useRef(false);

  const getCtx = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    return canvas.getContext("2d");
  }, []);

  const getPoint = useCallback(
    (e: React.MouseEvent | React.TouchEvent): { x: number; y: number } | null => {
      const canvas = canvasRef.current;
      if (!canvas) return null;
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      if ("touches" in e) {
        const t = e.touches[0];
        return t ? { x: (t.clientX - rect.left) * scaleX, y: (t.clientY - rect.top) * scaleY } : null;
      }
      return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY };
    },
    []
  );

  const startDrawing = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      e.preventDefault();
      if (disabled) return;
      const ctx = getCtx();
      const pt = getPoint(e);
      if (ctx && pt) {
        isDrawingRef.current = true;
        ctx.beginPath();
        ctx.moveTo(pt.x, pt.y);
      }
    },
    [disabled, getCtx, getPoint]
  );

  const draw = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      e.preventDefault();
      if (!isDrawingRef.current || disabled) return;
      const ctx = getCtx();
      const pt = getPoint(e);
      if (ctx && pt) {
        ctx.lineTo(pt.x, pt.y);
        ctx.stroke();
      }
    },
    [disabled, getCtx, getPoint]
  );

  const stopDrawing = useCallback(() => {
    if (!isDrawingRef.current) return;
    isDrawingRef.current = false;
    const canvas = canvasRef.current;
    if (canvas) {
      const dataUrl = canvas.toDataURL("image/png");
      onChange(dataUrl);
    }
  }, [onChange]);

  const clear = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = getCtx();
    if (canvas && ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      onChange(null);
    }
  }, [getCtx, onChange]);

  // Load existing signature when value changes, or configure empty canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.strokeStyle = "#000";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";

    if (value) {
      const img = new Image();
      img.onload = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      };
      img.src = value;
    } else {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  }, [value]);

  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-gray-700">{label}</label>
      <div className="relative rounded border border-gray-300 bg-white">
        <canvas
          ref={canvasRef}
          width={400}
          height={120}
          className="block w-full touch-none rounded border-0"
          style={{ width: "100%", height: 120 }}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
        />
      </div>
      <button
        type="button"
        onClick={clear}
        disabled={disabled}
        className="mt-1 text-xs text-gray-500 hover:text-gray-700 disabled:opacity-50"
      >
        Clear
      </button>
    </div>
  );
}
