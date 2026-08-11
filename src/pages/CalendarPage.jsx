import React, { useMemo, useState } from "react";
import { format } from "date-fns";
import { Filter, X } from "lucide-react";
import { useKieData } from "@/lib/useKieData";
import { useDateRange } from "@/lib/DateRangeContext";
import { buildPropertyEvents } from "@/lib/calendarEvents";
import PageHeader from "@/components/shared/PageHeader";
import DateRangePicker from "@/components/shared/DateRangePicker";
import KieCalendar from "@/components/shared/KieCalendar";
import { PageSkeleton } from "@/components/shared/Skeletons";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

// Portfolio calendar: every Task, rent/bill due date, compliance expiry,
// tenancy move and short-let check-in/out in one place, coloured by the
// kind-of-thing taxonomy. The global date-range picker acts as an optional
// filter (off by default so future months stay visible); the property select
// narrows to one property.
export default function CalendarPage() {
  const data = useKieData();
  const {
    properties, bills, tickets, compliance, equipment, tenancies, tenants,
    shortLets, tasks, loading,
  } = data;
  const { range, label } = useDateRange();
  const [propertyId, setPropertyId] = useState("all");
  const [applyRange, setApplyRange] = useState(false);

  const events = useMemo(() => {
    let evts = buildPropertyEvents({
      propertyId: propertyId === "all" ? null : propertyId,
      bills, tickets, compliance, equipment, tenancies, tenants, properties, shortLets, tasks,
    });
    if (applyRange && range?.start && range?.end) {
      const s = format(range.start, "yyyy-MM-dd");
      const e = format(range.end, "yyyy-MM-dd");
      evts = evts.filter((ev) => ev.date >= s && ev.date <= e);
    }
    return evts;
  }, [propertyId, applyRange, range, bills, tickets, compliance, equipment, tenancies, tenants, properties, shortLets, tasks]);

  if (loading) return <PageSkeleton />;

  return (
    <div className="space-y-4 animate-fade-in">
      <PageHeader
        title="Calendar"
        subtitle="Tasks, rent, bills, compliance and short-let changeovers — click anything to open the record"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Select value={propertyId} onValueChange={setPropertyId}>
              <SelectTrigger className="h-9 text-sm bg-card w-[170px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All properties</SelectItem>
                {properties.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <DateRangePicker />
            <button
              onClick={() => setApplyRange((v) => !v)}
              className={cn(
                "inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border text-sm font-medium transition-colors",
                applyRange
                  ? "bg-[hsl(var(--sage-light))] border-[hsl(var(--sage))] text-[hsl(var(--sage))]"
                  : "bg-card text-muted-foreground hover:bg-muted",
              )}
              title={applyRange ? "Showing only events in the picked range" : "Filter the calendar to the picked range"}
            >
              {applyRange ? <X className="w-3.5 h-3.5" /> : <Filter className="w-3.5 h-3.5" />}
              {applyRange ? `Filtered: ${label}` : "Filter to range"}
            </button>
          </div>
        }
      />
      <KieCalendar events={events} />
    </div>
  );
}
