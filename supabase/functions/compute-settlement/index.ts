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

    const { data: callerProfile } = await userClient
      .from("profiles")
      .select("role, org_id")
      .eq("id", user.id)
      .single();

    if (!callerProfile || callerProfile.role !== "agent") {
      throw new Error("Only agents can compute settlements");
    }

    const {
      owner_id,
      org_id,
      period_start,
      period_end,
      loss_adjustment_pct = 0,
    }: {
      owner_id: string;
      org_id: string;
      period_start: string;
      period_end: string;
      loss_adjustment_pct?: number;
    } = await req.json();

    if (!owner_id || !org_id || !period_start || !period_end) {
      throw new Error("owner_id, org_id, period_start, period_end are required");
    }

    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Get confirmed, MONTHLY visits for this owner in period. Instant-paid
    // collections are settled on the spot, so they don't belong in the average.
    const { data: visits, error: visitsError } = await adminClient
      .from("collection_visits")
      .select("total_kg, tea_rate_cents, fields(tea_rate_cents)")
      .eq("owner_id", owner_id)
      .or("pay_mode.is.null,pay_mode.neq.instant") // null pay_mode = treat as monthly
      .eq("org_id", org_id)
      .eq("owner_confirmed", true)
      .gte("collected_at", period_start + "T00:00:00")
      .lte("collected_at", period_end + "T23:59:59");

    if (visitsError) throw visitsError;
    if (!visits || visits.length === 0) {
      throw new Error("No confirmed visits found in this period for this owner");
    }

    // Compute weighted average rate
    let totalKg = 0;
    let weightedRateSum = 0;

    for (const v of visits) {
      const kg = v.total_kg ?? 0;
      // Use the tea rate applied at collection; fall back to the field's tea rate.
      const rate = (v as any).tea_rate_cents ?? (v.fields as any)?.tea_rate_cents ?? 0;
      totalKg += kg;
      weightedRateSum += kg * rate;
    }

    if (totalKg === 0) throw new Error("Total kg is zero");

    const rawAvgRate = weightedRateSum / totalKg;
    const adjustedAvgRate = Math.round(rawAvgRate * (1 - loss_adjustment_pct / 100));
    const grossCents = Math.round(totalKg * adjustedAvgRate);

    // Get deductions in period
    const { data: deductions } = await adminClient
      .from("deductions")
      .select("amount_cents")
      .eq("owner_id", owner_id)
      .eq("org_id", org_id)
      .gte("created_at", period_start + "T00:00:00")
      .lte("created_at", period_end + "T23:59:59");

    const totalDeductions = (deductions ?? []).reduce(
      (s: number, d: any) => s + d.amount_cents,
      0
    );

    // Owner-fronted worker pay to reimburse this period (paid from owner's pocket).
    const { data: reimbursements } = await adminClient
      .from("payments")
      .select("amount_cents")
      .eq("charged_to", owner_id)
      .eq("org_id", org_id)
      .eq("from_pocket", true)
      .gte("paid_at", period_start + "T00:00:00")
      .lte("paid_at", period_end + "T23:59:59");

    const totalReimbursements = (reimbursements ?? []).reduce(
      (s: number, p: any) => s + p.amount_cents,
      0
    );

    const netCents = grossCents - totalDeductions + totalReimbursements;

    // Store settlement
    const { data: settlement, error: settlementError } = await adminClient
      .from("settlements")
      .insert({
        owner_id,
        org_id,
        period_start,
        period_end,
        total_submitted_kg: totalKg,
        avg_rate_cents: adjustedAvgRate,
        loss_adjustment_pct: loss_adjustment_pct,
        gross_cents: grossCents,
        deductions_cents: totalDeductions,
        reimbursements_cents: totalReimbursements,
        net_cents: netCents,
        computed_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (settlementError) throw settlementError;

    return new Response(
      JSON.stringify({
        settlement_id: settlement.id,
        total_kg: totalKg,
        avg_rate_cents: adjustedAvgRate,
        gross_cents: grossCents,
        deductions_cents: totalDeductions,
        reimbursements_cents: totalReimbursements,
        net_cents: netCents,
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
