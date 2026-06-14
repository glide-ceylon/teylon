"use client";

import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { useProfile } from "@/lib/hooks/useProfile";
import { AppShell, PageHeader } from "@/components/AppShell";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Spinner } from "@/components/ui/Spinner";
import { Button } from "@/components/ui/Button";
import { formatLKR } from "@/lib/money";
import {
  CheckSquare,
  TrendingUp,
  Truck,
  AlertCircle,
  DollarSign,
  ArrowRight,
} from "lucide-react";

function OwnerHome({ profileId }: { profileId: string }) {
  const { data: pendingVisits } = useQuery({
    queryKey: ["pending-visits", profileId],
    queryFn: async () => {
      const { data } = await supabase
        .from("collection_visits")
        .select("id, collected_at, total_kg, fields(name)")
        .eq("owner_id", profileId)
        .eq("owner_confirmed", false)
        .eq("escalated", false)
        .order("collected_at", { ascending: false })
        .limit(5);
      return data ?? [];
    },
  });

  const { data: recentVisits } = useQuery({
    queryKey: ["recent-visits", profileId],
    queryFn: async () => {
      const { data } = await supabase
        .from("collection_visits")
        .select("id, collected_at, total_kg, owner_confirmed, escalated, fields(name)")
        .eq("owner_id", profileId)
        .order("collected_at", { ascending: false })
        .limit(5);
      return data ?? [];
    },
  });

  const pending = pendingVisits?.length ?? 0;

  return (
    <>
      <PageHeader
        title="Your farm"
        subtitle={new Date().toLocaleDateString("en-LK", {
          weekday: "long",
          day: "numeric",
          month: "long",
        })}
      />

      <div className="px-4 md:px-6 space-y-4 pb-6">
        {/* Pending confirmations */}
        {pending > 0 && (
          <Link href="/feed">
            <Card className="border-amber-200 bg-amber-50">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100">
                  <AlertCircle className="h-5 w-5 text-amber-600" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-amber-800">
                    {pending} collection{pending > 1 ? "s" : ""} waiting
                  </p>
                  <p className="text-sm text-amber-600">Tap to confirm or escalate</p>
                </div>
                <ArrowRight className="h-4 w-4 text-amber-500" />
              </div>
            </Card>
          </Link>
        )}

        {/* Balance */}
        <Link href="/balance">
          <Card>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-tea-100">
                <DollarSign className="h-5 w-5 text-tea-600" />
              </div>
              <div className="flex-1">
                <p className="text-sm text-tea-500">My balance</p>
                <p className="font-semibold text-tea-900">View what you&apos;re owed</p>
              </div>
              <ArrowRight className="h-4 w-4 text-tea-400" />
            </div>
          </Card>
        </Link>

        {/* Recent collections */}
        <div>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold text-tea-700">Recent collections</h2>
            <Link href="/feed" className="text-sm text-tea-500">See all</Link>
          </div>
          <div className="space-y-2">
            {recentVisits?.map((v: any) => (
              <Link key={v.id} href={`/feed/${v.id}`}>
                <Card padded={false} className="p-3 flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-tea-50">
                    <CheckSquare className="h-4 w-4 text-tea-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-tea-900 truncate">
                      {(v.fields as any)?.name ?? "Field"}
                    </p>
                    <p className="text-xs text-tea-400">
                      {new Date(v.collected_at).toLocaleDateString("en-LK")} ·{" "}
                      {v.total_kg?.toFixed(1)} kg
                    </p>
                  </div>
                  {v.owner_confirmed ? (
                    <Badge variant="green">Confirmed</Badge>
                  ) : v.escalated ? (
                    <Badge variant="red">Escalated</Badge>
                  ) : (
                    <Badge variant="amber">Pending</Badge>
                  )}
                </Card>
              </Link>
            ))}
            {recentVisits?.length === 0 && (
              <p className="text-center text-sm text-tea-400 py-6">No collections yet</p>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

function AgentHome({ profile }: { profile: { id: string; org_id: string | null; full_name: string } }) {
  const today = new Date().toISOString().split("T")[0];

  const { data: todayStats } = useQuery({
    queryKey: ["today-stats", profile.org_id],
    queryFn: async () => {
      const { data } = await supabase
        .from("collection_visits")
        .select("id, total_kg, owner_confirmed")
        .eq("org_id", profile.org_id)
        .gte("collected_at", today + "T00:00:00")
        .lte("collected_at", today + "T23:59:59");
      const visits = data ?? [];
      return {
        count: visits.length,
        totalKg: visits.reduce((s: number, v: any) => s + (v.total_kg ?? 0), 0),
        pendingConfirm: visits.filter((v: any) => !v.owner_confirmed).length,
      };
    },
    enabled: !!profile.org_id,
  });

  const { data: cashStats } = useQuery({
    queryKey: ["cash-stats", profile.org_id],
    queryFn: async () => {
      const { data } = await supabase
        .from("driver_cash_days")
        .select(`float_out_cents, paid_out_cents, status, drivers!inner(org_id)`)
        .eq("drivers.org_id", profile.org_id)
        .eq("day", today);
      const days = data ?? [];
      return {
        totalFloat: days.reduce((s: number, d: any) => s + d.float_out_cents, 0),
        totalPaidOut: days.reduce((s: number, d: any) => s + d.paid_out_cents, 0),
        open: days.filter((d: any) => d.status === "open").length,
      };
    },
    enabled: !!profile.org_id,
  });

  return (
    <>
      <PageHeader
        title={`Hello, ${profile.full_name.split(" ")[0]}`}
        subtitle={new Date().toLocaleDateString("en-LK", {
          weekday: "long",
          day: "numeric",
          month: "long",
        })}
        action={
          <Link href="/collect">
            <Button size="sm">+ Collect</Button>
          </Link>
        }
      />

      <div className="px-4 md:px-6 space-y-4 pb-6">
        {/* Today's collections */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Card>
            <p className="text-sm text-tea-500">Visits today</p>
            <p className="mt-1 text-2xl font-bold text-tea-900">
              {todayStats?.count ?? 0}
            </p>
          </Card>
          <Card>
            <p className="text-sm text-tea-500">Kg collected</p>
            <p className="mt-1 text-2xl font-bold text-tea-900">
              {(todayStats?.totalKg ?? 0).toFixed(0)}
            </p>
          </Card>
          <Card>
            <p className="text-sm text-tea-500">Awaiting confirm</p>
            <p className="mt-1 text-2xl font-bold text-amber-600">
              {todayStats?.pendingConfirm ?? 0}
            </p>
          </Card>
          <Card>
            <p className="text-sm text-tea-500">Cash days open</p>
            <p className="mt-1 text-2xl font-bold text-tea-900">
              {cashStats?.open ?? 0}
            </p>
          </Card>
        </div>

        {/* Cash summary */}
        {cashStats && (cashStats.totalFloat > 0 || cashStats.totalPaidOut > 0) && (
          <Link href="/cash">
            <Card>
              <div className="flex items-center justify-between mb-3">
                <p className="font-semibold text-tea-900">Cash today</p>
                <ArrowRight className="h-4 w-4 text-tea-400" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-tea-400">Float out</p>
                  <p className="font-semibold text-tea-900">{formatLKR(cashStats.totalFloat)}</p>
                </div>
                <div>
                  <p className="text-xs text-tea-400">Paid out</p>
                  <p className="font-semibold text-tea-900">{formatLKR(cashStats.totalPaidOut)}</p>
                </div>
              </div>
            </Card>
          </Link>
        )}

        {/* Quick links */}
        <div className="grid grid-cols-2 gap-3 md:hidden">
          <Link href="/collections">
            <Card className="flex flex-col items-center gap-2 py-5 text-center">
              <Truck className="h-6 w-6 text-tea-500" />
              <p className="text-sm font-medium text-tea-700">Collections</p>
            </Card>
          </Link>
          <Link href="/owners">
            <Card className="flex flex-col items-center gap-2 py-5 text-center">
              <TrendingUp className="h-6 w-6 text-tea-500" />
              <p className="text-sm font-medium text-tea-700">Owners</p>
            </Card>
          </Link>
        </div>
      </div>
    </>
  );
}

export default function HomePage() {
  const { data: profile, isLoading } = useProfile();
  const router = useRouter();

  if (!isLoading && profile?.role === "driver") {
    router.replace("/today");
    return null;
  }

  return (
    <AppShell>
      {isLoading ? (
        <div className="flex h-64 items-center justify-center">
          <Spinner />
        </div>
      ) : profile?.role === "owner" ? (
        <OwnerHome profileId={profile.id} />
      ) : profile?.role === "agent" ? (
        <AgentHome profile={profile} />
      ) : null}
    </AppShell>
  );
}
