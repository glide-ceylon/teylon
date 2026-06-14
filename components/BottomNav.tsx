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
} from "lucide-react";
import type { Role } from "@/lib/types";

type NavItem = {
  href: string;
  label: string;
  icon: React.ElementType;
  exactMatch?: boolean;
};

const ownerNav: NavItem[] = [
  { href: "/home", label: "Home", icon: Home, exactMatch: true },
  { href: "/feed", label: "Confirm", icon: CheckSquare },
  { href: "/fields", label: "Fields", icon: Layers },
  { href: "/balance", label: "Balance", icon: DollarSign },
  { href: "/account", label: "Account", icon: User },
];

const agentNav: NavItem[] = [
  { href: "/home", label: "Home", icon: Home, exactMatch: true },
  { href: "/collect", label: "Collect", icon: Truck },
  { href: "/owners", label: "Owners", icon: Users },
  { href: "/cash", label: "Cash", icon: CreditCard },
  { href: "/account", label: "More", icon: User },
];

const driverNav: NavItem[] = [
  { href: "/today", label: "Today", icon: Home, exactMatch: true },
  { href: "/collect", label: "Collect", icon: Truck },
  { href: "/collections", label: "Trips", icon: ListChecks },
  { href: "/account", label: "Account", icon: User },
];

function getNav(role: Role): NavItem[] {
  if (role === "owner") return ownerNav;
  if (role === "agent") return agentNav;
  if (role === "driver") return driverNav;
  return [];
}

interface BottomNavProps {
  role: Role;
  className?: string;
}

export function BottomNav({ role, className = "" }: BottomNavProps) {
  const pathname = usePathname();

  const items = getNav(role);

  function isActive(item: NavItem) {
    if (item.exactMatch) return pathname === item.href;
    return pathname.startsWith(item.href);
  }

  return (
    <nav
      className={[
        "fixed bottom-0 left-0 right-0 z-40 border-t border-tea-100 bg-white pb-safe",
        className,
      ].join(" ")}
    >
      <div className="flex items-stretch">
        {items.map((item) => {
          const active = isActive(item);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={[
                "flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-medium transition-colors min-h-[56px] justify-center",
                active ? "text-tea-600" : "text-tea-400",
              ].join(" ")}
            >
              <item.icon
                className={`h-5 w-5 ${active ? "text-tea-600" : "text-tea-400"}`}
                strokeWidth={active ? 2.5 : 2}
              />
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
