"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseClient";
import { useProfile } from "@/lib/hooks/useProfile";
import { AppShell, PageHeader } from "@/components/AppShell";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { formatLKR } from "@/lib/money";
import toast from "react-hot-toast";

export default function WorkerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: profile } = useProfile();
  const qc = useQueryClient();
  const isOwner = profile?.role === "owner";

  const [amountStr, setAmountStr] = useState("");
  const [fromPocket, setFromPocket] = useState(false);

  const { data: worker } = useQuery({
    queryKey: ["worker", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("workers")
        .select("*, fields(name, rate_per_kg_cents, lunch_allowance_cents)")
        .eq("id", id)
        .single();
      return data;
    },
  });

  const { data: payData } = useQuery({
    queryKey: ["worker-pay", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("collection_lines")
        .select("kg, collection_visits(collected_at, owner_confirmed)")
        .eq("worker_id", id);
      return data ?? [];
    },
  });

  const { data: payments } = useQuery({
    queryKey: ["worker-payments", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("payments")
        .select("*")
        .eq("worker_id", id)
        .order("paid_at", { ascending: false });
      return data ?? [];
    },
  });

  const payMutation = useMutation({
    mutationFn: async () => {
      const amount = Math.round((parseFloat(amountStr) || 0) * 100);
      if (amount <= 0) throw new Error("Enter an amount");
      const { data, error } = await supabase.functions.invoke("record-payment", {
        body: {
          owner_id: (worker as any).owner_id,
          worker_id: id,
          amount_cents: amount,
          mode: "instant",
          category: "worker",
          from_pocket: fromPocket,
          disbursed_by: profile!.id,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
    },
    onSuccess: () => {
      toast.success("Worker payment recorded");
      setAmountStr("");
      setFromPocket(false);
      qc.invalidateQueries({ queryKey: ["worker-payments", id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!worker) return null;

  const field = worker.fields as any;
  const ratePerKg = field?.rate_per_kg_cents ?? 0;
  const lunch = field?.lunch_allowance_cents ?? 0;
  const bonus = (worker as any).bonus_cents ?? 0;

  const confirmedLines = (payData ?? []).filter(
    (l: any) => l.collection_visits?.owner_confirmed
  );
  const totalKg = confirmedLines.reduce((s: number, l: any) => s + l.kg, 0);
  const grossPay = Math.round(totalKg * ratePerKg) + confirmedLines.length * lunch + bonus;

  const totalPaid = (payments ?? []).reduce((s: number, p: any) => s + p.amount_cents, 0);
  const owedCents = grossPay - totalPaid;

  return (
    <AppShell>
      <PageHeader title={worker.name} subtitle={field?.name ?? "Worker"} />

      <div className="px-4 md:px-6 pb-8 space-y-4 max-w-lg">
        {/* Summary */}
        <Card>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-sm text-tea-500">Total kg (confirmed)</span>
              <span className="font-semibold text-tea-900">{totalKg.toFixed(1)} kg</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-tea-500">Wage rate</span>
              <span className="text-tea-900">{formatLKR(ratePerKg)} / kg</span>
            </div>
            {lunch > 0 && (
              <div className="flex justify-between">
                <span className="text-sm text-tea-500">Lunch allowance</span>
                <span className="text-tea-900">{formatLKR(lunch)} × {confirmedLines.length} days</span>
              </div>
            )}
            {bonus > 0 && (
              <div className="flex justify-between">
                <span className="text-sm text-tea-500">Bonus</span>
                <span className="text-tea-900">{formatLKR(bonus)}</span>
              </div>
            )}
            <div className="flex justify-between border-t border-tea-100 pt-3">
              <span className="text-sm text-tea-500">Gross earned</span>
              <span className="font-semibold text-tea-900">{formatLKR(grossPay)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-tea-500">Total paid</span>
              <span className="text-tea-900">{formatLKR(totalPaid)}</span>
            </div>
            <div className="flex justify-between border-t border-tea-100 pt-3">
              <span className="font-semibold text-tea-700">Owed to worker</span>
              <span className={`text-xl font-bold ${owedCents > 0 ? "text-amber-600" : "text-green-600"}`}>
                {formatLKR(owedCents)}
              </span>
            </div>
          </div>
        </Card>

        {/* Pay worker — owner only */}
        {isOwner && (
          <Card className="space-y-3">
            <p className="font-semibold text-tea-900">Pay worker</p>
            <Input
              label="Amount (Rs)"
              placeholder={owedCents > 0 ? (owedCents / 100).toString() : "0"}
              value={amountStr}
              onChange={(e) => setAmountStr(e.target.value)}
              inputMode="decimal"
            />
            <label className="flex items-center gap-2 text-sm text-tea-700">
              <input
                type="checkbox"
                checked={fromPocket}
                onChange={(e) => setFromPocket(e.target.checked)}
                className="h-4 w-4 rounded border-tea-300"
              />
              I paid from my own pocket (reimburse me at settlement)
            </label>
            <Button
              fullWidth
              onClick={() => payMutation.mutate()}
              loading={payMutation.isPending}
              disabled={!amountStr}
            >
              Record payment
            </Button>
          </Card>
        )}

        {/* Payment history */}
        {payments && payments.length > 0 && (
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-tea-400">
              Payment history
            </p>
            <div className="space-y-2">
              {payments.map((p: any) => (
                <Card key={p.id} padded={false} className="p-3 flex items-center gap-3">
                  <div className="flex-1">
                    <p className="font-medium text-tea-900">{formatLKR(p.amount_cents)}</p>
                    <p className="text-xs text-tea-400">
                      {new Date(p.paid_at).toLocaleDateString("en-LK")}
                    </p>
                  </div>
                  {p.from_pocket && <Badge variant="amber">From pocket</Badge>}
                </Card>
              ))}
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
