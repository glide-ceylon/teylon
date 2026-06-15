"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { useProfile } from "@/lib/hooks/useProfile";
import { AppShell, PageHeader } from "@/components/AppShell";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { Users, Plus, ArrowRight, Search } from "lucide-react";

export default function OwnersPage() {
  const { data: profile } = useProfile();
  const [search, setSearch] = useState("");

  const { data: owners, isLoading } = useQuery({
    queryKey: ["owners", profile?.org_id],
    queryFn: async () => {
      // All owners the agent manages (shadow + linked) live in their org.
      // RLS returns owners this agent has adopted (scanned/created/collected).
      const { data } = await supabase
        .from("profiles")
        .select("id, full_name, phone, is_shadow")
        .eq("role", "owner")
        .order("full_name");
      return data ?? [];
    },
    enabled: !!profile?.org_id,
  });

  const filtered = (owners ?? []).filter((o: any) =>
    !search || o.full_name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <AppShell>
      <PageHeader
        title="Owners"
        action={
          <Link href="/owners/new">
            <Button size="sm">
              <Plus className="h-4 w-4" />
              Add owner
            </Button>
          </Link>
        }
      />

      <div className="px-4 md:px-6 pb-8 space-y-4">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-3.5 h-4 w-4 text-tea-400" />
          <input
            className="w-full rounded-xl border border-tea-200 bg-white py-3 pl-9 pr-4 text-tea-900 focus:outline-none focus:ring-2 focus:ring-tea-500"
            placeholder="Search owners…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {!isLoading && filtered.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No owners yet"
            description="Add an owner to start recording collections and payments"
            action={{
              label: "Create shadow owner",
              onClick: () => (window.location.href = "/owners/new"),
            }}
          />
        ) : (
          <div className="space-y-2">
            {filtered.map((owner: any) => (
              <Link key={owner.id} href={`/owners/${owner.id}`}>
                <Card padded={false} className="p-4 active:scale-[0.98] transition-transform">
                  <div className="flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-tea-900">{owner.full_name}</p>
                        {owner.is_shadow && (
                          <Badge variant="gray">Shadow</Badge>
                        )}
                      </div>
                      {owner.phone && (
                        <p className="text-xs text-tea-400">{owner.phone}</p>
                      )}
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
