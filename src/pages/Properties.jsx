import React, { useState } from "react";
import { useSearchParams, useNavigate, Navigate } from "react-router-dom";
import { useKieData } from "@/lib/useKieData";
import { base44 } from "@/api/base44Client";
import { formatGBP, formatDate, daysUntil, statusColor } from "@/lib/kieUtils";
import { logActivity } from "@/lib/kieUtils";
import {
  Building2, Search, LayoutGrid, List, Plus, X, MapPin, Users, Wrench, FileCheck, Sheet,
} from "lucide-react";
import { Link } from "react-router-dom";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

export default function Properties() {
  const { properties, tenants, compliance, tickets, units, reload, loading } = useKieData();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [view, setView] = useState("grid");
  const [search, setSearch] = useState("");
  const [addOpen, setAddOpen] = useState(false);

  // Legacy deep link: /properties?property=<id> → the detail route
  const propParam = searchParams.get("property");
  if (propParam) return <Navigate to={`/properties/${propParam}`} replace />;

  const filtered = properties.filter((p) =>
    p.name?.toLowerCase().includes(search.toLowerCase()) ||
    p.address?.toLowerCase().includes(search.toLowerCase()) ||
    p.postcode?.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return <div className="flex items-center justify-center h-96"><div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Properties</h1>
          <p className="text-sm text-slate-500 mt-0.5">{properties.length} properties · {units.length} units</p>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/import" className="flex items-center gap-2 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50">
            <Sheet className="w-4 h-4" /> Import from sheet
          </Link>
          <button onClick={() => setAddOpen(true)} className="flex items-center gap-2 px-4 py-2 bg-[hsl(var(--navy))] text-white rounded-lg text-sm font-medium hover:bg-[hsl(var(--navy-light))]">
            <Plus className="w-4 h-4" /> Add property
          </button>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search properties..." className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--sage))]/30" />
        </div>
        <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg p-1">
          <button onClick={() => setView("grid")} className={`p-1.5 rounded ${view === "grid" ? "bg-slate-100" : ""}`}><LayoutGrid className="w-4 h-4 text-slate-600" /></button>
          <button onClick={() => setView("table")} className={`p-1.5 rounded ${view === "table" ? "bg-slate-100" : ""}`}><List className="w-4 h-4 text-slate-600" /></button>
        </div>
      </div>

      {view === "grid" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((p) => {
            const propTenants = tenants.filter((t) => t.property_id === p.id);
            const propCompliance = compliance.filter((c) => c.property_id === p.id);
            const expiring = propCompliance.filter((c) => { const d = daysUntil(c.expiry_date); return d !== null && d <= 60; }).length;
            const openTickets = tickets.filter((t) => t.property_id === p.id && t.status !== "Complete" && t.status !== "Cancelled").length;
            return (
              <button key={p.id} onClick={() => navigate(`/properties/${p.id}`)} className="bg-white rounded-xl border border-slate-200 p-5 text-left hover:border-[hsl(var(--sage))] hover:shadow-md transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--sage))]">
                <div className="flex items-start justify-between mb-3">
                  <div className="w-11 h-11 rounded-lg bg-slate-100 flex items-center justify-center">
                    <Building2 className="w-5 h-5 text-slate-500" />
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${statusColor(p.occupancy_status)}`}>{p.occupancy_status}</span>
                </div>
                <h3 className="text-base font-semibold text-slate-900">{p.name}</h3>
                <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5"><MapPin className="w-3 h-3" />{p.address}, {p.postcode}</p>
                <div className="flex items-center gap-3 mt-3 text-xs text-slate-500">
                  <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5" />{propTenants.length} tenants</span>
                  <span className="flex items-center gap-1"><Wrench className="w-3.5 h-3.5" />{openTickets} open</span>
                  {expiring > 0 && <span className="flex items-center gap-1 text-amber-600"><FileCheck className="w-3.5 h-3.5" />{expiring} expiring</span>}
                </div>
              </button>
            );
          })}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs text-slate-500 uppercase">
              <tr>
                <th className="text-left px-4 py-3 font-medium">Property</th>
                <th className="text-left px-4 py-3 font-medium">Type</th>
                <th className="text-left px-4 py-3 font-medium">Occupancy</th>
                <th className="text-left px-4 py-3 font-medium">Tenants</th>
                <th className="text-left px-4 py-3 font-medium">Open issues</th>
                <th className="text-left px-4 py-3 font-medium">Compliance</th>
                <th className="text-right px-4 py-3 font-medium">Rent/mo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((p) => {
                const propTenants = tenants.filter((t) => t.property_id === p.id).length;
                const openTickets = tickets.filter((t) => t.property_id === p.id && t.status !== "Complete" && t.status !== "Cancelled").length;
                const expiring = compliance.filter((c) => c.property_id === p.id && daysUntil(c.expiry_date) <= 60 && daysUntil(c.expiry_date) !== null).length;
                return (
                  <tr key={p.id} onClick={() => navigate(`/properties/${p.id}`)} className="hover:bg-slate-50 cursor-pointer">
                    <td className="px-4 py-3"><p className="font-medium text-slate-900">{p.name}</p><p className="text-xs text-slate-500">{p.postcode}</p></td>
                    <td className="px-4 py-3 text-slate-600">{p.property_type}</td>
                    <td className="px-4 py-3"><span className={`text-xs px-2 py-0.5 rounded-full ${statusColor(p.occupancy_status)}`}>{p.occupancy_status}</span></td>
                    <td className="px-4 py-3 text-slate-600">{propTenants}</td>
                    <td className="px-4 py-3">{openTickets > 0 ? <span className="text-blue-600 font-medium">{openTickets}</span> : <span className="text-slate-300">—</span>}</td>
                    <td className="px-4 py-3">{expiring > 0 ? <span className="text-amber-600 font-medium">{expiring} expiring</span> : <span className="text-emerald-600">OK</span>}</td>
                    <td className="px-4 py-3 text-right font-medium text-slate-700">{formatGBP(p.monthly_rent_expected)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <AddPropertyModal open={addOpen} onClose={() => setAddOpen(false)} onCreated={reload} />
    </div>
  );
}

function PropertyDetail({ property, onClose, data }) {
  const { tenants, equipment, compliance, tickets, bills, units } = data;
  const propTenants = tenants.filter((t) => t.property_id === property.id);
  const propEquipment = equipment.filter((e) => e.property_id === property.id);
  const propCompliance = compliance.filter((c) => c.property_id === property.id);
  const propTickets = tickets.filter((t) => t.property_id === property.id);
  const propBills = bills.filter((b) => b.property_id === property.id);
  const propUnits = units.filter((u) => u.property_id === property.id);

  return (
    <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 bg-white px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-900">{property.name}</h2>
            <p className="text-sm text-slate-500">{property.address}, {property.postcode}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-100"><X className="w-5 h-5 text-slate-500" /></button>
        </div>
        <div className="p-6 space-y-5">
          <div className="flex items-center gap-2">
            <span className={`text-xs px-2.5 py-1 rounded-full ${statusColor(property.occupancy_status)}`}>{property.occupancy_status}</span>
            <span className="text-xs px-2.5 py-1 rounded-full bg-slate-100 text-slate-600">{property.property_type}</span>
            {property.hmo_status !== "Not HMO" && <span className="text-xs px-2.5 py-1 rounded-full bg-purple-100 text-purple-700">{property.hmo_status}</span>}
            <span className="text-xs px-2.5 py-1 rounded-full bg-slate-100 text-slate-600">{propUnits.length || property.units_count} units</span>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="p-3 bg-slate-50 rounded-lg"><p className="text-xs text-slate-400">Expected rent/mo</p><p className="text-lg font-bold text-slate-900">{formatGBP(property.monthly_rent_expected)}</p></div>
            <div className="p-3 bg-slate-50 rounded-lg"><p className="text-xs text-slate-400">Council tax band</p><p className="text-lg font-bold text-slate-900">{property.council_tax_band || "—"}</p></div>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-slate-900 mb-2">Tenants ({propTenants.length})</h3>
            {propTenants.map((t) => (
              <div key={t.id} className="flex items-center justify-between py-2 border-b border-slate-100">
                <div><p className="text-sm font-medium text-slate-800">{t.name}</p><p className="text-xs text-slate-500">{t.phone}</p></div>
                <div className="text-right"><p className="text-sm font-medium">{formatGBP(t.rent_amount)}</p><span className={`text-xs px-1.5 py-0.5 rounded-full ${statusColor(t.payment_status)}`}>{t.payment_status}</span></div>
              </div>
            ))}
          </div>

          <div>
            <h3 className="text-sm font-semibold text-slate-900 mb-2">Equipment ({propEquipment.length})</h3>
            {propEquipment.map((e) => (
              <div key={e.id} className="p-3 bg-slate-50 rounded-lg mb-2">
                <p className="text-sm font-medium text-slate-800">{e.make} {e.model}</p>
                <p className="text-xs text-slate-500">{e.type} · Installed {formatDate(e.install_date)}</p>
                {e.next_service_due && <p className="text-xs text-slate-500">Next service: {formatDate(e.next_service_due)}</p>}
              </div>
            ))}
          </div>

          <div>
            <h3 className="text-sm font-semibold text-slate-900 mb-2">Compliance ({propCompliance.length})</h3>
            {propCompliance.map((c) => (
              <div key={c.id} className="flex items-center justify-between py-2 border-b border-slate-100">
                <span className="text-sm text-slate-700">{c.category}</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-500">{formatDate(c.expiry_date)}</span>
                  <span className={`text-xs px-1.5 py-0.5 rounded-full ${statusColor(c.status)}`}>{c.status}</span>
                </div>
              </div>
            ))}
          </div>

          {propTickets.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-slate-900 mb-2">Maintenance ({propTickets.length})</h3>
              {propTickets.map((t) => (
                <div key={t.id} className="flex items-center justify-between py-2 border-b border-slate-100">
                  <span className="text-sm text-slate-700 truncate">{t.description}</span>
                  <span className={`text-xs px-1.5 py-0.5 rounded-full ${statusColor(t.status)}`}>{t.status}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function AddPropertyModal({ open, onClose, onCreated }) {
  const [form, setForm] = useState({ name: "", address: "", postcode: "", property_type: "House", hmo_status: "Not HMO", units_count: 1, occupancy_status: "Vacant", monthly_rent_expected: 0, council_tax_band: "B" });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    if (!form.name || !form.address || !form.postcode) { toast.error("Name, address and postcode are required"); return; }
    setSaving(true);
    try {
      const prop = await base44.entities.Property.create(form);
      await logActivity(base44, { property_id: prop.id, event_type: "Property update", description: `Property created: ${form.name}` });
      toast.success("Property added");
      onCreated();
      onClose();
      setForm({ name: "", address: "", postcode: "", property_type: "House", hmo_status: "Not HMO", units_count: 1, occupancy_status: "Vacant", monthly_rent_expected: 0, council_tax_band: "B" });
    } catch (e) { toast.error("Failed to add property"); }
    finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader><DialogTitle>Add property</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3 py-2">
          <div className="col-span-2 space-y-1.5"><Label>Property name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. 7 Willow Court" /></div>
          <div className="col-span-2 space-y-1.5"><Label>Address</Label><Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
          <div className="space-y-1.5"><Label>Postcode</Label><Input value={form.postcode} onChange={(e) => setForm({ ...form, postcode: e.target.value })} /></div>
          <div className="space-y-1.5"><Label>Property type</Label><Select value={form.property_type} onValueChange={(v) => setForm({ ...form, property_type: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{["House", "Flat", "HMO", "Bungalow", "Studio"].map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent></Select></div>
          <div className="space-y-1.5"><Label>HMO status</Label><Select value={form.hmo_status} onValueChange={(v) => setForm({ ...form, hmo_status: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{["Not HMO", "Licensed HMO", "HMO (unlicensed)"].map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent></Select></div>
          <div className="space-y-1.5"><Label>Units/rooms</Label><Input type="number" value={form.units_count} onChange={(e) => setForm({ ...form, units_count: parseInt(e.target.value) })} /></div>
          <div className="space-y-1.5"><Label>Monthly rent (£)</Label><Input type="number" value={form.monthly_rent_expected} onChange={(e) => setForm({ ...form, monthly_rent_expected: parseFloat(e.target.value) })} /></div>
          <div className="space-y-1.5"><Label>Council tax band</Label><Select value={form.council_tax_band} onValueChange={(v) => setForm({ ...form, council_tax_band: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{["A", "B", "C", "D", "E", "F", "G", "H"].map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent></Select></div>
        </div>
        <DialogFooter><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={handleSubmit} disabled={saving}>Add property</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}