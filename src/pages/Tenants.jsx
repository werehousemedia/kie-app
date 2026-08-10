import React, { useState } from "react";
import { useKieData } from "@/lib/useKieData";
import { base44 } from "@/api/base44Client";
import { formatGBP, formatDate, statusColor, logActivity } from "@/lib/kieUtils";
import { Search, Plus, MessageSquare } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { TenantAvatar } from "@/components/shared/TenantChip";
import PropertyLink from "@/components/shared/PropertyLink";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

export default function Tenants() {
  const { tenants, properties, reload, loading } = useKieData();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [addOpen, setAddOpen] = useState(false);

  const filtered = tenants.filter((t) =>
    t.name?.toLowerCase().includes(search.toLowerCase()) || t.phone?.includes(search) || t.email?.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return <div className="flex items-center justify-center h-96"><div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold text-slate-900">Tenants</h1><p className="text-sm text-slate-500 mt-0.5">{tenants.length} tenants across {properties.length} properties</p></div>
        <button onClick={() => setAddOpen(true)} className="flex items-center gap-2 px-4 py-2 bg-[hsl(var(--navy))] text-white rounded-lg text-sm font-medium hover:bg-[hsl(var(--navy-light))]"><Plus className="w-4 h-4" /> Add tenant</button>
      </div>
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search tenants..." className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--sage))]/30" />
      </div>
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs text-slate-500 uppercase">
            <tr><th className="text-left px-4 py-3 font-medium">Tenant</th><th className="text-left px-4 py-3 font-medium">Property</th><th className="text-left px-4 py-3 font-medium">Tenancy</th><th className="text-right px-4 py-3 font-medium">Rent</th><th className="text-left px-4 py-3 font-medium">Payment</th><th className="text-left px-4 py-3 font-medium">Consent</th><th className="px-4 py-3"></th></tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.map((t) => {
              const prop = properties.find((p) => p.id === t.property_id);
              return (
                <tr key={t.id} onClick={() => navigate(`/tenants/${t.id}`)} className="hover:bg-slate-50 cursor-pointer">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <TenantAvatar tenant={t} size="md" />
                      <div><p className="font-medium text-slate-900">{t.name}</p><p className="text-xs text-slate-500">{t.phone}</p></div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-600"><PropertyLink property={prop} /></td>
                  <td className="px-4 py-3 text-slate-600 text-xs">{formatDate(t.tenancy_start)} → {formatDate(t.tenancy_end)}</td>
                  <td className="px-4 py-3 text-right font-medium text-slate-700">{formatGBP(t.rent_amount)}</td>
                  <td className="px-4 py-3"><span className={`text-xs px-2 py-0.5 rounded-full ${statusColor(t.payment_status)}`}>{t.payment_status}</span></td>
                  <td className="px-4 py-3"><span className={`text-xs px-2 py-0.5 rounded-full ${t.consent_status === "Granted" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>{t.consent_status}</span></td>
                  <td className="px-4 py-3"><Link to="/whatsapp" onClick={(e) => e.stopPropagation()} className="p-1.5 rounded-lg hover:bg-slate-100 inline-block"><MessageSquare className="w-4 h-4 text-slate-500" /></Link></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <AddTenantModal open={addOpen} onClose={() => setAddOpen(false)} onCreated={reload} properties={properties} />
    </div>
  );
}

function TenantDetail({ tenant, onClose, data }) {
  const { properties, conversations, tickets } = data;
  const prop = properties.find((p) => p.id === tenant.property_id);
  const conv = conversations.find((c) => c.tenant_id === tenant.id);
  const tenantTickets = tickets.filter((t) => t.tenant_id === tenant.id);
  return (
    <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl max-w-lg w-full max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 bg-white px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div><h2 className="text-lg font-bold text-slate-900">{tenant.name}</h2><p className="text-sm text-slate-500">{prop?.name}</p></div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-100"><X className="w-5 h-5 text-slate-500" /></button>
        </div>
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="flex items-center gap-2 p-3 bg-slate-50 rounded-lg"><Phone className="w-4 h-4 text-slate-400" /><span className="text-sm text-slate-700">{tenant.phone}</span></div>
            <div className="flex items-center gap-2 p-3 bg-slate-50 rounded-lg"><Mail className="w-4 h-4 text-slate-400" /><span className="text-sm text-slate-700 truncate">{tenant.email || "—"}</span></div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="p-3 bg-slate-50 rounded-lg"><p className="text-xs text-slate-400">Rent</p><p className="text-base font-bold">{formatGBP(tenant.rent_amount)}/mo</p></div>
            <div className="p-3 bg-slate-50 rounded-lg"><p className="text-xs text-slate-400">Tenancy</p><p className="text-sm font-medium">{formatDate(tenant.tenancy_start)} → {formatDate(tenant.tenancy_end)}</p></div>
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-xs px-2.5 py-1 rounded-full ${statusColor(tenant.payment_status)}`}>Payment: {tenant.payment_status}</span>
            <span className={`text-xs px-2.5 py-1 rounded-full ${tenant.consent_status === "Granted" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}><ShieldCheck className="w-3 h-3 inline mr-1" />Consent: {tenant.consent_status}</span>
          </div>
          {tenant.notes && <div className="p-3 bg-slate-50 rounded-lg"><p className="text-xs text-slate-400 mb-1">Notes</p><p className="text-sm text-slate-600">{tenant.notes}</p></div>}
          {tenantTickets.length > 0 && (
            <div><h3 className="text-sm font-semibold mb-2">Maintenance history ({tenantTickets.length})</h3>
              {tenantTickets.map((t) => <div key={t.id} className="flex items-center justify-between py-2 border-b border-slate-100"><span className="text-sm text-slate-700 truncate">{t.description}</span><span className={`text-xs px-1.5 py-0.5 rounded-full ${statusColor(t.status)}`}>{t.status}</span></div>)}
            </div>
          )}
          {conv && <Link to="/whatsapp" className="flex items-center justify-center gap-2 w-full py-2.5 bg-[hsl(var(--sage))] text-white rounded-lg text-sm font-medium"><MessageSquare className="w-4 h-4" /> Open WhatsApp conversation</Link>}
        </div>
      </div>
    </div>
  );
}

function AddTenantModal({ open, onClose, onCreated, properties }) {
  const [form, setForm] = useState({ name: "", phone: "", email: "", property_id: "", tenancy_start: "", tenancy_end: "", rent_amount: 0, payment_status: "Due", consent_status: "Pending", notes: "" });
  const [saving, setSaving] = useState(false);
  const handleSubmit = async () => {
    if (!form.name || !form.phone || !form.property_id) { toast.error("Name, phone and property are required"); return; }
    setSaving(true);
    try {
      const t = await base44.entities.Tenant.create(form);
      // Every tenant gets a Tenancy record — it drives rent/residence history
      const today = new Date().toISOString().slice(0, 10);
      const start = form.tenancy_start || today;
      await base44.entities.Tenancy.create({
        tenant_id: t.id, property_id: form.property_id,
        start_date: form.tenancy_start || null, end_date: form.tenancy_end || null,
        rent_amount: form.rent_amount || 0,
        status: start > today ? "Upcoming" : "Active",
        rent_history: [{ date: start, amount: form.rent_amount || 0 }],
        is_demo: false, source: "manual",
      });
      await logActivity(base44, { tenant_id: t.id, property_id: form.property_id, event_type: "Tenant update", description: `Tenant added: ${form.name}` });
      toast.success("Tenant added"); onCreated(); onClose();
      setForm({ name: "", phone: "", email: "", property_id: "", tenancy_start: "", tenancy_end: "", rent_amount: 0, payment_status: "Due", consent_status: "Pending", notes: "" });
    } catch (e) { toast.error("Failed to add tenant"); } finally { setSaving(false); }
  };
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader><DialogTitle>Add tenant</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3 py-2">
          <div className="col-span-2 space-y-1.5"><Label>Full name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
          <div className="space-y-1.5"><Label>Phone (UK)</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+44 7xxx xxx xxx" /></div>
          <div className="space-y-1.5"><Label>Email</Label><Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
          <div className="col-span-2 space-y-1.5"><Label>Property</Label><Select value={form.property_id} onValueChange={(v) => setForm({ ...form, property_id: v })}><SelectTrigger><SelectValue placeholder="Select property" /></SelectTrigger><SelectContent>{properties.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent></Select></div>
          <div className="space-y-1.5"><Label>Tenancy start</Label><Input type="date" value={form.tenancy_start} onChange={(e) => setForm({ ...form, tenancy_start: e.target.value })} /></div>
          <div className="space-y-1.5"><Label>Tenancy end</Label><Input type="date" value={form.tenancy_end} onChange={(e) => setForm({ ...form, tenancy_end: e.target.value })} /></div>
          <div className="space-y-1.5"><Label>Monthly rent (£)</Label><Input type="number" value={form.rent_amount} onChange={(e) => setForm({ ...form, rent_amount: parseFloat(e.target.value) })} /></div>
          <div className="space-y-1.5"><Label>Consent status</Label><Select value={form.consent_status} onValueChange={(v) => setForm({ ...form, consent_status: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{["Granted", "Pending", "Withdrawn"].map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent></Select></div>
        </div>
        <DialogFooter><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={handleSubmit} disabled={saving}>Add tenant</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}