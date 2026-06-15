"use client";

import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseClient";
import { AppShell, PageHeader } from "@/components/AppShell";
import { Card } from "@/components/ui/Card";
import { formatLKR } from "@/lib/money";

export default function SettlementDetailPage() {
  const { id } = useParams<{ id: string }>();

  const { data: settlement } = useQuery({
    queryKey: ["settlement", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("settlements")
        .select("*, profiles!settlements_owner_id_fkey(full_name, phone)")
        .eq("id", id)
        .single();
      return data;
    },
  });

  if (!settlement) return null;

  const owner = (settlement as any).profiles;

  return (
    <AppShell>
      <PageHeader
        title="Settlement"
        subtitle={`${owner?.full_name ?? "Owner"} · ${new Date(settlement.period_start).toLocaleDateString("en-LK", { month: "short", year: "numeric" })}`}
      />

      <div className="px-4 md:px-6 pb-8 max-w-lg space-y-4">
        {/* Period */}
        <Card>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-sm text-tea-500">Owner</span>
              <span className="font-semibold text-tea-900">{owner?.full_name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-tea-500">Period</span>
              <span className="text-tea-900">
                {new Date(settlement.period_start).toLocaleDateString("en-LK")} →{" "}
                {new Date(settlement.period_end).toLocaleDateString("en-LK")}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-tea-500">Computed</span>
              <span className="text-tea-900">
                {new Date(settlement.computed_at).toLocaleDateString("en-LK")}
              </span>
            </div>
          </div>
        </Card>

        {/* Calculation breakdown */}
        <Card>
          <p className="mb-3 font-semibold text-tea-900">Breakdown</p>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-sm text-tea-500">Total kg submitted</span>
              <span className="font-semibold text-tea-900">
                {settlement.total_submitted_kg.toFixed(1)} kg
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-tea-500">Avg rate (after loss adj.)</span>
              <span className="font-semibold text-tea-900">
                {formatLKR(settlement.avg_rate_cents)}/kg
              </span>
            </div>
            {settlement.loss_adjustment_pct > 0 && (
              <div className="flex justify-between">
                <span className="text-sm text-tea-500">Loss adjustment</span>
                <span className="text-amber-600">{settlement.loss_adjustment_pct}%</span>
              </div>
            )}
            <div className="flex justify-between border-t border-tea-100 pt-3">
              <span className="text-sm text-tea-500">Gross</span>
              <span className="font-semibold text-tea-900">{formatLKR(settlement.gross_cents)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-tea-500">Deductions</span>
              <span className="text-red-600">- {formatLKR(settlement.deductions_cents)}</span>
            </div>
            {settlement.reimbursements_cents > 0 && (
              <div className="flex justify-between">
                <span className="text-sm text-tea-500">Worker pay reimbursed</span>
                <span className="text-green-600">+ {formatLKR(settlement.reimbursements_cents)}</span>
              </div>
            )}
            <div className="flex justify-between border-t border-tea-100 pt-3">
              <span className="font-bold text-tea-900">Net payout</span>
              <span className="text-2xl font-bold text-tea-700">
                {formatLKR(settlement.net_cents)}
              </span>
            </div>
          </div>
        </Card>

        <p className="text-center text-xs text-tea-400">
          Settlement ID: {settlement.id.slice(0, 8)}… · Auditable & re-runnable
        </p>
      </div>
    </AppShell>
  );
}
