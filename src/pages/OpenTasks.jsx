import React, { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import {
  ClipboardList, HardHat, ChevronRight, RefreshCw, CheckCircle2,
} from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useKieData } from "@/lib/useKieData";
import { formatDate, daysUntil, urgencyColor, logActivity } from "@/lib/kieUtils";
import { TASK_STATUSES, TASK_CATEGORIES, runTaskEngine } from "@/lib/taskUtils";
import { kindMeta, taskKind } from "@/lib/kindTaxonomy";
import PageHeader from "@/components/shared/PageHeader";
import EmptyState from "@/components/shared/EmptyState";
import BookContractorDialog from "@/components/shared/BookContractorDialog";
import { ListSkeleton } from "@/components/shared/Skeletons";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

// Status pill: status colour channel (open amber-ish neutral, in progress blue,
// done green) — kind colour stays on the left border, so the two channels
// never collide.
const statusPill = (s) =>
  s === "Done"
    ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"
    : s === "In progress"
      ? "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300"
      : "bg-slate-100 text-slate-600 dark:bg-slate-500/15 dark:text-slate-300";

function DueCell({ task }) {
  if (!task.due_date) return <span className="text-muted-foreground">—</span>;
  const d = daysUntil(task.due_date);
  const overdue = d != null && d < 0 && task.status !== "Done";
  return (
    <span className={cn("tabular-nums", overdue && "text-rose-600 dark:text-rose-400 font-semibold")}>
      {formatDate(task.due_date)}
      {overdue && <span className="block text-[11px] font-semibold">{Math.abs(d)}d overdue</span>}
    </span>
  );
}

const URGENCIES = ["low", "medium", "high", "emergency"];
const URGENCY_RANK = { emergency: 0, high: 1, medium: 2, low: 3 };

export default function OpenTasks() {
  const { tasks, properties, contractors, loading, reload } = useKieData();
  const [params] = useSearchParams();
  const [status, setStatus] = useState(params.get("status") || "open");
  const [urgency, setUrgency] = useState(params.get("urgency") || "all");
  const [category, setCategory] = useState(params.get("category") || "all");
  const [propertyId, setPropertyId] = useState(params.get("property") || "all");
  const [contractorId, setContractorId] = useState("all");
  const [groupBy, setGroupBy] = useState("none");
  const [bookingTask, setBookingTask] = useState(null);
  const [sweeping, setSweeping] = useState(false);

  const propName = (id) => properties.find((p) => p.id === id)?.name || "—";
  const contractorName = (id) => contractors.find((c) => c.id === id)?.name;

  const visible = useMemo(() => {
    let list = tasks;
    if (status === "open") list = list.filter((t) => t.status !== "Done");
    else if (status !== "all") list = list.filter((t) => t.status === status);
    if (urgency !== "all") list = list.filter((t) => t.urgency === urgency);
    if (category !== "all") list = list.filter((t) => t.category === category);
    if (propertyId !== "all") list = list.filter((t) => t.property_id === propertyId);
    if (contractorId !== "all") {
      list = contractorId === "unassigned"
        ? list.filter((t) => !t.contractor_id)
        : list.filter((t) => t.contractor_id === contractorId);
    }
    // Most urgent first, then earliest due.
    return [...list].sort((a, b) => {
      const u = (URGENCY_RANK[a.urgency] ?? 4) - (URGENCY_RANK[b.urgency] ?? 4);
      if (u !== 0) return u;
      return String(a.due_date || "9999").localeCompare(String(b.due_date || "9999"));
    });
  }, [tasks, status, urgency, category, propertyId, contractorId]);

  const groups = useMemo(() => {
    if (groupBy === "none") return [{ key: "all", label: null, rows: visible }];
    const map = new Map();
    for (const t of visible) {
      const key = groupBy === "property" ? (t.property_id || "none") : (t.contractor_id || "none");
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(t);
    }
    return [...map.entries()].map(([key, rows]) => ({
      key,
      label: groupBy === "property"
        ? (key === "none" ? "No property" : propName(key))
        : (key === "none" ? "Unassigned" : contractorName(key) || "Unknown contractor"),
      rows,
    }));
  }, [visible, groupBy, properties, contractors]);

  const setTaskStatus = async (task, newStatus) => {
    try {
      await base44.entities.Task.update(task.id, {
        status: newStatus,
        completed_at: newStatus === "Done" ? new Date().toISOString() : null,
      });
      await logActivity(base44, {
        property_id: task.property_id,
        event_type: "Task update",
        description: `Task ${newStatus === "Done" ? "completed" : `moved to ${newStatus}`}: ${task.title}`,
        related_id: task.id,
      });
      reload();
    } catch (e) {
      toast.error(`Couldn't update: ${e?.message || "unknown error"}`);
    }
  };

  const sweep = async () => {
    setSweeping(true);
    await runTaskEngine();
    setSweeping(false);
  };

  if (loading) return <ListSkeleton />;

  const filterSelect = (value, onChange, items, allLabel, width = "w-[130px]") => (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className={cn("h-8 text-xs bg-card", width)}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">{allLabel}</SelectItem>
        {items}
      </SelectContent>
    </Select>
  );

  return (
    <div className="space-y-4 animate-fade-in">
      <PageHeader
        title="Open Tasks"
        subtitle="Everything that needs doing, in one queue — auto-created from maintenance, compliance, rent and messages"
        actions={
          <button
            onClick={sweep}
            disabled={sweeping}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 border bg-card hover:bg-muted rounded-lg text-sm font-medium transition-colors disabled:opacity-60"
          >
            <RefreshCw className={cn("w-4 h-4", sweeping && "animate-spin")} />
            {sweeping ? "Checking…" : "Check for new tasks"}
          </button>
        }
      />

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2">
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="h-8 text-xs bg-card w-[130px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="open">All open</SelectItem>
            {TASK_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            <SelectItem value="all">Everything</SelectItem>
          </SelectContent>
        </Select>
        {filterSelect(urgency, setUrgency,
          URGENCIES.map((u) => <SelectItem key={u} value={u} className="capitalize">{u}</SelectItem>),
          "Any urgency")}
        {filterSelect(category, setCategory,
          TASK_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>),
          "Any category")}
        {filterSelect(propertyId, setPropertyId,
          properties.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>),
          "Any property", "w-[150px]")}
        <Select value={contractorId} onValueChange={setContractorId}>
          <SelectTrigger className="h-8 text-xs bg-card w-[150px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Any contractor</SelectItem>
            <SelectItem value="unassigned">Unassigned</SelectItem>
            {contractors.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <div className="ml-auto flex items-center gap-1.5">
          <span className="text-xs text-muted-foreground">Group by</span>
          <Select value={groupBy} onValueChange={setGroupBy}>
            <SelectTrigger className="h-8 text-xs bg-card w-[120px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">None</SelectItem>
              <SelectItem value="property">Property</SelectItem>
              <SelectItem value="contractor">Contractor</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {visible.length === 0 ? (
        <div className="rounded-xl border bg-card">
          <EmptyState
            icon={status === "open" ? CheckCircle2 : ClipboardList}
            title={status === "open" ? "No open tasks" : "Nothing matches these filters"}
            description={status === "open"
              ? "Everything's handled. New tasks appear here automatically when maintenance is reported, compliance falls due, rent goes overdue or a message needs a follow-up."
              : "Try widening the filters above."}
          />
        </div>
      ) : (
        <div className="rounded-xl border bg-card overflow-x-auto">
          <table className="w-full text-sm min-w-[820px]">
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th className="font-medium px-4 py-2.5">Task</th>
                <th className="font-medium px-3 py-2.5">Category</th>
                <th className="font-medium px-3 py-2.5">Urgency</th>
                <th className="font-medium px-3 py-2.5">Due</th>
                <th className="font-medium px-3 py-2.5">Status</th>
                <th className="font-medium px-3 py-2.5">Contractor</th>
                <th className="px-3 py-2.5" />
              </tr>
            </thead>
            {groups.map((g) => (
              <tbody key={g.key}>
                {g.label && (
                  <tr className="bg-muted/50">
                    <td colSpan={7} className="px-4 py-1.5 text-xs font-semibold text-muted-foreground">
                      {g.label} <span className="font-normal">· {g.rows.length}</span>
                    </td>
                  </tr>
                )}
                {g.rows.map((t) => {
                  const meta = kindMeta(taskKind(t));
                  return (
                    <tr key={t.id} className="border-b last:border-b-0 hover:bg-muted/40 transition-colors">
                      <td className={cn("px-4 py-2.5 border-l-[3px]", meta.border)}>
                        <p className="font-medium text-foreground leading-snug line-clamp-2 max-w-[320px]">{t.title}</p>
                        <Link to={`/properties/${t.property_id}`} className="text-xs text-muted-foreground hover:underline">
                          {propName(t.property_id)}
                        </Link>
                      </td>
                      <td className="px-3 py-2.5">
                        <span className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium", meta.chip)}>
                          {t.category}
                        </span>
                      </td>
                      <td className="px-3 py-2.5">
                        <span className={cn("inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium capitalize", urgencyColor(t.urgency))}>
                          {t.urgency}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-xs"><DueCell task={t} /></td>
                      <td className="px-3 py-2.5">
                        <Select value={t.status} onValueChange={(v) => setTaskStatus(t, v)}>
                          <SelectTrigger className={cn("h-7 w-[120px] border-0 text-[11px] font-medium rounded-full px-2.5", statusPill(t.status))}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {TASK_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="px-3 py-2.5 text-xs">
                        {t.contractor_id ? (
                          <span className="inline-flex items-center gap-1.5">
                            <HardHat className="w-3.5 h-3.5 text-orange-500" />
                            {contractorName(t.contractor_id) || "—"}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        {t.status !== "Done" && (
                          <button
                            onClick={() => setBookingTask(t)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border bg-card hover:bg-muted text-xs font-medium transition-colors whitespace-nowrap"
                          >
                            <HardHat className="w-3.5 h-3.5" />
                            {t.contractor_id ? "Rebook" : "Book contractor"}
                            <ChevronRight className="w-3 h-3 text-muted-foreground" />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            ))}
          </table>
        </div>
      )}

      <BookContractorDialog
        task={bookingTask}
        properties={properties}
        contractors={contractors}
        onClose={() => setBookingTask(null)}
        onBooked={() => { setBookingTask(null); reload(); }}
      />
    </div>
  );
}
