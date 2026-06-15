import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

interface PluckerLine {
  worker_id?: string;
  worker_name?: string; // used when creating a new worker on the fly
  new_worker_name?: string; // legacy alias for worker_name
  kg: number;
}

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

    if (!callerProfile || !["agent", "driver"].includes(callerProfile.role)) {
      throw new Error("Only agents and drivers can record collections");
    }

    const body = await req.json();
    const field_id: string | undefined = body.field_id;
    const driver_id: string | null = body.driver_id ?? null;
    const note: string | undefined = body.note;
    // Accept both `pluckers` and the older `lines` key.
    const pluckers: PluckerLine[] = body.pluckers ?? body.lines ?? [];
    let owner_id: string | undefined = body.owner_id;
    // Tea rate (agent->owner). If the caller supplies one it's an override.
    const teaRateInput: number | null =
      body.tea_rate_cents != null ? Number(body.tea_rate_cents) : null;
    const payModeInput: string | null = body.pay_mode ?? null;
    const advanceCents: number = body.advance_cents ? Number(body.advance_cents) : 0;

    if (!field_id || !pluckers.length) {
      throw new Error("field_id and at least one plucker line are required");
    }

    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Load field + owner + org defaults to resolve owner, tea rate, pay mode.
    const { data: field, error: fieldErr } = await adminClient
      .from("fields")
      .select("owner_id, tea_rate_cents, profiles!fields_owner_id_fkey(pay_mode)")
      .eq("id", field_id)
      .single();
    if (fieldErr || !field) throw new Error("Field not found");
    if (!owner_id) owner_id = field.owner_id;

    // Adopt the owner into the org so they appear in the agent's owner lists.
    await adminClient
      .from("agent_owners")
      .upsert(
        { org_id: callerProfile.org_id, owner_id },
        { onConflict: "org_id,owner_id" }
      );

    // Tea rate precedence: explicit override → field rate → org default.
    let teaRateCents = teaRateInput;
    let teaRateOverriddenBy: string | null = null;
    if (teaRateCents != null) {
      teaRateOverriddenBy = user.id; // driver/agent set it explicitly → audit
    } else {
      teaRateCents = field.tea_rate_cents ?? null;
      if (teaRateCents == null) {
        const { data: org } = await adminClient
          .from("orgs")
          .select("default_tea_rate_cents")
          .eq("id", callerProfile.org_id)
          .single();
        teaRateCents = org?.default_tea_rate_cents ?? 0;
      }
    }

    // Pay mode: explicit choice → owner default → monthly.
    const payMode =
      payModeInput ?? (field.profiles as any)?.pay_mode ?? "monthly";

    // Stamp the driver's current vehicle onto the visit (soft link, for history).
    let vehicle_id: string | null = null;
    if (driver_id) {
      const { data: driverRow } = await adminClient
        .from("drivers")
        .select("current_vehicle_id")
        .eq("id", driver_id)
        .single();
      vehicle_id = driverRow?.current_vehicle_id ?? null;
    }

    // Resolve worker IDs (create new workers as needed)
    const resolvedLines: { worker_id: string; kg: number }[] = [];
    const totalKg = pluckers.reduce((s, p) => s + p.kg, 0);

    for (const plucker of pluckers) {
      if (plucker.kg <= 0) continue;

      let workerId = plucker.worker_id;
      // Accept both `worker_name` and the older `new_worker_name` key.
      const newWorkerName = plucker.worker_name ?? plucker.new_worker_name;

      if (!workerId && newWorkerName) {
        const { data: worker, error: workerErr } = await adminClient
          .from("workers")
          .insert({
            field_id: field_id,
            owner_id: owner_id,
            org_id: callerProfile.org_id,
            name: newWorkerName,
          })
          .select("id")
          .single();
        if (workerErr) throw workerErr;
        workerId = worker.id;
      }

      if (!workerId) continue;
      resolvedLines.push({ worker_id: workerId, kg: plucker.kg });
    }

    // Create collection visit
    const { data: visit, error: visitError } = await adminClient
      .from("collection_visits")
      .insert({
        owner_id,
        field_id,
        driver_id,
        org_id: callerProfile.org_id,
        total_kg: totalKg,
        vehicle_id,
        tea_rate_cents: teaRateCents,
        tea_rate_overridden_by: teaRateOverriddenBy,
        pay_mode: payMode,
        note: note ?? null,
        owner_confirmed: false,
        escalated: false,
        collected_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (visitError) throw visitError;

    // Insert plucker lines
    if (resolvedLines.length > 0) {
      const { error: linesError } = await adminClient.from("collection_lines").insert(
        resolvedLines.map((l) => ({
          visit_id: visit.id,
          worker_id: l.worker_id,
          kg: l.kg,
        }))
      );
      if (linesError) throw linesError;
    }

    // Optional cash advance the owner takes on the spot (from driver float).
    if (advanceCents > 0) {
      // Running-tab deduction against the owner (drawn down at settlement).
      await adminClient.from("deductions").insert({
        owner_id,
        org_id: callerProfile.org_id,
        type: "advance",
        amount_cents: advanceCents,
        note: "Cash advance at collection",
      });

      // Attach to the driver's open cash day so it counts against the float.
      let cashDayId: string | null = null;
      if (driver_id) {
        const today = new Date().toISOString().split("T")[0];
        const { data: cd } = await adminClient
          .from("driver_cash_days")
          .select("id, paid_out_cents")
          .eq("driver_id", driver_id)
          .eq("day", today)
          .maybeSingle();
        if (cd) {
          cashDayId = cd.id;
          await adminClient
            .from("driver_cash_days")
            .update({ paid_out_cents: cd.paid_out_cents + advanceCents })
            .eq("id", cd.id);
        }
      }

      await adminClient.from("payments").insert({
        org_id: callerProfile.org_id,
        charged_to: owner_id,
        disbursed_by: user.id,
        driver_id: driver_id,
        driver_cash_day_id: cashDayId,
        visit_id: visit.id,
        amount_cents: advanceCents,
        mode: "instant",
        category: "advance",
        note: "Cash advance at collection",
      });
    }

    return new Response(
      JSON.stringify({
        visit_id: visit.id,
        total_kg: totalKg,
        tea_rate_cents: teaRateCents,
        pay_mode: payMode,
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
