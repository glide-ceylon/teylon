"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { useProfile } from "@/lib/hooks/useProfile";
import { AppShell, PageHeader } from "@/components/AppShell";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Truck, Plus, ArrowRight } from "lucide-react";

export default function DriversPage() {
  const { data: profile } = useProfile();

  const { data: drivers, isLoading } = useQuery({
    queryKey: ["drivers", profile?.org_id],
    queryFn: async () => {
      const { data } = await supabase
        .from("drivers")
        .select("id, profiles(full_name, phone), vehicles(identifier)")
        .eq("org_id", profile!.org_id)
        .order("created_at");
      return data ?? [];
    },
    enabled: !!profile?.org_id,
  });

  return (
    <AppShell>
      <PageHeader
        title="Drivers"
        action={
          <Link href="/drivers/new">
            <Button size="sm">
              <Plus className="h-4 w-4" />
              Add driver
            </Button>
          </Link>
        }
      />

      <div className="px-4 md:px-6 pb-8">
        {!isLoading && drivers?.length === 0 ? (
          <EmptyState
            icon={Truck}
            title="No drivers yet"
            description="Add drivers to assign them to collections and cash days"
            action={{
              label: "Add driver",
              onClick: () => (window.location.href = "/drivers/new"),
            }}
          />
        ) : (
          <div className="space-y-2">
            {drivers?.map((d: any) => (
              <Link key={d.id} href={`/drivers/${d.id}`}>
                <Card padded={false} className="p-4 active:scale-[0.98] transition-transform">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-tea-100">
                      <Truck className="h-5 w-5 text-tea-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-tea-900">
                        {(d.profiles as any)?.full_name ?? "Driver"}
                      </p>
                      <p className="text-sm text-tea-500">
                        {(d.profiles as any)?.phone ?? ""}
                        {(d.vehicles as any)?.identifier ? ` · ${(d.vehicles as any).identifier}` : ""}
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
