"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseClient";
import { useProfile } from "@/lib/hooks/useProfile";
import { AppShell, PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";
import toast from "react-hot-toast";

export default function NewSettlementPage() {
  const { data: profile } = useProfile();
  const router = useRouter();
  const qc = useQueryClient();

  const now = new Date();
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    .toISOString()
    .split("T")[0];
  const today = now.toISOString().split("T")[0];

  const [ownerId, setOwnerId] = useState("");
  const [periodStart, setPeriodStart] = useState(firstOfMonth);
  const [periodEnd, setPeriodEnd] = useState(today);
  const [lossDial, setLossDial] = useState("0");

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
      if (!ownerId) throw new Error("Select an owner");
      const { data, error } = await supabase.functions.invoke("compute-settlement", {
        body: {
          owner_id: ownerId,
          org_id: profile!.org_id,
          period_start: periodStart,
          period_end: periodEnd,
          loss_adjustment_pct: parseFloat(lossDial) || 0,
        },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast.success("Settlement computed");
      qc.invalidateQueries({ queryKey: ["settlements"] });
      router.push(`/settlements/${data.settlement_id}`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <AppShell>
      <PageHeader
        title="Run Settlement"
        subtitle="Compute monthly average payout for an owner"
      />

      <div className="px-4 md:px-6 pb-8 max-w-lg space-y-4">
        <Card className="bg-tea-50 border-tea-200">
          <p className="text-sm text-tea-600">
            Settlement computes the average kg rate over the period, applies your loss
            adjustment dial, subtracts deductions, and stores the result as an auditable record.
          </p>
        </Card>

        {/* Owner */}
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-tea-700">Owner *</label>
          <select
            value={ownerId}
            onChange={(e) => setOwnerId(e.target.value)}
            className="rounded-xl border border-tea-200 bg-white px-4 py-3 text-tea-900 focus:outline-none focus:ring-2 focus:ring-tea-500"
          >
            <option value="">— Select owner —</option>
            {owners?.map((o: any) => (
              <option key={o.id} value={o.id}>{o.full_name}</option>
            ))}
          </select>
        </div>

        {/* Period */}
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-tea-700">Period start</label>
            <input
              type="date"
              value={periodStart}
              onChange={(e) => setPeriodStart(e.target.value)}
              className="rounded-xl border border-tea-200 bg-white px-4 py-3 text-tea-900 focus:outline-none focus:ring-2 focus:ring-tea-500"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-tea-700">Period end</label>
            <input
              type="date"
              value={periodEnd}
              onChange={(e) => setPeriodEnd(e.target.value)}
              className="rounded-xl border border-tea-200 bg-white px-4 py-3 text-tea-900 focus:outline-none focus:ring-2 focus:ring-tea-500"
            />
          </div>
        </div>

        {/* Loss dial */}
        <div>
          <Input
            label="Loss adjustment % (optional)"
            placeholder="0"
            value={lossDial}
            onChange={(e) => setLossDial(e.target.value)}
            inputMode="decimal"
            hint="Soft dial — reduces average rate by this %. Owner sees adjusted rate, not raw factory rate. Default 0."
          />
        </div>

        <Button
          fullWidth
          size="lg"
          onClick={() => mutation.mutate()}
          loading={mutation.isPending}
          disabled={!ownerId}
        >
          Compute settlement
        </Button>
      </div>
    </AppShell>
  );
}
