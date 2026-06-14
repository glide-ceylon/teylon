"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import toast from "react-hot-toast";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [hasSession, setHasSession] = useState<boolean | null>(null);

  // The recovery link establishes a session via /auth/callback before landing here.
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setHasSession(!!session);
    });
  }, []);

  async function updatePassword() {
    if (password.length < 6) return toast.error("Password must be at least 6 characters");
    if (password !== confirm) return toast.error("Passwords do not match");

    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) return toast.error(error.message);

    toast.success("Password updated");
    router.replace("/home");
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center gap-6 px-6 py-12">
      <div className="text-center">
        <div className="mb-3 flex h-16 w-16 items-center justify-center rounded-2xl bg-tea-600 mx-auto">
          <span className="text-3xl">🔑</span>
        </div>
        <h1 className="text-2xl font-bold text-tea-700">Set a new password</h1>
      </div>

      {hasSession === false ? (
        <div className="flex flex-col gap-4 text-center">
          <p className="text-sm text-tea-500">
            This reset link is invalid or has expired. Request a new one from the sign-in page.
          </p>
          <Button onClick={() => router.replace("/login")} fullWidth size="lg">
            Back to sign in
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <Input
            label="New password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type="password"
            autoComplete="new-password"
            hint="At least 6 characters"
          />
          <Input
            label="Confirm password"
            placeholder="••••••••"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            type="password"
            autoComplete="new-password"
          />
          <Button
            onClick={updatePassword}
            disabled={!password || !confirm}
            loading={loading}
            fullWidth
            size="lg"
          >
            Update password
          </Button>
        </div>
      )}
    </main>
  );
}
