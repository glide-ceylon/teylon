"use client";

import { useProfile } from "@/lib/hooks/useProfile";
import { AppShell, PageHeader } from "@/components/AppShell";
import { QRCodeDisplay } from "@/components/QRCode";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Share2, Download } from "lucide-react";
import toast from "react-hot-toast";

export default function MyQRPage() {
  const { data: profile } = useProfile();

  // Encode a real URL (not a custom scheme) so ANY scanner — including the
  // native phone camera — recognises it and can deep-link into the app.
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const qrValue =
    profile?.role === "owner"
      ? `${origin}/collect?owner=${profile?.id}`
      : `${origin}/?ref=${profile?.id}`;

  async function handleShare() {
    try {
      await navigator.share({
        title: "My Teylon QR Code",
        text: `Scan to collect from ${profile?.full_name}`,
      });
    } catch {
      toast("Share not supported on this device", { icon: "ℹ️" });
    }
  }

  return (
    <AppShell>
      <PageHeader
        title="My QR Code"
        subtitle={
          profile?.role === "owner"
            ? "Show this to your agent/driver at collection"
            : "Show this to identify your lorry"
        }
      />

      <div className="flex flex-col items-center gap-6 px-4 pb-8 md:px-6">
        <Card className="w-full max-w-xs flex flex-col items-center gap-4">
          {profile?.id && (
            <QRCodeDisplay
              value={qrValue}
              size={220}
              label={profile.full_name}
            />
          )}
        </Card>

        <div className="w-full max-w-xs space-y-3">
          <p className="text-center text-sm text-tea-500">
            {profile?.role === "owner"
              ? "The driver scans this to start a collection for your field."
              : "Your lorry identifier embedded in this QR."}
          </p>

          {typeof navigator !== "undefined" && "share" in navigator && (
            <Button variant="secondary" fullWidth onClick={handleShare}>
              <Share2 className="h-4 w-4" />
              Share QR code
            </Button>
          )}
        </div>
      </div>
    </AppShell>
  );
}
