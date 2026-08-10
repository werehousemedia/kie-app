import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, addMonths,
  format, isSameMonth, isToday,
} from "date-fns";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { KIND_META } from "@/lib/calendarEvents";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

// Month-grid calendar over derived events. Every event row links to its
// underlying record; "Add" creates real records via the callbacks provided.
export default function PropertyCalendar({ events, onAdd }) {
  const [month, setMonth] = useState(() => startOfMonth(new Date()));

  const byDate = useMemo(() => {
    const map = new Map();
    for (const e of events) {
      if (!map.has(e.date)) map.set(e.date, []);
      map.get(e.date).push(e);
    }
    return map;
  }, [events]);

  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(month), { weekStartsOn: 1 });
    const end = endOfWeek(endOfMonth(month), { weekStartsOn: 1 });
    const out = [];
    for (let d = start; d <= end; d = addDays(d, 1)) out.push(d);
    return out;
  }, [month]);

  const legendKinds = ["rent", "bill", "maintenance", "service", "compliance", "tenancy"];

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-5">
      <div className="flex items-center justify-between mb-4 gap-2">
        <div className="flex items-center gap-1">
          <button onClick={() => setMonth((m) => addMonths(m, -1))} className="p-1.5 rounded-lg hover:bg-slate-100" aria-label="Previous month"><ChevronLeft className="w-4 h-4 text-slate-500" /></button>
          <h3 className="text-sm font-semibold text-slate-900 w-36 text-center">{format(month, "MMMM yyyy")}</h3>
          <button onClick={() => setMonth((m) => addMonths(m, 1))} className="p-1.5 rounded-lg hover:bg-slate-100" aria-label="Next month"><ChevronRight className="w-4 h-4 text-slate-500" /></button>
          <button onClick={() => setMonth(startOfMonth(new Date()))} className="ml-1 text-xs px-2 py-1 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50">Today</button>
        </div>
        {onAdd && (
          <DropdownMenu>
            <DropdownMenuTrigger className="flex items-center gap-1.5 px-3 py-1.5 bg-[hsl(var(--navy))] text-white rounded-lg text-xs font-medium hover:bg-[hsl(var(--navy-light))]">
              <Plus className="w-3.5 h-3.5" /> Add event
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onAdd("bill")}>Bill / rent charge</DropdownMenuItem>
              <DropdownMenuItem onClick={() => onAdd("maintenance")}>Maintenance job</DropdownMenuItem>
              <DropdownMenuItem onClick={() => onAdd("compliance")}>Compliance record</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      <div className="grid grid-cols-7 text-center text-[11px] font-medium text-slate-400 mb-1">
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => <div key={d} className="py-1">{d}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-px bg-slate-100 rounded-lg overflow-hidden">
        {days.map((day) => {
          const key = format(day, "yyyy-MM-dd");
          const dayEvents = byDate.get(key) || [];
          const inMonth = isSameMonth(day, month);
          return (
            <Popover key={key}>
              <PopoverTrigger asChild>
                <button
                  className={`min-h-[64px] p-1.5 text-left align-top transition-colors ${inMonth ? "bg-white hover:bg-slate-50" : "bg-slate-50/60 text-slate-300"} ${dayEvents.length > 0 ? "cursor-pointer" : "cursor-default"}`}
                  disabled={dayEvents.length === 0}
                >
                  <span className={`text-xs font-medium inline-flex items-center justify-center ${isToday(day) ? "bg-[hsl(var(--navy))] text-white rounded-full w-5 h-5" : inMonth ? "text-slate-600" : ""}`}>
                    {format(day, "d")}
                  </span>
                  <div className="flex flex-wrap gap-0.5 mt-1">
                    {dayEvents.slice(0, 4).map((e) => (
                      <span key={e.id} className={`w-1.5 h-1.5 rounded-full ${KIND_META[e.kind]?.dot || "bg-slate-400"}`} title={e.label} />
                    ))}
                    {dayEvents.length > 4 && <span className="text-[9px] text-slate-400 leading-none">+{dayEvents.length - 4}</span>}
                  </div>
                </button>
              </PopoverTrigger>
              {dayEvents.length > 0 && (
                <PopoverContent className="w-72 p-2" align="start">
                  <p className="text-xs font-semibold text-slate-500 px-2 pb-1">{format(day, "EEEE d MMMM")}</p>
                  <div className="space-y-0.5 max-h-56 overflow-y-auto">
                    {dayEvents.map((e) => (
                      <Link key={e.id} to={e.to} className="flex items-start gap-2 p-2 rounded-lg hover:bg-slate-50 group">
                        <span className={`w-2 h-2 rounded-full mt-1 shrink-0 ${KIND_META[e.kind]?.dot || "bg-slate-400"}`} />
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-slate-800 group-hover:underline decoration-[hsl(var(--sage))] underline-offset-2">{e.label}</p>
                          {e.sub && <p className="text-[11px] text-slate-500">{e.sub}</p>}
                        </div>
                      </Link>
                    ))}
                  </div>
                </PopoverContent>
              )}
            </Popover>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-3 mt-3">
        {legendKinds.map((k) => (
          <span key={k} className="flex items-center gap-1.5 text-[11px] text-slate-500">
            <span className={`w-2 h-2 rounded-full ${KIND_META[k].dot}`} /> {KIND_META[k].label}
          </span>
        ))}
      </div>
    </div>
  );
}
