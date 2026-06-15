"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { useProfile } from "@/lib/hooks/useProfile";
import { AppShell, PageHeader } from "@/components/AppShell";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatLKR } from "@/lib/money";
import { CreditCard, ArrowRight, Plus } from "lucide-react";
import toast from "react-hot-toast";

const today = new Date().toISOString().split("T")[0];

export default function CashPage() {
  const { data: profile } = useProfile();
  const qc = useQueryClient();

  const [showFloat, setShowFloat] = useState(false);
  const [floatStr, setFloatStr] = useState("");
  const [selectedDriver, setSelectedDriver] = useState<string | null>(null);

  const isDriver = profile?.role === "driver";

  // Drivers: get their own driver record
  const { data: myDriver } = useQuery({
    queryKey: ["my-driver", profile?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("drivers")
        .select("id")
        .eq("profile_id", profile!.id)
        .single();
      return data;
    },
    enabled: isDriver && !!profile?.id,
  });

  // Redirect driver to their own cash day
  if (isDriver && myDriver) {
    return <CashDayView driverId={myDriver.id} orgId={profile?.org_id ?? ""} />;
  }

  // Agent: list all drivers' cash status for today
  const { data: cashDays, isLoading } = useQuery({
    queryKey: ["cash-days-today", profile?.org_id],
    queryFn: async () => {
      const { data } = await supabase
        .from("driver_cash_days")
        .select("*, vehicles(identifier), drivers!inner(id, org_id, profiles(full_name))")
        .eq("drivers.org_id", profile!.org_id)
        .eq("day", today);
      return data ?? [];
    },
    enabled: !!profile?.org_id && !isDriver,
  });

  const { data: drivers } = useQuery({
    queryKey: ["drivers", profile?.org_id],
    queryFn: async () => {
      const { data } = await supabase
        .from("drivers")
        .select("id, profiles(full_name, phone), vehicles(identifier)")
        .eq("org_id", profile!.org_id);
      return data ?? [];
    },
    enabled: !!profile?.org_id && !isDriver,
  });

  const setFloatMutation = useMutation({
    mutationFn: async () => {
      if (!selectedDriver) throw new Error("Select a driver");
      const cents = Math.round((parseFloat(floatStr) || 0) * 100);
      if (cents <= 0) throw new Error("Enter a valid float amount");
      const { error } = await supabase
        .from("driver_cash_days")
        .upsert({ driver_id: selectedDriver, day: today, float_out_cents: cents })
        .select();
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Float set");
      setShowFloat(false);
      setFloatStr("");
      qc.invalidateQueries({ queryKey: ["cash-days-today"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const driversWithCash = new Set((cashDays ?? []).map((cd: any) => cd.driver_id));
  const driversWithoutCash = (drivers ?? []).filter((d: any) => !driversWithCash.has(d.id));

  return (
    <AppShell>
      <PageHeader
        title="Cash"
        subtitle={new Date().toLocaleDateString("en-LK", {
          weekday: "long",
          day: "numeric",
          month: "short",
        })}
        action={
          <Button size="sm" onClick={() => setShowFloat(true)}>
            <Plus className="h-4 w-4" />
            Set float
          </Button>
        }
      />

      <div className="px-4 md:px-6 pb-8 space-y-4 max-w-2xl">
        {/* Set float panel */}
        {showFloat && (
          <Card className="border-tea-300">
            <p className="mb-3 font-semibold text-tea-900">Set driver float</p>
            <div className="space-y-3">
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-tea-700">Driver</label>
                <select
                  value={selectedDriver ?? ""}
                  onChange={(e) => setSelectedDriver(e.target.value)}
                  className="rounded-xl border border-tea-200 bg-white px-4 py-3 text-tea-900 focus:outline-none focus:ring-2 focus:ring-tea-500"
                >
                  <option value="">— Select driver —</option>
                  {drivers?.map((d: any) => (
                    <option key={d.id} value={d.id}>
                      {(d.profiles as any)?.full_name ?? "Driver"}
                      {(d.profiles as any)?.phone ? ` — ${(d.profiles as any).phone}` : ""}
                    </option>
                  ))}
                </select>
              </div>
              <Input
                label="Float amount (Rs.)"
                placeholder="e.g. 50000"
                value={floatStr}
                onChange={(e) => setFloatStr(e.target.value)}
                inputMode="decimal"
              />
              <div className="flex gap-2">
                <Button variant="secondary" onClick={() => setShowFloat(false)} className="flex-1">
                  Cancel
                </Button>
                <Button
                  onClick={() => setFloatMutation.mutate()}
                  loading={setFloatMutation.isPending}
                  className="flex-1"
                >
                  Set float
                </Button>
              </div>
            </div>
          </Card>
        )}

        {/* Drivers with cash today */}
        {(cashDays ?? []).length > 0 && (
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-tea-400">
              Cash days today
            </p>
            <div className="space-y-2">
              {cashDays?.map((cd: any) => {
                const d = cd.drivers as any;
                const remaining = cd.float_out_cents - cd.paid_out_cents;
                return (
                  <Link key={cd.id} href={`/cash/${cd.driver_id}`}>
                    <Card padded={false} className="p-4 active:scale-[0.98] transition-transform">
                      <div className="flex items-center gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-semibold text-tea-900">
                              {d?.profiles?.full_name ?? "Driver"}
                            </p>
                            <Badge
                              variant={
                                cd.status === "reconciled"
                                  ? "green"
                                  : cd.status === "short"
                                  ? "red"
                                  : cd.status === "over"
                                  ? "blue"
                                  : "amber"
                              }
                            >
                              {cd.status}
                            </Badge>
                          </div>
                          <p className="text-sm text-tea-500">
                            Float: {formatLKR(cd.float_out_cents)} · Paid: {formatLKR(cd.paid_out_cents)} · Left: {formatLKR(remaining)}
                          </p>
                          {(cd.vehicles as any)?.identifier && (
                            <p className="text-xs text-tea-400">{(cd.vehicles as any).identifier}</p>
                          )}
                        </div>
                        <ArrowRight className="h-4 w-4 flex-shrink-0 text-tea-300" />
                      </div>
                    </Card>
                  </Link>
                );
              })}
            </div>
          </div>
        )}

        {/* Drivers without cash day today */}
        {driversWithoutCash.length > 0 && (
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-tea-400">
              No cash day yet today
            </p>
            <div className="space-y-2">
              {driversWithoutCash.map((d: any) => (
                <Card key={d.id} padded={false} className="p-3 flex items-center gap-3">
                  <div className="flex-1">
                    <p className="font-medium text-tea-900">
                      {(d.profiles as any)?.full_name ?? "Driver"}
                    </p>
                    {(d.vehicles as any)?.identifier && (
                      <p className="text-xs text-tea-400">{(d.vehicles as any).identifier}</p>
                    )}
                  </div>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      setSelectedDriver(d.id);
                      setShowFloat(true);
                    }}
                  >
                    Set float
                  </Button>
                </Card>
              ))}
            </div>
          </div>
        )}

        {!isLoading && (cashDays ?? []).length === 0 && driversWithoutCash.length === 0 && (
          <EmptyState
            icon={CreditCard}
            title="No cash days"
            description="Add a driver first, then set their float for the day"
          />
        )}
      </div>
    </AppShell>
  );
}

// Driver's own cash day view
function CashDayView({ driverId, orgId }: { driverId: string; orgId: string }) {
  const qc = useQueryClient();
  const [broughtBackStr, setBroughtBackStr] = useState("");

  const { data: cashDay } = useQuery({
    queryKey: ["my-cash-day", driverId],
    queryFn: async () => {
      const { data } = await supabase
        .from("driver_cash_days")
        .select("*")
        .eq("driver_id", driverId)
        .eq("day", today)
        .single();
      return data;
    },
  });

  const { data: paidOuts } = useQuery({
    queryKey: ["paid-outs", driverId],
    queryFn: async () => {
      const { data } = await supabase
        .from("payments")
        .select("*, profiles!payments_charged_to_fkey(full_name)")
        .eq("driver_cash_day_id", cashDay?.id)
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
          day: today,
        },
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Cash day reconciled");
      qc.invalidateQueries({ queryKey: ["my-cash-day", driverId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!cashDay) {
    return (
      <AppShell>
        <PageHeader title="My Cash" subtitle="Today" />
        <div className="px-4 py-8 text-center">
          <p className="text-tea-500">No float set for today.</p>
          <p className="mt-1 text-sm text-tea-400">Ask your agent to set your float.</p>
        </div>
      </AppShell>
    );
  }

  const remaining = cashDay.float_out_cents - cashDay.paid_out_cents;

  return (
    <AppShell>
      <PageHeader
        title="My Cash"
        subtitle={new Date().toLocaleDateString("en-LK", { weekday: "long", day: "numeric", month: "short" })}
      />

      <div className="mx-auto w-full max-w-md px-4 pb-8 space-y-4">
        {/* Big status card */}
        <Card className="bg-tea-600 text-white border-tea-700">
          <div className="space-y-4">
            <div className="flex justify-between">
              <span className="text-tea-200 text-sm">Float given</span>
              <span className="text-xl font-bold">{formatLKR(cashDay.float_out_cents)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-tea-200 text-sm">Paid out</span>
              <span className="text-xl font-bold text-red-300">- {formatLKR(cashDay.paid_out_cents)}</span>
            </div>
            <div className="flex justify-between border-t border-tea-500 pt-4">
              <span className="text-tea-100 font-semibold">In hand</span>
              <span className="text-2xl font-bold">{formatLKR(remaining)}</span>
            </div>
          </div>
        </Card>

        {/* Status */}
        <div className="flex items-center gap-2">
          <Badge
            variant={
              cashDay.status === "reconciled"
                ? "green"
                : cashDay.status === "short"
                ? "red"
                : cashDay.status === "over"
                ? "blue"
                : "amber"
            }
          >
            {cashDay.status}
          </Badge>
          {cashDay.note && <p className="text-sm text-tea-500">{cashDay.note}</p>}
        </div>

        {/* Paid out list */}
        {paidOuts && paidOuts.length > 0 && (
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-tea-400">
              Paid out today
            </p>
            {paidOuts.map((p: any) => (
              <Card key={p.id} padded={false} className="p-3 flex items-center gap-3 mb-2">
                <div className="flex-1">
                  <p className="font-medium text-tea-900">
                    {(p.profiles as any)?.full_name ?? "Owner"}
                  </p>
                  <p className="text-xs text-tea-400 capitalize">{p.mode}</p>
                </div>
                <span className="font-semibold text-tea-900">{formatLKR(p.amount_cents)}</span>
              </Card>
            ))}
          </div>
        )}

        {/* Reconcile */}
        {cashDay.status === "open" && (
          <Card>
            <p className="mb-3 font-semibold text-tea-900">End of day reconcile</p>
            <div className="space-y-3">
              <Input
                label="Cash brought back (Rs.)"
                placeholder="0"
                value={broughtBackStr}
                onChange={(e) => setBroughtBackStr(e.target.value)}
                inputMode="decimal"
              />
              <Button
                fullWidth
                onClick={() => reconcileMutation.mutate()}
                loading={reconcileMutation.isPending}
              >
                Reconcile & close day
              </Button>
            </div>
          </Card>
        )}
      </div>
    </AppShell>
  );
}
