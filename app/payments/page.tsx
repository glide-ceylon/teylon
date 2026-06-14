"use client";

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseClient";
import { useProfile } from "@/lib/hooks/useProfile";
import { AppShell, PageHeader } from "@/components/AppShell";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatLKR } from "@/lib/money";
import { CreditCard } from "lucide-react";

export default function PaymentsPage() {
  const { data: profile } = useProfile();

  const { data: payments, isLoading } = useQuery({
    queryKey: ["payments", profile?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("payments")
        .select("*")
        .eq("charged_to", profile!.id)
        .order("paid_at", { ascending: false });
      return data ?? [];
    },
    enabled: !!profile?.id,
  });

  return (
    <AppShell>
      <PageHeader title="Payment History" />

      <div className="px-4 md:px-6 pb-8">
        {!isLoading && payments?.length === 0 ? (
          <EmptyState
            icon={CreditCard}
            title="No payments yet"
            description="Payments from your agent will appear here"
          />
        ) : (
          <div className="space-y-2">
            {payments?.map((p: any) => (
              <Card key={p.id} padded={false} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-tea-900">
                        {formatLKR(p.amount_cents)}
                      </span>
                      <Badge variant={p.status === "confirmed" ? "green" : "gray"}>
                        {p.status}
                      </Badge>
                    </div>
                    <p className="mt-1 text-sm text-tea-500 capitalize">
                      {p.mode} payment
                      {p.weight_basis_kg ? ` · ${p.weight_basis_kg.toFixed(1)} kg` : ""}
                    </p>
                    <p className="text-xs text-tea-400">
                      {new Date(p.paid_at).toLocaleDateString("en-LK", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
