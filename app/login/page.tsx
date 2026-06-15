"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { getPostLoginPath } from "@/lib/authRouter";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import toast from "react-hot-toast";

type Mode = "signin" | "signup" | "forgot";

// Anything with "@" is treated as an email; otherwise it's a phone number.
const looksLikeEmail = (v: string) => v.includes("@");

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("signin");
  const [loading, setLoading] = useState(false);

  const [identifier, setIdentifier] = useState(""); // email OR phone
  const [password, setPassword] = useState("");

  const isEmail = looksLikeEmail(identifier);

  async function route(userId?: string) {
    if (!userId) return toast.error("Login failed — please try again");
    router.replace(await getPostLoginPath(userId));
  }

  // Sign in with password — works for both email and phone identifiers.
  async function signIn() {
    if (!identifier || !password) return toast.error("Enter your email/phone and password");
    if (!isEmail && !identifier.startsWith("+")) {
      return toast.error("For phone, include the country code, e.g. +94771234567");
    }
    setLoading(true);
    const credentials = isEmail
      ? { email: identifier, password }
      : { phone: identifier, password };
    const { data, error } = await supabase.auth.signInWithPassword(credentials);
    setLoading(false);
    if (error) return toast.error(error.message);
    route(data.user?.id);
  }

  async function signUp() {
    if (!isEmail) return toast.error("Sign up with an email address — you can add your phone later");
    if (password.length < 6) return toast.error("Password must be at least 6 characters");
    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email: identifier,
      password,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    setLoading(false);
    if (error) return toast.error(error.message);
    if (data.session && data.user) return route(data.user.id);
    toast.success("Check your email to confirm your account");
    setMode("signin");
  }

  async function sendReset() {
    if (!isEmail) return toast.error("Enter your email to reset the password");
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(identifier, {
      redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
    });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Password reset link sent — check your email");
    setMode("signin");
  }

  const primary =
    mode === "signin"
      ? { label: "Sign in", fn: signIn, disabled: !identifier || !password }
      : mode === "signup"
      ? { label: "Create account", fn: signUp, disabled: !identifier || !password }
      : { label: "Send reset link", fn: sendReset, disabled: !identifier };

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center gap-6 px-6 py-12">
      {/* Logo */}
      <div className="text-center">
        <div className="mb-3 flex h-16 w-16 items-center justify-center rounded-2xl bg-tea-600 mx-auto">
          <span className="text-3xl">🍃</span>
        </div>
        <h1 className="text-2xl font-bold text-tea-700">
          {mode === "signup"
            ? "Create your account"
            : mode === "forgot"
            ? "Reset password"
            : "Sign in to Teylon"}
        </h1>
      </div>

      <div className="flex flex-col gap-4">
        {/* Identifier — email or phone */}
        <Input
          label="Email or phone number"
          placeholder="you@example.com  or  +94771234567"
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
          autoComplete="username"
          autoFocus
          hint={
            mode === "signup"
              ? "Use an email to sign up — add your phone later"
              : "Phone numbers need the country code, e.g. +94"
          }
        />

        {/* Password — hidden only on the forgot-password step */}
        {mode !== "forgot" && (
          <Input
            label="Password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type="password"
            autoComplete={mode === "signup" ? "new-password" : "current-password"}
            hint={mode === "signup" ? "At least 6 characters" : undefined}
          />
        )}

        <Button onClick={primary.fn} disabled={primary.disabled} loading={loading} fullWidth size="lg">
          {primary.label}
        </Button>

        {/* Secondary actions */}
        {mode === "signin" ? (
          <div className="flex items-center justify-between text-sm pt-1">
            <button onClick={() => setMode("signup")} className="text-tea-600 underline">
              Create an account
            </button>
            <button onClick={() => setMode("forgot")} className="text-tea-500 underline">
              Forgot password?
            </button>
          </div>
        ) : (
          <button onClick={() => setMode("signin")} className="text-sm text-tea-500 underline self-center">
            Back to sign in
          </button>
        )}
      </div>
    </main>
  );
}
