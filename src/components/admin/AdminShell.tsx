"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  CalendarDays,
  Clock,
  LogOut,
  Settings,
  ShieldAlert,
  Users,
  Ban,
} from "lucide-react";
import { useAdminData } from "./AdminDataProvider";
import { adminBase } from "@/lib/clinic-config";
import { clsx } from "clsx";
import { InstallHint } from "./InstallHint";
import { reachabilityBanner } from "@/lib/api-client";

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { snapshot, refreshing, fromCache, online, serverUnreachable } = useAdminData();
  const clinic = snapshot.clinic;
  const base = adminBase(clinic.id);

  if (pathname.includes("/admin/print")) {
    return <>{children}</>;
  }

  const nav = [
    { href: base, label: "Calendar", icon: CalendarDays, exact: true, key: "cal" },
    clinic.flags.pendingApproval
      ? { href: `${base}/pending`, label: "Pending", icon: ShieldAlert, key: "pending" }
      : null,
    { href: `${base}/patients`, label: "Patients", icon: Users, key: "patients" },
    clinic.flags.followUps
      ? { href: `${base}/follow-ups`, label: "Follow-ups", icon: Clock, key: "follow" }
      : null,
    clinic.flags.closures ? { href: `${base}/blocks`, label: "Closures", icon: Ban, key: "blocks" } : null,
    { href: `${base}/settings`, label: "Settings", icon: Settings, key: "settings" },
  ].filter(Boolean) as {
    href: string;
    label: string;
    icon: typeof CalendarDays;
    exact?: boolean;
    key: string;
  }[];

  const pending = snapshot.appointments.filter((a) => a.status === "PENDING").length;
  const isCalendar = pathname === base;
  const banner = reachabilityBanner({ online, serverUnreachable, fromCache, refreshing });
  const brandStyle = {
    ["--brand-primary" as string]: clinic.brand.primary,
    ["--brand-accent" as string]: clinic.brand.accent,
  };

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  }

  return (
    <div className="flex h-dvh bg-ivory pt-[env(safe-area-inset-top)]" style={brandStyle}>
      <aside className="hidden w-60 shrink-0 flex-col border-r border-slate-200/80 bg-white md:flex">
        <div className="flex items-center gap-3 px-5 py-5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={clinic.logoUrl} alt="" className="h-10 w-10 rounded-xl object-cover" />
          <div>
            <div className="font-display text-base font-semibold leading-tight text-teal-dark">
              {clinic.name}
            </div>
            <div className="text-[11px] font-medium uppercase tracking-wider text-gold-dark">
              Clinic admin
            </div>
          </div>
        </div>
        <nav className="flex flex-1 flex-col gap-1 px-3">
          {nav.map((item) => {
            const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.key}
                href={item.href}
                className={clsx(
                  "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium",
                  active ? "bg-teal text-white shadow-sm" : "text-slate-600 hover:bg-teal-50",
                )}
              >
                <Icon className="h-4 w-4" />
                <span className="flex-1">{item.label}</span>
                {item.key === "pending" && pending > 0 && (
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
        <InstallHint />
        <div className="px-3 pb-[max(1rem,env(safe-area-inset-bottom))] pt-2">
          {banner === "offline" && (
            <p className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-[11px] font-medium leading-snug text-amber-800">
              Offline — last saved calendar. Changes save when you’re back online.
            </p>
          )}
          {banner === "updating" && (
            <p className="mb-3 px-3 text-[11px] text-slate-400">Updating from cloud…</p>
          )}
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
            <img src={clinic.logoUrl} alt="" className="h-8 w-8 rounded-lg object-cover" />
            <span className="font-display text-sm font-semibold text-teal-dark">{clinic.shortName} Admin</span>
          </div>
          {banner === "updating" && <span className="text-[11px] text-slate-400">Updating…</span>}
          {banner === "offline" && <span className="text-[11px] font-semibold text-amber-700">Offline</span>}
        </header>

        <main
          className={clsx(
            "min-h-0 flex-1",
            isCalendar ? "overflow-hidden" : "overflow-y-auto",
            "pb-[calc(4rem+env(safe-area-inset-bottom))] md:pb-0",
          )}
        >
          {children}
        </main>

        <nav
          className="fixed inset-x-0 bottom-0 z-40 hidden border-t border-slate-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur max-md:grid"
          style={{ gridTemplateColumns: `repeat(${nav.length}, minmax(0, 1fr))` }}
        >
          {nav.map((item) => {
            const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.key}
                href={item.href}
                className={clsx(
                  "relative flex flex-col items-center gap-0.5 py-2 text-[10px] font-semibold",
                  active ? "text-teal" : "text-slate-400",
                )}
              >
                <Icon className="h-5 w-5" />
                {item.label}
                {item.key === "pending" && pending > 0 && (
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
