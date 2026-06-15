import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

// Lets an agent/driver resolve an owner (and their fields) from a scanned QR,
// even if that owner isn't linked to the caller's org yet. Returns only the
// minimal info needed to start a collection — not the full profile.
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
      throw new Error("Only agents and drivers can look up owners");
    }

    const { owner_id } = await req.json();
    if (!owner_id) throw new Error("owner_id is required");

    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: owner, error: ownerError } = await adminClient
      .from("profiles")
      .select("id, full_name, role")
      .eq("id", owner_id)
      .single();

    if (ownerError || !owner) throw new Error("Owner not found");
    if (owner.role !== "owner") throw new Error("That QR code is not an owner");

    const { data: fields } = await adminClient
      .from("fields")
      .select("id, name, rate_per_kg_cents, tea_rate_cents")
      .eq("owner_id", owner_id)
      .order("name");

    // Owner's default pay mode (driver prefills, may override per collection).
    const { data: ownerSettings } = await adminClient
      .from("profiles")
      .select("pay_mode")
      .eq("id", owner_id)
      .single();

    // Org default tea rate — fallback when a field has no override.
    const { data: org } = await adminClient
      .from("orgs")
      .select("default_tea_rate_cents")
      .eq("id", callerProfile.org_id)
      .single();

    return new Response(
      JSON.stringify({
        id: owner.id,
        full_name: owner.full_name,
        pay_mode: ownerSettings?.pay_mode ?? "monthly",
        default_tea_rate_cents: org?.default_tea_rate_cents ?? 0,
        fields: fields ?? [],
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
