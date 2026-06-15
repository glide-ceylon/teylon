"use client";

import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseClient";
import { AppShell, PageHeader } from "@/components/AppShell";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { formatLKR } from "@/lib/money";
import { User } from "lucide-react";

export default function CollectionDetailPage() {
  const { id } = useParams<{ id: string }>();

  const { data: visit } = useQuery({
    queryKey: ["collection-detail", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("collection_visits")
        .select(`
          id, collected_at, total_kg, owner_confirmed, escalated, escalation_note, status, tea_rate_cents,
          fields(name, rate_per_kg_cents, tea_rate_cents),
          profiles!collection_visits_owner_id_fkey(full_name, phone),
          drivers(lorry_identifier, profiles(full_name)),
          collection_lines(id, kg, workers(id, name))
        `)
        .eq("id", id)
        .single();
      return data;
    },
  });

  if (!visit) return null;

  const field = visit.fields as any;
  const owner = (visit as any).profiles as any;
  const driver = visit.drivers as any;
  const lines = (visit.collection_lines as any[]) ?? [];

  return (
    <AppShell>
      <PageHeader
        title={field?.name ?? "Collection"}
        subtitle={new Date(visit.collected_at).toLocaleDateString("en-LK", {
          weekday: "long",
          day: "numeric",
          month: "long",
          year: "numeric",
        })}
      />

      <div className="px-4 md:px-6 pb-8 space-y-4 max-w-lg">
        {/* Status */}
        <div className="flex gap-2">
          {visit.owner_confirmed ? (
            <Badge variant="green">Owner confirmed</Badge>
          ) : visit.escalated ? (
            <Badge variant="red">Escalated</Badge>
          ) : (
            <Badge variant="amber">Awaiting owner confirmation</Badge>
          )}
        </div>

        {/* Details */}
        <Card>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-sm text-tea-500">Owner</span>
              <span className="font-medium text-tea-900">{owner?.full_name ?? "—"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-tea-500">Driver</span>
              <span className="text-tea-900">
                {driver?.profiles?.full_name ?? driver?.lorry_identifier ?? "—"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-tea-500">Total kg</span>
              <span className="font-bold text-tea-900">{visit.total_kg?.toFixed(1)} kg</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-tea-500">Tea rate</span>
              <span className="text-tea-900">
                {formatLKR((visit as any).tea_rate_cents ?? field?.tea_rate_cents ?? 0)}/kg
              </span>
            </div>
            <div className="flex justify-between border-t border-tea-100 pt-3">
              <span className="font-semibold text-tea-700">Est. owner payment</span>
              <span className="font-bold text-tea-900">
                {formatLKR((visit.total_kg ?? 0) * ((visit as any).tea_rate_cents ?? field?.tea_rate_cents ?? 0))}
              </span>
            </div>
          </div>
        </Card>

        {/* Lines */}
        {lines.length > 0 && (
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-tea-400">
              Pluckers · {lines.length}
            </p>
            <Card padded={false}>
              {lines.map((line: any, i: number) => (
                <div
                  key={line.id}
                  className={`flex items-center gap-3 px-4 py-3 ${i > 0 ? "border-t border-tea-50" : ""}`}
                >
                  <User className="h-4 w-4 text-tea-300 flex-shrink-0" />
                  <span className="flex-1 text-tea-800">{line.workers?.name ?? "Unknown"}</span>
                  <span className="font-semibold text-tea-900">{line.kg.toFixed(1)} kg</span>
                </div>
              ))}
            </Card>
          </div>
        )}

        {/* Escalation note */}
        {visit.escalated && visit.escalation_note && (
          <Card className="border-red-200 bg-red-50">
            <p className="text-sm font-medium text-red-700">Owner&apos;s dispute note:</p>
            <p className="mt-1 text-sm text-red-600 italic">
              &ldquo;{visit.escalation_note}&rdquo;
            </p>
          </Card>
        )}
      </div>
    </AppShell>
  );
}
