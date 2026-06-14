"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import toast from "react-hot-toast";

type Step = "role" | "owner-details" | "agent-details" | "owner-field";

const AREA_FLOOR_CENTS = 4000; // Rs.40/kg minimum

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("role");
  const [role, setRole] = useState<"owner" | "agent" | null>(null);
  const [loading, setLoading] = useState(false);

  // Owner fields
  const [ownerName, setOwnerName] = useState("");
  const [fieldName, setFieldName] = useState("");
  const [rateStr, setRateStr] = useState("40");
  const [skipField, setSkipField] = useState(false);

  // Agent fields
  const [agentName, setAgentName] = useState("");
  const [orgName, setOrgName] = useState("");

  async function createOwnerAccount() {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const qrCode = `teylon:owner:${session.user.id}`;

      // Create profile
      const { error: profileError } = await supabase.from("profiles").insert({
        id: session.user.id,
        full_name: ownerName,
        phone: session.user.phone || null,
        role: "owner",
        qr_code: qrCode,
        is_shadow: false,
      });
      if (profileError) throw profileError;

      toast.success("Account created!");
      router.replace("/home");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to create account");
    } finally {
      setLoading(false);
    }
  }

  async function createOwnerWithField() {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const qrCode = `teylon:owner:${session.user.id}`;

      const { error: profileError } = await supabase.from("profiles").insert({
        id: session.user.id,
        full_name: ownerName,
        phone: session.user.phone || null,
        role: "owner",
        qr_code: qrCode,
        is_shadow: false,
      });
      if (profileError) throw profileError;

      if (!skipField && fieldName) {
        const rateRupees = parseFloat(rateStr) || 40;
        const rateCents = Math.round(rateRupees * 100);
        const { error: fieldError } = await supabase.from("fields").insert({
          owner_id: session.user.id,
          name: fieldName,
          rate_per_kg_cents: Math.max(rateCents, AREA_FLOOR_CENTS),
          lunch_allowance_cents: 0,
        });
        if (fieldError) throw fieldError;
      }

      toast.success("Welcome to Teylon!");
      router.replace("/home");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to create account");
    } finally {
      setLoading(false);
    }
  }

  async function createAgentAccount() {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      // Create org. We generate the id client-side so we don't have to read the
      // row back — under RLS the agent has no profile yet, so current_org_id()
      // would be null and a SELECT-after-insert on orgs would be blocked.
      const orgId = crypto.randomUUID();
      const { error: orgError } = await supabase
        .from("orgs")
        .insert({ id: orgId, name: orgName });
      if (orgError) throw orgError;

      const qrCode = `teylon:agent:${session.user.id}`;

      const { error: profileError } = await supabase.from("profiles").insert({
        id: session.user.id,
        full_name: agentName,
        phone: session.user.phone || null,
        role: "agent",
        org_id: orgId,
        qr_code: qrCode,
        is_shadow: false,
      });
      if (profileError) throw profileError;

      toast.success("Welcome to Teylon!");
      router.replace("/home");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to create account");
    } finally {
      setLoading(false);
    }
  }

  // ── Step: Pick role ──
  if (step === "role") {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center gap-6 px-6 py-12">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-tea-700">Welcome to Teylon</h1>
          <p className="mt-1 text-sm text-tea-400">What best describes you?</p>
        </div>

        <div className="flex flex-col gap-3">
          <button
            onClick={() => { setRole("owner"); setStep("owner-details"); }}
            className="flex flex-col gap-1 rounded-2xl border-2 border-tea-100 bg-white p-5 text-left transition hover:border-tea-400 active:scale-[0.98]"
          >
            <span className="text-2xl">🌿</span>
            <p className="font-semibold text-tea-800">Field Owner</p>
            <p className="text-sm text-tea-500">I own a tea field and want to track collections and payments.</p>
          </button>

          <button
            onClick={() => { setRole("agent"); setStep("agent-details"); }}
            className="flex flex-col gap-1 rounded-2xl border-2 border-tea-100 bg-white p-5 text-left transition hover:border-tea-400 active:scale-[0.98]"
          >
            <span className="text-2xl">🚛</span>
            <p className="font-semibold text-tea-800">Agent / Collector</p>
            <p className="text-sm text-tea-500">I run a lorry and collect tea from multiple fields.</p>
          </button>
        </div>

        <p className="text-center text-xs text-tea-300">
          Drivers are created by an agent — ask your agent to add you.
        </p>
      </main>
    );
  }

  // ── Step: Owner details ──
  if (step === "owner-details") {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center gap-6 px-6 py-12">
        <button onClick={() => setStep("role")} className="self-start text-sm text-tea-500">
          ← Back
        </button>
        <div>
          <h1 className="text-2xl font-bold text-tea-700">Your details</h1>
          <p className="mt-1 text-sm text-tea-400">Field Owner</p>
        </div>

        <div className="flex flex-col gap-4">
          <Input
            label="Full name"
            placeholder="e.g. Nimal Perera"
            value={ownerName}
            onChange={(e) => setOwnerName(e.target.value)}
            autoFocus
          />
          <Button
            onClick={() => setStep("owner-field")}
            disabled={!ownerName.trim()}
            fullWidth
            size="lg"
          >
            Continue
          </Button>
        </div>
      </main>
    );
  }

  // ── Step: Owner optional first field ──
  if (step === "owner-field") {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center gap-6 px-6 py-12">
        <button onClick={() => setStep("owner-details")} className="self-start text-sm text-tea-500">
          ← Back
        </button>
        <div>
          <h1 className="text-2xl font-bold text-tea-700">Add your first field</h1>
          <p className="text-sm text-tea-400">Optional — you can add fields later.</p>
        </div>

        {!skipField && (
          <div className="flex flex-col gap-4">
            <Input
              label="Field name"
              placeholder="e.g. Upper Nuwara Estate"
              value={fieldName}
              onChange={(e) => setFieldName(e.target.value)}
              autoFocus
            />
            <Input
              label="Rate per kg (Rs.)"
              placeholder="40"
              value={rateStr}
              onChange={(e) => setRateStr(e.target.value)}
              inputMode="decimal"
              hint="Minimum is Rs.40/kg (area floor)"
            />
          </div>
        )}

        <div className="flex flex-col gap-3">
          <Button
            onClick={createOwnerWithField}
            loading={loading}
            disabled={!skipField && !fieldName.trim()}
            fullWidth
            size="lg"
          >
            {skipField ? "Create account" : "Create account with field"}
          </Button>
          <button
            onClick={() => setSkipField(!skipField)}
            className="text-sm text-tea-500 underline"
          >
            {skipField ? "Add a field now" : "Skip for now"}
          </button>
        </div>
      </main>
    );
  }

  // ── Step: Agent details ──
  if (step === "agent-details") {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center gap-6 px-6 py-12">
        <button onClick={() => setStep("role")} className="self-start text-sm text-tea-500">
          ← Back
        </button>
        <div>
          <h1 className="text-2xl font-bold text-tea-700">Your organisation</h1>
          <p className="mt-1 text-sm text-tea-400">Agent / Collector</p>
        </div>

        <div className="flex flex-col gap-4">
          <Input
            label="Your full name"
            placeholder="e.g. Sunil Fernando"
            value={agentName}
            onChange={(e) => setAgentName(e.target.value)}
            autoFocus
          />
          <Input
            label="Organisation / company name"
            placeholder="e.g. Fernando Tea Collectors"
            value={orgName}
            onChange={(e) => setOrgName(e.target.value)}
            hint="Drivers you create will belong to this organisation"
          />
          <Button
            onClick={createAgentAccount}
            disabled={!agentName.trim() || !orgName.trim()}
            loading={loading}
            fullWidth
            size="lg"
          >
            Create account
          </Button>
        </div>
      </main>
    );
  }

  return null;
}
