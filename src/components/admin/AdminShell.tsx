"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  CalendarDays,
  Clock,
  LogOut,
  ShieldAlert,
  Users,
  Ban,
} from "lucide-react";
import { useAdminData } from "./AdminDataProvider";
import { CLINIC } from "@/lib/clinic-config";
import { clsx } from "clsx";

const NAV = [
  { href: "/admin", label: "Calendar", icon: CalendarDays, exact: true },
  { href: "/admin/pending", label: "Pending", icon: ShieldAlert },
  { href: "/admin/patients", label: "Patients", icon: Users },
  { href: "/admin/follow-ups", label: "Follow-ups", icon: Clock },
  { href: "/admin/blocks", label: "Closures", icon: Ban },
];

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { snapshot, refreshing } = useAdminData();
  if (pathname.startsWith("/admin/print")) {
    return <>{children}</>;
  }

  const pending = snapshot.appointments.filter((a) => a.status === "PENDING").length;
  const isCalendar = pathname === "/admin";

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  }

  return (
    <div className="flex h-dvh bg-ivory">
      <aside className="hidden w-60 shrink-0 flex-col border-r border-slate-200/80 bg-white md:flex">
        <div className="flex items-center gap-3 px-5 py-5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.svg" alt="" className="h-10 w-10 rounded-xl" />
          <div>
            <div className="font-display text-base font-semibold leading-tight text-teal-dark">
              {CLINIC.name}
            </div>
            <div className="text-[11px] font-medium uppercase tracking-wider text-gold-dark">
              Clinic admin
            </div>
          </div>
        </div>
        <nav className="flex flex-1 flex-col gap-1 px-3">
          {NAV.map((item) => {
            const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={clsx(
                  "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium",
                  active ? "bg-teal text-white shadow-sm" : "text-slate-600 hover:bg-teal-50",
                )}
              >
                <Icon className="h-4 w-4" />
                <span className="flex-1">{item.label}</span>
                {item.href === "/admin/pending" && pending > 0 && (
                  <span
                    className={clsx(
                      "rounded-full px-1.5 text-[11px] font-bold",
                      active ? "bg-white/20" : "bg-gold text-teal-dark",
                    )}
                  >
                    {pending}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
        <div className="px-3 py-4">
          <button onClick={logout} className="btn-ghost w-full justify-start text-slate-500">
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-slate-200/80 bg-white px-4 md:hidden">
          <div className="flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.svg" alt="" className="h-8 w-8 rounded-lg" />
            <span className="font-display text-sm font-semibold text-teal-dark">SDC Admin</span>
          </div>
          {refreshing && <span className="text-[11px] text-slate-400">Syncing…</span>}
        </header>

        <main
          className={clsx(
            "min-h-0 flex-1",
            isCalendar ? "overflow-hidden" : "overflow-y-auto",
            "pb-16 md:pb-0",
          )}
        >
          {children}
        </main>

        <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-slate-200 bg-white/95 backdrop-blur md:hidden">
          {NAV.map((item) => {
            const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={clsx(
                  "relative flex flex-col items-center gap-0.5 py-2 text-[10px] font-semibold",
                  active ? "text-teal" : "text-slate-400",
                )}
              >
                <Icon className="h-5 w-5" />
                {item.label}
                {item.href === "/admin/pending" && pending > 0 && (
                  <span className="absolute right-[18%] top-1 h-1.5 w-1.5 rounded-full bg-gold" />
                )}
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
