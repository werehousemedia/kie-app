import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, addMonths,
  addWeeks, format, isSameMonth, isToday,
} from "date-fns";
import { ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";
import { KIND_META } from "@/lib/calendarEvents";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Portfolio calendar. Month / week / day views over derived events (see
// calendarEvents.js — every entry links to its underlying record). Colours
// come from the kind-of-thing taxonomy; status lives in the label text.
// Theme-aware: design tokens only, no hardcoded slate.
// ---------------------------------------------------------------------------

const fmtKey = (d) => format(d, "yyyy-MM-dd");

function useEventsByDate(events) {
  return useMemo(() => {
    const map = new Map();
    for (const e of events) {
      if (!map.has(e.date)) map.set(e.date, []);
      map.get(e.date).push(e);
    }
    return map;
  }, [events]);
}

function EventChip({ event, compact = false }) {
  const meta = KIND_META[event.kind] || KIND_META.task;
  return (
    <Link
      to={event.to}
      title={event.label}
      className={cn(
        "block w-full text-left rounded border-l-2 bg-muted/60 hover:bg-muted transition-colors truncate",
        compact ? "px-1 py-0.5 text-[10px]" : "px-1.5 py-0.5 text-[11px]",
      )}
      style={{ borderLeftColor: meta.hex }}
    >
      <span className="font-medium text-foreground">{event.label}</span>
    </Link>
  );
}

function EventRow({ event }) {
  const meta = KIND_META[event.kind] || KIND_META.task;
  return (
    <Link
      to={event.to}
      className="flex items-start gap-2.5 px-3 py-2 rounded-lg hover:bg-muted transition-colors group"
    >
      <span className={cn("w-2 h-2 rounded-full mt-1.5 shrink-0", meta.dot)} />
      <span className="flex-1 min-w-0">
        <span className="block text-sm text-foreground truncate group-hover:underline underline-offset-2">
          {event.label}
        </span>
        {event.sub && (
          <span className="block text-xs text-muted-foreground truncate">{event.sub}</span>
        )}
      </span>
      <span className="text-[11px] text-muted-foreground shrink-0 mt-0.5">
        {meta.label}
      </span>
    </Link>
  );
}

export function CalendarLegend({ kinds }) {
  const shown = kinds || ["rent", "maintenance", "compliance", "tenancy", "booking", "task"];
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      {shown.map((k) => (
        <span key={k} className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <span className={cn("w-2 h-2 rounded-full", KIND_META[k].dot)} /> {KIND_META[k].label}
        </span>
      ))}
    </div>
  );
}

const VIEWS = ["month", "week", "day"];

export default function KieCalendar({ events }) {
  const [view, setView] = useState("month");
  const [anchor, setAnchor] = useState(() => new Date());
  const byDate = useEventsByDate(events);

  const move = (dir) => {
    if (view === "month") setAnchor((a) => addMonths(a, dir));
    else if (view === "week") setAnchor((a) => addWeeks(a, dir));
    else setAnchor((a) => addDays(a, dir));
  };

  const title =
    view === "month" ? format(anchor, "MMMM yyyy")
    : view === "week" ? `${format(startOfWeek(anchor, { weekStartsOn: 1 }), "d MMM")} – ${format(endOfWeek(anchor, { weekStartsOn: 1 }), "d MMM yyyy")}`
    : format(anchor, "EEEE d MMMM yyyy");

  const monthDays = useMemo(() => {
    const start = startOfWeek(startOfMonth(anchor), { weekStartsOn: 1 });
    const end = endOfWeek(endOfMonth(anchor), { weekStartsOn: 1 });
    const out = [];
    for (let d = start; d <= end; d = addDays(d, 1)) out.push(d);
    return out;
  }, [anchor]);

  const weekDays = useMemo(() => {
    const start = startOfWeek(anchor, { weekStartsOn: 1 });
    return Array.from({ length: 7 }, (_, i) => addDays(start, i));
  }, [anchor]);

  return (
    <div className="rounded-xl border bg-card p-4 sm:p-5">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <div className="flex items-center gap-1">
          <button onClick={() => move(-1)} className="p-1.5 rounded-lg hover:bg-muted" aria-label="Previous">
            <ChevronLeft className="w-4 h-4 text-muted-foreground" />
          </button>
          <h3 className="text-sm font-semibold text-foreground min-w-[150px] text-center">{title}</h3>
          <button onClick={() => move(1)} className="p-1.5 rounded-lg hover:bg-muted" aria-label="Next">
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          </button>
          <button
            onClick={() => setAnchor(new Date())}
            className="ml-1 text-xs px-2 py-1 rounded-lg border text-muted-foreground hover:bg-muted"
          >
            Today
          </button>
        </div>
        <div className="flex rounded-lg border overflow-hidden">
          {VIEWS.map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={cn(
                "px-3 py-1.5 text-xs font-medium capitalize transition-colors",
                view === v ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:bg-muted",
              )}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      {/* Month view */}
      {view === "month" && (
        <>
          <div className="grid grid-cols-7 text-center text-[11px] font-medium text-muted-foreground mb-1">
            {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
              <div key={d} className="py-1">{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-px bg-border rounded-lg overflow-hidden">
            {monthDays.map((day) => {
              const key = fmtKey(day);
              const dayEvents = byDate.get(key) || [];
              const inMonth = isSameMonth(day, anchor);
              return (
                <div
                  key={key}
                  className={cn(
                    "min-h-[92px] p-1.5",
                    inMonth ? "bg-card" : "bg-muted/40",
                  )}
                >
                  <button
                    onClick={() => { setAnchor(day); setView("day"); }}
                    className={cn(
                      "text-xs font-medium inline-flex items-center justify-center mb-1 rounded-full w-5 h-5 hover:bg-muted",
                      isToday(day) && "bg-primary text-primary-foreground hover:bg-primary",
                      !inMonth && "text-muted-foreground/50",
                    )}
                  >
                    {format(day, "d")}
                  </button>
                  <div className="space-y-0.5">
                    {dayEvents.slice(0, 3).map((e) => (
                      <EventChip key={e.id} event={e} compact />
                    ))}
                    {dayEvents.length > 3 && (
                      <Popover>
                        <PopoverTrigger className="text-[10px] text-muted-foreground hover:text-foreground px-1">
                          +{dayEvents.length - 3} more
                        </PopoverTrigger>
                        <PopoverContent className="w-80 p-2" align="start">
                          <p className="text-xs font-semibold text-muted-foreground px-2 pb-1">
                            {format(day, "EEEE d MMMM")}
                          </p>
                          <div className="space-y-0.5 max-h-64 overflow-y-auto">
                            {dayEvents.map((e) => <EventRow key={e.id} event={e} />)}
                          </div>
                        </PopoverContent>
                      </Popover>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Week view */}
      {view === "week" && (
        <div className="grid grid-cols-1 sm:grid-cols-7 gap-px bg-border rounded-lg overflow-hidden">
          {weekDays.map((day) => {
            const key = fmtKey(day);
            const dayEvents = byDate.get(key) || [];
            return (
              <div key={key} className="bg-card min-h-[160px] p-2">
                <button
                  onClick={() => { setAnchor(day); setView("day"); }}
                  className={cn(
                    "w-full text-left mb-1.5 text-xs font-semibold rounded px-1 py-0.5 hover:bg-muted",
                    isToday(day) ? "text-primary" : "text-muted-foreground",
                  )}
                >
                  {format(day, "EEE d")}
                </button>
                <div className="space-y-1">
                  {dayEvents.map((e) => <EventChip key={e.id} event={e} />)}
                  {dayEvents.length === 0 && (
                    <p className="text-[11px] text-muted-foreground/50 px-1">—</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Day view */}
      {view === "day" && (
        <div className="rounded-lg border divide-y divide-border">
          {(byDate.get(fmtKey(anchor)) || []).map((e) => <EventRow key={e.id} event={e} />)}
          {(byDate.get(fmtKey(anchor)) || []).length === 0 && (
            <div className="flex flex-col items-center gap-2 py-10 text-center">
              <CalendarDays className="w-8 h-8 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">Nothing on {format(anchor, "EEEE d MMMM")}</p>
            </div>
          )}
        </div>
      )}

      <div className="mt-3">
        <CalendarLegend />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Compact 14-day version — replaces the old "Coming up" list on Overview.
// A day strip with taxonomy dots plus the next few events; tapping a day
// filters the list to that day.
// ---------------------------------------------------------------------------

export function CompactCalendar({ events, days = 14, maxRows = 8 }) {
  const [selected, setSelected] = useState(null); // yyyy-MM-dd or null = all
  const byDate = useEventsByDate(events);

  const strip = useMemo(() => {
    const today = new Date();
    return Array.from({ length: days }, (_, i) => addDays(today, i));
  }, [days]);

  const startKey = fmtKey(strip[0]);
  const endKey = fmtKey(strip[strip.length - 1]);
  const upcoming = useMemo(
    () =>
      events
        .filter((e) => e.date >= startKey && e.date <= endKey)
        .filter((e) => !selected || e.date === selected)
        .slice(0, maxRows),
    [events, startKey, endKey, selected, maxRows],
  );

  return (
    <div>
      {/* Day strip */}
      <div className="grid grid-cols-7 sm:grid-cols-[repeat(14,minmax(0,1fr))] gap-1 px-4 pb-3">
        {strip.map((day) => {
          const key = fmtKey(day);
          const dayEvents = byDate.get(key) || [];
          const isSel = selected === key;
          return (
            <button
              key={key}
              onClick={() => setSelected(isSel ? null : key)}
              className={cn(
                "flex flex-col items-center gap-0.5 rounded-lg py-1.5 transition-colors border",
                isSel ? "border-primary bg-primary/5" : "border-transparent hover:bg-muted",
              )}
              title={format(day, "EEEE d MMMM")}
            >
              <span className="text-[9px] font-medium text-muted-foreground uppercase">
                {format(day, "EEEEE")}
              </span>
              <span
                className={cn(
                  "text-xs font-semibold w-5 h-5 rounded-full flex items-center justify-center",
                  isToday(day) ? "bg-primary text-primary-foreground" : "text-foreground",
                )}
              >
                {format(day, "d")}
              </span>
              <span className="flex gap-0.5 h-1.5">
                {dayEvents.slice(0, 3).map((e) => (
                  <span
                    key={e.id}
                    className={cn("w-1.5 h-1.5 rounded-full", (KIND_META[e.kind] || KIND_META.task).dot)}
                  />
                ))}
              </span>
            </button>
          );
        })}
      </div>

      {/* Event list */}
      <div className="divide-y divide-border border-t">
        {upcoming.map((e) => (
          <Link key={e.id} to={e.to} className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted transition-colors">
            <span className={cn("w-2 h-2 rounded-full shrink-0", (KIND_META[e.kind] || KIND_META.task).dot)} />
            <span className="flex-1 min-w-0">
              <span className="block text-sm truncate">{e.label}</span>
              {e.sub && <span className="block text-xs text-muted-foreground truncate">{e.sub}</span>}
            </span>
            <span className="text-xs text-muted-foreground tabular-nums shrink-0">
              {format(new Date(e.date + "T00:00:00"), "EEE d MMM")}
            </span>
          </Link>
        ))}
        {upcoming.length === 0 && (
          <p className="px-4 py-6 text-sm text-muted-foreground text-center">
            {selected ? "Nothing on this day." : "Nothing due in the next two weeks."}
          </p>
        )}
      </div>
    </div>
  );
}
