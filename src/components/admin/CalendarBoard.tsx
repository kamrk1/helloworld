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
import { durationMinutes, fromCalendarDateClick, fromCalendarMarker } from "@/lib/datetime";
import { overlaps, rangeFitsHours } from "@/lib/slot-logic";
import { hoursFromRuntime } from "@/lib/clinic-hours";
import { hhmmDuration, snapToSlotMinutes } from "@/lib/hours-label";
import type { AppointmentDTO, BlockDTO } from "@/lib/types";
import { useAdminData } from "./AdminDataProvider";
import { useToast } from "./Toast";
import { AppointmentFormModal } from "./AppointmentFormModal";
import { BlockFormModal } from "./BlockFormModal";
import { EventDrawer } from "./EventDrawer";
import { apiJson, reachabilityBanner } from "@/lib/api-client";

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
      <div className="truncate text-[11px] opacity-90">
        {arg.timeText}
        {appt?.service ? ` · ${appt.service}` : ""}
      </div>
    </div>
  );
}

export function CalendarBoard() {
  const { snapshot, upsertAppointment, fromCache, refreshing, online, serverUnreachable } = useAdminData();
  const clinic = snapshot.clinic;
  const toast = useToast();
  const calRef = useRef<FullCalendar>(null);
  const [title, setTitle] = useState("");
  const [view, setView] = useState<"timeGridWeek" | "timeGridDay">("timeGridWeek");
  const [createStart, setCreateStart] = useState<Date | null>(null);
  const [blockRange, setBlockRange] = useState<{ start: Date; end: Date } | null>(null);
  const [selectedAppt, setSelectedAppt] = useState<AppointmentDTO | null>(null);
  const [selectedBlock, setSelectedBlock] = useState<BlockDTO | null>(null);
  const [interacting, setInteracting] = useState(false);
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

  const hours = useMemo(() => hoursFromRuntime(clinic.hours), [clinic.hours]);

  const businessHours = useMemo(() => {
    const daysOfWeek = [0, 1, 2, 3, 4, 5, 6].filter((d) => !clinic.closedWeekdays.includes(d));
    return hours.windows.map((w) => ({
      daysOfWeek,
      startTime: `${w.start}:00`,
      endTime: `${w.end}:00`,
    }));
  }, [hours.windows, clinic.closedWeekdays]);

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
    // Single-slot clicks: clicked column date + dateStr time (Asia/Kolkata).
    // Do not use `new Date()` — that is "today" and ignores the Saturday cell.
    info.view.calendar.unselect();
    const target = info.jsEvent?.target;
    const hitEvent =
      target instanceof Element &&
      Boolean(target.closest(".fc-event, .fc-timegrid-event, .fc-timegrid-event-harness"));

    const clickAt = fromCalendarDateClick(info);
    const slotEnd = new Date(clickAt.getTime() + clinic.slotMinutes * 60_000);

    const block = snapshot.blocks.find((b) =>
      overlaps(clickAt, slotEnd, new Date(b.startAt), new Date(b.endAt)),
    );
    if (block) {
      setCreateStart(null);
      setSelectedAppt(null);
      setSelectedBlock(block);
      return;
    }

    const appt = snapshot.appointments.find(
      (a) =>
        a.status !== "REJECTED" &&
        a.status !== "CANCELLED" &&
        overlaps(clickAt, slotEnd, new Date(a.startAt), new Date(a.endAt)),
    );
    if (appt) {
      setCreateStart(null);
      setSelectedBlock(null);
      setSelectedAppt(appt);
      return;
    }

    // Occupied visually but not in snapshot (or eventClick will follow) — never book a duplicate.
    if (hitEvent) return;

    if (!rangeFitsHours(clickAt, slotEnd, hours)) return;

    setCreateStart(clickAt);
  }

  function handleSelect(info: DateSelectArg) {
    const start = fromCalendarMarker(info.start, info.startStr);
    const end = fromCalendarMarker(info.end, info.endStr);
    info.view.calendar.unselect();

    const target = info.jsEvent?.target;
    if (
      target instanceof Element &&
      target.closest(".fc-event, .fc-timegrid-event, .fc-timegrid-event-harness, .fc-event-resizer")
    ) {
      return;
    }

    if (end.getTime() - start.getTime() < 60_000) return;

    const hitsAppointment = snapshot.appointments.some(
      (a) =>
        a.status !== "REJECTED" &&
        a.status !== "CANCELLED" &&
        overlaps(start, end, new Date(a.startAt), new Date(a.endAt)),
    );
    const hitsBlock = snapshot.blocks.some((b) =>
      overlaps(start, end, new Date(b.startAt), new Date(b.endAt)),
    );
    if (hitsAppointment || hitsBlock) return;

    if (!clinic.flags.closures) {
      toast.push("Closures are not in this clinic package", "err");
      return;
    }
    setCreateStart(null);
    setSelectedAppt(null);
    setSelectedBlock(null);
    setBlockRange({ start, end });
  }

  function handleEventClick(info: EventClickArg) {
    info.jsEvent.preventDefault();
    info.jsEvent.stopPropagation();
    setCreateStart(null);
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
    const durationMin = snapToSlotMinutes(durationMinutes(start, rawEnd), clinic.slotMinutes);
    const startAt = start.toISOString();
    const endAt = new Date(start.getTime() + durationMin * 60_000).toISOString();
    if (!rangeFitsHours(start, new Date(start.getTime() + durationMin * 60_000), hours)) {
      info.revert();
      toast.push("That time is outside clinic hours", "err");
      return;
    }
    const resized = "endDelta" in info;
    upsertAppointment({ ...prev, startAt, endAt, durationMin });
    try {
      const json = await apiJson<AppointmentDTO>(`/api/admin/appointments/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ startAt, durationMin }),
      });
      upsertAppointment(json);
      toast.push(resized ? "Appointment updated" : "Appointment moved");
    } catch (err) {
      upsertAppointment(prev);
      info.revert();
      toast.push(err instanceof Error ? err.message : resized ? "Update failed" : "Move failed", "err");
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

      <div className="min-h-0 flex-1 px-2 py-2 md:px-4 md:py-3">
        <div className={`h-full overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-card${interacting ? " cal-interacting" : ""}`}>
          <FullCalendar
            ref={calRef}
            plugins={[timeGridPlugin, interactionPlugin, luxonPlugin]}
            initialView={view}
            headerToolbar={false}
            timeZone={clinic.timezone}
            slotMinTime={hours.start + ":00"}
            slotMaxTime={hours.end + ":00"}
            slotDuration={hhmmDuration(clinic.slotMinutes)}
            snapDuration={hhmmDuration(clinic.slotMinutes)}
            allDaySlot={false}
            nowIndicator
            selectable
            selectMirror
            selectMinDistance={4}
            slotEventOverlap
            editable
            eventDurationEditable
            eventResizableFromStart={false}
            businessHours={businessHours}
            eventConstraint="businessHours"
            selectConstraint="businessHours"
            selectLongPressDelay={500}
            eventLongPressDelay={250}
            height="100%"
            expandRows
            weekends
            hiddenDays={clinic.closedWeekdays}
            slotLabelFormat={{ hour: "numeric", minute: "2-digit", hour12: true }}
            eventTimeFormat={{ hour: "numeric", minute: "2-digit", hour12: true }}
            dayHeaderFormat={
              view === "timeGridDay"
                ? { weekday: "long", month: "short", day: "numeric" }
                : { weekday: "short", day: "numeric" }
            }
            scrollTime={`${hours.start}:00`}
            events={events}
            dateClick={handleDateClick}
            select={handleSelect}
            eventClick={handleEventClick}
            eventDrop={persistTimes}
            eventResize={persistTimes}
            eventDragStart={() => setInteracting(true)}
            eventDragStop={() => setInteracting(false)}
            eventResizeStart={() => setInteracting(true)}
            eventResizeStop={() => setInteracting(false)}
            eventContent={(arg) => <EventInner arg={arg} />}
            datesSet={(arg) => setTitle(arg.view.title)}
            selectOverlap={() => false}
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
