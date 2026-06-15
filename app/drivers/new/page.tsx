"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseClient";
import { useProfile } from "@/lib/hooks/useProfile";
import { AppShell, PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";
import { Check, Copy } from "lucide-react";
import toast from "react-hot-toast";

function suggestPassword() {
  return Math.random().toString(36).slice(2, 8) + Math.floor(10 + Math.random() * 89);
}

export default function NewDriverPage() {
  const { data: profile } = useProfile();
  const router = useRouter();
  const qc = useQueryClient();

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState(suggestPassword);

  // After success, show the credentials the agent must hand to the driver.
  const [created, setCreated] = useState<{ phone: string; password: string } | null>(null);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!phone.startsWith("+")) throw new Error("Phone must be E.164, e.g. +94771234567");
      if (password.length < 6) throw new Error("Password must be at least 6 characters");
      const { data, error } = await supabase.functions.invoke("create-driver", {
        body: {
          name,
          phone,
          email: email || null,
          password,
          org_id: profile!.org_id,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data as { phone: string; password: string };
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["drivers"] });
      setCreated({ phone: data.phone, password: data.password });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  async function copy(text: string, label: string) {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${label} copied`);
    } catch {
      toast.error("Copy not supported");
    }
  }

  // ── Credentials screen ──
  if (created) {
    return (
      <AppShell>
        <PageHeader title="Driver created" />
        <div className="px-4 md:px-6 pb-8 max-w-lg space-y-4">
          <Card className="flex flex-col items-center gap-3 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
              <Check className="h-8 w-8 text-green-600" />
            </div>
            <p className="font-semibold text-tea-900">{name} can now log in</p>
            <p className="text-sm text-tea-500">
              Share these with the driver. They sign in with their phone (or email)
              and this password — no code needed. They pick their vehicle after logging in.
            </p>
          </Card>

          <Card className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-widest text-tea-400">Phone</p>
                <p className="font-mono text-lg text-tea-900">{created.phone}</p>
              </div>
              <Button size="sm" variant="secondary" onClick={() => copy(created.phone, "Phone")}>
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex items-center justify-between gap-3 border-t border-tea-100 pt-3">
              <div>
                <p className="text-xs uppercase tracking-widest text-tea-400">Password</p>
                <p className="font-mono text-lg text-tea-900">{created.password}</p>
              </div>
              <Button size="sm" variant="secondary" onClick={() => copy(created.password, "Password")}>
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </Card>

          <Card className="bg-amber-50 border-amber-200">
            <p className="text-sm text-amber-700">
              Save this password now — it won&apos;t be shown again.
            </p>
          </Card>

          <Button fullWidth size="lg" onClick={() => router.push("/drivers")}>
            Done
          </Button>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <PageHeader title="Add Driver" />

      <div className="px-4 md:px-6 pb-8 max-w-lg space-y-4">
        <Card className="bg-tea-50 border-tea-200">
          <p className="text-sm text-tea-600">
            This creates a login for the driver — the person, not a vehicle. They sign
            in with their <strong>phone (or email) + password</strong>, then scan or pick
            a vehicle when they start a trip.
          </p>
        </Card>

        <Input
          label="Driver full name *"
          placeholder="e.g. Kamal Silva"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
        />
        <Input
          label="Driver phone number *"
          placeholder="+94771234567"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          inputMode="tel"
          hint="Must be E.164 format with country code"
        />
        <Input
          label="Email (optional)"
          placeholder="driver@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          inputMode="email"
          type="email"
          hint="Lets the driver also sign in with email"
        />
        <div className="flex items-end gap-2">
          <div className="flex-1">
            <Input
              label="Password *"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              hint="Share this with the driver — at least 6 characters"
            />
          </div>
          <Button variant="secondary" onClick={() => setPassword(suggestPassword())}>
            New
          </Button>
        </div>

        <Button
          fullWidth
          size="lg"
          onClick={() => mutation.mutate()}
          loading={mutation.isPending}
          disabled={!name.trim() || !phone.trim() || password.length < 6}
        >
          Create driver account
        </Button>
      </div>
    </AppShell>
  );
}
