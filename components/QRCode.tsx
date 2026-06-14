"use client";

import { useEffect, useRef } from "react";

interface QRCodeDisplayProps {
  value: string;
  size?: number;
  label?: string;
}

export function QRCodeDisplay({
  value,
  size = 240,
  label,
}: QRCodeDisplayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current || !value) return;
    import("qrcode").then((QRCode) => {
      QRCode.toCanvas(canvasRef.current!, value, {
        width: size,
        margin: 2,
        color: {
          dark: "#245422",
          light: "#f1f7ef",
        },
      });
    });
  }, [value, size]);

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="rounded-2xl border-4 border-tea-100 p-2 bg-tea-50">
        <canvas
          ref={canvasRef}
          className="rounded-xl"
          width={size}
          height={size}
        />
      </div>
      {label && (
        <p className="text-center text-sm font-medium text-tea-600">{label}</p>
      )}
    </div>
  );
}
