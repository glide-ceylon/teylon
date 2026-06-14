import { supabase } from "@/lib/supabaseClient";

/**
 * Post-login routing decision (auth-method agnostic — works for phone OTP,
 * email+password, and confirmation-link sign-ups).
 *
 * Returns "/home" if the signed-in user already has a profile (returning user,
 * or a pre-created driver/shadow-owner that just got linked), otherwise
 * "/onboarding" for a brand-new account.
 */
export async function getPostLoginPath(userId: string): Promise<string> {
  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", userId)
    .single();

  return profile ? "/home" : "/onboarding";
}
