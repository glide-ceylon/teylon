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
      throw new Error("Only agents can create shadow owners");
    }

    const { name, phone, field_name, field_location, field_rate_cents } = await req.json();

    if (!name || !phone) throw new Error("name and phone are required");

    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Check if user with this phone already exists
    const { data: existingUsers } = await adminClient.auth.admin.listUsers();
    const existingUser = existingUsers?.users.find((u) => u.phone === phone);

    let ownerUserId: string;

    if (existingUser) {
      // User already exists — check if they have a profile
      const { data: existingProfile } = await adminClient
        .from("profiles")
        .select("id, is_shadow")
        .eq("id", existingUser.id)
        .maybeSingle();

      if (existingProfile && !existingProfile.is_shadow) {
        throw new Error("A real user with this phone number already exists");
      }

      ownerUserId = existingUser.id;
    } else {
      // Create new shadow auth user
      const { data: newUser, error: createUserError } = await adminClient.auth.admin.createUser({
        phone: phone,
        phone_confirm: true,
        user_metadata: { full_name: name },
      });

      if (createUserError) throw createUserError;
      if (!newUser.user) throw new Error("Failed to create auth user");

      ownerUserId = newUser.user.id;
    }

    // Upsert shadow profile
    const { error: profileError } = await adminClient.from("profiles").upsert({
      id: ownerUserId,
      full_name: name,
      phone: phone,
      role: "owner",
      org_id: callerProfile.org_id,
      is_shadow: true,
    });

    if (profileError) throw profileError;

    // Link the owner to the agent's org (shows in owner lists).
    await adminClient
      .from("agent_owners")
      .upsert(
        { org_id: callerProfile.org_id, owner_id: ownerUserId },
        { onConflict: "org_id,owner_id" }
      );

    // Optionally create a field
    let fieldId: string | null = null;
    if (field_name) {
      const rate = field_rate_cents ?? 4000; // minimum 4000 cents = Rs.40/kg
      const { data: field, error: fieldError } = await adminClient
        .from("fields")
        .insert({
          owner_id: ownerUserId,
          name: field_name,
          location: field_location ?? null,
          rate_per_kg_cents: Math.max(rate, 4000),
          org_id: callerProfile.org_id,
        })
        .select("id")
        .single();

      if (fieldError) throw fieldError;
      fieldId = field.id;
    }

    return new Response(
      JSON.stringify({ owner_id: ownerUserId, field_id: fieldId }),
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
