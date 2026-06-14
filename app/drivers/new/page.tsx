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

export default function NewDriverPage() {
  const { data: profile } = useProfile();
  const router = useRouter();
  const qc = useQueryClient();

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [lorryId, setLorryId] = useState("");
  const [vehicle, setVehicle] = useState("");

  const mutation = useMutation({
    mutationFn: async () => {
      if (!phone.startsWith("+")) throw new Error("Phone must be E.164, e.g. +94771234567");
      const { error } = await supabase.functions.invoke("create-driver", {
        body: {
          name,
          phone,
          lorry_identifier: lorryId,
          vehicle_details: vehicle || null,
          org_id: profile!.org_id,
        },
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(`Driver account created — ${name} can now log in with ${phone}`);
      qc.invalidateQueries({ queryKey: ["drivers"] });
      router.push("/drivers");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <AppShell>
      <PageHeader title="Add Driver" />

      <div className="px-4 md:px-6 pb-8 max-w-lg space-y-4">
        <Card className="bg-tea-50 border-tea-200">
          <p className="text-sm text-tea-600">
            Creating a driver account lets them log into Teylon with their phone number.
            Give them the phone number you enter here — they use it to sign in with OTP.
          </p>
        </Card>

        <Input
          label="Driver full name *"
          placeholder="e.g. Kamal Silva"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
        />
        <Input
          label="Driver phone number *"
          placeholder="+94771234567"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          inputMode="tel"
          hint="Must be E.164 format with country code"
        />
        <Input
          label="Lorry / vehicle identifier *"
          placeholder="e.g. WP-1234 or Lorry 3"
          value={lorryId}
          onChange={(e) => setLorryId(e.target.value)}
          hint="Used to identify the lorry at collection"
        />
        <Input
          label="Vehicle details"
          placeholder="e.g. White Isuzu truck"
          value={vehicle}
          onChange={(e) => setVehicle(e.target.value)}
        />

        <Button
          fullWidth
          size="lg"
          onClick={() => mutation.mutate()}
          loading={mutation.isPending}
          disabled={!name.trim() || !phone.trim() || !lorryId.trim()}
        >
          Create driver account
        </Button>
      </div>
    </AppShell>
  );
}
