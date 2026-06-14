"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { useProfile } from "@/lib/hooks/useProfile";
import { AppShell, PageHeader } from "@/components/AppShell";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { Truck, ArrowRight } from "lucide-react";

export default function CollectionsPage() {
  const { data: profile } = useProfile();
  const [filter, setFilter] = useState<"today" | "week" | "all">("today");

  const { data: visits, isLoading } = useQuery({
    queryKey: ["collections", profile?.org_id, filter],
    queryFn: async () => {
      let query = supabase
        .from("collection_visits")
        .select(`
          id, collected_at, total_kg, owner_confirmed, escalated,
          fields(name),
          profiles!collection_visits_owner_id_fkey(full_name),
          drivers(lorry_identifier)
        `)
        .order("collected_at", { ascending: false });

      if (profile?.role === "driver") {
        // Drivers see only their own collections
        const { data: driver } = await supabase
          .from("drivers")
          .select("id")
          .eq("profile_id", profile.id)
          .single();
        if (driver) query = query.eq("driver_id", driver.id);
      } else {
        query = query.eq("org_id", profile!.org_id);
      }

      const now = new Date();
      if (filter === "today") {
        const todayStr = now.toISOString().split("T")[0];
        query = query
          .gte("collected_at", todayStr + "T00:00:00")
          .lte("collected_at", todayStr + "T23:59:59");
      } else if (filter === "week") {
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        query = query.gte("collected_at", weekAgo.toISOString());
      }

      const { data } = await query.limit(50);
      return data ?? [];
    },
    enabled: !!(profile?.org_id || profile?.role === "driver"),
  });

  const totalKg = (visits ?? []).reduce((s: number, v: any) => s + (v.total_kg ?? 0), 0);

  return (
    <AppShell>
      <PageHeader
        title="Collections"
        subtitle={
          visits
            ? `${visits.length} visits · ${totalKg.toFixed(0)} kg`
            : undefined
        }
      />

      <div className="px-4 md:px-6 pb-8 space-y-4">
        {/* Filter tabs */}
        <div className="flex gap-2">
          {(["today", "week", "all"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={[
                "rounded-full px-4 py-1.5 text-sm font-medium transition-colors capitalize",
                filter === f
                  ? "bg-tea-600 text-white"
                  : "bg-white text-tea-500 border border-tea-200",
              ].join(" ")}
            >
              {f === "week" ? "7 days" : f}
            </button>
          ))}
        </div>

        {!isLoading && visits?.length === 0 ? (
          <EmptyState
            icon={Truck}
            title="No collections"
            description="Collections will appear here after you submit them"
          />
        ) : (
          <div className="space-y-2">
            {visits?.map((v: any) => (
              <Link key={v.id} href={`/collections/${v.id}`}>
                <Card padded={false} className="p-4 active:scale-[0.98] transition-transform">
                  <div className="flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-tea-900">
                          {(v.fields as any)?.name ?? "Field"}
                        </p>
                        {v.owner_confirmed ? (
                          <Badge variant="green">Confirmed</Badge>
                        ) : v.escalated ? (
                          <Badge variant="red">Escalated</Badge>
                        ) : (
                          <Badge variant="amber">Pending</Badge>
                        )}
                      </div>
                      <p className="text-sm text-tea-500">
                        {(v.profiles as any)?.full_name ?? "Owner"} ·{" "}
                        {v.total_kg?.toFixed(1)} kg ·{" "}
                        {new Date(v.collected_at).toLocaleDateString("en-LK")}
                      </p>
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
