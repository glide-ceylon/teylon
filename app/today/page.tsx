"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { useProfile } from "@/lib/hooks/useProfile";
import { AppShell, PageHeader } from "@/components/AppShell";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { formatLKR } from "@/lib/money";
import { Truck, Plus } from "lucide-react";

const today = new Date().toISOString().split("T")[0];

export default function DriverTodayPage() {
  const { data: profile } = useProfile();

  const { data: myDriver } = useQuery({
    queryKey: ["my-driver", profile?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("drivers")
        .select("id, lorry_identifier")
        .eq("profile_id", profile!.id)
        .single();
      return data;
    },
    enabled: !!profile?.id,
  });

  const { data: cashDay } = useQuery({
    queryKey: ["my-cash-day", myDriver?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("driver_cash_days")
        .select("*")
        .eq("driver_id", myDriver!.id)
        .eq("day", today)
        .maybeSingle();
      return data;
    },
    enabled: !!myDriver?.id,
  });

  const { data: todayVisits } = useQuery({
    queryKey: ["today-visits", myDriver?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("collection_visits")
        .select("id, total_kg, owner_confirmed, collected_at, fields(name), profiles!collection_visits_owner_id_fkey(full_name)")
        .eq("driver_id", myDriver!.id)
        .gte("collected_at", today + "T00:00:00")
        .lte("collected_at", today + "T23:59:59")
        .order("collected_at", { ascending: false });
      return data ?? [];
    },
    enabled: !!myDriver?.id,
  });

  const totalKgToday = (todayVisits ?? []).reduce(
    (s: number, v: any) => s + (v.total_kg ?? 0), 0
  );

  const cashRemaining = cashDay
    ? cashDay.float_out_cents - cashDay.paid_out_cents
    : null;

  return (
    <AppShell>
      <PageHeader
        title={`Today`}
        subtitle={new Date().toLocaleDateString("en-LK", {
          weekday: "long",
          day: "numeric",
          month: "long",
        })}
      />

      <div className="mx-auto w-full max-w-md px-4 pb-32 space-y-4">
        {/* Lorry ID */}
        {myDriver && (
          <p className="text-sm text-tea-400">Lorry: {myDriver.lorry_identifier}</p>
        )}

        {/* Cash float card */}
        {cashDay ? (
          <Link href="/cash">
            <Card className="bg-tea-600 text-white border-tea-700">
              <p className="text-tea-200 text-sm mb-3">Cash float</p>
              <div className="flex justify-between items-end">
                <div>
                  <p className="text-xs text-tea-300">In hand</p>
                  <p className="text-3xl font-bold">{formatLKR(cashRemaining ?? 0)}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-tea-300">Paid out</p>
                  <p className="text-lg font-semibold">{formatLKR(cashDay.paid_out_cents)}</p>
                </div>
              </div>
              <Badge variant="tea" className="mt-3 bg-tea-500 text-white">
                {cashDay.status}
              </Badge>
            </Card>
          </Link>
        ) : (
          <Card className="border-amber-200 bg-amber-50">
            <p className="font-semibold text-amber-800">No float set today</p>
            <p className="text-sm text-amber-600 mt-1">
              Ask your agent to set your cash float for today.
            </p>
          </Card>
        )}

        {/* Today stats */}
        <div className="grid grid-cols-2 gap-3">
          <Card>
            <p className="text-sm text-tea-500">Visits today</p>
            <p className="text-2xl font-bold text-tea-900">{todayVisits?.length ?? 0}</p>
          </Card>
          <Card>
            <p className="text-sm text-tea-500">Kg collected</p>
            <p className="text-2xl font-bold text-tea-900">{totalKgToday.toFixed(0)}</p>
          </Card>
        </div>

        {/* Today's visits */}
        {(todayVisits ?? []).length > 0 && (
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-tea-400">
              Today&apos;s collections
            </p>
            <div className="space-y-2">
              {todayVisits?.map((v: any) => (
                <Link key={v.id} href={`/collections/${v.id}`}>
                  <Card padded={false} className="p-3 flex items-center gap-3">
                    <Truck className="h-4 w-4 text-tea-400 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-tea-900 truncate">
                        {(v.fields as any)?.name ?? "Field"}
                      </p>
                      <p className="text-xs text-tea-400">
                        {(v.profiles as any)?.full_name} · {v.total_kg?.toFixed(1)} kg
                      </p>
                    </div>
                    {v.owner_confirmed ? (
                      <Badge variant="green">✓</Badge>
                    ) : (
                      <Badge variant="amber">Pending</Badge>
                    )}
                  </Card>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Sticky big collect button */}
      <div className="fixed bottom-20 left-0 right-0 mx-auto max-w-md px-4">
        <Link href="/collect">
          <Button fullWidth size="lg" className="shadow-lg">
            <Plus className="h-5 w-5" />
            New collection
          </Button>
        </Link>
      </div>
    </AppShell>
  );
}
