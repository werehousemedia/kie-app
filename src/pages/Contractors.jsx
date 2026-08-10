import React, { useState } from "react";
import { useKieData } from "@/lib/useKieData";
import { base44 } from "@/api/base44Client";
import { formatGBP, formatDate, statusColor, daysUntil, logActivity } from "@/lib/kieUtils";
import { Search, Plus, Star, Phone, Mail, MapPin, Shield, Wrench } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

export default function Contractors() {
  const { contractors, tickets, properties, reload, loading } = useKieData();
  const [search, setSearch] = useState("");
  const [addOpen, setAddOpen] = useState(false);

  const filtered = contractors.filter((c) =>
    c.name?.toLowerCase().includes(search.toLowerCase()) || c.trade?.toLowerCase().includes(search.toLowerCase()) || c.coverage_area?.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return <div className="flex items-center justify-center h-96"><div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold text-slate-900">Contractors</h1><p className="text-sm text-slate-500 mt-0.5">{contractors.length} contractors · {contractors.filter(c => c.preferred).length} preferred</p></div>
        <button onClick={() => setAddOpen(true)} className="flex items-center gap-2 px-4 py-2 bg-[hsl(var(--navy))] text-white rounded-lg text-sm font-medium hover:bg-[hsl(var(--navy-light))]"><Plus className="w-4 h-4" /> Add contractor</button>
      </div>
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name, trade, area..." className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--sage))]/30" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((c) => {
          const contractorTickets = tickets.filter((t) => t.contractor_id === c.id);
          const activeJobs = contractorTickets.filter((t) => t.status !== "Complete" && t.status !== "Cancelled").length;
          const insuranceDays = daysUntil(c.insurance_expiry);
          return (
            <div key={c.id} className="bg-white rounded-xl border border-slate-200 p-5 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-lg bg-slate-100 flex items-center justify-center"><Wrench className="w-5 h-5 text-slate-500" /></div>
                  <div><p className="text-sm font-semibold text-slate-900 flex items-center gap-1.5">{c.name}{c.preferred && <span className="text-[9px] bg-[hsl(var(--sage))] text-white px-1 py-0.5 rounded-full">PREFERRED</span>}</p><p className="text-xs text-slate-500">{c.trade}</p></div>
                </div>
                <div className="flex items-center gap-1"><Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" /><span className="text-xs font-medium text-slate-600">{c.rating}</span></div>
              </div>
              <div className="space-y-1.5 text-xs text-slate-500">
                <p className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5" />{c.coverage_area}</p>
                <p className="flex items-center gap-1.5"><Phone className="w-3.5 h-3.5" />{c.phone}</p>
                {c.email && <p className="flex items-center gap-1.5"><Mail className="w-3.5 h-3.5" />{c.email}</p>}
                <p className="flex items-center gap-1.5"><Shield className="w-3.5 h-3.5" />Insurance: {insuranceDays !== null ? `${insuranceDays}d` : "—"} {insuranceDays < 30 && insuranceDays >= 0 && <span className="text-amber-600">(expiring)</span>}</p>
              </div>
              <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-100">
                <span className={`text-xs px-2 py-0.5 rounded-full ${statusColor(c.availability)}`}>{c.availability}</span>
                <span className="text-xs text-slate-500">{activeJobs} active · avg {formatGBP(c.avg_quote)}</span>
              </div>
            </div>
          );
        })}
      </div>
      <AddContractorModal open={addOpen} onClose={() => setAddOpen(false)} onCreated={reload} />
    </div>
  );
}

function AddContractorModal({ open, onClose, onCreated }) {
  const [form, setForm] = useState({ name: "", trade: "Plumbing", services: "", coverage_area: "", phone: "", email: "", availability: "Available", insurance_expiry: "", rating: 4, preferred: false, avg_quote: 0 });
  const [saving, setSaving] = useState(false);
  const handleSubmit = async () => {
    if (!form.name || !form.trade) { toast.error("Name and trade required"); return; }
    setSaving(true);
    try {
      const c = await base44.entities.Contractor.create(form);
      await logActivity(base44, { event_type: "Contractor assigned", description: `Contractor added: ${form.name} (${form.trade})`, related_id: c.id });
      toast.success("Contractor added"); onCreated(); onClose();
      setForm({ name: "", trade: "Plumbing", services: "", coverage_area: "", phone: "", email: "", availability: "Available", insurance_expiry: "", rating: 4, preferred: false, avg_quote: 0 });
    } catch (e) { toast.error("Failed"); } finally { setSaving(false); }
  };
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader><DialogTitle>Add contractor</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3 py-2">
          <div className="space-y-1.5"><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
          <div className="space-y-1.5"><Label>Trade</Label><Select value={form.trade} onValueChange={(v) => setForm({ ...form, trade: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{["Plumbing", "Heating/Gas", "Electrical", "General", "Carpentry", "Roofing", "Pest control", "Cleaning", "Locksmith", "Appliance repair"].map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent></Select></div>
          <div className="col-span-2 space-y-1.5"><Label>Services</Label><Input value={form.services} onChange={(e) => setForm({ ...form, services: e.target.value })} placeholder="e.g. Boiler repair, powerflushing, gas safety" /></div>
          <div className="space-y-1.5"><Label>Coverage area</Label><Input value={form.coverage_area} onChange={(e) => setForm({ ...form, coverage_area: e.target.value })} placeholder="e.g. Greater London, Surrey" /></div>
          <div className="space-y-1.5"><Label>Phone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
          <div className="space-y-1.5"><Label>Email</Label><Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
          <div className="space-y-1.5"><Label>Availability</Label><Select value={form.availability} onValueChange={(v) => setForm({ ...form, availability: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{["Available", "Limited", "Booked", "On holiday"].map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent></Select></div>
          <div className="space-y-1.5"><Label>Insurance expiry</Label><Input type="date" value={form.insurance_expiry} onChange={(e) => setForm({ ...form, insurance_expiry: e.target.value })} /></div>
          <div className="space-y-1.5"><Label>Rating (1-5)</Label><Input type="number" step="0.1" max="5" value={form.rating} onChange={(e) => setForm({ ...form, rating: parseFloat(e.target.value) })} /></div>
          <div className="space-y-1.5"><Label>Avg quote (£)</Label><Input type="number" value={form.avg_quote} onChange={(e) => setForm({ ...form, avg_quote: parseFloat(e.target.value) })} /></div>
          <div className="col-span-2 flex items-center gap-2"><input type="checkbox" checked={form.preferred} onChange={(e) => setForm({ ...form, preferred: e.target.checked })} id="pref" /><Label htmlFor="pref">Preferred contractor</Label></div>
        </div>
        <DialogFooter><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={handleSubmit} disabled={saving}>Add</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}