"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { getPostLoginPath } from "@/lib/authRouter";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import toast from "react-hot-toast";

type Method = "phone" | "email";
type PhoneStage = "phone" | "otp";
type EmailStage = "signin" | "signup" | "forgot";

export default function LoginPage() {
  const router = useRouter();
  const [method, setMethod] = useState<Method>("phone");
  const [loading, setLoading] = useState(false);

  // ── Phone state ──
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [phoneStage, setPhoneStage] = useState<PhoneStage>("phone");
  const [phoneMode, setPhoneMode] = useState<"otp" | "password">("otp");

  // ── Email state ──
  const [emailStage, setEmailStage] = useState<EmailStage>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // ── Phone OTP handlers ──
  async function sendOtp() {
    if (!phone.startsWith("+")) {
      toast.error("Enter phone in E.164 format, e.g. +94771234567");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signInWithOtp({ phone });
    setLoading(false);
    if (error) return toast.error(error.message);
    setPhoneStage("otp");
    toast.success("OTP sent — check your SMS");
  }

  async function verifyOtp() {
    setLoading(true);
    const { data, error } = await supabase.auth.verifyOtp({
      phone,
      token: otp,
      type: "sms",
    });
    setLoading(false);
    if (error) return toast.error(error.message);

    const userId = data.user?.id;
    if (!userId) return toast.error("Login failed — please try again");

    router.replace(await getPostLoginPath(userId));
  }

  async function signInWithPhonePassword() {
    if (!phone.startsWith("+")) {
      return toast.error("Enter phone in E.164 format, e.g. +94771234567");
    }
    if (!password) return toast.error("Enter your password");
    setLoading(true);
    const { data, error } = await supabase.auth.signInWithPassword({
      phone,
      password,
    });
    setLoading(false);
    if (error) return toast.error(error.message);

    const userId = data.user?.id;
    if (!userId) return toast.error("Login failed — please try again");

    router.replace(await getPostLoginPath(userId));
  }

  // ── Email handlers ──
  async function signInWithEmail() {
    if (!email || !password) return toast.error("Enter email and password");
    setLoading(true);
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    setLoading(false);
    if (error) return toast.error(error.message);

    const userId = data.user?.id;
    if (!userId) return toast.error("Login failed — please try again");

    router.replace(await getPostLoginPath(userId));
  }

  async function signUpWithEmail() {
    if (!email || !password) return toast.error("Enter email and password");
    if (password.length < 6)
      return toast.error("Password must be at least 6 characters");

    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    setLoading(false);
    if (error) return toast.error(error.message);

    // If email confirmation is OFF, a session is returned immediately.
    if (data.session && data.user) {
      router.replace(await getPostLoginPath(data.user.id));
      return;
    }

    // Email confirmation is ON — user must click the link in their inbox.
    toast.success("Check your email to confirm your account");
    setEmailStage("signin");
  }

  async function sendPasswordReset() {
    if (!email) return toast.error("Enter your email");
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
    });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Password reset link sent — check your email");
    setEmailStage("signin");
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center gap-6 px-6 py-12">
      {/* Logo */}
      <div className="text-center">
        <div className="mb-3 flex h-16 w-16 items-center justify-center rounded-2xl bg-tea-600 mx-auto">
          <span className="text-3xl">🍃</span>
        </div>
        <h1 className="text-2xl font-bold text-tea-700">Sign in to Teylon</h1>
        <p className="mt-1 text-sm text-tea-400">
          {method === "phone" ? "Phone OTP — no password needed" : "Email & password"}
        </p>
      </div>

      {/* Method toggle */}
      <div className="flex rounded-xl bg-tea-50 p-1">
        <button
          onClick={() => setMethod("phone")}
          className={[
            "flex-1 rounded-lg py-2 text-sm font-medium transition-colors",
            method === "phone" ? "bg-white text-tea-800 shadow-sm" : "text-tea-500",
          ].join(" ")}
        >
          Phone
        </button>
        <button
          onClick={() => setMethod("email")}
          className={[
            "flex-1 rounded-lg py-2 text-sm font-medium transition-colors",
            method === "email" ? "bg-white text-tea-800 shadow-sm" : "text-tea-500",
          ].join(" ")}
        >
          Email
        </button>
      </div>

      {/* ── PHONE: password mode (drivers) ── */}
      {method === "phone" && phoneMode === "password" && (
        <div className="flex flex-col gap-4">
          <Input
            label="Phone number"
            placeholder="+94771234567"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            inputMode="tel"
            autoComplete="tel"
            hint="Include country code, e.g. +94 for Sri Lanka"
          />
          <Input
            label="Password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type="password"
            autoComplete="current-password"
          />
          <Button
            onClick={signInWithPhonePassword}
            disabled={!phone || !password}
            loading={loading}
            fullWidth
            size="lg"
          >
            Sign in
          </Button>
          <button
            onClick={() => setPhoneMode("otp")}
            className="text-sm text-tea-500 underline self-center"
          >
            Use OTP instead
          </button>
        </div>
      )}

      {/* ── PHONE: OTP mode ── */}
      {method === "phone" && phoneMode === "otp" &&
        (phoneStage === "phone" ? (
          <div className="flex flex-col gap-4">
            <Input
              label="Phone number"
              placeholder="+94771234567"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              inputMode="tel"
              autoComplete="tel"
              hint="Include country code, e.g. +94 for Sri Lanka"
            />
            <Button onClick={sendOtp} disabled={!phone} loading={loading} fullWidth size="lg">
              Send OTP
            </Button>
            <button
              onClick={() => setPhoneMode("password")}
              className="text-sm text-tea-500 underline self-center"
            >
              Sign in with password instead
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-tea-500">
              Code sent to <strong>{phone}</strong>
            </p>
            <Input
              label="6-digit code"
              placeholder="••••••"
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
              inputMode="numeric"
              autoComplete="one-time-code"
              className="tracking-[0.5em] text-center text-xl"
            />
            <Button onClick={verifyOtp} disabled={otp.length < 6} loading={loading} fullWidth size="lg">
              Verify & continue
            </Button>
            <button
              onClick={() => {
                setPhoneStage("phone");
                setOtp("");
              }}
              className="text-sm text-tea-500 underline"
            >
              Change phone number
            </button>
          </div>
        ))}

      {/* ── EMAIL ── */}
      {method === "email" && (
        <div className="flex flex-col gap-4">
          <Input
            label="Email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            inputMode="email"
            autoComplete="email"
            type="email"
          />

          {emailStage !== "forgot" && (
            <Input
              label="Password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={emailStage === "signup" ? "new-password" : "current-password"}
              type="password"
              hint={emailStage === "signup" ? "At least 6 characters" : undefined}
            />
          )}

          {emailStage === "signin" && (
            <>
              <Button onClick={signInWithEmail} disabled={!email || !password} loading={loading} fullWidth size="lg">
                Sign in
              </Button>
              <div className="flex items-center justify-between text-sm">
                <button onClick={() => setEmailStage("signup")} className="text-tea-600 underline">
                  Create an account
                </button>
                <button onClick={() => setEmailStage("forgot")} className="text-tea-500 underline">
                  Forgot password?
                </button>
              </div>
            </>
          )}

          {emailStage === "signup" && (
            <>
              <Button onClick={signUpWithEmail} disabled={!email || !password} loading={loading} fullWidth size="lg">
                Create account
              </Button>
              <button onClick={() => setEmailStage("signin")} className="text-sm text-tea-500 underline self-center">
                Already have an account? Sign in
              </button>
            </>
          )}

          {emailStage === "forgot" && (
            <>
              <p className="text-sm text-tea-500">
                We&apos;ll email you a link to reset your password.
              </p>
              <Button onClick={sendPasswordReset} disabled={!email} loading={loading} fullWidth size="lg">
                Send reset link
              </Button>
              <button onClick={() => setEmailStage("signin")} className="text-sm text-tea-500 underline self-center">
                Back to sign in
              </button>
            </>
          )}
        </div>
      )}
    </main>
  );
}
