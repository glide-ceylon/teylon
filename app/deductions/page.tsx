"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { useProfile } from "@/lib/hooks/useProfile";
import { AppShell, PageHeader } from "@/components/AppShell";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatLKR } from "@/lib/money";
import { Minus, Plus } from "lucide-react";

const TYPE_LABEL: Record<string, string> = {
  fertilizer: "Fertilizer",
  government: "Government",
  side_business: "Side business",
  advance: "Cash advance",
};

export default function DeductionsPage() {
  const { data: profile } = useProfile();
  const isAgent = profile?.role === "agent";

  const { data: deductions, isLoading } = useQuery({
    queryKey: ["deductions", profile?.id, profile?.org_id],
    queryFn: async () => {
      let query = supabase
        .from("deductions")
        .select("*, profiles!deductions_owner_id_fkey(full_name)")
        .order("created_at", { ascending: false });

      if (isAgent) {
        // Agent sees all deductions in their org
        query = query.eq("org_id", profile!.org_id);
      } else {
        // Owner sees only their own
        query = query.eq("owner_id", profile!.id);
      }

      const { data } = await query;
      return data ?? [];
    },
    enabled: !!profile,
  });

  const total = (deductions ?? []).reduce((s: number, d: any) => s + d.amount_cents, 0);

  return (
    <AppShell>
      <PageHeader
        title="Deductions"
        action={
          isAgent ? (
            <Link href="/deductions/new">
              <Button size="sm">
                <Plus className="h-4 w-4" />
                Add
              </Button>
            </Link>
          ) : undefined
        }
      />

      <div className="px-4 md:px-6 pb-8 space-y-4 max-w-2xl">
        {/* Total */}
        {deductions && deductions.length > 0 && (
          <Card className="bg-red-50 border-red-200">
            <div className="flex justify-between items-center">
              <span className="text-sm font-semibold text-red-700">Total deductions</span>
              <span className="text-xl font-bold text-red-600">{formatLKR(total)}</span>
            </div>
          </Card>
        )}

        {!isLoading && deductions?.length === 0 ? (
          <EmptyState
            icon={Minus}
            title="No deductions"
            description={
              isAgent
                ? "Log fertilizer, govt items, or advances against owners"
                : "No deductions charged against your account"
            }
            action={
              isAgent
                ? {
                    label: "Add deduction",
                    onClick: () => (window.location.href = "/deductions/new"),
                  }
                : undefined
            }
          />
        ) : (
          <div className="space-y-2">
            {deductions?.map((d: any) => (
              <Card key={d.id} padded={false} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-tea-900">
                        {TYPE_LABEL[d.type] ?? d.type}
                      </span>
                      {isAgent && (
                        <Badge variant="tea">
                          {(d.profiles as any)?.full_name ?? "Owner"}
                        </Badge>
                      )}
                    </div>
                    {d.note && (
                      <p className="mt-1 text-sm text-tea-500">{d.note}</p>
                    )}
                    <p className="text-xs text-tea-400">
                      {new Date(d.created_at).toLocaleDateString("en-LK")}
                    </p>
                  </div>
                  <span className="font-bold text-red-600">
                    {formatLKR(d.amount_cents)}
                  </span>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
