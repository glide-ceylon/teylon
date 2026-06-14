"use client";

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseClient";
import { useProfile } from "@/lib/hooks/useProfile";
import { AppShell, PageHeader } from "@/components/AppShell";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { formatLKR } from "@/lib/money";
import { TrendingUp } from "lucide-react";

export default function BalancePage() {
  const { data: profile } = useProfile();

  const { data: visits } = useQuery({
    queryKey: ["balance-visits", profile?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("collection_visits")
        .select(`
          id, collected_at, total_kg, owner_confirmed, status,
          fields(name, rate_per_kg_cents)
        `)
        .eq("owner_id", profile!.id)
        .eq("owner_confirmed", true)
        .neq("status", "settled")
        .order("collected_at", { ascending: false });
      return data ?? [];
    },
    enabled: !!profile?.id,
  });

  const { data: deductions } = useQuery({
    queryKey: ["balance-deductions", profile?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("deductions")
        .select("*")
        .eq("owner_id", profile!.id)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
    enabled: !!profile?.id,
  });

  const { data: payments } = useQuery({
    queryKey: ["balance-payments", profile?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("payments")
        .select("*")
        .eq("charged_to", profile!.id)
        .order("paid_at", { ascending: false });
      return data ?? [];
    },
    enabled: !!profile?.id,
  });

  const { data: settlements } = useQuery({
    queryKey: ["balance-settlements", profile?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("settlements")
        .select("*")
        .eq("owner_id", profile!.id)
        .order("computed_at", { ascending: false })
        .limit(3);
      return data ?? [];
    },
    enabled: !!profile?.id,
  });

  const grossEarned = (visits ?? []).reduce((sum: number, v: any) => {
    const rate = (v.fields as any)?.rate_per_kg_cents ?? 0;
    return sum + (v.total_kg ?? 0) * rate;
  }, 0);

  const totalDeductions = (deductions ?? []).reduce(
    (s: number, d: any) => s + d.amount_cents, 0
  );

  const totalPaid = (payments ?? [])
    .filter((p: any) => p.status === "confirmed")
    .reduce((s: number, p: any) => s + p.amount_cents, 0);

  const netOwed = grossEarned - totalDeductions - totalPaid;

  return (
    <AppShell>
      <PageHeader title="My Balance" subtitle="What your agent owes you" />

      <div className="px-4 md:px-6 pb-8 space-y-6 max-w-2xl">
        {/* Summary card */}
        <Card>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-sm text-tea-500">Gross earned (unconfirmed)</span>
              <span className="font-semibold text-tea-900">{formatLKR(grossEarned)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-tea-500">Deductions</span>
              <span className="text-red-600">- {formatLKR(totalDeductions)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-tea-500">Already paid</span>
              <span className="text-tea-500">- {formatLKR(totalPaid)}</span>
            </div>
            <div className="flex justify-between items-center border-t border-tea-100 pt-3">
              <span className="font-bold text-tea-900">Agent owes you</span>
              <span
                className={`text-2xl font-bold ${netOwed >= 0 ? "text-tea-700" : "text-red-600"}`}
              >
                {formatLKR(netOwed)}
              </span>
            </div>
          </div>
        </Card>

        {/* Confirmed visits */}
        {visits && visits.length > 0 && (
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-tea-400">
              Unsettled collections
            </p>
            <div className="space-y-2">
              {visits.map((v: any) => {
                const rate = (v.fields as any)?.rate_per_kg_cents ?? 0;
                return (
                  <Card key={v.id} padded={false} className="p-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-tea-900">
                          {(v.fields as any)?.name ?? "Field"}
                        </p>
                        <p className="text-xs text-tea-400">
                          {new Date(v.collected_at).toLocaleDateString("en-LK")} ·{" "}
                          {v.total_kg?.toFixed(1)} kg
                        </p>
                      </div>
                      <span className="font-semibold text-tea-900">
                        {formatLKR((v.total_kg ?? 0) * rate)}
                      </span>
                    </div>
                  </Card>
                );
              })}
            </div>
          </div>
        )}

        {/* Recent settlements */}
        {settlements && settlements.length > 0 && (
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-tea-400">
              Recent settlements
            </p>
            <div className="space-y-2">
              {settlements.map((s: any) => (
                <Card key={s.id} padded={false} className="p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-tea-900">
                        {new Date(s.period_start).toLocaleDateString("en-LK", {
                          month: "short", year: "numeric"
                        })}
                      </p>
                      <p className="text-xs text-tea-400">
                        {s.total_submitted_kg.toFixed(0)} kg ·{" "}
                        {formatLKR(s.avg_rate_cents)}/kg avg
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-tea-900">{formatLKR(s.net_cents)}</p>
                      <p className="text-xs text-tea-400">net</p>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Deductions */}
        {deductions && deductions.length > 0 && (
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-tea-400">
              Deductions
            </p>
            <div className="space-y-2">
              {deductions.map((d: any) => (
                <Card key={d.id} padded={false} className="p-3 flex items-center gap-3">
                  <div className="flex-1">
                    <p className="font-medium text-tea-900 capitalize">
                      {d.type.replace("_", " ")}
                    </p>
                    {d.note && (
                      <p className="text-xs text-tea-400">{d.note}</p>
                    )}
                    <p className="text-xs text-tea-400">
                      {new Date(d.created_at).toLocaleDateString("en-LK")}
                    </p>
                  </div>
                  <span className="font-semibold text-red-600">
                    - {formatLKR(d.amount_cents)}
                  </span>
                </Card>
              ))}
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
