import React, { useState, useEffect } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { useKieData } from "@/lib/useKieData";
import PageHeader from "@/components/shared/PageHeader";
import EmptyState from "@/components/shared/EmptyState";
import PropertyLink from "@/components/shared/PropertyLink";
import { CardGridSkeleton } from "@/components/shared/Skeletons";
import { base44 } from "@/api/base44Client";
import { formatGBP, formatDateTime, urgencyColor, statusColor, matchContractors, logActivity } from "@/lib/kieUtils";
import { Search, Plus, X, Check, ChevronRight, CheckCircle2, User, Wrench, Ban, Pencil, MessageSquare, Phone } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

const statusFlow = ["New", "AI triage", "Awaiting landlord approval", "Contractor requested", "Visit booked", "Work in progress", "Awaiting sign-off", "Complete"];

const BTN_PRIMARY = "inline-flex items-center gap-1.5 px-3.5 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 active:scale-[0.98] transition-all shadow-sm disabled:opacity-50 disabled:pointer-events-none";
const BTN_SECONDARY = "inline-flex items-center gap-1.5 px-3.5 py-2 border bg-card hover:bg-muted text-foreground rounded-lg text-sm font-medium active:scale-[0.98] transition-all shadow-sm disabled:opacity-50 disabled:pointer-events-none";
const BTN_DANGER = "inline-flex items-center gap-1.5 px-3.5 py-2 bg-rose-600 text-white hover:bg-rose-700 rounded-lg text-sm font-medium active:scale-[0.98] transition-all shadow-sm disabled:opacity-50 disabled:pointer-events-none";
const CHIP = "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium";

// Friendly wording for automated tenant updates (system-message convention).
const FRIENDLY_STATUS = {
  "New": "we've logged your repair request",
  "AI triage": "your request is being assessed",
  "Awaiting landlord approval": "your request is awaiting landlord approval",
  "Contractor requested": "we're arranging a contractor",
  "Visit booked": "a contractor visit has been booked",
  "Work in progress": "work is now in progress",
  "Awaiting sign-off": "the work is finished and awaiting final checks",
  "Complete": "the job is complete",
  "Cancelled": "this job has been cancelled",
};

// datetime-local input value from an ISO string, in local time.
const toLocalInput = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};

export default function Maintenance() {
  const { tickets, properties, tenants, contractors, conversations, triages, reload, loading } = useKieData();
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState(() => {
    const s = searchParams.get("status");
    return s === "open" || s === "Cancelled" || statusFlow.includes(s) ? s : "all";
  });
  const [filterUrgency, setFilterUrgency] = useState(() => {
    const u = searchParams.get("urgency");
    return ["low", "medium", "high", "emergency"].includes(u) ? u : "all";
  });
  const [addOpen, setAddOpen] = useState(false);

  useEffect(() => {
    if (searchParams.get("new") === "1") {
      setAddOpen(true);
      setSearchParams((p) => { p.delete("new"); return p; }, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ?ticket=<id> deep link is the single source of truth for the detail sheet.
  const ticketParam = searchParams.get("ticket");
  const selected = ticketParam ? tickets.find((t) => t.id === ticketParam) : null;
  const openTicket = (id) => setSearchParams((p) => { p.set("ticket", id); return p; }, { replace: true });
  const closeTicket = () => setSearchParams((p) => { p.delete("ticket"); return p; }, { replace: true });

  const changeStatus = (v) => {
    setFilterStatus(v);
    setSearchParams((p) => { if (v === "all") p.delete("status"); else p.set("status", v); return p; }, { replace: true });
  };
  const changeUrgency = (v) => {
    setFilterUrgency(v);
    setSearchParams((p) => { if (v === "all") p.delete("urgency"); else p.set("urgency", v); return p; }, { replace: true });
  };
  const clearFilters = () => {
    setSearch(""); setFilterStatus("all"); setFilterUrgency("all");
    setSearchParams((p) => { p.delete("status"); p.delete("urgency"); return p; }, { replace: true });
  };

  const q = search.trim().toLowerCase();
  const filtered = tickets.filter((t) => {
    const prop = properties.find((p) => p.id === t.property_id);
    const tenant = tenants.find((tn) => tn.id === t.tenant_id);
    const contractor = contractors.find((c) => c.id === t.contractor_id);
    const matchSearch = !q
      || t.description?.toLowerCase().includes(q)
      || prop?.name?.toLowerCase().includes(q)
      || tenant?.name?.toLowerCase().includes(q)
      || contractor?.name?.toLowerCase().includes(q);
    const matchStatus = filterStatus === "all" || (filterStatus === "open" ? (t.status !== "Complete" && t.status !== "Cancelled") : t.status === filterStatus);
    const matchUrgency = filterUrgency === "all" || t.urgency === filterUrgency;
    return matchSearch && matchStatus && matchUrgency;
  });

  const openCount = tickets.filter((t) => t.status !== "Complete" && t.status !== "Cancelled").length;
  const hasFilters = q || filterStatus !== "all" || filterUrgency !== "all";

  if (loading) {
    return (
      <div className="space-y-5 animate-fade-in">
        <PageHeader title="Maintenance" subtitle="Loading tickets…" />
        <CardGridSkeleton cards={4} />
      </div>
    );
  }

  return (
    <div className="space-y-5 animate-fade-in">
      <PageHeader
        title="Maintenance"
        subtitle={`${tickets.length} tickets · ${openCount} open`}
        actions={
          <button onClick={() => setAddOpen(true)} className={BTN_PRIMARY}>
            <Plus className="w-4 h-4" /> Create job
          </button>
        }
      />

      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1 sm:max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search tickets, tenants, contractors…"
            aria-label="Search tickets"
            className="w-full pl-9 pr-3 py-2 bg-card border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[hsl(var(--sage))]/40"
          />
        </div>
        <div className="grid grid-cols-2 gap-2 sm:flex">
          <Select value={filterStatus} onValueChange={changeStatus}>
            <SelectTrigger className="w-full sm:w-48 bg-card" aria-label="Filter by status"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="open">All open</SelectItem>
              {statusFlow.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              <SelectItem value="Cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterUrgency} onValueChange={changeUrgency}>
            <SelectTrigger className="w-full sm:w-36 bg-card" aria-label="Filter by urgency"><SelectValue placeholder="Urgency" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All urgency</SelectItem>
              {["low", "medium", "high", "emergency"].map((s) => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {tickets.length === 0 ? (
        <div className="rounded-xl border bg-card">
          <EmptyState
            icon={Wrench}
            title="No maintenance jobs yet"
            description="Log your first repair and track it from report to sign-off — tenants get automatic updates along the way."
            action={<button onClick={() => setAddOpen(true)} className={BTN_PRIMARY}><Plus className="w-4 h-4" /> Create job</button>}
          />
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border bg-card">
          <EmptyState
            icon={Search}
            title="Nothing matches"
            description="No tickets match the current search or filters."
            action={hasFilters ? <button onClick={clearFilters} className={BTN_SECONDARY}>Clear filters</button> : null}
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filtered.map((t) => {
            const prop = properties.find((p) => p.id === t.property_id);
            const tenant = tenants.find((tn) => tn.id === t.tenant_id);
            const contractor = contractors.find((c) => c.id === t.contractor_id);
            return (
              <div
                key={t.id}
                role="button"
                tabIndex={0}
                onClick={() => openTicket(t.id)}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openTicket(t.id); } }}
                className="rounded-xl border bg-card p-4 text-left cursor-pointer hover:border-[hsl(var(--sage))] hover:shadow-md transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--sage))]"
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className={`${CHIP} border capitalize ${urgencyColor(t.urgency)}`}>{t.urgency}</span>
                    <span className={`${CHIP} bg-muted text-muted-foreground capitalize`}>{t.issue_type}</span>
                  </div>
                  <span className={`${CHIP} shrink-0 ${statusColor(t.status)}`}>{t.status}</span>
                </div>
                <p className="text-sm font-medium text-foreground mb-1 line-clamp-2">{t.description}</p>
                <p className="text-xs text-muted-foreground">
                  <PropertyLink property={prop} />
                  {tenant && <> · <Link to={`/tenants/${tenant.id}`} onClick={(e) => e.stopPropagation()} className="hover:underline decoration-[hsl(var(--sage))] underline-offset-2">{tenant.name}</Link></>}
                </p>
                <div className="flex items-center justify-between mt-3 pt-3 border-t">
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    {contractor && <span className="flex items-center gap-1"><User className="w-3 h-3" />{contractor.name}</span>}
                    {t.cost_estimate > 0 && <span className="tabular-nums">Est: {formatGBP(t.cost_estimate)}</span>}
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {selected && (
        <TicketSheet
          ticket={selected}
          onClose={closeTicket}
          data={{ properties, tenants, contractors, conversations, triages, reload }}
        />
      )}
      <AddTicketModal open={addOpen} onClose={() => setAddOpen(false)} onCreated={reload} properties={properties} tenants={tenants} />
    </div>
  );
}

function StatusPipeline({ status }) {
  if (status === "Cancelled") {
    return (
      <div className="flex items-center gap-2.5 rounded-xl border border-rose-200 dark:border-rose-500/30 bg-rose-50 dark:bg-rose-500/10 px-4 py-3">
        <Ban className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
        <div>
          <p className="text-sm font-medium text-rose-700 dark:text-rose-300">Job cancelled</p>
          <p className="text-xs text-rose-600/80 dark:text-rose-300/70">This ticket was terminated before completion.</p>
        </div>
      </div>
    );
  }
  const idx = statusFlow.indexOf(status);
  return (
    <div className="overflow-x-auto no-scrollbar">
      <div className="min-w-[360px]">
        <div className="flex items-center gap-1">
          {statusFlow.map((s, i) => (
            <div
              key={s}
              title={s}
              className={`h-1.5 flex-1 rounded-full ${
                i < idx ? "bg-[hsl(var(--sage))]"
                : i === idx ? `bg-[hsl(var(--sage))] ${status === "Complete" ? "" : "animate-pulse"}`
                : "bg-muted"
              }`}
            />
          ))}
        </div>
        <div className="flex gap-1 mt-1.5">
          {statusFlow.map((s, i) => (
            <div key={s} className={`flex-1 flex ${i <= 1 ? "justify-start" : i >= statusFlow.length - 2 ? "justify-end" : "justify-center"}`}>
              {i === idx && (
                <span className="text-[11px] font-medium text-foreground whitespace-nowrap">
                  {s} · step {idx + 1} of {statusFlow.length}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function InlineRow({ label, value, editing, busy, onStart, onCancel, onSave, children }) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3 min-h-[56px]">
      <div className="flex-1 min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        {editing ? (
          <div className="mt-1 flex items-center gap-1.5">
            {children}
            <button onClick={onSave} disabled={busy} aria-label={`Save ${label}`} className="p-1.5 rounded-lg bg-primary text-primary-foreground hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-50"><Check className="w-3.5 h-3.5" /></button>
            <button onClick={onCancel} disabled={busy} aria-label="Cancel edit" className="p-1.5 rounded-lg border bg-card hover:bg-muted active:scale-[0.98] transition-all disabled:opacity-50"><X className="w-3.5 h-3.5" /></button>
          </div>
        ) : (
          <p className="text-sm font-semibold tabular-nums text-foreground">{value}</p>
        )}
      </div>
      {!editing && (
        <button onClick={onStart} aria-label={`Edit ${label}`} className="p-2 rounded-lg hover:bg-muted text-muted-foreground transition-colors">
          <Pencil className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}

function TicketSheet({ ticket, onClose, data }) {
  const { properties, tenants, contractors, conversations, triages, reload } = data;
  const prop = properties.find((p) => p.id === ticket.property_id);
  const tenant = tenants.find((t) => t.id === ticket.tenant_id);
  const contractor = contractors.find((c) => c.id === ticket.contractor_id);
  const conv = conversations.find((c) => c.id === ticket.conversation_id);
  const triage = triages.find((t) => t.id === ticket.ai_triage_id);
  const matched = matchContractors(contractors, ticket.issue_type, prop?.postcode);

  const [busy, setBusy] = useState(null);
  const [editField, setEditField] = useState(null);
  const [draft, setDraft] = useState("");
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");

  const terminal = ticket.status === "Complete" || ticket.status === "Cancelled";
  const needsApproval = ticket.status === "Awaiting landlord approval" && !ticket.landlord_approved;
  const canAdvance = !terminal && !needsApproval;

  // Automated tenant update (system-message convention). Silent no-op when the
  // tenant has no conversation. Never touches unread_count.
  const notifyTenant = async (newStatus) => {
    try {
      if (!ticket.tenant_id) return;
      const c = conversations.find((cv) => cv.tenant_id === ticket.tenant_id);
      if (!c) return;
      const content = `Update on your repair: ${FRIENDLY_STATUS[newStatus] || `status is now ${newStatus}`}`;
      const now = new Date().toISOString();
      await base44.entities.Message.create({ conversation_id: c.id, sender: "system", content, timestamp: now });
      await base44.entities.Conversation.update(c.id, { last_message: content, last_message_at: now });
    } catch (e) {
      console.warn("Tenant auto-update failed:", e);
    }
  };

  const advanceStatus = async () => {
    const idx = statusFlow.indexOf(ticket.status);
    const next = statusFlow[Math.min(idx + 1, statusFlow.length - 1)];
    if (next === ticket.status) return;
    setBusy("advance");
    try {
      await base44.entities.MaintenanceTicket.update(ticket.id, { status: next });
      await logActivity(base44, { property_id: ticket.property_id, tenant_id: ticket.tenant_id, event_type: "Maintenance status", description: `Ticket status: ${ticket.status} → ${next}`, related_id: ticket.id });
      await notifyTenant(next);
      toast.success(`Status updated to ${next}`);
      reload();
    } catch (e) { toast.error(`Couldn't update status${e?.message ? `: ${e.message}` : ""}`); }
    finally { setBusy(null); }
  };

  const assignContractor = async (c) => {
    setBusy(`assign:${c.id}`);
    try {
      await base44.entities.MaintenanceTicket.update(ticket.id, { contractor_id: c.id, status: "Contractor requested" });
      await logActivity(base44, { property_id: ticket.property_id, event_type: "Contractor assigned", description: `Assigned ${c.name} to ticket`, related_id: ticket.id });
      await notifyTenant("Contractor requested");
      toast.success(`${c.name} assigned`);
      reload();
    } catch (e) { toast.error(`Couldn't assign contractor${e?.message ? `: ${e.message}` : ""}`); }
    finally { setBusy(null); }
  };

  const approve = async () => {
    setBusy("approve");
    try {
      await base44.entities.MaintenanceTicket.update(ticket.id, { landlord_approved: true, status: "Contractor requested" });
      await logActivity(base44, { property_id: ticket.property_id, event_type: "Maintenance status", description: `Landlord approved ticket`, related_id: ticket.id });
      await notifyTenant("Contractor requested");
      toast.success("Approved");
      reload();
    } catch (e) { toast.error(`Couldn't approve${e?.message ? `: ${e.message}` : ""}`); }
    finally { setBusy(null); }
  };

  const complete = async () => {
    setBusy("complete");
    try {
      await base44.entities.MaintenanceTicket.update(ticket.id, { status: "Complete", completed_at: new Date().toISOString() });
      await logActivity(base44, { property_id: ticket.property_id, event_type: "Maintenance status", description: `Ticket completed`, related_id: ticket.id });
      await notifyTenant("Complete");
      toast.success("Marked complete");
      reload();
    } catch (e) { toast.error(`Couldn't complete${e?.message ? `: ${e.message}` : ""}`); }
    finally { setBusy(null); }
  };

  const cancelJob = async () => {
    setBusy("cancel");
    try {
      const reason = cancelReason.trim();
      const payload = { status: "Cancelled" };
      if (reason) payload.description = `${ticket.description || ""}\n\nCancelled: ${reason}`;
      await base44.entities.MaintenanceTicket.update(ticket.id, payload);
      await logActivity(base44, { property_id: ticket.property_id, tenant_id: ticket.tenant_id, event_type: "Maintenance status", description: `Ticket cancelled${reason ? `: ${reason.slice(0, 80)}` : ""}`, related_id: ticket.id });
      await notifyTenant("Cancelled");
      toast.success("Job cancelled");
      setCancelOpen(false);
      setCancelReason("");
      reload();
    } catch (e) { toast.error(`Couldn't cancel${e?.message ? `: ${e.message}` : ""}`); }
    finally { setBusy(null); }
  };

  const startEdit = (field) => {
    setEditField(field);
    if (field === "appointment_date") setDraft(toLocalInput(ticket.appointment_date));
    else setDraft(ticket[field] != null ? String(ticket[field]) : "");
  };

  const saveEdit = async () => {
    const field = editField;
    setBusy("edit");
    try {
      if (field === "appointment_date") {
        const iso = draft ? new Date(draft).toISOString() : null;
        const patch = { appointment_date: iso };
        const curIdx = statusFlow.indexOf(ticket.status);
        const visitIdx = statusFlow.indexOf("Visit booked");
        const autoAdvance = !!iso && curIdx !== -1 && curIdx < visitIdx;
        if (autoAdvance) patch.status = "Visit booked";
        await base44.entities.MaintenanceTicket.update(ticket.id, patch);
        await logActivity(base44, { property_id: ticket.property_id, tenant_id: ticket.tenant_id, event_type: "Maintenance status", description: iso ? `Appointment set for ${formatDateTime(iso)}${autoAdvance ? " · status → Visit booked" : ""}` : "Appointment cleared", related_id: ticket.id });
        if (autoAdvance) await notifyTenant("Visit booked");
        toast.success(iso ? (autoAdvance ? "Appointment saved · visit booked" : "Appointment saved") : "Appointment cleared");
      } else {
        const n = parseFloat(draft);
        const val = Number.isFinite(n) ? n : null;
        await base44.entities.MaintenanceTicket.update(ticket.id, { [field]: val });
        const label = field === "cost_estimate" ? "Cost estimate" : "Actual cost";
        await logActivity(base44, { property_id: ticket.property_id, tenant_id: ticket.tenant_id, event_type: "Maintenance status", description: `${label} set to ${val == null ? "—" : formatGBP(val)}`, related_id: ticket.id });
        toast.success(`${label} saved`);
      }
      setEditField(null);
      reload();
    } catch (e) { toast.error(`Couldn't save${e?.message ? `: ${e.message}` : ""}`); }
    finally { setBusy(null); }
  };

  return (
    <Sheet open={true} onOpenChange={(o) => { if (!o) onClose(); }}>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader className="pr-8 text-left">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className={`${CHIP} border capitalize ${urgencyColor(ticket.urgency)}`}>{ticket.urgency}</span>
            <span className={`${CHIP} bg-muted text-muted-foreground capitalize`}>{ticket.issue_type}</span>
            <span className={`${CHIP} ${statusColor(ticket.status)}`}>{ticket.status}</span>
          </div>
          <SheetTitle className="text-base leading-snug">{ticket.description}</SheetTitle>
          <SheetDescription className="sr-only">Maintenance ticket details</SheetDescription>
          <p className="text-sm text-muted-foreground">
            <PropertyLink property={prop} />
            {tenant && <> · <Link to={`/tenants/${tenant.id}`} className="hover:underline decoration-[hsl(var(--sage))] underline-offset-2">{tenant.name}</Link></>}
          </p>
        </SheetHeader>

        <div className="mt-4 space-y-4">
          <StatusPipeline status={ticket.status} />

          {ticket.status === "Complete" && ticket.completed_at && (
            <p className="text-xs text-muted-foreground">Completed {formatDateTime(ticket.completed_at)}</p>
          )}

          {triage && (
            <div className="rounded-xl border border-[hsl(var(--sage))]/30 bg-[hsl(var(--sage))]/10 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-[hsl(var(--sage))] mb-1">AI triage</p>
              <p className="text-sm text-foreground">{triage.suggested_reply}</p>
              {triage.recommended_action && <p className="text-xs text-muted-foreground mt-2"><span className="font-medium text-foreground">Action:</span> {triage.recommended_action}</p>}
            </div>
          )}

          <div className="rounded-xl border bg-card divide-y divide-border">
            <InlineRow
              label="Cost estimate"
              value={ticket.cost_estimate != null ? formatGBP(ticket.cost_estimate) : "—"}
              editing={editField === "cost_estimate"}
              busy={busy === "edit"}
              onStart={() => startEdit("cost_estimate")}
              onCancel={() => setEditField(null)}
              onSave={saveEdit}
            >
              <Input type="number" min="0" step="1" value={draft} onChange={(e) => setDraft(e.target.value)} className="h-8 flex-1 min-w-0" aria-label="Cost estimate in pounds" />
            </InlineRow>
            <InlineRow
              label="Actual cost"
              value={ticket.cost_actual != null ? formatGBP(ticket.cost_actual) : "—"}
              editing={editField === "cost_actual"}
              busy={busy === "edit"}
              onStart={() => startEdit("cost_actual")}
              onCancel={() => setEditField(null)}
              onSave={saveEdit}
            >
              <Input type="number" min="0" step="1" value={draft} onChange={(e) => setDraft(e.target.value)} className="h-8 flex-1 min-w-0" aria-label="Actual cost in pounds" />
            </InlineRow>
            <InlineRow
              label="Appointment"
              value={ticket.appointment_date ? formatDateTime(ticket.appointment_date) : "—"}
              editing={editField === "appointment_date"}
              busy={busy === "edit"}
              onStart={() => startEdit("appointment_date")}
              onCancel={() => setEditField(null)}
              onSave={saveEdit}
            >
              <Input type="datetime-local" value={draft} onChange={(e) => setDraft(e.target.value)} className="h-8 flex-1 min-w-0" aria-label="Appointment date and time" />
            </InlineRow>
          </div>
          {editField === "appointment_date" && statusFlow.indexOf(ticket.status) > -1 && statusFlow.indexOf(ticket.status) < statusFlow.indexOf("Visit booked") && (
            <p className="text-[11px] text-muted-foreground -mt-2">Setting an appointment moves this job to “Visit booked” automatically.</p>
          )}

          {contractor ? (
            <div className="rounded-xl border bg-card p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">Assigned contractor</p>
              <p className="text-sm font-medium text-foreground">{contractor.name} · {contractor.trade}</p>
              {contractor.phone && (
                <a href={`tel:${contractor.phone}`} className="mt-1 inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground hover:underline">
                  <Phone className="w-3.5 h-3.5" />{contractor.phone}
                </a>
              )}
            </div>
          ) : (
            <div>
              <p className="text-sm font-semibold text-foreground mb-2">Suggested contractors</p>
              {matched.length === 0 ? (
                <div className="rounded-xl border bg-card">
                  <EmptyState compact icon={User} title="No matching contractors" description={<>None of your contractors cover this trade. <Link to="/contractors?new=1" className="text-[hsl(var(--sage))] hover:underline">Add one</Link>.</>} />
                </div>
              ) : (
                <div className="rounded-xl border bg-card divide-y divide-border">
                  {matched.slice(0, 3).map((c) => (
                    <div key={c.id} className="flex items-center justify-between gap-2 px-4 py-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">
                          {c.name} {c.preferred && <span className="text-[9px] bg-[hsl(var(--sage))] text-white px-1.5 py-0.5 rounded-full align-middle">PREFERRED</span>}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">{c.trade} · ★ {c.rating ?? "—"} · {c.availability || "—"}</p>
                      </div>
                      <button onClick={() => assignContractor(c)} disabled={!!busy} className="text-xs font-medium text-[hsl(var(--sage))] hover:underline disabled:opacity-50 shrink-0">
                        {busy === `assign:${c.id}` ? "Assigning…" : "Assign →"}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {conv && (
            <Link to={`/whatsapp?conversation=${conv.id}`} className="flex items-center gap-2.5 rounded-xl border border-blue-200 dark:border-blue-500/30 bg-blue-50 dark:bg-blue-500/10 px-4 py-3 hover:opacity-90 transition-opacity">
              <MessageSquare className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wide text-blue-700 dark:text-blue-300">Linked WhatsApp</p>
                <p className="text-xs text-blue-700/80 dark:text-blue-300/80 truncate">Conversation with {tenant?.name || "tenant"} — open chat</p>
              </div>
            </Link>
          )}

          {!terminal && (
            <div className="flex flex-wrap items-center gap-2 pt-3 border-t">
              {needsApproval && (
                <button onClick={approve} disabled={!!busy} className={BTN_PRIMARY}>
                  {busy === "approve" ? "Approving…" : "Approve"}
                </button>
              )}
              {canAdvance && (
                <button onClick={advanceStatus} disabled={!!busy} className={ticket.status === "Awaiting sign-off" ? BTN_SECONDARY : BTN_PRIMARY}>
                  {busy === "advance" ? "Updating…" : <>Advance status <ChevronRight className="w-4 h-4" /></>}
                </button>
              )}
              {ticket.status === "Awaiting sign-off" && (
                <button onClick={complete} disabled={!!busy} className={BTN_PRIMARY}>
                  <CheckCircle2 className="w-4 h-4" /> {busy === "complete" ? "Completing…" : "Complete"}
                </button>
              )}
              <button onClick={() => setCancelOpen(true)} disabled={!!busy} className={`${BTN_DANGER} ml-auto`}>
                <Ban className="w-4 h-4" /> Cancel job
              </button>
            </div>
          )}
        </div>

        <AlertDialog open={cancelOpen} onOpenChange={setCancelOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Cancel this job?</AlertDialogTitle>
              <AlertDialogDescription>
                The ticket will be marked Cancelled. If the tenant has a linked chat, they'll be notified automatically.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="space-y-1.5">
              <Label htmlFor="cancel-reason" className="text-xs font-medium text-muted-foreground">Reason (optional)</Label>
              <Textarea id="cancel-reason" value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} rows={2} placeholder="e.g. Tenant resolved it themselves" />
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel>Keep job</AlertDialogCancel>
              <AlertDialogAction onClick={cancelJob} disabled={busy === "cancel"} className="bg-rose-600 text-white hover:bg-rose-700">
                {busy === "cancel" ? "Cancelling…" : "Cancel job"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </SheetContent>
    </Sheet>
  );
}

function AddTicketModal({ open, onClose, onCreated, properties, tenants }) {
  const EMPTY_FORM = { property_id: "", tenant_id: "", issue_type: "plumbing", urgency: "medium", description: "" };
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const propTenants = tenants.filter((t) => t.property_id === form.property_id);

  const handleSubmit = async () => {
    if (!form.property_id || !form.description.trim()) { toast.error("Property and description required"); return; }
    if (saving) return;
    setSaving(true);
    try {
      const t = await base44.entities.MaintenanceTicket.create({ ...form, status: "New" });
      await logActivity(base44, { property_id: form.property_id, tenant_id: form.tenant_id, event_type: "Maintenance created", description: `Ticket created: ${form.description.slice(0, 60)}`, related_id: t.id, severity: form.urgency === "emergency" ? "critical" : "info" });
      toast.success("Ticket created");
      onCreated(); onClose();
      setForm(EMPTY_FORM);
    } catch (e) { toast.error(`Couldn't create ticket${e?.message ? `: ${e.message}` : ""}`); }
    finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Create maintenance job</DialogTitle></DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground">Property</Label>
            <Select value={form.property_id} onValueChange={(v) => setForm({ ...form, property_id: v, tenant_id: tenants.find((t) => t.property_id === v)?.id || "" })}>
              <SelectTrigger><SelectValue placeholder="Select property" /></SelectTrigger>
              <SelectContent>{properties.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground">Tenant</Label>
            <Select value={form.tenant_id || "__none__"} onValueChange={(v) => setForm({ ...form, tenant_id: v === "__none__" ? "" : v })} disabled={!form.property_id}>
              <SelectTrigger><SelectValue placeholder="Select tenant" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">No tenant</SelectItem>
                {propTenants.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
              </SelectContent>
            </Select>
            {propTenants.length > 1 && <p className="text-[11px] text-muted-foreground">First tenant auto-picked — change it if a different tenant reported this (HMO).</p>}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">Issue type</Label>
              <Select value={form.issue_type} onValueChange={(v) => setForm({ ...form, issue_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{["plumbing", "heating", "electricity", "appliance", "structural", "general"].map((t) => <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">Urgency</Label>
              <Select value={form.urgency} onValueChange={(v) => setForm({ ...form, urgency: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{["low", "medium", "high", "emergency"].map((t) => <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground">Description</Label>
            <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} placeholder="Describe the issue…" />
          </div>
        </div>
        <DialogFooter>
          <button onClick={onClose} disabled={saving} className={BTN_SECONDARY}>Cancel</button>
          <button onClick={handleSubmit} disabled={saving} className={BTN_PRIMARY}>{saving ? "Creating…" : "Create job"}</button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
