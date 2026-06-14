"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { useProfile } from "@/lib/hooks/useProfile";
import { AppShell, PageHeader } from "@/components/AppShell";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { Bell } from "lucide-react";

export default function NotificationsPage() {
  const { data: profile } = useProfile();

  // For owners: pending collections = their notifications
  const { data: pendingVisits } = useQuery({
    queryKey: ["notifications-visits", profile?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("collection_visits")
        .select("id, collected_at, total_kg, fields(name), profiles!collection_visits_driver_id_fkey(full_name)")
        .eq("owner_id", profile!.id)
        .eq("owner_confirmed", false)
        .eq("escalated", false)
        .order("collected_at", { ascending: false });
      return data ?? [];
    },
    enabled: !!profile && profile.role === "owner",
  });

  // For agents: escalated collections
  const { data: escalated } = useQuery({
    queryKey: ["notifications-escalated", profile?.org_id],
    queryFn: async () => {
      const { data } = await supabase
        .from("collection_visits")
        .select("id, collected_at, total_kg, escalation_note, fields(name), profiles!collection_visits_owner_id_fkey(full_name)")
        .eq("org_id", profile!.org_id)
        .eq("escalated", true)
        .order("collected_at", { ascending: false })
        .limit(20);
      return data ?? [];
    },
    enabled: !!profile && (profile.role === "agent" || profile.role === "driver"),
  });

  const isOwner = profile?.role === "owner";

  const items = isOwner ? (pendingVisits ?? []) : (escalated ?? []);

  return (
    <AppShell>
      <PageHeader title="Notifications" />

      <div className="px-4 md:px-6 pb-8">
        {items.length === 0 ? (
          <EmptyState
            icon={Bell}
            title="All clear"
            description="No new notifications"
          />
        ) : (
          <div className="space-y-2">
            {isOwner && items.map((v: any) => (
              <Link key={v.id} href={`/feed/${v.id}`}>
                <Card padded={false} className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-medium text-tea-900">
                        Collection from {(v.fields as any)?.name ?? "your field"}
                      </p>
                      <p className="text-sm text-tea-500">
                        {v.total_kg?.toFixed(1)} kg ·{" "}
                        {new Date(v.collected_at).toLocaleDateString("en-LK")}
                      </p>
                    </div>
                    <Badge variant="amber">Confirm</Badge>
                  </div>
                </Card>
              </Link>
            ))}
            {!isOwner && items.map((v: any) => (
              <Link key={v.id} href={`/collections/${v.id}`}>
                <Card padded={false} className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-medium text-tea-900">
                        Escalated: {(v.fields as any)?.name ?? "Field"}
                      </p>
                      <p className="text-sm text-tea-500">
                        {(v.profiles as any)?.full_name} ·{" "}
                        {v.total_kg?.toFixed(1)} kg
                      </p>
                      {v.escalation_note && (
                        <p className="mt-1 text-xs text-red-500 italic">
                          &ldquo;{v.escalation_note}&rdquo;
                        </p>
                      )}
                    </div>
                    <Badge variant="red">Escalated</Badge>
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
