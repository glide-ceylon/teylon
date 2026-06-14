"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseClient";
import { useProfile } from "@/lib/hooks/useProfile";
import { AppShell, PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import toast from "react-hot-toast";

function NewWorkerForm() {
  const { data: profile } = useProfile();
  const router = useRouter();
  const searchParams = useSearchParams();
  const qc = useQueryClient();

  const preselectedFieldId = searchParams.get("field_id") ?? "";

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [fieldId, setFieldId] = useState(preselectedFieldId);

  const { data: fields } = useQuery({
    queryKey: ["fields", profile?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("fields")
        .select("id, name")
        .eq("owner_id", profile!.id)
        .order("name");
      return data ?? [];
    },
    enabled: !!profile?.id,
  });

  const mutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("workers").insert({
        name,
        phone: phone || null,
        field_id: fieldId || null,
        is_shadow: false,
        created_by: profile!.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Worker added");
      qc.invalidateQueries({ queryKey: ["all-workers"] });
      qc.invalidateQueries({ queryKey: ["field-workers", fieldId] });
      router.back();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <AppShell>
      <PageHeader title="Add Worker" />

      <div className="px-4 md:px-6 pb-8 max-w-lg space-y-4">
        <Input
          label="Full name *"
          placeholder="e.g. Kamala Perera"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
        />
        <Input
          label="Phone"
          placeholder="+94771234567"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          inputMode="tel"
          hint="Optional — for future OTP claim"
        />

        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-tea-700">Field</label>
          <select
            value={fieldId}
            onChange={(e) => setFieldId(e.target.value)}
            className="w-full rounded-xl border border-tea-200 bg-white px-4 py-3 text-tea-900 focus:outline-none focus:ring-2 focus:ring-tea-500"
          >
            <option value="">— Select field —</option>
            {fields?.map((f: any) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
        </div>

        <Button
          fullWidth
          size="lg"
          onClick={() => mutation.mutate()}
          loading={mutation.isPending}
          disabled={!name.trim()}
        >
          Add worker
        </Button>
      </div>
    </AppShell>
  );
}

export default function NewWorkerPage() {
  return (
    <Suspense>
      <NewWorkerForm />
    </Suspense>
  );
}
