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
import { Layers, Plus, ArrowRight } from "lucide-react";

export default function FieldsPage() {
  const { data: profile } = useProfile();

  const { data: fields, isLoading } = useQuery({
    queryKey: ["fields", profile?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("fields")
        .select("*, workers(count)")
        .eq("owner_id", profile!.id)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
    enabled: !!profile?.id,
  });

  return (
    <AppShell>
      <PageHeader
        title="My Fields"
        action={
          <Link href="/fields/new">
            <Button size="sm">
              <Plus className="h-4 w-4" />
              Add field
            </Button>
          </Link>
        }
      />

      <div className="px-4 md:px-6 pb-8">
        {!isLoading && fields?.length === 0 ? (
          <EmptyState
            icon={Layers}
            title="No fields yet"
            description="Add your tea field to start tracking collections"
            action={{
              label: "Add first field",
              onClick: () => (window.location.href = "/fields/new"),
            }}
          />
        ) : (
          <div className="space-y-3">
            {fields?.map((field: any) => (
              <Link key={field.id} href={`/fields/${field.id}`}>
                <Card className="active:scale-[0.98] transition-transform">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-tea-100">
                      <Layers className="h-5 w-5 text-tea-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-tea-900">{field.name}</p>
                      <p className="text-sm text-tea-500">
                        {formatLKR(field.rate_per_kg_cents)} / kg
                        {field.acreage ? ` · ${field.acreage} acres` : ""}
                        {field.location ? ` · ${field.location}` : ""}
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
