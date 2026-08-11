import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Search, Activity as ActivityIcon } from "lucide-react";
import { useKieData } from "@/lib/useKieData";
import { timeAgo } from "@/lib/kieUtils";
import PageHeader from "@/components/shared/PageHeader";
import EmptyState from "@/components/shared/EmptyState";
import { ListSkeleton } from "@/components/shared/Skeletons";
import PropertyLink from "@/components/shared/PropertyLink";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const EVENT_TYPES = [
  "WhatsApp message", "AI triage", "Maintenance created", "Maintenance status",
  "Contractor assigned", "Compliance reminder", "Bill update", "Rent reminder",
  "Document upload", "Integration sync", "Tenant update", "Property update",
];

const SEV_DOT = {
  critical: "bg-rose-500",
  warning: "bg-amber-500",
  info: "bg-[hsl(var(--sage))]",
};

const PAGE_SIZE = 30;

export default function Activity() {
  const { activity, properties, tenants, loading } = useKieData();
  const [text, setText] = useState("");
  const [type, setType] = useState("all");
  const [propertyId, setPropertyId] = useState("all");
  const [limit, setLimit] = useState(PAGE_SIZE);

  const filtered = useMemo(() => {
    const q = text.trim().toLowerCase();
    return activity.filter((a) => {
      if (type !== "all" && a.event_type !== type) return false;
      if (propertyId !== "all" && a.property_id !== propertyId) return false;
      if (q && !(a.description || "").toLowerCase().includes(q)) return false;
      return true;
    });
  }, [activity, text, type, propertyId]);

  const visible = filtered.slice(0, limit);

  // Group by en-GB day for sticky date headers.
  const groups = useMemo(() => {
    const map = new Map();
    for (const a of visible) {
      const day = a.timestamp
        ? new Date(a.timestamp).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })
        : "Undated";
      if (!map.has(day)) map.set(day, []);
      map.get(day).push(a);
    }
    return [...map.entries()];
  }, [visible]);

  if (loading) {
    return (
      <div className="space-y-5">
        <PageHeader title="Activity" subtitle="Loading timeline…" />
        <ListSkeleton rows={8} />
      </div>
    );
  }

  return (
    <div className="space-y-5 animate-fade-in">
      <PageHeader
        title="Activity"
        subtitle={`${activity.length} events — the audit trail behind every record`}
      />

      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            value={text}
            onChange={(e) => { setText(e.target.value); setLimit(PAGE_SIZE); }}
            placeholder="Search events…"
            className="w-full pl-9 pr-3 py-2 bg-muted rounded-lg text-sm border border-transparent focus:outline-none focus:bg-card focus:border-border transition-all"
          />
        </div>
        <div className="flex gap-2">
          <Select value={type} onValueChange={(v) => { setType(v); setLimit(PAGE_SIZE); }}>
            <SelectTrigger className="w-full sm:w-52 h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All event types</SelectItem>
              {EVENT_TYPES.map((t) => (
                <SelectItem key={t} value={t}>{t}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={propertyId} onValueChange={(v) => { setPropertyId(v); setLimit(PAGE_SIZE); }}>
            <SelectTrigger className="w-full sm:w-44 h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All properties</SelectItem>
              {properties.map((p) => (
                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {visible.length === 0 ? (
        <div className="rounded-xl border bg-card">
          <EmptyState
            icon={ActivityIcon}
            title={activity.length === 0 ? "No activity yet" : "Nothing matches these filters"}
            description={activity.length === 0 ? "Every sync, message, ticket and payment writes an event here." : undefined}
            action={
              activity.length > 0 && (
                <button
                  onClick={() => { setText(""); setType("all"); setPropertyId("all"); }}
                  className="text-sm font-medium text-[hsl(var(--sage))] hover:underline"
                >
                  Clear filters
                </button>
              )
            }
          />
        </div>
      ) : (
        <div className="rounded-xl border bg-card overflow-hidden">
          {groups.map(([day, events]) => (
            <div key={day}>
              <p className="sticky top-14 z-10 px-4 py-1.5 text-[11px] font-semibold text-muted-foreground bg-muted/80 backdrop-blur-sm border-y border-border/60">
                {day}
              </p>
              <div className="divide-y divide-border/60">
                {events.map((a) => {
                  const property = properties.find((p) => p.id === a.property_id);
                  const tenant = tenants.find((t) => t.id === a.tenant_id);
                  return (
                    <div key={a.id} className="flex items-start gap-3 px-4 py-2.5">
                      <span className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${SEV_DOT[a.severity] || SEV_DOT.info}`} />
                      <span className="flex-1 min-w-0">
                        <span className="block text-sm">{a.description}</span>
                        <span className="block text-xs text-muted-foreground mt-0.5">
                          {a.event_type}
                          {property && (
                            <>
                              {" · "}
                              <PropertyLink property={property} />
                            </>
                          )}
                          {tenant && (
                            <>
                              {" · "}
                              <Link to={`/tenants/${tenant.id}`} className="hover:underline">{tenant.name}</Link>
                            </>
                          )}
                        </span>
                      </span>
                      <span className="text-[11px] text-muted-foreground shrink-0 tabular-nums">{timeAgo(a.timestamp)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
          {filtered.length > limit && (
            <button
              onClick={() => setLimit((l) => l + PAGE_SIZE)}
              className="w-full py-2.5 text-sm font-medium text-[hsl(var(--sage))] hover:bg-muted transition-colors border-t"
            >
              Load {Math.min(PAGE_SIZE, filtered.length - limit)} more
            </button>
          )}
        </div>
      )}
    </div>
  );
}