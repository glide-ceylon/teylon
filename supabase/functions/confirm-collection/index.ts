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

    if (!callerProfile || callerProfile.role !== "owner") {
      throw new Error("Only owners can confirm collections");
    }

    const { visit_id, action, escalation_note } = await req.json();

    if (!visit_id || !action) throw new Error("visit_id and action are required");
    if (!["confirm", "escalate"].includes(action)) {
      throw new Error("action must be 'confirm' or 'escalate'");
    }

    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Verify visit belongs to this owner
    const { data: visit, error: visitError } = await adminClient
      .from("collection_visits")
      .select("id, owner_id, owner_confirmed, escalated")
      .eq("id", visit_id)
      .single();

    if (visitError || !visit) throw new Error("Visit not found");
    if (visit.owner_id !== user.id) throw new Error("This visit does not belong to you");
    if (visit.owner_confirmed) throw new Error("Visit already confirmed");

    if (action === "confirm") {
      const { error } = await adminClient
        .from("collection_visits")
        .update({
          owner_confirmed: true,
          confirmed_at: new Date().toISOString(),
        })
        .eq("id", visit_id);

      if (error) throw error;

      return new Response(
        JSON.stringify({ success: true, action: "confirmed" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } else {
      // escalate
      if (!escalation_note?.trim()) {
        throw new Error("Escalation note is required");
      }

      const { error } = await adminClient
        .from("collection_visits")
        .update({
          escalated: true,
          escalation_note: escalation_note.trim(),
          escalated_at: new Date().toISOString(),
        })
        .eq("id", visit_id);

      if (error) throw error;

      return new Response(
        JSON.stringify({ success: true, action: "escalated" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
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
