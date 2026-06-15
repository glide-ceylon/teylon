"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseClient";
import { useProfile } from "@/lib/hooks/useProfile";
import { AppShell, PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";
import toast from "react-hot-toast";

export default function NewVehiclePage() {
  const { data: profile } = useProfile();
  const router = useRouter();
  const qc = useQueryClient();

  const [identifier, setIdentifier] = useState("");
  const [details, setDetails] = useState("");

  const mutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase
        .from("vehicles")
        .insert({
          org_id: profile!.org_id,
          identifier: identifier.trim(),
          details: details.trim() || null,
        })
        .select("id")
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast.success("Vehicle added");
      qc.invalidateQueries({ queryKey: ["vehicles"] });
      router.push(`/vehicles/${data.id}`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <AppShell>
      <PageHeader title="Add Vehicle" subtitle="Drivers scan its QR to start a trip" />

      <div className="px-4 md:px-6 pb-8 max-w-lg space-y-4">
        <Input
          label="Plate / identifier *"
          placeholder="e.g. WP-1234 or Lorry 3"
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
          autoFocus
        />
        <Input
          label="Details"
          placeholder="e.g. White Isuzu truck"
          value={details}
          onChange={(e) => setDetails(e.target.value)}
        />

        <Card className="bg-tea-50 border-tea-200">
          <p className="text-sm text-tea-600">
            After saving you&apos;ll get a QR code. Print it and stick it in the lorry —
            the driver scans it to link themselves to this vehicle.
          </p>
        </Card>

        <Button
          fullWidth
          size="lg"
          onClick={() => mutation.mutate()}
          loading={mutation.isPending}
          disabled={!identifier.trim()}
        >
          Add vehicle
        </Button>
      </div>
    </AppShell>
  );
}
