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

    if (!callerProfile || !["agent", "driver"].includes(callerProfile.role)) {
      throw new Error("Only agents and drivers can record payments");
    }

    const {
      owner_id,
      amount_cents,
      mode,
      driver_id,
      driver_cash_day_id,
      note,
    }: {
      owner_id: string;
      amount_cents: number;
      mode: "instant" | "monthly";
      driver_id?: string;
      driver_cash_day_id?: string;
      note?: string;
    } = await req.json();

    if (!owner_id || !amount_cents || !mode) {
      throw new Error("owner_id, amount_cents, and mode are required");
    }

    if (amount_cents <= 0) throw new Error("amount_cents must be positive");

    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Insert payment record
    const { data: payment, error: paymentError } = await adminClient
      .from("payments")
      .insert({
        org_id: callerProfile.org_id,
        charged_to: owner_id,
        disbursed_by: user.id,
        driver_id: driver_id ?? null,
        driver_cash_day_id: driver_cash_day_id ?? null,
        amount_cents: amount_cents,
        mode: mode,
        note: note ?? null,
        paid_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (paymentError) throw paymentError;

    // If driver cash day is specified, increment paid_out_cents
    if (driver_cash_day_id) {
      const { error: updateError } = await adminClient.rpc("increment_paid_out", {
        cash_day_id: driver_cash_day_id,
        amount: amount_cents,
      });

      // Fallback if RPC not available — use direct update
      if (updateError) {
        const { data: cd } = await adminClient
          .from("driver_cash_days")
          .select("paid_out_cents")
          .eq("id", driver_cash_day_id)
          .single();

        if (cd) {
          await adminClient
            .from("driver_cash_days")
            .update({ paid_out_cents: cd.paid_out_cents + amount_cents })
            .eq("id", driver_cash_day_id);
        }
      }
    }

    return new Response(
      JSON.stringify({ payment_id: payment.id }),
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
