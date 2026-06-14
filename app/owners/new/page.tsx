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

export default function NewOwnerPage() {
  const { data: profile } = useProfile();
  const router = useRouter();
  const qc = useQueryClient();

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [fieldName, setFieldName] = useState("");
  const [rateStr, setRateStr] = useState("40");

  const mutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke(
        "create-shadow-owner",
        {
          body: {
            name,
            phone: phone || null,
            field_name: fieldName || null,
            field_rate_cents: Math.max(Math.round((parseFloat(rateStr) || 40) * 100), 4000),
            org_id: profile!.org_id,
          },
        }
      );
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast.success("Owner created");
      qc.invalidateQueries({ queryKey: ["owners"] });
      router.push(`/owners/${data.owner_id}`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <AppShell>
      <PageHeader
        title="Create Shadow Owner"
        subtitle="Owner will be linked when they log in with this phone"
      />

      <div className="px-4 md:px-6 pb-8 max-w-lg space-y-4">
        <Card className="bg-tea-50 border-tea-200">
          <p className="text-sm text-tea-600">
            A shadow owner lets you start collecting immediately. If they later log in
            with this phone number, their account is automatically linked to their records.
          </p>
        </Card>

        <Input
          label="Full name *"
          placeholder="e.g. Nimal Perera"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
        />
        <Input
          label="Phone"
          placeholder="+94771234567"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          inputMode="tel"
          hint="Used to link account if they sign up later"
        />

        <div className="pt-2">
          <p className="text-sm font-semibold text-tea-700 mb-3">Optional: Add first field</p>
          <div className="space-y-3">
            <Input
              label="Field name"
              placeholder="e.g. Upper Nuwara Estate"
              value={fieldName}
              onChange={(e) => setFieldName(e.target.value)}
            />
            {fieldName && (
              <Input
                label="Rate per kg (Rs.)"
                placeholder="40"
                value={rateStr}
                onChange={(e) => setRateStr(e.target.value)}
                inputMode="decimal"
                hint="Minimum Rs.40/kg"
              />
            )}
          </div>
        </div>

        <Button
          fullWidth
          size="lg"
          onClick={() => mutation.mutate()}
          loading={mutation.isPending}
          disabled={!name.trim()}
        >
          Create shadow owner
        </Button>
      </div>
    </AppShell>
  );
}
