"use client";

import { useEffect, useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseClient";
import { useProfile } from "@/lib/hooks/useProfile";
import { AppShell } from "@/components/AppShell";
import { QRScanner } from "@/components/QRScanner";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { formatLKR } from "@/lib/money";
import { Camera, Search, X, Plus, Check, ArrowLeft } from "lucide-react";
import toast from "react-hot-toast";

type WorkerLine = {
  id: string;
  worker_id: string | null;
  worker_name: string;
  kgStr: string;
};

type SelectedField = {
  id: string;
  name: string;
  owner_id: string;
  owner_name: string;
  rate_per_kg_cents: number; // worker wage rate
  tea_rate_cents: number; // resolved base tea rate (agent->owner)
  pay_mode: "instant" | "monthly";
};

export default function CollectPage() {
  const { data: profile } = useProfile();
  const qc = useQueryClient();

  const [showScanner, setShowScanner] = useState(false);
  const [fieldSearch, setFieldSearch] = useState("");
  const [selectedField, setSelectedField] = useState<SelectedField | null>(null);
  const [lines, setLines] = useState<WorkerLine[]>([
    { id: crypto.randomUUID(), worker_id: null, worker_name: "", kgStr: "" },
  ]);
  const [workerSearch, setWorkerSearch] = useState<Record<string, string>>({});

  // Estimate / review step
  const [reviewing, setReviewing] = useState(false);
  const [teaRateStr, setTeaRateStr] = useState("");
  const [payMode, setPayMode] = useState<"instant" | "monthly">("monthly");
  const [advanceStr, setAdvanceStr] = useState("");

  const [submitted, setSubmitted] = useState(false);

  // Org default tea rate (fallback when a field has no tea rate of its own).
  const { data: org } = useQuery({
    queryKey: ["org-tea-rate", profile?.org_id],
    queryFn: async () => {
      const { data } = await supabase
        .from("orgs")
        .select("default_tea_rate_cents")
        .eq("id", profile!.org_id)
        .single();
      return data;
    },
    enabled: !!profile?.org_id,
  });
  const orgTeaRate = org?.default_tea_rate_cents ?? 0;

  // Search fields
  const { data: fieldResults } = useQuery({
    queryKey: ["field-search", fieldSearch],
    queryFn: async () => {
      if (fieldSearch.length < 2) return [];
      const { data } = await supabase
        .from("fields")
        .select("id, name, owner_id, rate_per_kg_cents, tea_rate_cents, profiles!fields_owner_id_fkey(full_name, pay_mode)")
        .ilike("name", `%${fieldSearch}%`)
        .limit(8);
      return data ?? [];
    },
    enabled: fieldSearch.length >= 2,
  });

  // If the collector is a driver, resolve their driver record (for driver_id).
  const { data: myDriver } = useQuery({
    queryKey: ["my-driver", profile?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("drivers")
        .select("id")
        .eq("profile_id", profile!.id)
        .maybeSingle();
      return data;
    },
    enabled: !!profile?.id && profile?.role === "driver",
  });

  // Workers for selected field
  const { data: fieldWorkers } = useQuery({
    queryKey: ["field-workers-collect", selectedField?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("workers")
        .select("id, name")
        .eq("field_id", selectedField!.id)
        .order("name");
      return data ?? [];
    },
    enabled: !!selectedField?.id,
  });

  // Initialise estimate inputs whenever a field is selected.
  useEffect(() => {
    if (selectedField) {
      setTeaRateStr(((selectedField.tea_rate_cents || 0) / 100).toString());
      setPayMode(selectedField.pay_mode);
    }
  }, [selectedField]);

  function handleQRResult(result: string) {
    setShowScanner(false);
    const match = result.match(
      /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i
    );
    if (!match) {
      toast.error("Invalid QR code");
      return;
    }
    lookupOwnerById(match[0]);
  }

  async function lookupOwnerById(ownerId: string) {
    const { data, error } = await supabase.functions.invoke("lookup-owner", {
      body: { owner_id: ownerId },
    });
    if (error || !data || data.error) {
      toast.error(data?.error ?? "Owner not found");
      return;
    }

    const fields = data.fields as {
      id: string;
      name: string;
      rate_per_kg_cents: number;
      tea_rate_cents: number | null;
    }[];

    if (!fields || fields.length === 0) {
      toast.error(`${data.full_name} has no fields yet — add one first`);
      return;
    }

    if (fields.length === 1) {
      setSelectedField({
        id: fields[0].id,
        name: fields[0].name,
        owner_id: data.id,
        owner_name: data.full_name,
        rate_per_kg_cents: fields[0].rate_per_kg_cents,
        tea_rate_cents: fields[0].tea_rate_cents ?? orgTeaRate,
        pay_mode: data.pay_mode ?? "monthly",
      });
      toast.success(`Loaded: ${data.full_name} — ${fields[0].name}`);
    } else {
      toast("Owner has multiple fields — search by field name instead", { icon: "ℹ️" });
    }
  }

  // Deep link from a scanned QR opened in the native camera: /collect?owner=<id>
  useEffect(() => {
    const ownerId = new URLSearchParams(window.location.search).get("owner");
    if (ownerId) lookupOwnerById(ownerId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function updateLine(id: string, key: keyof WorkerLine, value: string) {
    setLines((ls) => ls.map((l) => (l.id === id ? { ...l, [key]: value } : l)));
  }
  function removeLine(id: string) {
    if (lines.length > 1) setLines((ls) => ls.filter((l) => l.id !== id));
  }
  function addLine() {
    setLines((ls) => [
      ...ls,
      { id: crypto.randomUUID(), worker_id: null, worker_name: "", kgStr: "" },
    ]);
  }
  function selectWorker(lineId: string, workerId: string, workerName: string) {
    setLines((ls) =>
      ls.map((l) => (l.id === lineId ? { ...l, worker_id: workerId, worker_name: workerName } : l))
    );
    setWorkerSearch((prev) => ({ ...prev, [lineId]: "" }));
  }
  function resetAll() {
    setSubmitted(false);
    setReviewing(false);
    setSelectedField(null);
    setFieldSearch("");
    setAdvanceStr("");
    setLines([{ id: crypto.randomUUID(), worker_id: null, worker_name: "", kgStr: "" }]);
  }

  const total = useMemo(
    () => lines.reduce((s, l) => s + (parseFloat(l.kgStr) || 0), 0),
    [lines]
  );

  const workerRate = selectedField?.rate_per_kg_cents ?? 0;
  const teaRateCents = Math.round((parseFloat(teaRateStr) || 0) * 100);
  const baseTeaRate = selectedField?.tea_rate_cents ?? 0;
  const teaRateChanged = teaRateCents !== baseTeaRate;

  const workerPayCents = Math.round(total * workerRate);
  const teaValueCents = Math.round(total * teaRateCents);
  const advanceCents = Math.round((parseFloat(advanceStr) || 0) * 100);

  const submitMutation = useMutation({
    mutationFn: async () => {
      if (!selectedField) throw new Error("No field selected");
      const validLines = lines.filter((l) => parseFloat(l.kgStr) > 0);
      if (!validLines.length) throw new Error("Add at least one plucker weight");
      if (teaRateCents <= 0) throw new Error("Enter the tea rate (Rs/kg) for the owner");
      if (advanceCents > teaValueCents) {
        throw new Error("Cash advance can't exceed the tea value");
      }

      const { data, error } = await supabase.functions.invoke("record-collection", {
        body: {
          field_id: selectedField.id,
          owner_id: selectedField.owner_id,
          driver_id: myDriver?.id ?? null,
          pluckers: validLines.map((l) => ({
            worker_id: l.worker_id,
            worker_name: !l.worker_id ? l.worker_name : undefined,
            kg: parseFloat(l.kgStr),
          })),
          // Only send the tea rate when the driver changed it (→ audited override).
          tea_rate_cents: teaRateChanged ? teaRateCents : undefined,
          pay_mode: payMode,
          advance_cents: advanceCents > 0 ? advanceCents : undefined,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      setSubmitted(true);
      qc.invalidateQueries({ queryKey: ["collections"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // ── Success screen ──
  if (submitted) {
    return (
      <AppShell>
        <div className="mx-auto flex min-h-[80vh] max-w-md flex-col items-center justify-center gap-6 p-8 text-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-green-100">
            <Check className="h-10 w-10 text-green-600" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-tea-900">Collection recorded</h2>
            <p className="mt-2 text-tea-500">
              {total.toFixed(1)} kg · tea value {formatLKR(teaValueCents)}
            </p>
            {advanceCents > 0 && (
              <p className="mt-1 text-sm text-amber-600">
                Cash advance paid: {formatLKR(advanceCents)}
              </p>
            )}
            <p className="mt-3 text-sm text-tea-400">
              {payMode === "instant" ? "Paid now." : "Owner notified — awaiting confirmation."}
            </p>
          </div>
          <Button fullWidth onClick={resetAll}>
            New collection
          </Button>
        </div>
      </AppShell>
    );
  }

  // ── Estimate / review screen ──
  if (reviewing && selectedField) {
    const pluckerCount = lines.filter((l) => parseFloat(l.kgStr) > 0).length;
    return (
      <AppShell>
        <div className="mx-auto w-full max-w-md px-4 pb-32 pt-4">
          <button
            onClick={() => setReviewing(false)}
            className="mb-4 flex items-center gap-1 text-sm text-tea-500"
          >
            <ArrowLeft className="h-4 w-4" /> Back to edit
          </button>

          <h1 className="mb-1 text-xl font-bold text-tea-900">Estimate</h1>
          <p className="mb-4 text-sm text-tea-500">
            {selectedField.owner_name} · {selectedField.name} · {total.toFixed(1)} kg from {pluckerCount} pluckers
          </p>

          {/* Tea value — what the owner earns (firm) */}
          <Card className="mb-3 bg-tea-600 text-white border-tea-700">
            <p className="text-tea-200 text-sm">Tea value (owner earns)</p>
            <p className="text-3xl font-bold">{formatLKR(teaValueCents)}</p>
            <p className="text-xs text-tea-300 mt-1">
              {total.toFixed(1)} kg × {formatLKR(teaRateCents)}/kg
            </p>
          </Card>

          {/* Tea rate (editable, audited if changed) */}
          <Card className="mb-3 space-y-2">
            <label className="text-sm font-medium text-tea-700">Tea rate (Rs/kg)</label>
            <input
              className="w-full rounded-xl border border-tea-200 px-4 py-3 text-tea-900 focus:outline-none focus:ring-2 focus:ring-tea-500"
              inputMode="decimal"
              value={teaRateStr}
              onChange={(e) => setTeaRateStr(e.target.value)}
            />
            {teaRateChanged && (
              <p className="text-xs text-amber-600">
                Changed from {formatLKR(baseTeaRate)}/kg — this will be logged.
              </p>
            )}
          </Card>

          {/* Pay mode */}
          <Card className="mb-3">
            <p className="mb-2 text-sm font-medium text-tea-700">Payment</p>
            <div className="flex gap-2">
              <button
                onClick={() => setPayMode("monthly")}
                className={`flex-1 rounded-xl border px-3 py-2 text-sm ${
                  payMode === "monthly"
                    ? "border-tea-500 bg-tea-50 text-tea-800 font-semibold"
                    : "border-tea-200 text-tea-500"
                }`}
              >
                Monthly settle
              </button>
              <button
                onClick={() => setPayMode("instant")}
                className={`flex-1 rounded-xl border px-3 py-2 text-sm ${
                  payMode === "instant"
                    ? "border-tea-500 bg-tea-50 text-tea-800 font-semibold"
                    : "border-tea-200 text-tea-500"
                }`}
              >
                Pay full now
              </button>
            </div>
          </Card>

          {/* Cash advance */}
          <Card className="mb-3 space-y-2">
            <label className="text-sm font-medium text-tea-700">Cash advance now (Rs)</label>
            <input
              className="w-full rounded-xl border border-tea-200 px-4 py-3 text-tea-900 focus:outline-none focus:ring-2 focus:ring-tea-500"
              inputMode="decimal"
              placeholder="0"
              value={advanceStr}
              onChange={(e) => setAdvanceStr(e.target.value)}
            />
            <p className="text-xs text-tea-400">
              Cash the owner takes on the spot (from driver float). Drawn down at settlement.
            </p>
          </Card>

          {/* Worker wage (owner pays workers) */}
          <Card className="mb-3">
            <div className="flex justify-between">
              <span className="text-sm text-tea-500">Worker wage (owner pays pluckers)</span>
              <span className="font-semibold text-tea-900">{formatLKR(workerPayCents)}</span>
            </div>
            <p className="mt-1 text-xs text-tea-400">
              {total.toFixed(1)} kg × {formatLKR(workerRate)}/kg. Lunch & bonus added at monthly worker pay.
            </p>
          </Card>

          <Button
            fullWidth
            size="lg"
            onClick={() => submitMutation.mutate()}
            loading={submitMutation.isPending}
            disabled={total <= 0 || teaRateCents <= 0}
          >
            Confirm collection
          </Button>
        </div>
      </AppShell>
    );
  }

  // ── Entry screen ──
  return (
    <AppShell>
      {showScanner && (
        <QRScanner onResult={handleQRResult} onClose={() => setShowScanner(false)} />
      )}

      <div className="mx-auto w-full max-w-md px-4 pb-32 pt-4">
        <h1 className="mb-4 text-xl font-bold text-tea-900">New Collection</h1>

        {/* Field selection */}
        {!selectedField ? (
          <div className="space-y-3 mb-6">
            <Button fullWidth size="lg" variant="secondary" onClick={() => setShowScanner(true)}>
              <Camera className="h-5 w-5" />
              Scan owner QR
            </Button>

            <div className="flex items-center gap-2">
              <div className="flex-1 h-px bg-tea-100" />
              <span className="text-xs text-tea-400">OR</span>
              <div className="flex-1 h-px bg-tea-100" />
            </div>

            <div className="relative">
              <Search className="absolute left-3 top-3.5 h-4 w-4 text-tea-400" />
              <input
                className="w-full rounded-xl border border-tea-200 bg-white py-3 pl-9 pr-4 text-tea-900 focus:outline-none focus:ring-2 focus:ring-tea-500"
                placeholder="Search field or owner name…"
                value={fieldSearch}
                onChange={(e) => setFieldSearch(e.target.value)}
              />
            </div>

            {fieldResults && fieldResults.length > 0 && (
              <Card padded={false}>
                {fieldResults.map((f: any) => (
                  <button
                    key={f.id}
                    className="w-full px-4 py-3 text-left hover:bg-tea-50 first:rounded-t-2xl last:rounded-b-2xl border-b border-tea-50 last:border-b-0"
                    onClick={() => {
                      setSelectedField({
                        id: f.id,
                        name: f.name,
                        owner_id: f.owner_id,
                        owner_name: (f.profiles as any)?.full_name ?? "Owner",
                        rate_per_kg_cents: f.rate_per_kg_cents,
                        tea_rate_cents: f.tea_rate_cents ?? orgTeaRate,
                        pay_mode: (f.profiles as any)?.pay_mode ?? "monthly",
                      });
                      setFieldSearch("");
                    }}
                  >
                    <p className="font-medium text-tea-900">{f.name}</p>
                    <p className="text-xs text-tea-400">
                      {(f.profiles as any)?.full_name ?? "Owner"} · worker {formatLKR(f.rate_per_kg_cents)}/kg
                    </p>
                  </button>
                ))}
              </Card>
            )}
          </div>
        ) : (
          <Card className="mb-4 bg-tea-50 border-tea-200">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-semibold text-tea-900">{selectedField.name}</p>
                <p className="text-sm text-tea-500">
                  {selectedField.owner_name} · worker {formatLKR(selectedField.rate_per_kg_cents)}/kg
                </p>
              </div>
              <button
                onClick={() => { setSelectedField(null); setLines([{ id: crypto.randomUUID(), worker_id: null, worker_name: "", kgStr: "" }]); }}
                className="rounded-full p-1 hover:bg-tea-100"
              >
                <X className="h-4 w-4 text-tea-500" />
              </button>
            </div>
          </Card>
        )}

        {/* Plucker lines */}
        {selectedField && (
          <div className="space-y-2 mb-4">
            <p className="text-xs font-semibold uppercase tracking-widest text-tea-400">Pluckers</p>
            {lines.map((line, i) => {
              const filteredWorkers =
                fieldWorkers?.filter(
                  (w: any) =>
                    !workerSearch[line.id] ||
                    w.name.toLowerCase().includes(workerSearch[line.id].toLowerCase())
                ) ?? [];

              return (
                <div key={line.id} className="rounded-2xl border border-tea-100 bg-white p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs font-semibold text-tea-400 w-4">{i + 1}</span>

                    <div className="flex-1 relative">
                      {line.worker_id ? (
                        <div className="flex items-center justify-between rounded-xl bg-tea-50 px-3 py-2">
                          <span className="text-sm font-medium text-tea-800">{line.worker_name}</span>
                          <button onClick={() => updateLine(line.id, "worker_id", "")} className="ml-2">
                            <X className="h-3 w-3 text-tea-400" />
                          </button>
                        </div>
                      ) : (
                        <>
                          <input
                            className="w-full rounded-xl border border-tea-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-tea-400"
                            placeholder="Plucker name"
                            value={workerSearch[line.id] ?? line.worker_name}
                            onChange={(e) => {
                              setWorkerSearch((prev) => ({ ...prev, [line.id]: e.target.value }));
                              updateLine(line.id, "worker_name", e.target.value);
                            }}
                          />
                          {workerSearch[line.id] && filteredWorkers.length > 0 && (
                            <div className="absolute z-10 mt-1 w-full rounded-xl border border-tea-100 bg-white shadow-lg">
                              {filteredWorkers.map((w: any) => (
                                <button
                                  key={w.id}
                                  className="w-full px-3 py-2 text-left text-sm hover:bg-tea-50 first:rounded-t-xl last:rounded-b-xl"
                                  onMouseDown={() => selectWorker(line.id, w.id, w.name)}
                                >
                                  {w.name}
                                </button>
                              ))}
                            </div>
                          )}
                        </>
                      )}
                    </div>

                    <input
                      className="w-20 rounded-xl border border-tea-200 px-3 py-2 text-right text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-tea-400"
                      placeholder="kg"
                      inputMode="decimal"
                      value={line.kgStr}
                      onChange={(e) => updateLine(line.id, "kgStr", e.target.value)}
                    />

                    <button onClick={() => removeLine(line.id)} className="p-1 text-tea-300 hover:text-tea-500">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              );
            })}

            <button onClick={addLine} className="flex items-center gap-2 text-sm font-medium text-tea-600">
              <Plus className="h-4 w-4" />
              Add plucker
            </button>
          </div>
        )}

        {/* Sticky total + review */}
        {selectedField && (
          <div className="fixed bottom-20 left-0 right-0 mx-auto max-w-md px-4">
            <div className="rounded-2xl bg-white shadow-lg border border-tea-100 p-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <span className="text-sm text-tea-500">Total</span>
                  <p className="text-2xl font-bold text-tea-900">{total.toFixed(1)} kg</p>
                </div>
                <div className="text-right">
                  <span className="text-sm text-tea-500">Tea value</span>
                  <p className="font-semibold text-tea-700">{formatLKR(teaValueCents)}</p>
                </div>
              </div>
              <Button
                fullWidth
                size="lg"
                onClick={() => setReviewing(true)}
                disabled={total <= 0}
              >
                Review estimate
              </Button>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
