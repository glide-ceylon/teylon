"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { useProfile } from "@/lib/hooks/useProfile";
import { AppShell, PageHeader } from "@/components/AppShell";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Truck, Plus, ChevronRight } from "lucide-react";

export default function VehiclesPage() {
  const { data: profile } = useProfile();

  const { data: vehicles, isLoading } = useQuery({
    queryKey: ["vehicles", profile?.org_id],
    queryFn: async () => {
      const { data } = await supabase
        .from("vehicles")
        .select("*")
        .eq("org_id", profile!.org_id)
        .order("identifier");
      return data ?? [];
    },
    enabled: !!profile?.org_id,
  });

  return (
    <AppShell>
      <PageHeader
        title="Vehicles"
        subtitle="Lorries drivers can scan into"
        action={
          <Link href="/vehicles/new">
            <Button size="sm">
              <Plus className="h-4 w-4" />
              Add
            </Button>
          </Link>
        }
      />

      <div className="px-4 md:px-6 pb-8 max-w-2xl">
        {!isLoading && vehicles?.length === 0 ? (
          <EmptyState
            icon={Truck}
            title="No vehicles yet"
            description="Add a lorry, then print its QR for the driver to scan when they start a trip"
            action={{ label: "Add vehicle", onClick: () => (window.location.href = "/vehicles/new") }}
          />
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {vehicles?.map((v: any) => (
              <Link key={v.id} href={`/vehicles/${v.id}`}>
                <Card padded={false} className="p-4 active:scale-[0.98] transition-transform">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-tea-100">
                      <Truck className="h-5 w-5 text-tea-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-tea-900">{v.identifier}</p>
                      {v.details && <p className="text-sm text-tea-400 truncate">{v.details}</p>}
                    </div>
                    <ChevronRight className="h-4 w-4 text-tea-300" />
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
