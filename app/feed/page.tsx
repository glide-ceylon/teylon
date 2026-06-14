"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { useProfile } from "@/lib/hooks/useProfile";
import { AppShell, PageHeader } from "@/components/AppShell";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { CheckSquare, ArrowRight } from "lucide-react";

export default function FeedPage() {
  const { data: profile } = useProfile();

  const { data: visits, isLoading } = useQuery({
    queryKey: ["owner-feed", profile?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("collection_visits")
        .select(`
          id, collected_at, total_kg, owner_confirmed, escalated,
          fields(name),
          drivers(lorry_identifier, profiles(full_name))
        `)
        .eq("owner_id", profile!.id)
        .order("collected_at", { ascending: false });
      return data ?? [];
    },
    enabled: !!profile?.id,
  });

  const pending = visits?.filter((v: any) => !v.owner_confirmed && !v.escalated) ?? [];
  const confirmed = visits?.filter((v: any) => v.owner_confirmed) ?? [];
  const escalated = visits?.filter((v: any) => v.escalated) ?? [];

  return (
    <AppShell>
      <PageHeader
        title="Collections"
        subtitle={
          pending.length > 0
            ? `${pending.length} waiting for confirmation`
            : "All confirmed"
        }
      />

      <div className="px-4 md:px-6 pb-8 space-y-6">
        {/* Pending — needs action */}
        {pending.length > 0 && (
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-amber-600">
              Needs confirmation · {pending.length}
            </p>
            <div className="space-y-2">
              {pending.map((v: any) => (
                <VisitCard key={v.id} visit={v} />
              ))}
            </div>
          </div>
        )}

        {/* Escalated */}
        {escalated.length > 0 && (
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-red-500">
              Escalated · {escalated.length}
            </p>
            <div className="space-y-2">
              {escalated.map((v: any) => (
                <VisitCard key={v.id} visit={v} />
              ))}
            </div>
          </div>
        )}

        {/* Confirmed */}
        {confirmed.length > 0 && (
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-tea-400">
              Confirmed · {confirmed.length}
            </p>
            <div className="space-y-2">
              {confirmed.map((v: any) => (
                <VisitCard key={v.id} visit={v} />
              ))}
            </div>
          </div>
        )}

        {!isLoading && visits?.length === 0 && (
          <EmptyState
            icon={CheckSquare}
            title="No collections yet"
            description="Collections from your agent will appear here"
          />
        )}
      </div>
    </AppShell>
  );
}

function VisitCard({ visit }: { visit: any }) {
  const driverName =
    visit.drivers?.profiles?.full_name ?? visit.drivers?.lorry_identifier ?? "Driver";

  return (
    <Link href={`/feed/${visit.id}`}>
      <Card padded={false} className="p-4 active:scale-[0.98] transition-transform">
        <div className="flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-semibold text-tea-900">
                {visit.fields?.name ?? "Field"}
              </p>
              {visit.owner_confirmed ? (
                <Badge variant="green">Confirmed</Badge>
              ) : visit.escalated ? (
                <Badge variant="red">Escalated</Badge>
              ) : (
                <Badge variant="amber">Pending</Badge>
              )}
            </div>
            <p className="mt-0.5 text-sm text-tea-500">
              {new Date(visit.collected_at).toLocaleDateString("en-LK", {
                day: "numeric",
                month: "short",
                year: "numeric",
              })}{" "}
              · {visit.total_kg?.toFixed(1)} kg · {driverName}
            </p>
          </div>
          <ArrowRight className="h-4 w-4 flex-shrink-0 text-tea-300" />
        </div>
      </Card>
    </Link>
  );
}
