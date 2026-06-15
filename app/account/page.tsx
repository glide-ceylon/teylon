"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { useProfile } from "@/lib/hooks/useProfile";
import { AppShell, PageHeader } from "@/components/AppShell";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import {
  QrCode,
  LogOut,
  Bell,
  ChevronRight,
  User,
  Truck,
  Settings,
} from "lucide-react";
import toast from "react-hot-toast";

export default function AccountPage() {
  const { data: profile } = useProfile();
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setEmail(data.user?.email ?? null);
    });
  }, []);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.replace("/login");
  }

  const isDriver = profile?.role === "driver";
  const isAgent = profile?.role === "agent";

  return (
    <AppShell>
      <PageHeader title="Account" />

      <div className="px-4 md:px-6 space-y-4 pb-8">
        {/* Profile card */}
        <Card>
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-tea-100">
              <User className="h-7 w-7 text-tea-600" />
            </div>
            <div>
              <p className="font-semibold text-tea-900">{profile?.full_name}</p>
              <p className="text-sm text-tea-500 capitalize">{profile?.role}</p>
              {profile?.phone && (
                <p className="text-xs text-tea-400">{profile.phone}</p>
              )}
              {email && (
                <p className="text-xs text-tea-400">{email}</p>
              )}
            </div>
          </div>
        </Card>

        {/* QR code — for owners and drivers */}
        {(profile?.role === "owner" || isDriver) && (
          <Link href="/account/qr">
            <Card>
              <div className="flex items-center gap-3">
                <QrCode className="h-5 w-5 text-tea-500" />
                <div className="flex-1">
                  <p className="font-medium text-tea-900">My QR code</p>
                  <p className="text-sm text-tea-400">
                    {isDriver ? "Show at collection" : "Share with your agent"}
                  </p>
                </div>
                <ChevronRight className="h-4 w-4 text-tea-300" />
              </div>
            </Card>
          </Link>
        )}

        {/* Notifications */}
        <Link href="/notifications">
          <Card>
            <div className="flex items-center gap-3">
              <Bell className="h-5 w-5 text-tea-500" />
              <div className="flex-1">
                <p className="font-medium text-tea-900">Notifications</p>
                <p className="text-sm text-tea-400">Alerts and confirmations</p>
              </div>
              <ChevronRight className="h-4 w-4 text-tea-300" />
            </div>
          </Card>
        </Link>

        {/* Agent-only: extra links */}
        {isAgent && (
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-widest text-tea-300 px-1">
              Management
            </p>
            <Link href="/drivers">
              <Card>
                <div className="flex items-center gap-3">
                  <User className="h-5 w-5 text-tea-500" />
                  <div className="flex-1">
                    <p className="font-medium text-tea-900">Drivers</p>
                    <p className="text-sm text-tea-400">Manage driver accounts</p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-tea-300" />
                </div>
              </Card>
            </Link>
            <Link href="/vehicles">
              <Card>
                <div className="flex items-center gap-3">
                  <Truck className="h-5 w-5 text-tea-500" />
                  <div className="flex-1">
                    <p className="font-medium text-tea-900">Vehicles</p>
                    <p className="text-sm text-tea-400">Lorries and their QR codes</p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-tea-300" />
                </div>
              </Card>
            </Link>
            <Link href="/settings">
              <Card>
                <div className="flex items-center gap-3">
                  <Settings className="h-5 w-5 text-tea-500" />
                  <div className="flex-1">
                    <p className="font-medium text-tea-900">Settings</p>
                    <p className="text-sm text-tea-400">Tea rate and defaults</p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-tea-300" />
                </div>
              </Card>
            </Link>
            <Link href="/settlements">
              <Card>
                <div className="flex items-center gap-3">
                  <ChevronRight className="h-5 w-5 text-tea-500" />
                  <div className="flex-1">
                    <p className="font-medium text-tea-900">Settlements</p>
                    <p className="text-sm text-tea-400">Monthly owner settlements</p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-tea-300" />
                </div>
              </Card>
            </Link>
          </div>
        )}

        {/* Logout */}
        <Button
          variant="danger"
          fullWidth
          onClick={handleLogout}
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </Button>

        <p className="text-center text-xs text-tea-300">
          Teylon — Glide Ceylon · v1
        </p>
      </div>
    </AppShell>
  );
}
