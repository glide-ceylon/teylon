"use client";

import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseClient";
import { AppShell, PageHeader } from "@/components/AppShell";
import { Card } from "@/components/ui/Card";
import { QRCodeDisplay } from "@/components/QRCode";

export default function VehicleDetailPage() {
  const { id } = useParams<{ id: string }>();

  const { data: vehicle } = useQuery({
    queryKey: ["vehicle", id],
    queryFn: async () => {
      const { data } = await supabase.from("vehicles").select("*").eq("id", id).single();
      return data;
    },
  });

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const qrValue = `${origin}/today?vehicle=${id}`;

  if (!vehicle) return null;

  return (
    <AppShell>
      <PageHeader title={vehicle.identifier} subtitle={vehicle.details ?? "Vehicle"} />

      <div className="flex flex-col items-center gap-6 px-4 pb-8 md:px-6">
        <Card className="w-full max-w-xs flex flex-col items-center gap-4">
          <QRCodeDisplay value={qrValue} size={220} label={vehicle.identifier} />
        </Card>
        <p className="max-w-xs text-center text-sm text-tea-500">
          Print this and stick it in the lorry. The driver scans it from their
          Today screen to link to this vehicle for the trip.
        </p>
      </div>
    </AppShell>
  );
}
