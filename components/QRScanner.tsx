"use client";

import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { Button } from "./ui/Button";

interface QRScannerProps {
  onResult: (result: string) => void;
  onClose: () => void;
}

export function QRScanner({ onResult, onClose }: QRScannerProps) {
  const [error, setError] = useState<string | null>(null);
  const scannerRef = useRef<unknown>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;

    async function startScanner() {
      try {
        const { Html5QrcodeScanner } = await import("html5-qrcode");
        if (!mountedRef.current) return;

        const scanner = new Html5QrcodeScanner(
          "qr-reader",
          {
            fps: 10,
            qrbox: { width: 250, height: 250 },
            aspectRatio: 1,
            showTorchButtonIfSupported: true,
          },
          false
        );

        scanner.render(
          (result: string) => {
            if (mountedRef.current) {
              onResult(result);
              scanner.clear().catch(() => {});
            }
          },
          () => {
            // Ignore per-frame errors
          }
        );

        scannerRef.current = scanner;
      } catch {
        if (mountedRef.current) {
          setError("Camera access denied or not supported on this device.");
        }
      }
    }

    startScanner();

    return () => {
      mountedRef.current = false;
      if (scannerRef.current) {
        (scannerRef.current as { clear: () => Promise<void> })
          .clear()
          .catch(() => {});
      }
    };
  }, [onResult]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/90">
      {/* Header */}
      <div className="flex items-center justify-between p-4 text-white">
        <p className="font-semibold">Scan Owner QR Code</p>
        <button onClick={onClose} className="rounded-full p-2 hover:bg-white/10">
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Scanner */}
      <div className="flex flex-1 flex-col items-center justify-center px-4">
        {error ? (
          <div className="text-center text-white">
            <p className="mb-4 text-red-400">{error}</p>
            <Button variant="secondary" onClick={onClose}>
              Go back
            </Button>
          </div>
        ) : (
          <div
            id="qr-reader"
            className="w-full max-w-sm overflow-hidden rounded-2xl"
          />
        )}
      </div>

      <p className="pb-8 text-center text-sm text-white/60">
        Point the camera at the owner&apos;s QR code
      </p>
    </div>
  );
}
