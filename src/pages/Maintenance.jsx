import React, { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useKieData } from "@/lib/useKieData";
import { base44 } from "@/api/base44Client";
import { formatGBP, formatDate, urgencyColor, statusColor, matchContractors, logActivity } from "@/lib/kieUtils";
import { Search, Plus, X, ChevronRight, CheckCircle2, User } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

const statusFlow = ["New", "AI triage", "Awaiting landlord approval", "Contractor requested", "Visit booked", "Work in progress", "Awaiting sign-off", "Complete"];

export default function Maintenance() {
  const { tickets, properties, tenants, contractors, conversations, triages, reload, loading } = useKieData();
  const [searchParams] = useSearchParams();
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState(() => {
    const s = searchParams.get("status");
    return s === "open" || statusFlow.includes(s) ? s : "all";
  });
  const [filterUrgency, setFilterUrgency] = useState(() => {
    const u = searchParams.get("urgency");
    return ["low", "medium", "high", "emergency"].includes(u) ? u : "all";
  });
  const [addOpen, setAddOpen] = useState(false);
  const [selected, setSelected] = useState(null);

  const filtered = tickets.filter((t) => {
    const prop = properties.find((p) => p.id === t.property_id);
    const matchSearch = !search || t.description?.toLowerCase().includes(search.toLowerCase()) || prop?.name?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === "all" || (filterStatus === "open" ? (t.status !== "Complete" && t.status !== "Cancelled") : t.status === filterStatus);
    const matchUrgency = filterUrgency === "all" || t.urgency === filterUrgency;
    return matchSearch && matchStatus && matchUrgency;
  });

  if (loading) return <div className="flex items-center justify-center h-96"><div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold text-slate-900">Maintenance</h1><p className="text-sm text-slate-500 mt-0.5">{tickets.length} tickets · {tickets.filter(t => t.status !== "Complete" && t.status !== "Cancelled").length} open</p></div>
        <button onClick={() => setAddOpen(true)} className="flex items-center gap-2 px-4 py-2 bg-[hsl(var(--navy))] text-white rounded-lg text-sm font-medium hover:bg-[hsl(var(--navy-light))]"><Plus className="w-4 h-4" /> Create job</button>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search tickets..." className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--sage))]/30" />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}><SelectTrigger className="w-48 bg-white"><SelectValue placeholder="Status" /></SelectTrigger><SelectContent><SelectItem value="all">All statuses</SelectItem><SelectItem value="open">All open</SelectItem>{statusFlow.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select>
        <Select value={filterUrgency} onValueChange={setFilterUrgency}><SelectTrigger className="w-36 bg-white"><SelectValue placeholder="Urgency" /></SelectTrigger><SelectContent><SelectItem value="all">All urgency</SelectItem>{["low", "medium", "high", "emergency"].map((s) => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}</SelectContent></Select>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {filtered.map((t) => {
          const prop = properties.find((p) => p.id === t.property_id);
          const tenant = tenants.find((tn) => tn.id === t.tenant_id);
          const contractor = contractors.find((c) => c.id === t.contractor_id);
          return (
            <button key={t.id} onClick={() => setSelected(t)} className="bg-white rounded-xl border border-slate-200 p-4 text-left hover:border-[hsl(var(--sage))] hover:shadow-md transition-all">
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className={`text-xs px-2 py-0.5 rounded-full border ${urgencyColor(t.urgency)}`}>{t.urgency}</span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 capitalize">{t.issue_type}</span>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full ${statusColor(t.status)}`}>{t.status}</span>
              </div>
              <p className="text-sm font-medium text-slate-900 mb-1 line-clamp-2">{t.description}</p>
              <p className="text-xs text-slate-500">{prop?.name} · {tenant?.name}</p>
              <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-100">
                <div className="flex items-center gap-3 text-xs text-slate-500">
                  {contractor && <span className="flex items-center gap-1"><User className="w-3 h-3" />{contractor.name}</span>}
                  {t.cost_estimate > 0 && <span>Est: {formatGBP(t.cost_estimate)}</span>}
                </div>
                <ChevronRight className="w-4 h-4 text-slate-300" />
              </div>
            </button>
          );
        })}
      </div>

      {selected && <TicketDetail ticket={selected} onClose={() => setSelected(null)} data={{ properties, tenants, contractors, conversations, triages, reload }} />}
      <AddTicketModal open={addOpen} onClose={() => setAddOpen(false)} onCreated={reload} properties={properties} tenants={tenants} />
    </div>
  );
}

function TicketDetail({ ticket, onClose, data }) {
  const { properties, tenants, contractors, conversations, triages, reload } = data;
  const prop = properties.find((p) => p.id === ticket.property_id);
  const tenant = tenants.find((t) => t.id === ticket.tenant_id);
  const contractor = contractors.find((c) => c.id === ticket.contractor_id);
  const conv = conversations.find((c) => c.id === ticket.conversation_id);
  const triage = triages.find((t) => t.id === ticket.ai_triage_id);
  const matched = matchContractors(contractors, ticket.issue_type, prop?.postcode);

  const advanceStatus = async () => {
    const idx = statusFlow.indexOf(ticket.status);
    const next = statusFlow[Math.min(idx + 1, statusFlow.length - 1)];
    await base44.entities.MaintenanceTicket.update(ticket.id, { status: next });
    await logActivity(base44, { property_id: ticket.property_id, tenant_id: ticket.tenant_id, event_type: "Maintenance status", description: `Ticket status: ${ticket.status} → ${next}`, related_id: ticket.id });
    toast.success(`Status updated to ${next}`);
    onClose(); reload();
  };

  const assignContractor = async (c) => {
    await base44.entities.MaintenanceTicket.update(ticket.id, { contractor_id: c.id, status: "Contractor requested" });
    await logActivity(base44, { property_id: ticket.property_id, event_type: "Contractor assigned", description: `Assigned ${c.name} to ticket`, related_id: ticket.id });
    toast.success(`${c.name} assigned`); onClose(); reload();
  };

  const approve = async () => {
    await base44.entities.MaintenanceTicket.update(ticket.id, { landlord_approved: true, status: "Contractor requested" });
    await logActivity(base44, { property_id: ticket.property_id, event_type: "Maintenance status", description: `Landlord approved ticket`, related_id: ticket.id });
    toast.success("Approved"); onClose(); reload();
  };

  const complete = async () => {
    await base44.entities.MaintenanceTicket.update(ticket.id, { status: "Complete", completed_at: new Date().toISOString() });
    await logActivity(base44, { property_id: ticket.property_id, event_type: "Maintenance status", description: `Ticket completed`, related_id: ticket.id });
    toast.success("Marked complete"); onClose(); reload();
  };

  return (
    <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 bg-white px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className={`text-xs px-2 py-0.5 rounded-full border ${urgencyColor(ticket.urgency)}`}>{ticket.urgency}</span>
            <span className={`text-xs px-2 py-0.5 rounded-full ${statusColor(ticket.status)}`}>{ticket.status}</span>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-100"><X className="w-5 h-5 text-slate-500" /></button>
        </div>
        <div className="p-6 space-y-5">
          <div><h2 className="text-lg font-bold text-slate-900 mb-1">{ticket.description}</h2><p className="text-sm text-slate-500">{prop?.name} · {tenant?.name}</p></div>

          {triage && (
            <div className="p-3 bg-[hsl(var(--sage-light))] rounded-lg">
              <p className="text-xs font-semibold text-[hsl(var(--sage))] uppercase mb-1">AI Triage</p>
              <p className="text-sm text-slate-700">{triage.suggested_reply}</p>
              {triage.recommended_action && <p className="text-xs text-slate-600 mt-2"><strong>Action:</strong> {triage.recommended_action}</p>}
            </div>
          )}

          <div className="flex items-center gap-2">
            <div className="flex-1 bg-slate-50 rounded-lg p-2"><p className="text-xs text-slate-400">Cost estimate</p><p className="text-sm font-bold">{formatGBP(ticket.cost_estimate)}</p></div>
            <div className="flex-1 bg-slate-50 rounded-lg p-2"><p className="text-xs text-slate-400">Actual cost</p><p className="text-sm font-bold">{formatGBP(ticket.cost_actual)}</p></div>
            <div className="flex-1 bg-slate-50 rounded-lg p-2"><p className="text-xs text-slate-400">Appointment</p><p className="text-sm font-medium">{formatDate(ticket.appointment_date)}</p></div>
          </div>

          {contractor ? (
            <div className="p-3 bg-slate-50 rounded-lg"><p className="text-xs font-semibold text-slate-400 uppercase mb-1">Assigned contractor</p><p className="text-sm font-medium">{contractor.name} · {contractor.trade}</p><p className="text-xs text-slate-500">{contractor.phone}</p></div>
          ) : (
            <div>
              <p className="text-sm font-semibold text-slate-900 mb-2">Suggested contractors</p>
              <div className="space-y-2">
                {matched.slice(0, 3).map((c) => (
                  <div key={c.id} className="flex items-center justify-between p-2.5 bg-slate-50 rounded-lg">
                    <div><p className="text-sm font-medium">{c.name} {c.preferred && <span className="text-[10px] bg-[hsl(var(--sage))] text-white px-1 py-0.5 rounded-full ml-1">PREFERRED</span>}</p><p className="text-xs text-slate-500">{c.trade} · ★ {c.rating} · {c.availability}</p></div>
                    <button onClick={() => assignContractor(c)} className="text-xs font-medium text-[hsl(var(--sage))] hover:underline">Assign →</button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {conv && <div className="p-3 bg-blue-50 rounded-lg"><p className="text-xs font-semibold text-blue-400 uppercase mb-1">Linked WhatsApp</p><p className="text-xs text-blue-700">Conversation with {tenant?.name}</p></div>}

          <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
            {ticket.status === "Awaiting landlord approval" && <button onClick={approve} className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium">Approve</button>}
            {ticket.status !== "Complete" && ticket.status !== "Cancelled" && <button onClick={advanceStatus} className="px-4 py-2 bg-[hsl(var(--navy))] text-white rounded-lg text-sm font-medium">Advance status →</button>}
            {ticket.status === "Awaiting sign-off" && <button onClick={complete} className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium flex items-center gap-1"><CheckCircle2 className="w-4 h-4" /> Complete</button>}
          </div>
        </div>
      </div>
    </div>
  );
}

function AddTicketModal({ open, onClose, onCreated, properties, tenants }) {
  const [form, setForm] = useState({ property_id: "", tenant_id: "", issue_type: "plumbing", urgency: "medium", description: "" });
  const [saving, setSaving] = useState(false);
  const handleSubmit = async () => {
    if (!form.property_id || !form.description) { toast.error("Property and description required"); return; }
    setSaving(true);
    try {
      const t = await base44.entities.MaintenanceTicket.create({ ...form, status: "New" });
      await logActivity(base44, { property_id: form.property_id, tenant_id: form.tenant_id, event_type: "Maintenance created", description: `Ticket created: ${form.description.slice(0, 60)}`, related_id: t.id, severity: form.urgency === "emergency" ? "critical" : "info" });
      toast.success("Ticket created"); onCreated(); onClose();
      setForm({ property_id: "", tenant_id: "", issue_type: "plumbing", urgency: "medium", description: "" });
    } catch (e) { toast.error("Failed"); } finally { setSaving(false); }
  };
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Create maintenance job</DialogTitle></DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1.5"><Label>Property</Label><Select value={form.property_id} onValueChange={(v) => setForm({ ...form, property_id: v, tenant_id: tenants.find((t) => t.property_id === v)?.id || "" })}><SelectTrigger><SelectValue placeholder="Select property" /></SelectTrigger><SelectContent>{properties.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent></Select></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>Issue type</Label><Select value={form.issue_type} onValueChange={(v) => setForm({ ...form, issue_type: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{["plumbing", "heating", "electricity", "appliance", "structural", "general"].map((t) => <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-1.5"><Label>Urgency</Label><Select value={form.urgency} onValueChange={(v) => setForm({ ...form, urgency: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{["low", "medium", "high", "emergency"].map((t) => <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>)}</SelectContent></Select></div>
          </div>
          <div className="space-y-1.5"><Label>Description</Label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} placeholder="Describe the issue..." /></div>
        </div>
        <DialogFooter><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={handleSubmit} disabled={saving}>Create</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}