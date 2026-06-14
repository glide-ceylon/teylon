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
      .select("role")
      .eq("id", user.id)
      .single();

    if (!callerProfile || !["agent", "driver"].includes(callerProfile.role)) {
      throw new Error("Only agents and drivers can reconcile cash days");
    }

    const { driver_id, brought_back_cents, day } = await req.json();

    if (!driver_id || brought_back_cents == null || !day) {
      throw new Error("driver_id, brought_back_cents, and day are required");
    }

    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Get the cash day
    const { data: cashDay, error: cdError } = await adminClient
      .from("driver_cash_days")
      .select("*")
      .eq("driver_id", driver_id)
      .eq("day", day)
      .single();

    if (cdError || !cashDay) throw new Error("Cash day not found");
    if (cashDay.status !== "open") throw new Error("Cash day is already closed");

    // Compute status
    const expected = cashDay.float_out_cents - cashDay.paid_out_cents;
    const diff = brought_back_cents - expected;
    let status: "reconciled" | "short" | "over";
    let note: string;

    const TOLERANCE = 0; // strict: any difference is flagged

    if (Math.abs(diff) <= TOLERANCE) {
      status = "reconciled";
      note = "Balanced";
    } else if (diff < 0) {
      status = "short";
      note = `Short by Rs.${Math.abs(diff / 100).toFixed(2)}`;
    } else {
      status = "over";
      note = `Over by Rs.${(diff / 100).toFixed(2)}`;
    }

    const { error: updateError } = await adminClient
      .from("driver_cash_days")
      .update({
        brought_back_cents: brought_back_cents,
        status: status,
        note: note,
        reconciled_at: new Date().toISOString(),
      })
      .eq("id", cashDay.id);

    if (updateError) throw updateError;

    return new Response(
      JSON.stringify({ success: true, status, note, diff }),
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
