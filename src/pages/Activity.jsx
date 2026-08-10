import React, { useState } from "react";
import { useKieData } from "@/lib/useKieData";
import { formatDateTime } from "@/lib/kieUtils";
import { Search, Activity as ActivityIcon } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const eventTypeIcons = {
  "WhatsApp message": "💬",
  "AI triage": "✨",
  "Maintenance created": "🔧",
  "Maintenance status": "🔄",
  "Contractor assigned": "👷",
  "Compliance reminder": "📋",
  "Bill update": "💰",
  "Rent reminder": "🔔",
  "Document upload": "📄",
  "Integration sync": "🔗",
  "Tenant update": "👤",
  "Property update": "🏠",
};

export default function Activity() {
  const { activity, properties, tenants, loading } = useKieData();
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [filterProperty, setFilterProperty] = useState("all");

  const filtered = activity.filter((a) => {
    const matchSearch = !search || a.description?.toLowerCase().includes(search.toLowerCase());
    const matchType = filterType === "all" || a.event_type === filterType;
    const matchProp = filterProperty === "all" || a.property_id === filterProperty;
    return matchSearch && matchType && matchProp;
  });

  const grouped = filtered.reduce((acc, a) => {
    const date = new Date(a.timestamp).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
    if (!acc[date]) acc[date] = [];
    acc[date].push(a);
    return acc;
  }, {});

  if (loading) return <div className="flex items-center justify-center h-96"><div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-5 animate-fade-in">
      <div><h1 className="text-2xl font-bold text-slate-900">Activity Timeline</h1><p className="text-sm text-slate-500 mt-0.5">{activity.length} events logged · cross-referenced audit trail</p></div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search events..." className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--sage))]/30" />
        </div>
        <Select value={filterType} onValueChange={setFilterType}><SelectTrigger className="w-48 bg-white"><SelectValue placeholder="Event type" /></SelectTrigger><SelectContent><SelectItem value="all">All types</SelectItem>{Object.keys(eventTypeIcons).map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent></Select>
        <Select value={filterProperty} onValueChange={setFilterProperty}><SelectTrigger className="w-48 bg-white"><SelectValue placeholder="Property" /></SelectTrigger><SelectContent><SelectItem value="all">All properties</SelectItem>{properties.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent></Select>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-6">
        {Object.entries(grouped).length === 0 ? (
          <div className="text-center py-12"><ActivityIcon className="w-8 h-8 text-slate-300 mx-auto mb-2" /><p className="text-sm text-slate-400">No events found</p></div>
        ) : (
          Object.entries(grouped).map(([date, events]) => (
            <div key={date} className="mb-6 last:mb-0">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3 sticky top-0 bg-white py-1">{date}</p>
              <div className="space-y-3">
                {events.map((a) => {
                  const prop = properties.find((p) => p.id === a.property_id);
                  const tenant = tenants.find((t) => t.id === a.tenant_id);
                  return (
                    <div key={a.id} className="flex items-start gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-sm ${a.severity === "critical" ? "bg-rose-50" : a.severity === "warning" ? "bg-amber-50" : "bg-slate-100"}`}>
                        {eventTypeIcons[a.event_type] || "•"}
                      </div>
                      <div className="flex-1 min-w-0 pb-3 border-b border-slate-50 last:border-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-sm font-medium text-slate-800">{a.event_type}</span>
                          {a.severity === "critical" && <span className="text-[10px] bg-rose-100 text-rose-600 px-1.5 py-0.5 rounded-full">critical</span>}
                          {a.severity === "warning" && <span className="text-[10px] bg-amber-100 text-amber-600 px-1.5 py-0.5 rounded-full">warning</span>}
                          <span className="text-xs text-slate-400 ml-auto">{formatDateTime(a.timestamp)}</span>
                        </div>
                        <p className="text-sm text-slate-600">{a.description}</p>
                        {(prop || tenant) && <p className="text-xs text-slate-400 mt-0.5">{prop?.name}{prop && tenant ? " · " : ""}{tenant?.name}</p>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}