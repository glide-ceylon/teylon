import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

// Logs a cash payout to a loader / lorry-driver, drawn from the driver's float
// so it counts against the day's reconciliation.
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
      throw new Error("Only agents and drivers can record crew payouts");
    }

    const { driver_id, name, role, amount_cents, day, note } = await req.json();
    if (!name || !amount_cents || amount_cents <= 0) {
      throw new Error("name and a positive amount_cents are required");
    }

    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const theDay = day ?? new Date().toISOString().split("T")[0];

    // Attach to the driver's cash day so it draws down the float.
    let cashDayId: string | null = null;
    if (driver_id) {
      const { data: cd } = await adminClient
        .from("driver_cash_days")
        .select("id, paid_out_cents")
        .eq("driver_id", driver_id)
        .eq("day", theDay)
        .maybeSingle();
      if (cd) {
        cashDayId = cd.id;
        await adminClient
          .from("driver_cash_days")
          .update({ paid_out_cents: cd.paid_out_cents + amount_cents })
          .eq("id", cd.id);
      }
    }

    const { data: payout, error } = await adminClient
      .from("crew_payouts")
      .insert({
        org_id: callerProfile.org_id,
        driver_id: driver_id ?? null,
        driver_cash_day_id: cashDayId,
        day: theDay,
        name,
        role: role ?? null,
        amount_cents,
        note: note ?? null,
      })
      .select("id")
      .single();

    if (error) throw error;

    return new Response(
      JSON.stringify({ payout_id: payout.id }),
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
