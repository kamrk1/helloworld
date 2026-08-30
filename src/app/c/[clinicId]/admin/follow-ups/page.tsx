"use client";

import { useMemo, useState } from "react";
import { MessageCircle } from "lucide-react";
import { useAdminData } from "@/components/admin/AdminDataProvider";
import { addDays, formatDateLong, startOfDayIST, startOfWeekMondayIST } from "@/lib/datetime";
import { hasMobile, waLink } from "@/lib/phone";

type Tab = "overdue" | "imminent" | "week";

export default function FollowUpsPage() {
  const { snapshot } = useAdminData();
  const clinic = snapshot.clinic;
  const [tab, setTab] = useState<Tab>("overdue");

  const groups = useMemo(() => {
    const today = startOfDayIST(new Date());
    const weekStart = startOfWeekMondayIST();
    const weekEnd = addDays(weekStart, 7);
    const imminentEnd = addDays(today, 3);
    const withFollow = snapshot.appointments.filter((a) => a.followupDate);
    const overdue = withFollow.filter((a) => new Date(a.followupDate!) < today);
    const imminent = withFollow.filter((a) => {
      const d = new Date(a.followupDate!);
      return d >= today && d < imminentEnd;
    });
    const week = withFollow.filter((a) => {
      const d = new Date(a.followupDate!);
      return d >= weekStart && d < weekEnd;
    });
    return { overdue, imminent, week };
  }, [snapshot.appointments]);

  const rows = groups[tab];

  if (!clinic.flags.followUps) {
    return <p className="px-4 py-10 text-center text-sm text-slate-400">Follow-ups are not in this clinic package.</p>;
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <h1 className="font-display text-2xl font-semibold text-teal-dark">Follow-ups</h1>
      <p className="mt-1 text-sm text-slate-500">Visits with a follow-up date on file.</p>
      <div className="mt-4 flex gap-2">
        {(
          [
            ["overdue", `Overdue (${groups.overdue.length})`],
            ["imminent", `Imminent (${groups.imminent.length})`],
            ["week", `This week (${groups.week.length})`],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            className={`rounded-full px-3 py-1.5 text-sm font-semibold ${
              tab === key ? "bg-teal text-white" : "bg-white text-slate-600 shadow-sm"
            }`}
            onClick={() => setTab(key)}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="mt-4 space-y-2">
        {rows.map((a) => (
          <div key={a.id} className="card flex flex-wrap items-center gap-3 px-4 py-3">
            <div className="min-w-0 flex-1">
              <div className="font-semibold text-slate-800">{a.patientName}</div>
              <div className="text-sm text-slate-500">
                Follow-up {formatDateLong(new Date(a.followupDate!))} · {a.service} · {a.ref}
              </div>
            </div>
            {clinic.flags.whatsapp && hasMobile(a.phone) && (
            <a
              className="btn-secondary"
              href={waLink(
                a.phone,
                `Hello ${a.patientName}, this is ${clinic.name}. Your follow-up is due on ${formatDateLong(new Date(a.followupDate!))}. Please book a slot.`,
              )}
              target="_blank"
              rel="noreferrer"
            >
              <MessageCircle className="h-4 w-4" /> WhatsApp
            </a>
            )}
          </div>
        ))}
        {rows.length === 0 && <p className="py-10 text-center text-sm text-slate-400">Nothing in this list</p>}
      </div>
    </div>
  );
}
