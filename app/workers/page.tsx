"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { useProfile } from "@/lib/hooks/useProfile";
import { AppShell, PageHeader } from "@/components/AppShell";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Users, Plus, User } from "lucide-react";

export default function WorkersPage() {
  const { data: profile } = useProfile();

  const { data: workers, isLoading } = useQuery({
    queryKey: ["all-workers", profile?.id],
    queryFn: async () => {
      // Get all fields for this owner, then their workers
      const { data: fields } = await supabase
        .from("fields")
        .select("id, name")
        .eq("owner_id", profile!.id);

      if (!fields?.length) return [];

      const fieldIds = fields.map((f: any) => f.id);
      const { data: workers } = await supabase
        .from("workers")
        .select("id, name, phone, field_id, is_shadow")
        .in("field_id", fieldIds)
        .order("name");

      return (workers ?? []).map((w: any) => ({
        ...w,
        fieldName: fields.find((f: any) => f.id === w.field_id)?.name ?? "",
      }));
    },
    enabled: !!profile?.id,
  });

  return (
    <AppShell>
      <PageHeader
        title="Workers"
        subtitle="Your pluckers"
        action={
          <Link href="/workers/new">
            <Button size="sm">
              <Plus className="h-4 w-4" />
              Add
            </Button>
          </Link>
        }
      />

      <div className="px-4 md:px-6 pb-8">
        {!isLoading && workers?.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No workers yet"
            description="Add pluckers to track their kg and pay"
            action={{
              label: "Add worker",
              onClick: () => (window.location.href = "/workers/new"),
            }}
          />
        ) : (
          <div className="space-y-2">
            {workers?.map((w: any) => (
              <Link key={w.id} href={`/workers/${w.id}`}>
                <Card padded={false} className="p-4 flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-tea-100">
                    <User className="h-4 w-4 text-tea-500" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-tea-900">{w.name}</p>
                    <p className="text-xs text-tea-400">
                      {w.fieldName}
                      {w.phone ? ` · ${w.phone}` : ""}
                    </p>
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
