"use client";

import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseClient";
import { useProfile } from "@/lib/hooks/useProfile";
import { AppShell, PageHeader } from "@/components/AppShell";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import toast from "react-hot-toast";

export default function SettingsPage() {
  const { data: profile } = useProfile();
  const qc = useQueryClient();
  const [teaRateStr, setTeaRateStr] = useState("");

  const { data: org } = useQuery({
    queryKey: ["org-settings", profile?.org_id],
    queryFn: async () => {
      const { data } = await supabase
        .from("orgs")
        .select("id, name, default_tea_rate_cents")
        .eq("id", profile!.org_id)
        .single();
      return data;
    },
    enabled: !!profile?.org_id,
  });

  useEffect(() => {
    if (org) setTeaRateStr(((org.default_tea_rate_cents || 0) / 100).toString());
  }, [org]);

  const save = useMutation({
    mutationFn: async () => {
      const cents = Math.round((parseFloat(teaRateStr) || 0) * 100);
      if (cents <= 0) throw new Error("Enter a tea rate greater than 0");
      const { error } = await supabase
        .from("orgs")
        .update({ default_tea_rate_cents: cents })
        .eq("id", profile!.org_id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Tea rate saved");
      qc.invalidateQueries({ queryKey: ["org-settings"] });
      qc.invalidateQueries({ queryKey: ["org-tea-rate"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <AppShell>
      <PageHeader title="Settings" subtitle={org?.name} />

      <div className="px-4 md:px-6 pb-8 max-w-lg space-y-4">
        <Card className="space-y-3">
          <div>
            <p className="font-semibold text-tea-900">Default tea rate</p>
            <p className="text-sm text-tea-500">
              The price you pay owners per kg of tea (agent → owner). Used for the
              collection estimate; a driver can adjust it per collection (audited),
              and you can override it per field later.
            </p>
          </div>
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <Input
                label="Tea rate (Rs/kg)"
                placeholder="120"
                value={teaRateStr}
                onChange={(e) => setTeaRateStr(e.target.value)}
                inputMode="decimal"
              />
            </div>
            <Button onClick={() => save.mutate()} loading={save.isPending}>
              Save
            </Button>
          </div>
          <p className="text-xs text-tea-400">
            Note: this is different from the worker wage rate (~Rs.40/kg), which is set per field.
          </p>
        </Card>
      </div>
    </AppShell>
  );
}
