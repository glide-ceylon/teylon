"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { Spinner } from "@/components/ui/Spinner";
import { useState } from "react";

export default function LandingPage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        router.replace("/home");
      } else {
        setChecking(false);
      }
    });
  }, [router]);

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 p-8 text-center">
      <div>
        <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-3xl bg-tea-600 mx-auto shadow-lg">
          <span className="text-4xl">🍃</span>
        </div>
        <h1 className="text-4xl font-bold text-tea-700">Teylon</h1>
        <p className="mt-2 text-tea-500">Tea collection & payments</p>
        <p className="text-xs text-tea-400">A Glide Ceylon product</p>
      </div>

      <div className="flex w-full max-w-xs flex-col gap-3">
        <Link
          href="/login"
          className="rounded-2xl bg-tea-600 px-6 py-4 text-base font-semibold text-white shadow active:scale-[0.98] transition-transform"
        >
          Get started
        </Link>
      </div>

      <p className="max-w-xs text-sm text-tea-400">
        Scan · weigh · confirm — the trust layer no notebook gives you.
      </p>
    </main>
  );
}
