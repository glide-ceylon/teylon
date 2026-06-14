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

    if (!field_id || !pluckers.length) {
      throw new Error("field_id and at least one plucker line are required");
    }

    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Derive owner from the field when the caller didn't supply it.
    if (!owner_id) {
      const { data: field, error: fieldErr } = await adminClient
        .from("fields")
        .select("owner_id")
        .eq("id", field_id)
        .single();
      if (fieldErr || !field) throw new Error("Field not found");
      owner_id = field.owner_id;
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

    return new Response(
      JSON.stringify({ visit_id: visit.id, total_kg: totalKg }),
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
