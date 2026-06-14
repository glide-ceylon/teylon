"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseClient";
import { useProfile } from "@/lib/hooks/useProfile";
import { AppShell, PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import toast from "react-hot-toast";

const AREA_FLOOR_CENTS = 4000;

export default function NewFieldPage() {
  const { data: profile } = useProfile();
  const router = useRouter();
  const qc = useQueryClient();

  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [acreage, setAcreage] = useState("");
  const [rateStr, setRateStr] = useState("40");
  const [lunchStr, setLunchStr] = useState("0");

  const mutation = useMutation({
    mutationFn: async () => {
      const rateCents = Math.max(
        Math.round((parseFloat(rateStr) || 40) * 100),
        AREA_FLOOR_CENTS
      );
      const lunchCents = Math.round((parseFloat(lunchStr) || 0) * 100);

      const { error } = await supabase.from("fields").insert({
        owner_id: profile!.id,
        name,
        location: location || null,
        acreage: acreage ? parseFloat(acreage) : null,
        rate_per_kg_cents: rateCents,
        lunch_allowance_cents: lunchCents,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Field added");
      qc.invalidateQueries({ queryKey: ["fields", profile?.id] });
      router.push("/fields");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <AppShell>
      <PageHeader title="Add Field" />

      <div className="px-4 md:px-6 pb-8 max-w-lg space-y-4">
        <Input
          label="Field name *"
          placeholder="e.g. Upper Nuwara Estate"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
        />
        <Input
          label="Location"
          placeholder="e.g. Nuwara Eliya"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
        />
        <Input
          label="Acreage"
          placeholder="e.g. 24"
          value={acreage}
          onChange={(e) => setAcreage(e.target.value)}
          inputMode="decimal"
        />
        <Input
          label="Rate per kg (Rs.) *"
          placeholder="40"
          value={rateStr}
          onChange={(e) => setRateStr(e.target.value)}
          inputMode="decimal"
          hint="Minimum area floor is Rs.40/kg"
        />
        <Input
          label="Lunch allowance per plucker (Rs.)"
          placeholder="0"
          value={lunchStr}
          onChange={(e) => setLunchStr(e.target.value)}
          inputMode="decimal"
          hint="Added to each plucker's pay per day"
        />

        <Button
          fullWidth
          size="lg"
          onClick={() => mutation.mutate()}
          loading={mutation.isPending}
          disabled={!name.trim()}
        >
          Create field
        </Button>
      </div>
    </AppShell>
  );
}
