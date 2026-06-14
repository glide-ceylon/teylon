import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing Authorization header");

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) throw new Error("Unauthorized");

    const url = new URL(req.url);
    const workerId = url.searchParams.get("worker_id");
    const periodStart = url.searchParams.get("period_start");
    const periodEnd = url.searchParams.get("period_end");

    if (!workerId) throw new Error("worker_id query param is required");

    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Get worker info
    const { data: worker, error: workerError } = await adminClient
      .from("workers")
      .select("id, name, bonus_cents, fields(rate_per_kg_cents, lunch_allowance_cents)")
      .eq("id", workerId)
      .single();

    if (workerError || !worker) throw new Error("Worker not found");

    const ratePerKg = (worker.fields as any)?.rate_per_kg_cents ?? 4000;
    const lunchAllowance = (worker.fields as any)?.lunch_allowance_cents ?? 0;

    // Build collection lines query
    let query = adminClient
      .from("collection_lines")
      .select("kg, collection_visits!inner(collected_at, owner_confirmed)")
      .eq("worker_id", workerId)
      .eq("collection_visits.owner_confirmed", true);

    if (periodStart) {
      query = query.gte("collection_visits.collected_at", periodStart + "T00:00:00");
    }
    if (periodEnd) {
      query = query.lte("collection_visits.collected_at", periodEnd + "T23:59:59");
    }

    const { data: lines, error: linesError } = await query;
    if (linesError) throw linesError;

    // Aggregate
    const totalKg = (lines ?? []).reduce((s: number, l: any) => s + l.kg, 0);
    const distinctDays = new Set(
      (lines ?? []).map((l: any) =>
        new Date(l.collection_visits.collected_at).toISOString().split("T")[0]
      )
    ).size;

    const kgEarnings = Math.round(totalKg * ratePerKg);
    const lunchEarnings = distinctDays * lunchAllowance;
    const bonusCents = worker.bonus_cents ?? 0;
    const grossCents = kgEarnings + lunchEarnings + bonusCents;

    // Get total paid to this worker
    const { data: payments } = await adminClient
      .from("payments")
      .select("amount_cents")
      .eq("worker_id", workerId);

    const totalPaidCents = (payments ?? []).reduce(
      (s: number, p: any) => s + p.amount_cents,
      0
    );

    const owedCents = grossCents - totalPaidCents;

    return new Response(
      JSON.stringify({
        worker_id: workerId,
        worker_name: worker.name,
        total_kg: totalKg,
        distinct_days: distinctDays,
        rate_per_kg_cents: ratePerKg,
        kg_earnings_cents: kgEarnings,
        lunch_earnings_cents: lunchEarnings,
        bonus_cents: bonusCents,
        gross_cents: grossCents,
        total_paid_cents: totalPaidCents,
        owed_cents: owedCents,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
