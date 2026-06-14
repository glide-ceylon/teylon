"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { useProfile } from "@/lib/hooks/useProfile";
import { AppShell, PageHeader } from "@/components/AppShell";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatLKR } from "@/lib/money";
import { BarChart2, Plus, ArrowRight } from "lucide-react";

export default function SettlementsPage() {
  const { data: profile } = useProfile();

  const { data: settlements, isLoading } = useQuery({
    queryKey: ["settlements", profile?.org_id],
    queryFn: async () => {
      const { data } = await supabase
        .from("settlements")
        .select("*, profiles!settlements_owner_id_fkey(full_name)")
        .eq("org_id", profile!.org_id)
        .order("computed_at", { ascending: false });
      return data ?? [];
    },
    enabled: !!profile?.org_id,
  });

  return (
    <AppShell>
      <PageHeader
        title="Settlements"
        subtitle="Monthly owner payouts"
        action={
          <Link href="/settlements/new">
            <Button size="sm">
              <Plus className="h-4 w-4" />
              Run
            </Button>
          </Link>
        }
      />

      <div className="px-4 md:px-6 pb-8 max-w-2xl">
        {!isLoading && settlements?.length === 0 ? (
          <EmptyState
            icon={BarChart2}
            title="No settlements yet"
            description="Run a monthly settlement to compute the average rate and pay out owners"
            action={{
              label: "Run settlement",
              onClick: () => (window.location.href = "/settlements/new"),
            }}
          />
        ) : (
          <div className="space-y-2">
            {settlements?.map((s: any) => (
              <Link key={s.id} href={`/settlements/${s.id}`}>
                <Card padded={false} className="p-4 active:scale-[0.98] transition-transform">
                  <div className="flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-tea-900">
                        {(s.profiles as any)?.full_name ?? "Owner"}
                      </p>
                      <p className="text-sm text-tea-500">
                        {new Date(s.period_start).toLocaleDateString("en-LK", {
                          day: "numeric", month: "short"
                        })}
                        {" → "}
                        {new Date(s.period_end).toLocaleDateString("en-LK", {
                          day: "numeric", month: "short", year: "numeric"
                        })}
                        {" · "}{s.total_submitted_kg.toFixed(0)} kg
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="font-bold text-tea-900">{formatLKR(s.net_cents)}</p>
                      <p className="text-xs text-tea-400">net</p>
                    </div>
                    <ArrowRight className="h-4 w-4 flex-shrink-0 text-tea-300" />
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
