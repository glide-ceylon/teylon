import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

// Deletes a driver: frees the phone number (removes the auth user) while
// preserving collection history by unlinking it rather than cascading deletes.
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
      throw new Error("Only agents can delete drivers");
    }

    const { driver_id } = await req.json();
    if (!driver_id) throw new Error("driver_id is required");

    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Verify the driver belongs to the caller's org.
    const { data: driver, error: driverError } = await adminClient
      .from("drivers")
      .select("id, profile_id, org_id")
      .eq("id", driver_id)
      .single();

    if (driverError || !driver) throw new Error("Driver not found");
    if (driver.org_id !== callerProfile.org_id) {
      throw new Error("That driver is not in your organisation");
    }

    const profileId = driver.profile_id;

    // Unlink history (keep the records, drop the driver reference).
    await adminClient.from("collection_visits").update({ driver_id: null }).eq("driver_id", driver_id);
    await adminClient.from("payments").update({ driver_id: null }).eq("driver_id", driver_id);
    await adminClient.from("payments").update({ disbursed_by: null }).eq("disbursed_by", profileId);

    // Cash days are per-driver-per-day records with a NOT NULL driver_id — remove them.
    await adminClient.from("driver_cash_days").delete().eq("driver_id", driver_id);

    // Remove the driver row, then the auth user (profile cascades from auth.users).
    const { error: delDriverError } = await adminClient.from("drivers").delete().eq("id", driver_id);
    if (delDriverError) throw delDriverError;

    const { error: delUserError } = await adminClient.auth.admin.deleteUser(profileId);
    if (delUserError) throw delUserError;

    return new Response(
      JSON.stringify({ success: true }),
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
