"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import FullCalendar from "@fullcalendar/react";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import luxonPlugin from "@fullcalendar/luxon3";
import type {
  DateSelectArg,
  EventClickArg,
  EventContentArg,
  EventDropArg,
  EventInput,
} from "@fullcalendar/core";
import type { DateClickArg, EventResizeDoneArg } from "@fullcalendar/interaction";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { CLINIC } from "@/lib/clinic-config";
import { durationMinutes, fromCalendarMarker } from "@/lib/datetime";
import type { AppointmentDTO, BlockDTO } from "@/lib/types";
import { useAdminData } from "./AdminDataProvider";
import { useToast } from "./Toast";
import { AppointmentFormModal } from "./AppointmentFormModal";
import { BlockFormModal } from "./BlockFormModal";
import { EventDrawer } from "./EventDrawer";
import { apiJson, reachabilityBanner, UNREACHABLE_BANNER } from "@/lib/api-client";

function snapDuration(minutes: number) {
  return ([30, 60, 90] as const).reduce((best, n) =>
    Math.abs(n - minutes) < Math.abs(best - minutes) ? n : best,
  );
}

function toEvents(appointments: AppointmentDTO[], blocks: BlockDTO[]): EventInput[] {
  const appts: EventInput[] = appointments
    .filter((a) => a.status !== "REJECTED" && a.status !== "CANCELLED")
    .map((a) => ({
      id: `appt:${a.id}`,
      title: a.patientName,
      start: a.startAt,
      end: a.endAt,
      editable: true,
      durationEditable: true,
      classNames: [`evt-${a.status.toLowerCase()}`],
      extendedProps: { kind: "appointment", appointment: a },
    }));
  const closed: EventInput[] = blocks.map((b) => ({
    id: `block:${b.id}`,
    title: b.reason || "Closed",
    start: b.startAt,
    end: b.endAt,
    editable: false,
    durationEditable: false,
    classNames: ["evt-block"],
    extendedProps: { kind: "block", block: b },
  }));
  return [...closed, ...appts];
}

function EventInner({ arg }: { arg: EventContentArg }) {
  const kind = arg.event.extendedProps.kind as string;
  if (kind === "block") {
    return (
      <div className="h-full min-h-0 overflow-hidden leading-tight">
        <div className="font-semibold">Blocked</div>
        <div className="truncate text-[11px]">{arg.event.title}</div>
      </div>
    );
  }
  const appt = arg.event.extendedProps.appointment as AppointmentDTO;
  return (
    <div className="h-full min-h-0 overflow-hidden leading-tight">
      <div className="truncate font-semibold">{arg.event.title}</div>
      <div className="truncate text-[11px] opacity-90">{appt?.service}</div>
    </div>
  );
}

export function CalendarBoard() {
  const { snapshot, upsertAppointment, fromCache, refreshing, online, serverUnreachable } = useAdminData();
  const toast = useToast();
  const calRef = useRef<FullCalendar>(null);
  const [title, setTitle] = useState("");
  const [view, setView] = useState<"timeGridWeek" | "timeGridDay">("timeGridWeek");
  const [createStart, setCreateStart] = useState<Date | null>(null);
  const [blockRange, setBlockRange] = useState<{ start: Date; end: Date } | null>(null);
  const [selectedAppt, setSelectedAppt] = useState<AppointmentDTO | null>(null);
  const [selectedBlock, setSelectedBlock] = useState<BlockDTO | null>(null);
  const banner = reachabilityBanner({ online, serverUnreachable, fromCache, refreshing });

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 768px)");
    const apply = () => {
      const next = mq.matches ? "timeGridDay" : "timeGridWeek";
      setView(next);
      calRef.current?.getApi().changeView(next);
    };
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  const events = useMemo(
    () => toEvents(snapshot.appointments, snapshot.blocks),
    [snapshot.appointments, snapshot.blocks],
  );

  function go(dir: "prev" | "next" | "today") {
    const api = calRef.current?.getApi();
    if (!api) return;
    if (dir === "today") api.today();
    else if (dir === "prev") api.prev();
    else api.next();
    setTitle(api.view.title);
  }

  function changeView(next: "timeGridWeek" | "timeGridDay") {
    setView(next);
    calRef.current?.getApi().changeView(next);
    setTitle(calRef.current?.getApi().view.title ?? "");
  }

  function handleDateClick(info: DateClickArg) {
    // Single-slot clicks: use FullCalendar's dateClick start (Asia/Kolkata wall clock).
    info.view.calendar.unselect();
    setCreateStart(fromCalendarMarker(info.date, info.dateStr));
  }

  function handleSelect(info: DateSelectArg) {
    const start = fromCalendarMarker(info.start, info.startStr);
    const end = fromCalendarMarker(info.end, info.endStr);
    info.view.calendar.unselect();
    // Click-drag always creates a clinic block, including a single 30-min slot.
    // A click without drag is dateClick → new appointment.
    setBlockRange({ start, end });
  }

  function handleEventClick(info: EventClickArg) {
    info.jsEvent.preventDefault();
    info.jsEvent.stopPropagation();
    const kind = info.event.extendedProps.kind;
    if (kind === "block") {
      setSelectedBlock(info.event.extendedProps.block as BlockDTO);
      setSelectedAppt(null);
    } else {
      const id = info.event.id.replace("appt:", "");
      const live = snapshot.appointments.find((a) => a.id === id);
      setSelectedAppt(live ?? (info.event.extendedProps.appointment as AppointmentDTO));
      setSelectedBlock(null);
    }
  }

  async function persistTimes(info: EventDropArg | EventResizeDoneArg) {
    if (info.event.extendedProps.kind !== "appointment") {
      info.revert();
      return;
    }
    const id = info.event.id.replace("appt:", "");
    const prev = snapshot.appointments.find((a) => a.id === id);
    if (!prev || !info.event.start) {
      info.revert();
      return;
    }
    const start = fromCalendarMarker(info.event.start, info.event.startStr);
    const rawEnd = info.event.end
      ? fromCalendarMarker(info.event.end, info.event.endStr)
      : new Date(start.getTime() + prev.durationMin * 60_000);
    const durationMin = snapDuration(durationMinutes(start, rawEnd));
    const startAt = start.toISOString();
    const endAt = new Date(start.getTime() + durationMin * 60_000).toISOString();
    upsertAppointment({ ...prev, startAt, endAt, durationMin });
    try {
      const json = await apiJson<AppointmentDTO>(`/api/admin/appointments/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ startAt, durationMin }),
      });
      upsertAppointment(json);
      toast.push("Appointment moved");
    } catch (err) {
      upsertAppointment(prev);
      info.revert();
      toast.push(err instanceof Error ? err.message : "Move failed", "err");
    }
  }

  return (
    <div className="flex h-full flex-col bg-ivory">
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200/80 bg-white px-3 py-2 md:px-5 md:py-2.5">
        <button className="btn-secondary px-2.5 py-1.5 text-xs md:px-3 md:py-2 md:text-sm" onClick={() => go("today")}>
          Today
        </button>
        <div className="flex items-center">
          <button className="btn-ghost px-1.5 md:px-2" onClick={() => go("prev")} aria-label="Previous">
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button className="btn-ghost px-1.5 md:px-2" onClick={() => go("next")} aria-label="Next">
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
        <h1 className="min-w-0 flex-1 truncate font-display text-base font-semibold text-teal-dark md:text-xl">
          {title || "Calendar"}
        </h1>
        <div className="flex rounded-lg border border-slate-200 p-0.5">
          <button
            className={`rounded-md px-2.5 py-1 text-[11px] font-semibold md:px-3 md:text-xs ${view === "timeGridWeek" ? "bg-teal text-white" : "text-slate-600"}`}
            onClick={() => changeView("timeGridWeek")}
          >
            Week
          </button>
          <button
            className={`rounded-md px-2.5 py-1 text-[11px] font-semibold md:px-3 md:text-xs ${view === "timeGridDay" ? "bg-teal text-white" : "text-slate-600"}`}
            onClick={() => changeView("timeGridDay")}
          >
            Day
          </button>
        </div>
        <button className="btn-primary px-2.5 py-1.5 md:px-3.5 md:py-2" onClick={() => setCreateStart(new Date())}>
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">Appointment</span>
        </button>
        {fromCache && refreshing && (
          <span className="hidden text-[11px] text-slate-400 lg:inline">Updating…</span>
        )}
      </div>
      {banner === "offline" && (
        <div className="bg-amber-50 px-3 py-1.5 text-center text-[11px] font-medium text-amber-800 md:hidden">
          Offline — showing last saved week. Edits need a connection.
        </div>
      )}
      {banner === "unreachable" && (
        <div className="bg-amber-50 px-3 py-1.5 text-center text-[11px] font-medium text-amber-800 md:hidden">
          {UNREACHABLE_BANNER}
        </div>
      )}

      <div className="min-h-0 flex-1 px-2 py-2 md:px-4 md:py-3">
        <div className="h-full overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-card">
          <FullCalendar
            ref={calRef}
            plugins={[timeGridPlugin, interactionPlugin, luxonPlugin]}
            initialView={view}
            headerToolbar={false}
            timeZone={CLINIC.timezone}
            slotMinTime={CLINIC.hours.start + ":00"}
            slotMaxTime={CLINIC.hours.end + ":00"}
            slotDuration="00:30:00"
            snapDuration="00:30:00"
            allDaySlot={false}
            nowIndicator
            selectable
            selectMirror
            selectMinDistance={4}
            slotEventOverlap={false}
            editable
            eventDurationEditable
            eventResizableFromStart={false}
            selectLongPressDelay={250}
            eventLongPressDelay={250}
            height="100%"
            expandRows
            weekends
            hiddenDays={CLINIC.closedWeekdays}
            slotLabelFormat={{ hour: "numeric", minute: "2-digit", hour12: true }}
            eventTimeFormat={{ hour: "numeric", minute: "2-digit", hour12: true }}
            dayHeaderFormat={
              view === "timeGridDay"
                ? { weekday: "long", month: "short", day: "numeric" }
                : { weekday: "short", day: "numeric" }
            }
            scrollTime="10:00:00"
            events={events}
            dateClick={handleDateClick}
            select={handleSelect}
            eventClick={handleEventClick}
            eventDrop={persistTimes}
            eventResize={persistTimes}
            eventContent={(arg) => <EventInner arg={arg} />}
            datesSet={(arg) => setTitle(arg.view.title)}
            selectOverlap={(ev) => ev.extendedProps.kind !== "block"}
            eventOverlap={(still) => still.extendedProps.kind !== "block"}
          />
        </div>
      </div>

      {createStart && (
        <AppointmentFormModal
          key={createStart.toISOString()}
          start={createStart}
          onClose={() => setCreateStart(null)}
        />
      )}
      {blockRange && (
        <BlockFormModal start={blockRange.start} end={blockRange.end} onClose={() => setBlockRange(null)} />
      )}
      {(selectedAppt || selectedBlock) && (
        <EventDrawer
          key={selectedAppt?.id ?? selectedBlock?.id}
          appointment={selectedAppt ?? undefined}
          block={selectedBlock ?? undefined}
          onClose={() => {
            setSelectedAppt(null);
            setSelectedBlock(null);
          }}
        />
      )}
    </div>
  );
}
