"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { useProfile } from "@/lib/hooks/useProfile";
import { AppShell, PageHeader } from "@/components/AppShell";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { formatLKR } from "@/lib/money";
import { Plus, User } from "lucide-react";
import toast from "react-hot-toast";

const AREA_FLOOR_CENTS = 4000;

export default function FieldDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: profile } = useProfile();
  const router = useRouter();
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);

  const { data: field } = useQuery({
    queryKey: ["field", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("fields")
        .select("*")
        .eq("id", id)
        .single();
      return data;
    },
  });

  const { data: workers } = useQuery({
    queryKey: ["field-workers", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("workers")
        .select("id, name, phone, is_shadow")
        .eq("field_id", id)
        .order("name");
      return data ?? [];
    },
  });

  const [name, setName] = useState("");
  const [rateStr, setRateStr] = useState("");
  const [lunchStr, setLunchStr] = useState("");

  function startEdit() {
    if (field) {
      setName(field.name);
      setRateStr((field.rate_per_kg_cents / 100).toString());
      setLunchStr((field.lunch_allowance_cents / 100).toString());
    }
    setEditing(true);
  }

  const saveMutation = useMutation({
    mutationFn: async () => {
      const rateCents = Math.max(
        Math.round((parseFloat(rateStr) || 40) * 100),
        AREA_FLOOR_CENTS
      );
      const { error } = await supabase
        .from("fields")
        .update({
          name,
          rate_per_kg_cents: rateCents,
          lunch_allowance_cents: Math.round((parseFloat(lunchStr) || 0) * 100),
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Field updated");
      qc.invalidateQueries({ queryKey: ["field", id] });
      qc.invalidateQueries({ queryKey: ["fields", profile?.id] });
      setEditing(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!field) return null;

  return (
    <AppShell>
      <PageHeader
        title={field.name}
        action={
          !editing && (
            <Button size="sm" variant="secondary" onClick={startEdit}>
              Edit
            </Button>
          )
        }
      />

      <div className="px-4 md:px-6 pb-8 space-y-6 max-w-lg">
        {editing ? (
          <Card>
            <div className="space-y-4">
              <Input
                label="Field name"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              <Input
                label="Rate per kg (Rs.)"
                value={rateStr}
                onChange={(e) => setRateStr(e.target.value)}
                inputMode="decimal"
                hint="Min Rs.40/kg"
              />
              <Input
                label="Lunch allowance (Rs.)"
                value={lunchStr}
                onChange={(e) => setLunchStr(e.target.value)}
                inputMode="decimal"
              />
              <div className="flex gap-2 pt-2">
                <Button
                  variant="secondary"
                  onClick={() => setEditing(false)}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => saveMutation.mutate()}
                  loading={saveMutation.isPending}
                  className="flex-1"
                >
                  Save
                </Button>
              </div>
            </div>
          </Card>
        ) : (
          <Card>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-sm text-tea-500">Rate per kg</span>
                <span className="font-semibold text-tea-900">
                  {formatLKR(field.rate_per_kg_cents)}
                </span>
              </div>
              {field.lunch_allowance_cents > 0 && (
                <div className="flex justify-between">
                  <span className="text-sm text-tea-500">Lunch allowance</span>
                  <span className="text-tea-900">
                    {formatLKR(field.lunch_allowance_cents)}
                  </span>
                </div>
              )}
              {field.acreage && (
                <div className="flex justify-between">
                  <span className="text-sm text-tea-500">Acreage</span>
                  <span className="text-tea-900">{field.acreage} acres</span>
                </div>
              )}
              {field.location && (
                <div className="flex justify-between">
                  <span className="text-sm text-tea-500">Location</span>
                  <span className="text-tea-900">{field.location}</span>
                </div>
              )}
            </div>
          </Card>
        )}

        {/* Workers */}
        <div>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold text-tea-700">Workers (pluckers)</h2>
            <Link href="/workers/new">
              <Button size="sm" variant="secondary">
                <Plus className="h-4 w-4" />
                Add
              </Button>
            </Link>
          </div>

          {workers?.length === 0 ? (
            <p className="text-sm text-tea-400 py-4">No workers added yet</p>
          ) : (
            <div className="space-y-2">
              {workers?.map((w: any) => (
                <Link key={w.id} href={`/workers/${w.id}`}>
                  <Card padded={false} className="p-3 flex items-center gap-3">
                    <User className="h-4 w-4 text-tea-400" />
                    <div className="flex-1">
                      <p className="font-medium text-tea-900">{w.name}</p>
                      {w.phone && (
                        <p className="text-xs text-tea-400">{w.phone}</p>
                      )}
                    </div>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
