"use client";

import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { useProfile } from "@/lib/hooks/useProfile";
import { AppShell, PageHeader } from "@/components/AppShell";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { formatLKR } from "@/lib/money";
import { Plus, Truck, ArrowRight } from "lucide-react";
import { useState } from "react";
import toast from "react-hot-toast";

export default function OwnerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: profile } = useProfile();
  const qc = useQueryClient();

  const [payAmount, setPayAmount] = useState("");
  const [payMode, setPayMode] = useState<"instant" | "monthly">("instant");

  const { data: owner } = useQuery({
    queryKey: ["owner", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", id)
        .single();
      return data;
    },
  });

  const { data: visits } = useQuery({
    queryKey: ["owner-visits", id, profile?.org_id],
    queryFn: async () => {
      const { data } = await supabase
        .from("collection_visits")
        .select("id, collected_at, total_kg, owner_confirmed, escalated, pay_mode, tea_rate_cents, fields(name, tea_rate_cents)")
        .eq("owner_id", id)
        .eq("org_id", profile!.org_id)
        .order("collected_at", { ascending: false })
        .limit(20);
      return data ?? [];
    },
    enabled: !!profile?.org_id,
  });

  const { data: deductions } = useQuery({
    queryKey: ["owner-deductions", id, profile?.org_id],
    queryFn: async () => {
      const { data } = await supabase
        .from("deductions")
        .select("*")
        .eq("owner_id", id)
        .eq("org_id", profile!.org_id)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
    enabled: !!profile?.org_id,
  });

  const { data: payments } = useQuery({
    queryKey: ["owner-payments", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("payments")
        .select("*")
        .eq("charged_to", id)
        .order("paid_at", { ascending: false });
      return data ?? [];
    },
  });

  const confirmedVisits = (visits ?? []).filter((v: any) => v.owner_confirmed);
  // Owner is owed the TEA value (~120/kg) on monthly visits (instant are paid on
  // the spot). Use the visit's snapshot rate, falling back to the field's.
  const teaRateOf = (v: any) => v.tea_rate_cents ?? (v.fields as any)?.tea_rate_cents ?? 0;
  const grossEarned = confirmedVisits
    .filter((v: any) => v.pay_mode !== "instant")
    .reduce((s: number, v: any) => s + (v.total_kg ?? 0) * teaRateOf(v), 0);
  const totalDeductions = (deductions ?? []).reduce((s: number, d: any) => s + d.amount_cents, 0);
  const reimbursements = (payments ?? [])
    .filter((p: any) => p.from_pocket)
    .reduce((s: number, p: any) => s + p.amount_cents, 0);
  const totalPaid = (payments ?? [])
    .filter((p: any) => !p.from_pocket && p.category !== "advance" && p.category !== "worker")
    .reduce((s: number, p: any) => s + p.amount_cents, 0);
  const netOwed = grossEarned - totalDeductions - totalPaid + reimbursements;

  const recordPaymentMutation = useMutation({
    mutationFn: async () => {
      const amountCents = Math.round((parseFloat(payAmount) || 0) * 100);
      if (amountCents <= 0) throw new Error("Enter a valid amount");
      const { error } = await supabase.functions.invoke("record-payment", {
        body: {
          owner_id: id,
          amount_cents: amountCents,
          mode: payMode,
          org_id: profile!.org_id,
        },
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Payment recorded");
      setPayAmount("");
      qc.invalidateQueries({ queryKey: ["owner-payments", id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!owner) return null;

  return (
    <AppShell>
      <PageHeader
        title={owner.full_name}
        subtitle={owner.phone ?? "No phone"}
      />

      <div className="px-4 md:px-6 pb-8 max-w-2xl space-y-4">
        {/* Balance summary */}
        <Card>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-sm text-tea-500">Gross earned</span>
              <span className="font-semibold">{formatLKR(grossEarned)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-tea-500">Deductions</span>
              <span className="text-red-600">- {formatLKR(totalDeductions)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-tea-500">Paid</span>
              <span className="text-tea-500">- {formatLKR(totalPaid)}</span>
            </div>
            <div className="flex justify-between border-t border-tea-100 pt-3">
              <span className="font-bold text-tea-900">We owe owner</span>
              <span className={`text-xl font-bold ${netOwed >= 0 ? "text-tea-700" : "text-red-600"}`}>
                {formatLKR(netOwed)}
              </span>
            </div>
          </div>
        </Card>

        {/* Record payment */}
        <Card>
          <p className="mb-3 font-semibold text-tea-900">Record Payment</p>
          <div className="space-y-3">
            <div className="flex gap-2">
              {(["instant", "monthly"] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setPayMode(m)}
                  className={[
                    "flex-1 rounded-xl py-2 text-sm font-medium capitalize transition-colors",
                    payMode === m
                      ? "bg-tea-600 text-white"
                      : "bg-tea-50 text-tea-600",
                  ].join(" ")}
                >
                  {m}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <div className="flex-1">
                <input
                  className="w-full rounded-xl border border-tea-200 bg-white px-4 py-3 text-tea-900 focus:outline-none focus:ring-2 focus:ring-tea-500"
                  placeholder="Amount (Rs.)"
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  inputMode="decimal"
                />
              </div>
              <Button
                onClick={() => recordPaymentMutation.mutate()}
                loading={recordPaymentMutation.isPending}
                disabled={!payAmount}
              >
                Record
              </Button>
            </div>
          </div>
        </Card>

        {/* Quick actions */}
        <div className="flex gap-2">
          <Link href={`/deductions/new?owner_id=${id}`} className="flex-1">
            <Button variant="secondary" fullWidth size="sm">
              <Plus className="h-4 w-4" />
              Add deduction
            </Button>
          </Link>
          <Link href={`/collect?owner_id=${id}`} className="flex-1">
            <Button variant="secondary" fullWidth size="sm">
              <Truck className="h-4 w-4" />
              Collect
            </Button>
          </Link>
        </div>

        {/* Recent visits */}
        {visits && visits.length > 0 && (
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-tea-400">
              Collections
            </p>
            <div className="space-y-2">
              {visits.slice(0, 5).map((v: any) => (
                <Link key={v.id} href={`/collections/${v.id}`}>
                  <Card padded={false} className="p-3 flex items-center gap-3">
                    <div className="flex-1">
                      <p className="font-medium text-tea-900">
                        {(v.fields as any)?.name ?? "Field"}
                      </p>
                      <p className="text-xs text-tea-400">
                        {new Date(v.collected_at).toLocaleDateString("en-LK")} · {v.total_kg?.toFixed(1)} kg
                      </p>
                    </div>
                    {v.owner_confirmed ? (
                      <Badge variant="green">✓</Badge>
                    ) : (
                      <Badge variant="amber">Pending</Badge>
                    )}
                    <ArrowRight className="h-4 w-4 text-tea-300" />
                  </Card>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
