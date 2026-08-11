import React, { useEffect, useMemo, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { toast } from "sonner";
import {
  Plus,
  Search,
  Wrench,
  Sparkles,
  Check,
  X,
  CalendarDays,
  Banknote,
  HardHat,
  Star,
} from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useKieData } from "@/lib/useKieData";
import { formatGBP, formatDate, formatDateTime, urgencyColor, statusColor, logActivity, matchContractors } from "@/lib/kieUtils";
import PageHeader from "@/components/shared/PageHeader";
import EmptyState from "@/components/shared/EmptyState";
import { ListSkeleton } from "@/components/shared/Skeletons";
import PropertyLink from "@/components/shared/PropertyLink";
import TenantChip from "@/components/shared/TenantChip";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

// KEEP: the canonical status flow, in order. "Cancelled" is a separate exit.
const STATUS_FLOW = [
  "New",
  "AI triage",
  "Awaiting landlord approval",
  "Contractor requested",
  "Visit booked",
  "Work in progress",
  "Awaiting sign-off",
  "Complete",
];

const TENANT_UPDATE = {
  "Awaiting landlord approval": "Your repair has been assessed and is awaiting approval.",
  "Contractor requested": "A contractor has been requested for your repair — they'll be in touch to arrange a visit.",
  "Visit booked": "A visit has been booked for your repair.",
  "Work in progress": "Work on your repair is underway.",
  "Awaiting sign-off": "The work is finished and awaiting final sign-off.",
  Complete: "Your repair is complete. Reply here if anything isn't right.",
  Cancelled: "This repair request has been closed. Message us if you still need help.",
};

const ISSUE_TYPES = ["plumbing", "heating", "electricity", "appliance", "structural", "general"];
const URGENCIES = ["low", "medium", "high", "emergency"];

export default function Maintenance() {
  const { tickets, properties, tenants, contractors, conversations, triages, reload, loading } = useKieData();
  const [searchParams, setSearchParams] = useSearchParams();

  const [text, setText] = useState("");
  const [status, setStatus] = useState(searchParams.get("status") || "open");
  const [urgency, setUrgency] = useState(searchParams.get("urgency") || "all");
  const [openTicketId, setOpenTicketId] = useState(searchParams.get("ticket") || null);
  const [addOpen, setAddOpen] = useState(false);

  useEffect(() => {
    if (searchParams.get("new") === "1") {
      setAddOpen(true);
      setSearchParams((p) => { p.delete("new"); return p; }, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ?ticket= can arrive while we're already mounted (e.g. command palette).
  useEffect(() => {
    const id = searchParams.get("ticket");
    if (id) setOpenTicketId(id);
  }, [searchParams]);

  const setFilter = (kind, value) => {
    if (kind === "status") setStatus(value);
    else setUrgency(value);
    setSearchParams((p) => {
      const key = kind;
      if (value === "all") p.delete(key);
      else p.set(key, value);
      return p;
    }, { replace: true });
  };

  const closeDetail = () => {
    setOpenTicketId(null);
    setSearchParams((p) => { p.delete("ticket"); return p; }, { replace: true });
  };

  const filtered = useMemo(() => {
    const q = text.trim().toLowerCase();
    return tickets.filter((t) => {
      if (status === "open") {
        if (t.status === "Complete" || t.status === "Cancelled") return false;
      } else if (status !== "all" && t.status !== status) return false;
      if (urgency !== "all" && t.urgency !== urgency) return false;
      if (q) {
        const prop = properties.find((p) => p.id === t.property_id);
        const tenant = tenants.find((x) => x.id === t.tenant_id);
        if (![t.description, prop?.name, tenant?.name].some((s) => (s || "").toLowerCase().includes(q))) return false;
      }
      return true;
    });
  }, [tickets, status, urgency, text, properties, tenants]);

  const openCount = tickets.filter((t) => t.status !== "Complete" && t.status !== "Cancelled").length;
  const ticket = tickets.find((t) => t.id === openTicketId) || null;

  // Every status change tells the tenant (system message, if they have a
  // conversation) and logs activity — the "what's happening?" killer.
  const notifyTenant = async (tkt, newStatus) => {
    const body = TENANT_UPDATE[newStatus];
    if (!body) return;
    const convo =
      conversations.find((c) => c.id === tkt.conversation_id) ||
      conversations.find((c) => c.tenant_id === tkt.tenant_id);
    if (!convo) return;
    const now = new Date().toISOString();
    try {
      await base44.entities.Message.create({
        conversation_id: convo.id,
        sender: "system",
        content: `Update on your repair: ${body}`,
        timestamp: now,
      });
      await base44.entities.Conversation.update(convo.id, {
        last_message: `Update on your repair: ${body}`,
        last_message_at: now,
      });
    } catch {
      /* tenant update is best-effort — the status change itself already saved */
    }
  };

  const mutate = async (fn, successMsg) => {
    try {
      await fn();
      if (successMsg) toast.success(successMsg);
      reload();
    } catch (e) {
      toast.error(`Action failed: ${e?.message || "unknown error"}`);
    }
  };

  const setTicketStatus = (tkt, newStatus, extra = {}) =>
    mutate(async () => {
      await base44.entities.MaintenanceTicket.update(tkt.id, { status: newStatus, ...extra });
      await logActivity(base44, {
        property_id: tkt.property_id,
        tenant_id: tkt.tenant_id,
        event_type: "Maintenance status",
        description: `Ticket → ${newStatus}: ${(tkt.description || "").slice(0, 50)}`,
        related_id: tkt.id,
      });
      await notifyTenant(tkt, newStatus);
    }, `Status: ${newStatus}`);

  const advance = (tkt) => {
    const i = STATUS_FLOW.indexOf(tkt.status);
    const next = STATUS_FLOW[Math.min(i + 1, STATUS_FLOW.length - 1)];
    if (next === tkt.status) return;
    setTicketStatus(tkt, next, next === "Complete" ? { completed_at: new Date().toISOString() } : {});
  };

  const approve = (tkt) =>
    mutate(async () => {
      await base44.entities.MaintenanceTicket.update(tkt.id, { landlord_approved: true, status: "Contractor requested" });
      await logActivity(base44, {
        property_id: tkt.property_id,
        tenant_id: tkt.tenant_id,
        event_type: "Maintenance status",
        description: `Approved: ${(tkt.description || "").slice(0, 50)}`,
        related_id: tkt.id,
      });
      await notifyTenant(tkt, "Contractor requested");
    }, "Approved — contractor requested");

  const complete = (tkt) =>
    setTicketStatus(tkt, "Complete", { completed_at: new Date().toISOString() });

  const cancel = (tkt, reason) =>
    mutate(async () => {
      await base44.entities.MaintenanceTicket.update(tkt.id, { status: "Cancelled" });
      await logActivity(base44, {
        property_id: tkt.property_id,
        tenant_id: tkt.tenant_id,
        event_type: "Maintenance status",
        description: `Cancelled${reason ? ` (${reason})` : ""}: ${(tkt.description || "").slice(0, 50)}`,
        related_id: tkt.id,
      });
      await notifyTenant(tkt, "Cancelled");
    }, "Job cancelled");

  const assign = (tkt, contractor) =>
    mutate(async () => {
      await base44.entities.MaintenanceTicket.update(tkt.id, { contractor_id: contractor.id, status: "Contractor requested" });
      await logActivity(base44, {
        property_id: tkt.property_id,
        tenant_id: tkt.tenant_id,
        event_type: "Contractor assigned",
        description: `${contractor.name} assigned: ${(tkt.description || "").slice(0, 50)}`,
        related_id: tkt.id,
      });
      await notifyTenant(tkt, "Contractor requested");
    }, `${contractor.name} assigned`);

  const saveField = (tkt, patch, msg) =>
    mutate(async () => {
      // Booking a visit date fast-forwards the pipeline to "Visit booked".
      const autoAdvance =
        patch.appointment_date &&
        STATUS_FLOW.indexOf(tkt.status) < STATUS_FLOW.indexOf("Visit booked") &&
        tkt.status !== "Cancelled";
      await base44.entities.MaintenanceTicket.update(tkt.id, {
        ...patch,
        ...(autoAdvance ? { status: "Visit booked" } : {}),
      });
      await logActivity(base44, {
        property_id: tkt.property_id,
        tenant_id: tkt.tenant_id,
        event_type: "Maintenance status",
        description: `${msg}: ${(tkt.description || "").slice(0, 50)}`,
        related_id: tkt.id,
      });
      if (autoAdvance) await notifyTenant(tkt, "Visit booked");
    }, msg);

  if (loading) {
    return (
      <div className="space-y-5">
        <PageHeader title="Maintenance" subtitle="Loading jobs…" />
        <ListSkeleton rows={5} />
      </div>
    );
  }

  return (
    <div className="space-y-5 animate-fade-in">
      <PageHeader
        title="Maintenance"
        subtitle={`${tickets.length} job${tickets.length === 1 ? "" : "s"} · ${openCount} open`}
        actions={
          <button
            onClick={() => setAddOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
          >
            <Plus className="w-4 h-4" /> Create job
          </button>
        }
      />

      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Search description, property, tenant…"
            className="w-full pl-9 pr-3 py-2 bg-muted rounded-lg text-sm border border-transparent focus:outline-none focus:bg-card focus:border-border transition-all"
          />
        </div>
        <div className="flex gap-2">
          <Select value={status} onValueChange={(v) => setFilter("status", v)}>
            <SelectTrigger className="w-full sm:w-52 h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="open">Open jobs</SelectItem>
              <SelectItem value="all">All statuses</SelectItem>
              {[...STATUS_FLOW, "Cancelled"].map((s) => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={urgency} onValueChange={(v) => setFilter("urgency", v)}>
            <SelectTrigger className="w-full sm:w-36 h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Any urgency</SelectItem>
              {URGENCIES.map((u) => (
                <SelectItem key={u} value={u} className="capitalize">{u}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border bg-card">
          {tickets.length === 0 ? (
            <EmptyState
              icon={Wrench}
              title="No maintenance jobs yet"
              description="Create a job here, or let the AI raise one automatically from a tenant WhatsApp message."
              action={
                <button onClick={() => setAddOpen(true)} className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 transition-opacity">
                  <Plus className="w-4 h-4" /> Create job
                </button>
              }
            />
          ) : (
            <EmptyState
              icon={Search}
              title="Nothing matches these filters"
              action={
                <button
                  onClick={() => { setText(""); setFilter("status", "open"); setFilter("urgency", "all"); }}
                  className="text-sm font-medium text-[hsl(var(--sage))] hover:underline"
                >
                  Clear filters
                </button>
              }
            />
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {filtered.map((t) => {
            const contractor = contractors.find((c) => c.id === t.contractor_id);
            const tenant = tenants.find((x) => x.id === t.tenant_id);
            return (
              <button
                key={t.id}
                onClick={() => {
                  setOpenTicketId(t.id);
                  setSearchParams((p) => { p.set("ticket", t.id); return p; }, { replace: true });
                }}
                className="rounded-xl border bg-card p-4 text-left hover:bg-muted/60 active:scale-[0.99] transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))]"
              >
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${urgencyColor(t.urgency)}`}>
                    {t.urgency || "low"}
                  </span>
                  <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium capitalize">
                    {t.issue_type || "general"}
                  </span>
                  <span className={`ml-auto inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${statusColor(t.status)}`}>
                    {t.status}
                  </span>
                </div>
                <p className="text-sm font-medium mt-2 line-clamp-2">{t.description || "Maintenance job"}</p>
                <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground flex-wrap">
                  <PropertyLink property={properties.find((p) => p.id === t.property_id)} />
                  {tenant && <TenantChip tenant={tenant} size="xs" />}
                  {contractor && (
                    <span className="inline-flex items-center gap-1">
                      <HardHat className="w-3 h-3" /> {contractor.name}
                    </span>
                  )}
                  {t.appointment_date && (
                    <span className="inline-flex items-center gap-1">
                      <CalendarDays className="w-3 h-3" /> {formatDateTime(t.appointment_date)}
                    </span>
                  )}
                  {t.cost_estimate > 0 && (
                    <span className="inline-flex items-center gap-1 tabular-nums">
                      <Banknote className="w-3 h-3" /> est {formatGBP(t.cost_estimate)}
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}

      <TicketDetailSheet
        ticket={ticket}
        onClose={closeDetail}
        properties={properties}
        tenants={tenants}
        contractors={contractors}
        triages={triages}
        onAdvance={advance}
        onApprove={approve}
        onComplete={complete}
        onCancel={cancel}
        onAssign={assign}
        onSaveField={saveField}
      />

      <AddTicketModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        properties={properties}
        tenants={tenants}
        reload={reload}
      />
    </div>
  );
}

function Pipeline({ status }) {
  if (status === "Cancelled") {
    return (
      <div className="rounded-lg bg-muted px-3 py-2 text-xs font-medium text-muted-foreground">
        This job was cancelled.
      </div>
    );
  }
  const idx = STATUS_FLOW.indexOf(status);
  return (
    <div>
      <div className="flex gap-1 overflow-x-auto no-scrollbar">
        {STATUS_FLOW.map((s, i) => (
          <div
            key={s}
            title={s}
            className={`h-1.5 flex-1 min-w-[16px] rounded-full ${
              i < idx ? "bg-[hsl(var(--sage))]" : i === idx ? "bg-[hsl(var(--sage))] animate-pulse" : "bg-muted"
            }`}
          />
        ))}
      </div>
      <p className="text-xs text-muted-foreground mt-1.5">
        Step {idx + 1} of {STATUS_FLOW.length}: <span className="font-medium text-foreground">{status}</span>
      </p>
    </div>
  );
}

function InlineField({ label, type = "number", value, placeholder, onSave }) {
  const [v, setV] = useState(value ?? "");
  const [saving, setSaving] = useState(false);
  useEffect(() => setV(value ?? ""), [value]);
  const dirty = String(v) !== String(value ?? "");
  return (
    <div>
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      <div className="flex gap-1.5 mt-1">
        <Input
          type={type}
          value={v}
          min={type === "number" ? "0" : undefined}
          placeholder={placeholder}
          onChange={(e) => setV(e.target.value)}
          className="h-9"
        />
        {dirty && (
          <button
            onClick={async () => {
              setSaving(true);
              await onSave(v);
              setSaving(false);
            }}
            disabled={saving}
            className="shrink-0 px-2.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:opacity-90 disabled:opacity-60"
          >
            {saving ? "…" : "Save"}
          </button>
        )}
      </div>
    </div>
  );
}

function TicketDetailSheet({
  ticket, onClose, properties, tenants, contractors, triages,
  onAdvance, onApprove, onComplete, onCancel, onAssign, onSaveField,
}) {
  const [reason, setReason] = useState("");
  if (!ticket) return null;

  const property = properties.find((p) => p.id === ticket.property_id);
  const tenant = tenants.find((t) => t.id === ticket.tenant_id);
  const contractor = contractors.find((c) => c.id === ticket.contractor_id);
  const triage = triages.find((tr) => tr.id === ticket.ai_triage_id);
  const suggestions = !contractor
    ? matchContractors(contractors, ticket.issue_type, property?.postcode || "").slice(0, 3)
    : [];
  const idx = STATUS_FLOW.indexOf(ticket.status);
  const isOpen = ticket.status !== "Complete" && ticket.status !== "Cancelled";
  const needsApproval = ticket.status === "Awaiting landlord approval" && !ticket.landlord_approved;

  return (
    <Sheet open={!!ticket} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader className="pb-3">
          <SheetTitle className="text-base leading-snug pr-8">
            {ticket.description || "Maintenance job"}
          </SheetTitle>
        </SheetHeader>
        <div className="space-y-4">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${urgencyColor(ticket.urgency)}`}>
              {ticket.urgency || "low"}
            </span>
            <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium capitalize">
              {ticket.issue_type || "general"}
            </span>
            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${statusColor(ticket.status)}`}>
              {ticket.status}
            </span>
          </div>

          <Pipeline status={ticket.status} />

          <div className="text-sm space-y-1.5">
            <p>
              <span className="text-muted-foreground">Property: </span>
              <PropertyLink property={property} className="font-medium" />
            </p>
            {tenant && (
              <p className="flex items-center gap-1.5">
                <span className="text-muted-foreground">Tenant: </span>
                <TenantChip tenant={tenant} size="xs" />
              </p>
            )}
            {ticket.completed_at && (
              <p className="text-muted-foreground text-xs">Completed {formatDateTime(ticket.completed_at)}</p>
            )}
          </div>

          {triage && (triage.suggested_reply || triage.recommended_action) && (
            <div className="rounded-xl bg-[hsl(var(--sage-light))]/50 p-3 space-y-1">
              <p className="text-[11px] font-semibold flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5 text-[hsl(var(--sage))]" /> AI triage
              </p>
              {triage.recommended_action && <p className="text-xs">{triage.recommended_action}</p>}
              {triage.suggested_reply && (
                <p className="text-xs text-muted-foreground">"{triage.suggested_reply}"</p>
              )}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <InlineField
              label="Cost estimate £"
              value={ticket.cost_estimate || ""}
              placeholder="0"
              onSave={(v) => {
                const n = parseFloat(v);
                return onSaveField(ticket, { cost_estimate: Number.isFinite(n) ? n : null }, "Estimate updated");
              }}
            />
            <InlineField
              label="Actual cost £"
              value={ticket.cost_actual || ""}
              placeholder="0"
              onSave={(v) => {
                const n = parseFloat(v);
                return onSaveField(ticket, { cost_actual: Number.isFinite(n) ? n : null }, "Cost recorded");
              }}
            />
          </div>
          <InlineField
            label="Visit date & time"
            type="datetime-local"
            value={ticket.appointment_date ? ticket.appointment_date.slice(0, 16) : ""}
            onSave={(v) =>
              onSaveField(
                ticket,
                { appointment_date: v ? new Date(v).toISOString() : null },
                v ? "Visit booked" : "Visit date cleared"
              )
            }
          />

          {contractor ? (
            <div className="rounded-xl border p-3">
              <p className="text-[11px] font-semibold text-muted-foreground mb-1">Assigned contractor</p>
              <p className="text-sm font-medium flex items-center gap-1.5">
                {contractor.name}
                {contractor.preferred && <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-400" />}
              </p>
              <p className="text-xs text-muted-foreground">
                {contractor.trade}
                {contractor.phone && (
                  <>
                    {" · "}
                    <a href={`tel:${contractor.phone}`} className="hover:underline">{contractor.phone}</a>
                  </>
                )}
              </p>
            </div>
          ) : (
            isOpen &&
            suggestions.length > 0 && (
              <div className="rounded-xl border p-3 space-y-2">
                <p className="text-[11px] font-semibold text-muted-foreground">Suggested contractors</p>
                {suggestions.map((c) => (
                  <div key={c.id} className="flex items-center gap-2">
                    <span className="flex-1 min-w-0 text-sm truncate">
                      {c.name}
                      {c.preferred && <Star className="w-3 h-3 inline ml-1 text-amber-500 fill-amber-400" />}
                      <span className="text-xs text-muted-foreground"> · {c.availability || "—"}</span>
                    </span>
                    <button
                      onClick={() => onAssign(ticket, c)}
                      className="shrink-0 text-xs font-medium text-[hsl(var(--sage))] hover:underline"
                    >
                      Assign →
                    </button>
                  </div>
                ))}
              </div>
            )
          )}

          {isOpen && (
            <div className="flex flex-wrap gap-2 pt-1">
              {needsApproval && (
                <button
                  onClick={() => onApprove(ticket)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-[hsl(var(--sage))] text-white rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
                >
                  <Check className="w-4 h-4" /> Approve
                </button>
              )}
              {!needsApproval && ticket.status !== "Awaiting sign-off" && idx < STATUS_FLOW.length - 1 && (
                <button
                  onClick={() => onAdvance(ticket)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
                >
                  Advance: {STATUS_FLOW[idx + 1]} →
                </button>
              )}
              {ticket.status === "Awaiting sign-off" && (
                <button
                  onClick={() => onComplete(ticket)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors"
                >
                  <Check className="w-4 h-4" /> Complete
                </button>
              )}
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <button className="inline-flex items-center gap-1.5 px-3.5 py-2 border bg-card hover:bg-muted rounded-lg text-sm font-medium text-rose-600 dark:text-rose-400 transition-colors">
                    <X className="w-4 h-4" /> Cancel job
                  </button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Cancel this job?</AlertDialogTitle>
                    <AlertDialogDescription>
                      The tenant will be told the request has been closed.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <Input
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Reason (optional)"
                  />
                  <AlertDialogFooter>
                    <AlertDialogCancel>Keep job</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => { onCancel(ticket, reason.trim()); setReason(""); }}
                      className="bg-rose-600 hover:bg-rose-700 text-white"
                    >
                      Cancel job
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function AddTicketModal({ open, onClose, properties, tenants, reload }) {
  const empty = { property_id: "", tenant_id: "", issue_type: "general", urgency: "medium", description: "" };
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  // KEEP: property choice auto-fills the tenant — but it's now overridable (HMO fix).
  const pickProperty = (pid) => {
    const first = tenants.find((t) => t.property_id === pid);
    setForm((f) => ({ ...f, property_id: pid, tenant_id: first?.id || "" }));
  };
  const propertyTenants = tenants.filter((t) => t.property_id === form.property_id);

  const submit = async () => {
    if (!form.property_id || !form.description.trim()) {
      toast.error("Property and description are required");
      return;
    }
    setSaving(true);
    try {
      const ticket = await base44.entities.MaintenanceTicket.create({
        property_id: form.property_id,
        tenant_id: form.tenant_id || undefined,
        issue_type: form.issue_type,
        urgency: form.urgency,
        description: form.description.trim(),
        status: "New",
      });
      await logActivity(base44, {
        property_id: form.property_id,
        tenant_id: form.tenant_id || undefined,
        event_type: "Maintenance created",
        description: `Job created: ${form.description.slice(0, 50)}`,
        related_id: ticket.id,
        ...(form.urgency === "emergency" ? { severity: "critical" } : {}),
      });
      toast.success("Job created");
      setForm(empty);
      onClose();
      reload();
    } catch (e) {
      toast.error(`Couldn't create job: ${e?.message || "unknown error"}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !saving && !v && onClose()}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create maintenance job</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 mt-1">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Property *</label>
              <Select value={form.property_id} onValueChange={pickProperty}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Choose property" />
                </SelectTrigger>
                <SelectContent>
                  {properties.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Tenant</label>
              <Select
                value={form.tenant_id}
                onValueChange={(v) => set("tenant_id", v)}
                disabled={propertyTenants.length === 0}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder={propertyTenants.length ? "Choose tenant" : "No tenants here"} />
                </SelectTrigger>
                <SelectContent>
                  {propertyTenants.map((t) => (
                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Issue type</label>
              <Select value={form.issue_type} onValueChange={(v) => set("issue_type", v)}>
                <SelectTrigger className="mt-1 capitalize">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ISSUE_TYPES.map((t) => (
                    <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Urgency</label>
              <Select value={form.urgency} onValueChange={(v) => set("urgency", v)}>
                <SelectTrigger className="mt-1 capitalize">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {URGENCIES.map((u) => (
                    <SelectItem key={u} value={u} className="capitalize">{u}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Description *</label>
            <Textarea
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
              placeholder="What's the problem, where, and how bad?"
              rows={3}
              className="mt-1"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={onClose} disabled={saving} className="px-3.5 py-2 border bg-card hover:bg-muted rounded-lg text-sm font-medium transition-colors">
              Cancel
            </button>
            <button onClick={submit} disabled={saving} className="px-3.5 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-60">
              {saving ? "Creating…" : "Create job"}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}