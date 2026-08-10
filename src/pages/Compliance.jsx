import React, { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useKieData } from "@/lib/useKieData";
import PropertyLink from "@/components/shared/PropertyLink";
import { base44 } from "@/api/base44Client";
import { formatDate, daysUntil, statusColor, logActivity } from "@/lib/kieUtils";
import { Search, Plus, FileCheck, AlertTriangle, CheckCircle2, XCircle, Upload, Bell } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

const categories = ["Gas Safety Certificate", "EPC", "EICR", "Boiler service", "Smoke/CO alarm", "HMO licence", "Insurance", "Tenancy agreement", "Inventory", "Legionella Risk Assessment", "PAT Test", "Deposit Protection Certificate"];

const STATUS_PARAM_MAP = { expiring: "Expiring soon", overdue: "Overdue", missing: "Missing", compliant: "Compliant" };

export default function Compliance() {
  const { compliance, properties, tenants, reload, loading } = useKieData();
  const [searchParams] = useSearchParams();
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState(() => STATUS_PARAM_MAP[searchParams.get("status")] || "all");
  const [addOpen, setAddOpen] = useState(false);

  const filtered = compliance.filter((c) => {
    const prop = properties.find((p) => p.id === c.property_id);
    const matchSearch = !search || c.category?.toLowerCase().includes(search.toLowerCase()) || prop?.name?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === "all" || c.status === filterStatus;
    return matchSearch && matchStatus;
  });

  const toggleStatus = (status) => setFilterStatus((cur) => (cur === status ? "all" : status));

  const compliant = compliance.filter((c) => c.status === "Compliant").length;
  const expiring = compliance.filter((c) => c.status === "Expiring soon").length;
  const overdue = compliance.filter((c) => c.status === "Overdue").length;
  const missing = compliance.filter((c) => c.status === "Missing").length;

  if (loading) return <div className="flex items-center justify-center h-96"><div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin" /></div>;

  const sendReminder = async (c) => {
    await logActivity(base44, { property_id: c.property_id, event_type: "Compliance reminder", description: `Reminder sent: ${c.category} expires ${formatDate(c.expiry_date)} (${daysUntil(c.expiry_date)}d)`, related_id: c.id, severity: daysUntil(c.expiry_date) <= 7 ? "critical" : "warning" });
    toast.success("Reminder logged");
    reload();
  };

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold text-slate-900">Compliance & Documents</h1><p className="text-sm text-slate-500 mt-0.5">{compliance.length} records across {properties.length} properties</p></div>
        <button onClick={() => setAddOpen(true)} className="flex items-center gap-2 px-4 py-2 bg-[hsl(var(--navy))] text-white rounded-lg text-sm font-medium hover:bg-[hsl(var(--navy-light))]"><Plus className="w-4 h-4" /> Add record</button>
      </div>

      <div className="grid grid-cols-4 gap-3">
        {[
          { status: "Compliant", count: compliant, icon: CheckCircle2, iconCls: "text-emerald-500", countCls: "text-emerald-600" },
          { status: "Expiring soon", count: expiring, icon: AlertTriangle, iconCls: "text-amber-500", countCls: "text-amber-600" },
          { status: "Overdue", count: overdue, icon: XCircle, iconCls: "text-rose-500", countCls: "text-rose-600" },
          { status: "Missing", count: missing, icon: FileCheck, iconCls: "text-slate-400", countCls: "text-slate-600" },
        ].map(({ status, count, icon: Icon, iconCls, countCls }) => (
          <button
            key={status}
            onClick={() => toggleStatus(status)}
            className={`bg-white rounded-xl border p-4 text-left transition-all hover:border-[hsl(var(--sage))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--sage))] ${filterStatus === status ? "border-[hsl(var(--sage))] ring-1 ring-[hsl(var(--sage))]" : "border-slate-200"}`}
            title={filterStatus === status ? "Click to clear filter" : `Show only ${status.toLowerCase()} records`}
          >
            <div className="flex items-center gap-2 mb-1"><Icon className={`w-4 h-4 ${iconCls}`} /><span className="text-xs text-slate-500">{status}</span></div>
            <p className={`text-xl font-bold ${countCls}`}>{count}</p>
          </button>
        ))}
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search compliance..." className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--sage))]/30" />
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs text-slate-500 uppercase">
            <tr><th className="text-left px-4 py-3">Category</th><th className="text-left px-4 py-3">Property</th><th className="text-left px-4 py-3">Issue date</th><th className="text-left px-4 py-3">Expiry</th><th className="text-left px-4 py-3">Days left</th><th className="text-left px-4 py-3">Status</th><th className="px-4 py-3"></th></tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.map((c) => {
              const prop = properties.find((p) => p.id === c.property_id);
              const d = daysUntil(c.expiry_date);
              return (
                <tr key={c.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-800">{c.category}</td>
                  <td className="px-4 py-3 text-slate-600"><PropertyLink property={prop} /></td>
                  <td className="px-4 py-3 text-slate-600">{formatDate(c.issue_date)}</td>
                  <td className="px-4 py-3 text-slate-600">{formatDate(c.expiry_date)}</td>
                  <td className="px-4 py-3">{d !== null && <span className={`text-xs font-medium ${d < 0 ? "text-rose-600" : d <= 30 ? "text-amber-600" : "text-slate-500"}`}>{d < 0 ? `${Math.abs(d)}d overdue` : `${d}d`}</span>}</td>
                  <td className="px-4 py-3"><span className={`text-xs px-2 py-0.5 rounded-full ${statusColor(c.status)}`}>{c.status}</span></td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      {c.status !== "Compliant" && <button onClick={() => sendReminder(c)} className="text-xs px-2 py-1 rounded-md bg-blue-50 text-blue-700 hover:bg-blue-100 font-medium flex items-center gap-1"><Bell className="w-3 h-3" /> Remind</button>}
                      {c.file_url ? <a href={c.file_url} target="_blank" rel="noreferrer" className="text-xs px-2 py-1 rounded-md bg-slate-100 text-slate-600 hover:bg-slate-200 font-medium">View</a> : <button className="text-xs px-2 py-1 rounded-md bg-slate-100 text-slate-400 font-medium flex items-center gap-1"><Upload className="w-3 h-3" /> Upload</button>}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <AddComplianceModal open={addOpen} onClose={() => setAddOpen(false)} onCreated={reload} properties={properties} />
    </div>
  );
}

function AddComplianceModal({ open, onClose, onCreated, properties }) {
  const [form, setForm] = useState({ property_id: "", category: "Gas Safety Certificate", issue_date: "", expiry_date: "", status: "Compliant", notes: "" });
  const [saving, setSaving] = useState(false);
  const handleSubmit = async () => {
    if (!form.property_id || !form.expiry_date) { toast.error("Property and expiry date required"); return; }
    const d = daysUntil(form.expiry_date);
    let status = "Compliant";
    if (d < 0) status = "Overdue"; else if (d <= 60) status = "Expiring soon";
    setSaving(true);
    try {
      const c = await base44.entities.ComplianceRecord.create({ ...form, status });
      await logActivity(base44, { property_id: form.property_id, event_type: "Document upload", description: `Compliance record added: ${form.category} (expires ${formatDate(form.expiry_date)})`, related_id: c.id, severity: status === "Overdue" ? "critical" : status === "Expiring soon" ? "warning" : "info" });
      toast.success("Record added"); onCreated(); onClose();
      setForm({ property_id: "", category: "Gas Safety Certificate", issue_date: "", expiry_date: "", status: "Compliant", notes: "" });
    } catch (e) { toast.error("Failed"); } finally { setSaving(false); }
  };
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Add compliance record</DialogTitle></DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1.5"><Label>Property</Label><Select value={form.property_id} onValueChange={(v) => setForm({ ...form, property_id: v })}><SelectTrigger><SelectValue placeholder="Select property" /></SelectTrigger><SelectContent>{properties.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent></Select></div>
          <div className="space-y-1.5"><Label>Category</Label><Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{categories.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent></Select></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>Issue date</Label><Input type="date" value={form.issue_date} onChange={(e) => setForm({ ...form, issue_date: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Expiry date</Label><Input type="date" value={form.expiry_date} onChange={(e) => setForm({ ...form, expiry_date: e.target.value })} /></div>
          </div>
          <div className="space-y-1.5"><Label>Notes</Label><Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
        </div>
        <DialogFooter><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={handleSubmit} disabled={saving}>Add</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}