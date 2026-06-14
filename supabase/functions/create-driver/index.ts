import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Authenticate calling user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing Authorization header");

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) throw new Error("Unauthorized");

    // Check caller is agent
    const { data: callerProfile } = await userClient
      .from("profiles")
      .select("role, org_id")
      .eq("id", user.id)
      .single();

    if (!callerProfile || callerProfile.role !== "agent") {
      throw new Error("Only agents can create drivers");
    }

    const { name, phone, lorry_identifier, vehicle_details } = await req.json();

    if (!name || !phone || !lorry_identifier) {
      throw new Error("name, phone, and lorry_identifier are required");
    }

    // Admin client for bypassing RLS
    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Create auth user for driver
    const { data: newUser, error: createUserError } = await adminClient.auth.admin.createUser({
      phone: phone,
      phone_confirm: true,
      user_metadata: { full_name: name },
    });

    if (createUserError) throw createUserError;
    if (!newUser.user) throw new Error("Failed to create auth user");

    const driverUserId = newUser.user.id;

    // Create profile
    const { error: profileError } = await adminClient.from("profiles").insert({
      id: driverUserId,
      full_name: name,
      phone: phone,
      role: "driver",
      org_id: callerProfile.org_id,
    });

    if (profileError) {
      // Rollback auth user
      await adminClient.auth.admin.deleteUser(driverUserId);
      throw profileError;
    }

    // Create driver record
    const { data: driver, error: driverError } = await adminClient
      .from("drivers")
      .insert({
        profile_id: driverUserId,
        org_id: callerProfile.org_id,
        lorry_identifier: lorry_identifier,
        vehicle_details: vehicle_details ?? null,
      })
      .select()
      .single();

    if (driverError) {
      await adminClient.auth.admin.deleteUser(driverUserId);
      throw driverError;
    }

    return new Response(
      JSON.stringify({ driver_id: driver.id, user_id: driverUserId }),
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
