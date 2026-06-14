"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useProfile } from "@/lib/hooks/useProfile";
import { BottomNav } from "./BottomNav";
import { Sidebar } from "./Sidebar";
import { FullPageSpinner } from "./ui/Spinner";

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const { data: profile, isLoading } = useProfile();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !profile) {
      router.push("/login");
    }
  }, [profile, isLoading, router]);

  if (isLoading) return <FullPageSpinner />;
  if (!profile) return null;

  const isDriver = profile.role === "driver";

  // Driver: always mobile-only centered layout
  if (isDriver) {
    return (
      <div className="relative mx-auto flex min-h-screen w-full max-w-[448px] flex-col bg-white shadow-xl">
        <main className="flex-1 overflow-y-auto pb-20">{children}</main>
        <BottomNav role={profile.role} />
      </div>
    );
  }

  // Owner / Agent: responsive — sidebar on desktop, bottom nav on mobile
  return (
    <div className="flex min-h-screen">
      {/* Desktop sidebar */}
      <Sidebar
        role={profile.role}
        profileName={profile.full_name}
        className="hidden md:flex"
      />

      {/* Main content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <main className="flex-1 overflow-y-auto pb-20 md:pb-0">{children}</main>
        {/* Mobile bottom nav */}
        <BottomNav role={profile.role} className="md:hidden" />
      </div>
    </div>
  );
}

// Page header component for consistent headers
interface PageHeaderProps {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}

export function PageHeader({ title, subtitle, action }: PageHeaderProps) {
  return (
    <div className="flex items-start justify-between px-4 py-4 md:px-6">
      <div>
        <h1 className="text-xl font-bold text-tea-900">{title}</h1>
        {subtitle && <p className="mt-0.5 text-sm text-tea-500">{subtitle}</p>}
      </div>
      {action && <div className="ml-4 flex-shrink-0">{action}</div>}
    </div>
  );
}
