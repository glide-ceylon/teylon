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

const today = new Date().toISOString().split("T")[0];

export default function DriverCashDayPage() {
  const { driverId } = useParams<{ driverId: string }>();
  const { data: profile } = useProfile();
  const qc = useQueryClient();
  const [broughtBackStr, setBroughtBackStr] = useState("");
  const [selectedDay, setSelectedDay] = useState(today);

  const { data: driver } = useQuery({
    queryKey: ["driver-info", driverId],
    queryFn: async () => {
      const { data } = await supabase
        .from("drivers")
        .select("id, lorry_identifier, profiles(full_name)")
        .eq("id", driverId)
        .single();
      return data;
    },
  });

  const { data: cashDay } = useQuery({
    queryKey: ["cash-day", driverId, selectedDay],
    queryFn: async () => {
      const { data } = await supabase
        .from("driver_cash_days")
        .select("*")
        .eq("driver_id", driverId)
        .eq("day", selectedDay)
        .maybeSingle();
      return data;
    },
  });

  const { data: cashHistory } = useQuery({
    queryKey: ["cash-history", driverId],
    queryFn: async () => {
      const { data } = await supabase
        .from("driver_cash_days")
        .select("*")
        .eq("driver_id", driverId)
        .order("day", { ascending: false })
        .limit(10);
      return data ?? [];
    },
  });

  const { data: paidOuts } = useQuery({
    queryKey: ["paid-outs-day", cashDay?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("payments")
        .select("*, profiles!payments_charged_to_fkey(full_name)")
        .eq("driver_cash_day_id", cashDay!.id)
        .order("paid_at", { ascending: false });
      return data ?? [];
    },
    enabled: !!cashDay?.id,
  });

  const reconcileMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.functions.invoke("reconcile-cash-day", {
        body: {
          driver_id: driverId,
          brought_back_cents: Math.round((parseFloat(broughtBackStr) || 0) * 100),
          day: selectedDay,
        },
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Cash day reconciled");
      qc.invalidateQueries({ queryKey: ["cash-day", driverId, selectedDay] });
      qc.invalidateQueries({ queryKey: ["cash-history", driverId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const driverName = (driver?.profiles as any)?.full_name ?? "Driver";
  const remaining = cashDay
    ? cashDay.float_out_cents - cashDay.paid_out_cents
    : 0;

  return (
    <AppShell>
      <PageHeader
        title={driverName}
        subtitle={`${driver?.lorry_identifier ?? "—"} · Cash`}
      />

      <div className="px-4 md:px-6 pb-8 max-w-lg space-y-4">
        {/* Day selector */}
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-tea-700">Day</label>
          <input
            type="date"
            value={selectedDay}
            onChange={(e) => setSelectedDay(e.target.value)}
            className="rounded-xl border border-tea-200 bg-white px-4 py-3 text-tea-900 focus:outline-none focus:ring-2 focus:ring-tea-500"
          />
        </div>

        {cashDay ? (
          <>
            {/* Cash summary */}
            <Card>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-sm text-tea-500">Float given</span>
                  <span className="font-semibold text-tea-900">{formatLKR(cashDay.float_out_cents)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-tea-500">Paid out</span>
                  <span className="font-semibold text-tea-900">{formatLKR(cashDay.paid_out_cents)}</span>
                </div>
                {cashDay.brought_back_cents != null && (
                  <div className="flex justify-between">
                    <span className="text-sm text-tea-500">Brought back</span>
                    <span className="font-semibold text-tea-900">{formatLKR(cashDay.brought_back_cents)}</span>
                  </div>
                )}
                <div className="flex justify-between border-t border-tea-100 pt-3">
                  <span className="font-semibold text-tea-700">Balance</span>
                  <span className="text-xl font-bold text-tea-900">{formatLKR(remaining)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge
                    variant={
                      cashDay.status === "reconciled" ? "green"
                      : cashDay.status === "short" ? "red"
                      : cashDay.status === "over" ? "blue"
                      : "amber"
                    }
                  >
                    {cashDay.status}
                  </Badge>
                  {cashDay.note && <p className="text-sm text-tea-500">{cashDay.note}</p>}
                </div>
              </div>
            </Card>

            {/* Paid out log */}
            {paidOuts && paidOuts.length > 0 && (
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-tea-400">Paid out</p>
                {paidOuts.map((p: any) => (
                  <Card key={p.id} padded={false} className="p-3 flex items-center gap-3 mb-2">
                    <div className="flex-1">
                      <p className="font-medium text-tea-900">{(p.profiles as any)?.full_name ?? "Owner"}</p>
                      <p className="text-xs text-tea-400 capitalize">{p.mode}</p>
                    </div>
                    <span className="font-semibold">{formatLKR(p.amount_cents)}</span>
                  </Card>
                ))}
              </div>
            )}

            {/* Reconcile */}
            {cashDay.status === "open" && (
              <Card>
                <p className="mb-3 font-semibold text-tea-900">Reconcile cash</p>
                <div className="space-y-3">
                  <Input
                    label="Cash brought back (Rs.)"
                    value={broughtBackStr}
                    onChange={(e) => setBroughtBackStr(e.target.value)}
                    inputMode="decimal"
                    placeholder="0"
                  />
                  <Button
                    fullWidth
                    onClick={() => reconcileMutation.mutate()}
                    loading={reconcileMutation.isPending}
                  >
                    Reconcile & close
                  </Button>
                </div>
              </Card>
            )}
          </>
        ) : (
          <div className="py-8 text-center">
            <p className="text-tea-500">No cash day for this date.</p>
          </div>
        )}

        {/* History */}
        {cashHistory && cashHistory.length > 1 && (
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-tea-400">History</p>
            <div className="space-y-2">
              {cashHistory.slice(0, 7).map((cd: any) => (
                <button
                  key={cd.id}
                  onClick={() => setSelectedDay(cd.day)}
                  className="w-full"
                >
                  <Card padded={false} className={`p-3 flex items-center gap-3 ${selectedDay === cd.day ? "border-tea-400" : ""}`}>
                    <div className="flex-1">
                      <p className="font-medium text-tea-900 text-sm">
                        {new Date(cd.day + "T12:00:00").toLocaleDateString("en-LK", { weekday: "short", day: "numeric", month: "short" })}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-tea-700">{formatLKR(cd.float_out_cents)}</p>
                    </div>
                    <Badge variant={cd.status === "reconciled" ? "green" : cd.status === "short" ? "red" : "amber"}>
                      {cd.status}
                    </Badge>
                  </Card>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
