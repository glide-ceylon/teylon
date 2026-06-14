"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  CheckSquare,
  Layers,
  DollarSign,
  User,
  Users,
  CreditCard,
  Truck,
  ListChecks,
  Minus,
  BarChart2,
  Settings,
  LogOut,
} from "lucide-react";
import type { Role } from "@/lib/types";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";

type NavItem = {
  href: string;
  label: string;
  icon: React.ElementType;
  exactMatch?: boolean;
  section?: string;
};

const ownerNav: NavItem[] = [
  { href: "/home", label: "Home", icon: Home, exactMatch: true },
  { href: "/feed", label: "Confirm Collections", icon: CheckSquare },
  { section: "My Farm" },
  { href: "/fields", label: "Fields", icon: Layers },
  { href: "/workers", label: "Workers", icon: Users },
  { section: "Payments" },
  { href: "/balance", label: "My Balance", icon: DollarSign },
  { href: "/payments", label: "Payment History", icon: CreditCard },
  { href: "/deductions", label: "Deductions", icon: Minus },
] as NavItem[];

const agentNav: NavItem[] = [
  { href: "/home", label: "Home", icon: Home, exactMatch: true },
  { href: "/collect", label: "New Collection", icon: Truck },
  { href: "/collections", label: "Collections", icon: ListChecks },
  { section: "Owners" },
  { href: "/owners", label: "Owners", icon: Users },
  { href: "/deductions", label: "Deductions", icon: Minus },
  { section: "Cash & Finance" },
  { href: "/cash", label: "Cash", icon: CreditCard },
  { href: "/settlements", label: "Settlements", icon: BarChart2 },
  { section: "Team" },
  { href: "/drivers", label: "Drivers", icon: Truck },
] as NavItem[];

function getNav(role: Role): NavItem[] {
  if (role === "owner") return ownerNav;
  if (role === "agent") return agentNav;
  return [];
}

interface SidebarProps {
  role: Role;
  profileName: string;
  className?: string;
}

export function Sidebar({ role, profileName, className = "" }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const items = getNav(role);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  function isActive(item: NavItem) {
    if (!item.href) return false;
    if (item.exactMatch) return pathname === item.href;
    return pathname.startsWith(item.href);
  }

  return (
    <aside
      className={[
        "flex h-screen w-60 flex-col border-r border-tea-100 bg-white",
        className,
      ].join(" ")}
      style={{ position: "sticky", top: 0 }}
    >
      {/* Logo */}
      <div className="flex h-16 items-center border-b border-tea-100 px-5">
        <div>
          <p className="font-bold text-tea-700">Teylon</p>
          <p className="text-xs text-tea-400 capitalize">{role}</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-3 px-2">
        {items.map((item, i) => {
          if ("section" in item && !item.href) {
            return (
              <p
                key={i}
                className="mt-4 mb-1 px-3 text-[10px] font-semibold uppercase tracking-widest text-tea-300"
              >
                {item.section}
              </p>
            );
          }
          const active = isActive(item);
          return (
            <Link
              key={item.href}
              href={item.href!}
              className={[
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                active
                  ? "bg-tea-100 text-tea-700"
                  : "text-tea-500 hover:bg-tea-50 hover:text-tea-700",
              ].join(" ")}
            >
              <item.icon
                className={`h-4 w-4 flex-shrink-0 ${active ? "text-tea-600" : "text-tea-400"}`}
              />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="border-t border-tea-100 p-3">
        <Link
          href="/account"
          className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-tea-500 hover:bg-tea-50"
        >
          <Settings className="h-4 w-4 text-tea-400" />
          Account
        </Link>
        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-tea-500 hover:bg-tea-50"
        >
          <LogOut className="h-4 w-4 text-tea-400" />
          Sign out
        </button>
        <p className="mt-2 truncate px-3 text-xs text-tea-300">{profileName}</p>
      </div>
    </aside>
  );
}
