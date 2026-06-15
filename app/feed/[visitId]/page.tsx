"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseClient";
import { useProfile } from "@/lib/hooks/useProfile";
import { AppShell, PageHeader } from "@/components/AppShell";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { formatLKR } from "@/lib/money";
import { CheckCircle, AlertTriangle, User } from "lucide-react";
import toast from "react-hot-toast";

export default function VisitDetailPage() {
  const { visitId } = useParams<{ visitId: string }>();
  const { data: profile } = useProfile();
  const router = useRouter();
  const qc = useQueryClient();
  const [escalationNote, setEscalationNote] = useState("");
  const [showEscalate, setShowEscalate] = useState(false);

  const { data: visit, isLoading } = useQuery({
    queryKey: ["visit", visitId],
    queryFn: async () => {
      const { data } = await supabase
        .from("collection_visits")
        .select(`
          id, collected_at, total_kg, owner_confirmed, escalated, escalation_note, status, tea_rate_cents,
          fields(id, name, rate_per_kg_cents, lunch_allowance_cents, tea_rate_cents),
          drivers(lorry_identifier, profiles(full_name)),
          collection_lines(id, kg, workers(id, name))
        `)
        .eq("id", visitId)
        .single();
      return data;
    },
  });

  const confirmMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.functions.invoke("confirm-collection", {
        body: { visit_id: visitId, action: "confirm" },
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Collection confirmed");
      qc.invalidateQueries({ queryKey: ["visit", visitId] });
      qc.invalidateQueries({ queryKey: ["owner-feed", profile?.id] });
      router.push("/feed");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const escalateMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.functions.invoke("confirm-collection", {
        body: {
          visit_id: visitId,
          action: "escalate",
          escalation_note: escalationNote,
        },
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Collection escalated");
      qc.invalidateQueries({ queryKey: ["visit", visitId] });
      router.push("/feed");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) {
    return (
      <AppShell>
        <div className="flex h-64 items-center justify-center">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-tea-200 border-t-tea-600" />
        </div>
      </AppShell>
    );
  }

  if (!visit) return null;

  const field = visit.fields as any;
  const driver = visit.drivers as any;
  const lines = (visit.collection_lines as any[]) ?? [];
  // The owner earns the TEA value (agent→owner), not the worker wage.
  const teaRate = (visit as any).tea_rate_cents ?? field?.tea_rate_cents ?? 0;
  const estimatedPay = (visit.total_kg ?? 0) * teaRate;

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

      <div className="px-4 md:px-6 pb-8 space-y-4">
        {/* Status */}
        <div className="flex gap-2">
          {visit.owner_confirmed ? (
            <Badge variant="green">You confirmed this</Badge>
          ) : visit.escalated ? (
            <Badge variant="red">You escalated this</Badge>
          ) : (
            <Badge variant="amber">Awaiting your confirmation</Badge>
          )}
        </div>

        {/* Collection summary */}
        <Card>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-sm text-tea-500">Total collected</span>
              <span className="font-bold text-tea-900">{visit.total_kg?.toFixed(1)} kg</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-tea-500">Tea rate</span>
              <span className="font-semibold text-tea-900">
                {formatLKR(teaRate)} / kg
              </span>
            </div>
            <div className="flex justify-between border-t border-tea-100 pt-3">
              <span className="text-sm font-semibold text-tea-700">Estimated payment</span>
              <span className="font-bold text-tea-700">{formatLKR(estimatedPay)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-tea-500">Driver / Lorry</span>
              <span className="text-sm text-tea-700">
                {driver?.profiles?.full_name ?? driver?.lorry_identifier ?? "—"}
              </span>
            </div>
          </div>
        </Card>

        {/* Plucker lines */}
        {lines.length > 0 && (
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-tea-400">
              Pluckers · {lines.length}
            </p>
            <Card padded={false}>
              {lines.map((line: any, i: number) => (
                <div
                  key={line.id}
                  className={`flex items-center gap-3 px-4 py-3 ${
                    i > 0 ? "border-t border-tea-50" : ""
                  }`}
                >
                  <User className="h-4 w-4 text-tea-300 flex-shrink-0" />
                  <span className="flex-1 text-tea-800">
                    {line.workers?.name ?? "Unknown"}
                  </span>
                  <span className="font-semibold text-tea-900">
                    {line.kg.toFixed(1)} kg
                  </span>
                </div>
              ))}
            </Card>
          </div>
        )}

        {/* Escalation note if escalated */}
        {visit.escalated && visit.escalation_note && (
          <Card className="border-red-200 bg-red-50">
            <p className="text-sm font-medium text-red-700">Your note:</p>
            <p className="mt-1 text-sm text-red-600 italic">
              &ldquo;{visit.escalation_note}&rdquo;
            </p>
          </Card>
        )}

        {/* Action buttons — only if not yet actioned */}
        {!visit.owner_confirmed && !visit.escalated && (
          <div className="space-y-3 pt-2">
            <Button
              fullWidth
              size="lg"
              onClick={() => confirmMutation.mutate()}
              loading={confirmMutation.isPending}
            >
              <CheckCircle className="h-5 w-5" />
              Confirm this collection
            </Button>

            {!showEscalate ? (
              <Button
                fullWidth
                variant="secondary"
                onClick={() => setShowEscalate(true)}
              >
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                Dispute / Escalate
              </Button>
            ) : (
              <div className="space-y-3 rounded-2xl border border-amber-200 bg-amber-50 p-4">
                <p className="font-semibold text-amber-800">Escalate collection</p>
                <p className="text-sm text-amber-700">
                  Tell your agent what&apos;s wrong. They will be notified.
                </p>
                <textarea
                  value={escalationNote}
                  onChange={(e) => setEscalationNote(e.target.value)}
                  placeholder="e.g. Weights seem incorrect, total is lower than expected…"
                  rows={3}
                  className="w-full rounded-xl border border-amber-200 bg-white p-3 text-sm text-tea-900 focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
                <div className="flex gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setShowEscalate(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => escalateMutation.mutate()}
                    loading={escalateMutation.isPending}
                    disabled={!escalationNote.trim()}
                  >
                    Send escalation
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </AppShell>
  );
}
