"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseClient";
import { useProfile } from "@/lib/hooks/useProfile";
import { AppShell, PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import toast from "react-hot-toast";

const TYPES = [
  { value: "fertilizer", label: "Fertilizer" },
  { value: "government", label: "Government" },
  { value: "side_business", label: "Side business" },
  { value: "advance", label: "Cash advance" },
];

function NewDeductionForm() {
  const { data: profile } = useProfile();
  const router = useRouter();
  const searchParams = useSearchParams();
  const qc = useQueryClient();

  const preselectedOwnerId = searchParams.get("owner_id") ?? "";
  const [ownerId, setOwnerId] = useState(preselectedOwnerId);
  const [type, setType] = useState("fertilizer");
  const [amountStr, setAmountStr] = useState("");
  const [note, setNote] = useState("");

  const { data: owners } = useQuery({
    queryKey: ["owners-list", profile?.org_id],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, full_name")
        .eq("role", "owner")
        .order("full_name");
      return data ?? [];
    },
    enabled: !!profile?.org_id,
  });

  const mutation = useMutation({
    mutationFn: async () => {
      const amountCents = Math.round((parseFloat(amountStr) || 0) * 100);
      if (amountCents <= 0) throw new Error("Enter a valid amount");
      if (!ownerId) throw new Error("Select an owner");

      const { error } = await supabase.from("deductions").insert({
        owner_id: ownerId,
        org_id: profile!.org_id,
        type,
        amount_cents: amountCents,
        note: note || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Deduction recorded");
      qc.invalidateQueries({ queryKey: ["deductions"] });
      router.back();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <AppShell>
      <PageHeader title="Add Deduction" />

      <div className="px-4 md:px-6 pb-8 max-w-lg space-y-4">
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-tea-700">Owner *</label>
          <select
            value={ownerId}
            onChange={(e) => setOwnerId(e.target.value)}
            className="w-full rounded-xl border border-tea-200 bg-white px-4 py-3 text-tea-900 focus:outline-none focus:ring-2 focus:ring-tea-500"
          >
            <option value="">— Select owner —</option>
            {owners?.map((o: any) => (
              <option key={o.id} value={o.id}>
                {o.full_name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-tea-700">Type *</label>
          <div className="grid grid-cols-2 gap-2">
            {TYPES.map((t) => (
              <button
                key={t.value}
                onClick={() => setType(t.value)}
                className={[
                  "rounded-xl py-3 text-sm font-medium transition-colors",
                  type === t.value
                    ? "bg-tea-600 text-white"
                    : "bg-white border border-tea-200 text-tea-700",
                ].join(" ")}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <Input
          label="Amount (Rs.) *"
          placeholder="0.00"
          value={amountStr}
          onChange={(e) => setAmountStr(e.target.value)}
          inputMode="decimal"
        />

        <Input
          label="Note"
          placeholder="e.g. 25kg fertilizer bag"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />

        <Button
          fullWidth
          size="lg"
          onClick={() => mutation.mutate()}
          loading={mutation.isPending}
          disabled={!ownerId || !amountStr}
        >
          Record deduction
        </Button>
      </div>
    </AppShell>
  );
}

export default function NewDeductionPage() {
  return (
    <Suspense>
      <NewDeductionForm />
    </Suspense>
  );
}
