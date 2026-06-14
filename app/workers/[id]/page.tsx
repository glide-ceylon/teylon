"use client";

import { useParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseClient";
import { useProfile } from "@/lib/hooks/useProfile";
import { AppShell, PageHeader } from "@/components/AppShell";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { formatLKR } from "@/lib/money";
import { CheckCircle } from "lucide-react";
import toast from "react-hot-toast";

export default function WorkerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: profile } = useProfile();
  const qc = useQueryClient();

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
      // Sum kg from collection lines
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
        .eq("payee_id", id)
        .order("paid_at", { ascending: false });
      return data ?? [];
    },
  });

  const markPaidMutation = useMutation({
    mutationFn: async (paymentId: string) => {
      const { error } = await supabase
        .from("payments")
        .update({ status: "confirmed" })
        .eq("id", paymentId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Marked as paid");
      qc.invalidateQueries({ queryKey: ["worker-payments", id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!worker) return null;

  const field = worker.fields as any;
  const ratePerKg = field?.rate_per_kg_cents ?? 0;
  const lunch = field?.lunch_allowance_cents ?? 0;

  const confirmedLines = (payData ?? []).filter(
    (l: any) => l.collection_visits?.owner_confirmed
  );
  const totalKg = confirmedLines.reduce((s: number, l: any) => s + l.kg, 0);
  const grossPay = totalKg * ratePerKg + confirmedLines.length * lunch;

  const totalPaid = (payments ?? [])
    .filter((p: any) => p.status === "confirmed")
    .reduce((s: number, p: any) => s + p.amount_cents, 0);

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
              <span className="text-sm text-tea-500">Rate</span>
              <span className="text-tea-900">{formatLKR(ratePerKg)} / kg</span>
            </div>
            {lunch > 0 && (
              <div className="flex justify-between">
                <span className="text-sm text-tea-500">Lunch allowance</span>
                <span className="text-tea-900">{formatLKR(lunch)} × {confirmedLines.length} days</span>
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
              <span
                className={`text-xl font-bold ${owedCents > 0 ? "text-amber-600" : "text-green-600"}`}
              >
                {formatLKR(owedCents)}
              </span>
            </div>
          </div>
        </Card>

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
                  {p.status === "confirmed" ? (
                    <Badge variant="green">Paid</Badge>
                  ) : (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => markPaidMutation.mutate(p.id)}
                      loading={markPaidMutation.isPending}
                    >
                      <CheckCircle className="h-3 w-3" />
                      Mark paid
                    </Button>
                  )}
                </Card>
              ))}
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
