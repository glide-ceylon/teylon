import { createSupabaseServer } from "@/lib/supabaseServer";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next");

  if (code) {
    const supabase = await createSupabaseServer();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      // Password-recovery (or any explicit destination) overrides default routing.
      if (next) {
        return NextResponse.redirect(`${origin}${next}`);
      }

      // Otherwise route by profile existence: existing user → /home, new → /onboarding.
      const userId = data.user?.id;
      if (userId) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("id")
          .eq("id", userId)
          .single();

        return NextResponse.redirect(`${origin}${profile ? "/home" : "/onboarding"}`);
      }
    }
  }

  return NextResponse.redirect(`${origin}/login`);
}
