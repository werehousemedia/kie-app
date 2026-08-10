import React, { useMemo, useState } from "react";
import { useParams, useNavigate, useSearchParams, Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useKieData } from "@/lib/useKieData";
import { formatGBP, formatDate, daysUntil, urgencyColor, statusColor, timeAgo, logActivity } from "@/lib/kieUtils";
import { buildPropertyEvents, KIND_META } from "@/lib/calendarEvents";
import TenantChip from "@/components/shared/TenantChip";
import PropertyCalendar from "@/components/property/PropertyCalendar";
import InventorySection from "@/components/property/InventorySection";
import AddEventModal from "@/components/property/AddEventModal";
import {
  ArrowLeft, Building2, Wallet, Users, Wrench, FileCheck, TrendingUp,
  DoorOpen, Pencil, ArrowRight, ExternalLink,
} from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

const TABS = ["overview", "units", "money", "maintenance", "inventory", "documents", "calendar"];

function MetricCard({ label, value, sublabel, icon: Icon, onClick, tone = "default" }) {
  const toneCls = tone === "alert" ? "text-rose-600" : tone === "warn" ? "text-amber-600" : "text-slate-900";
  return (
    <button onClick={onClick} className="bg-white rounded-xl border border-slate-200 p-4 text-left hover:border-[hsl(var(--sage))] hover:shadow-sm transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--sage))] group">
      <div className="flex items-center justify-between mb-1.5">
        <Icon className="w-4 h-4 text-slate-400" />
        <ArrowRight className="w-3.5 h-3.5 text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
      <p className={`text-lg font-bold ${toneCls}`}>{value}</p>
      <p className="text-xs text-slate-500">{label}</p>
      {sublabel && <p className="text-[11px] text-slate-400 mt-0.5">{sublabel}</p>}
    </button>
  );
}

export default function PropertyDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const data = useKieData();
  const { properties, units, tenants, tenancies, equipment, compliance, tickets, bills, transactions, activity, loading, reload } = data;
  const [editOpen, setEditOpen] = useState(false);
  const [addEventKind, setAddEventKind] = useState(null);

  const tab = TABS.includes(searchParams.get("tab")) ? searchParams.get("tab") : "overview";
  const setTab = (t) => setSearchParams(t === "overview" ? {} : { tab: t }, { replace: true });

  const property = properties.find((p) => p.id === id);

  const propUnits = useMemo(() => units.filter((u) => u.property_id === id), [units, id]);
  const propTenants = useMemo(() => tenants.filter((t) => t.property_id === id), [tenants, id]);
  const activeTenancies = useMemo(() => tenancies.filter((ty) => ty.property_id === id && ty.status !== "Ended"), [tenancies, id]);
  const propTickets = useMemo(() => tickets.filter((t) => t.property_id === id), [tickets, id]);
  const openTickets = propTickets.filter((t) => t.status !== "Complete" && t.status !== "Cancelled");
  const propCompliance = useMemo(() => compliance.filter((c) => c.property_id === id), [compliance, id]);
  const propBills = useMemo(() => bills.filter((b) => b.property_id === id), [bills, id]);
  const propTransactions = useMemo(() => transactions.filter((t) => t.property_id === id), [transactions, id]);
  const propActivity = useMemo(() => activity.filter((a) => a.property_id === id).slice(0, 8), [activity, id]);

  const events = useMemo(
    () => buildPropertyEvents({ propertyId: id, bills, tickets, compliance, equipment, tenancies, tenants, properties }),
    [id, bills, tickets, compliance, equipment, tenancies, tenants, properties]
  );
  const today = new Date().toISOString().slice(0, 10);
  const upcoming = events.filter((e) => e.date >= today).slice(0, 5);

  if (loading) return <div className="flex items-center justify-center h-96"><div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin" /></div>;

  if (!property) {
    return (
      <div className="text-center py-20">
        <Building2 className="w-10 h-10 text-slate-300 mx-auto mb-3" />
        <p className="text-slate-600 font-medium">Property not found</p>
        <Link to="/properties" className="text-sm text-[hsl(var(--sage))] hover:underline mt-2 inline-block">← Back to properties</Link>
      </div>
    );
  }

  // Derived money metrics — tenancies are the source of truth for income
  const monthlyIncome = activeTenancies.length > 0
    ? activeTenancies.reduce((s, ty) => s + (ty.rent_amount || 0), 0)
    : propTenants.reduce((s, t) => s + (t.rent_amount || 0), 0) || property.monthly_rent_expected || 0;
  const grossYield = property.purchase_value > 0 && monthlyIncome > 0
    ? ((monthlyIncome * 12) / property.purchase_value) * 100
    : null;
  const occupiedUnits = propUnits.filter((u) => u.occupancy_status === "Occupied").length;
  const complianceWorst = propCompliance.some((c) => c.status === "Overdue") ? "Overdue"
    : propCompliance.some((c) => c.status === "Expiring soon") ? "Expiring soon"
    : propCompliance.length > 0 ? "Compliant" : "No records";
  const expenseByCategory = propBills.filter((b) => !b.is_income).reduce((m, b) => {
    m[b.category] = (m[b.category] || 0) + (b.amount || 0);
    return m;
  }, {});

  const tenantForUnit = (u) => propTenants.find((t) => t.unit_id === u.id) || propTenants.find((t) => t.id === u.tenant_id);

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Breadcrumb + header */}
      <div>
        <button onClick={() => navigate("/properties")} className="text-sm text-slate-500 hover:text-slate-800 flex items-center gap-1 mb-2"><ArrowLeft className="w-3.5 h-3.5" /> Properties</button>
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">{property.name}</h1>
            <p className="text-sm text-slate-500 mt-0.5">{property.address}{property.postcode ? `, ${property.postcode}` : ""}</p>
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <span className={`text-xs px-2.5 py-1 rounded-full ${statusColor(property.occupancy_status)}`}>{property.occupancy_status}</span>
              <span className="text-xs px-2.5 py-1 rounded-full bg-slate-100 text-slate-600">{property.property_type}</span>
              {property.hmo_status !== "Not HMO" && <span className="text-xs px-2.5 py-1 rounded-full bg-purple-100 text-purple-700">{property.hmo_status}</span>}
              {property.council_tax_band && <span className="text-xs px-2.5 py-1 rounded-full bg-slate-100 text-slate-600">Band {property.council_tax_band}</span>}
            </div>
          </div>
          <button onClick={() => setEditOpen(true)} className="flex items-center gap-1.5 px-3 py-2 border border-slate-300 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50"><Pencil className="w-3.5 h-3.5" /> Edit</button>
        </div>
      </div>

      {/* Metric strip — every card navigates */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <MetricCard label="Property value" value={property.purchase_value ? formatGBP(property.purchase_value) : "Set value"} icon={Building2} onClick={() => setEditOpen(true)} />
        <MetricCard label="Rental income /mo" value={formatGBP(monthlyIncome)} sublabel={`${activeTenancies.length || propTenants.length} tenanc${(activeTenancies.length || propTenants.length) === 1 ? "y" : "ies"}`} icon={Wallet} onClick={() => setTab("money")} />
        <MetricCard label="Occupancy" value={propUnits.length > 0 ? `${occupiedUnits}/${propUnits.length}` : property.occupancy_status} sublabel={propUnits.length > 0 ? "rooms occupied" : null} icon={DoorOpen} onClick={() => setTab("units")} />
        <MetricCard label="Gross yield" value={grossYield ? `${grossYield.toFixed(1)}%` : "—"} sublabel={grossYield ? null : "needs value + rent"} icon={TrendingUp} onClick={() => setTab("money")} />
        <MetricCard label="Open maintenance" value={openTickets.length} tone={openTickets.some((t) => t.urgency === "emergency") ? "alert" : "default"} icon={Wrench} onClick={() => setTab("maintenance")} />
        <MetricCard label="Compliance" value={complianceWorst} tone={complianceWorst === "Overdue" ? "alert" : complianceWorst === "Expiring soon" ? "warn" : "default"} icon={FileCheck} onClick={() => setTab("documents")} />
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="units">Units & Tenants</TabsTrigger>
          <TabsTrigger value="money">Money</TabsTrigger>
          <TabsTrigger value="maintenance">Maintenance</TabsTrigger>
          <TabsTrigger value="inventory">Furniture & Inventory</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
          <TabsTrigger value="calendar">Calendar</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4 mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-slate-900">Who lives here</h2>
                <button onClick={() => setTab("units")} className="text-xs text-[hsl(var(--sage))] hover:underline">All units →</button>
              </div>
              {propTenants.length === 0 && <p className="text-sm text-slate-400">No tenants recorded.</p>}
              <div className="space-y-2">
                {propTenants.map((t) => {
                  const ty = activeTenancies.find((x) => x.tenant_id === t.id);
                  const unit = propUnits.find((u) => u.id === t.unit_id);
                  return (
                    <div key={t.id} className="flex items-center justify-between gap-2 py-1.5">
                      <TenantChip tenant={t} size="md" />
                      <div className="text-right">
                        <p className="text-sm font-medium text-slate-800">{formatGBP(ty?.rent_amount ?? t.rent_amount)}/mo</p>
                        <p className="text-xs text-slate-500">{unit?.unit_label || property.property_type}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-slate-900">Coming up</h2>
                <button onClick={() => setTab("calendar")} className="text-xs text-[hsl(var(--sage))] hover:underline">Calendar →</button>
              </div>
              {upcoming.length === 0 && <p className="text-sm text-slate-400">Nothing scheduled.</p>}
              <div className="space-y-1">
                {upcoming.map((e) => (
                  <Link key={e.id} to={e.to} className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-slate-50 group">
                    <span className={`w-2 h-2 rounded-full shrink-0 ${KIND_META[e.kind]?.dot}`} />
                    <span className="text-sm text-slate-700 truncate flex-1 group-hover:underline decoration-[hsl(var(--sage))] underline-offset-2">{e.label}</span>
                    <span className="text-xs text-slate-400 shrink-0">{formatDate(e.date)}</span>
                  </Link>
                ))}
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <h2 className="text-sm font-semibold text-slate-900 mb-3">Recent activity</h2>
            {propActivity.length === 0 && <p className="text-sm text-slate-400">No activity yet for this property.</p>}
            <div className="space-y-1.5">
              {propActivity.map((a) => (
                <div key={a.id} className="flex items-start gap-2.5 py-1">
                  <span className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${a.severity === "critical" ? "bg-rose-500" : a.severity === "warning" ? "bg-amber-500" : "bg-slate-300"}`} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-slate-700">{a.description}</p>
                    <p className="text-[11px] text-slate-400">{a.event_type} · {timeAgo(a.timestamp)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="units" className="mt-4">
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            {propUnits.length === 0 ? (
              <div className="p-8 text-center">
                <DoorOpen className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-sm text-slate-500">Single unit — no individual rooms tracked.</p>
                {propTenants.length > 0 && <div className="mt-3 flex justify-center"><TenantChip tenant={propTenants[0]} size="md" /></div>}
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-xs text-slate-500 uppercase">
                  <tr><th className="text-left px-4 py-3">Room</th><th className="text-left px-4 py-3">Status</th><th className="text-left px-4 py-3">Tenant</th><th className="text-right px-4 py-3">Rent/mo</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {[...propUnits].sort((a, b) => String(a.unit_label).localeCompare(String(b.unit_label), undefined, { numeric: true })).map((u) => {
                    const t = tenantForUnit(u);
                    return (
                      <tr key={u.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3 font-medium text-slate-800">{u.unit_label}</td>
                        <td className="px-4 py-3"><span className={`text-xs px-2 py-0.5 rounded-full ${statusColor(u.occupancy_status)}`}>{u.occupancy_status}</span></td>
                        <td className="px-4 py-3">{t ? <TenantChip tenant={t} /> : <span className="text-slate-300">—</span>}</td>
                        <td className="px-4 py-3 text-right font-medium text-slate-700">{u.rent_amount ? formatGBP(u.rent_amount) : t?.rent_amount ? formatGBP(t.rent_amount) : "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </TabsContent>

        <TabsContent value="money" className="space-y-4 mt-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-white rounded-xl border border-slate-200 p-4"><p className="text-xs text-slate-500">Monthly income</p><p className="text-lg font-bold text-emerald-600">{formatGBP(monthlyIncome)}</p></div>
            <div className="bg-white rounded-xl border border-slate-200 p-4"><p className="text-xs text-slate-500">Unpaid bills</p><p className="text-lg font-bold text-slate-900">{formatGBP(propBills.filter((b) => !b.is_income && b.status !== "Paid").reduce((s, b) => s + (b.amount || 0), 0))}</p></div>
            <div className="bg-white rounded-xl border border-slate-200 p-4"><p className="text-xs text-slate-500">Purchase value</p><p className="text-lg font-bold text-slate-900">{property.purchase_value ? formatGBP(property.purchase_value) : "—"}</p></div>
            <div className="bg-white rounded-xl border border-slate-200 p-4"><p className="text-xs text-slate-500">Gross yield</p><p className="text-lg font-bold text-slate-900">{grossYield ? `${grossYield.toFixed(1)}%` : "—"}</p></div>
          </div>

          {Object.keys(expenseByCategory).length > 0 && (
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <h2 className="text-sm font-semibold text-slate-900 mb-3">Expense breakdown</h2>
              <div className="space-y-2">
                {Object.entries(expenseByCategory).sort((a, b) => b[1] - a[1]).map(([cat, amount]) => {
                  const max = Math.max(...Object.values(expenseByCategory));
                  return (
                    <Link key={cat} to="/finance?tab=bills" className="flex items-center gap-3 group">
                      <span className="text-xs text-slate-600 w-28 shrink-0 group-hover:underline decoration-[hsl(var(--sage))] underline-offset-2">{cat}</span>
                      <div className="flex-1 bg-slate-100 rounded-full h-2 overflow-hidden"><div className="h-full bg-[hsl(var(--navy))] rounded-full" style={{ width: `${(amount / max) * 100}%` }} /></div>
                      <span className="text-xs font-medium text-slate-700 w-16 text-right shrink-0">{formatGBP(amount)}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          )}

          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-900">Bills & charges</h2>
              <Link to="/finance?tab=bills" className="text-xs text-[hsl(var(--sage))] hover:underline flex items-center gap-1">Finance <ExternalLink className="w-3 h-3" /></Link>
            </div>
            {propBills.length === 0 ? <p className="text-sm text-slate-400 p-4">No bills recorded — add one from the Calendar tab.</p> : (
              <table className="w-full text-sm">
                <tbody className="divide-y divide-slate-100">
                  {[...propBills].sort((a, b) => new Date(b.due_date) - new Date(a.due_date)).slice(0, 10).map((b) => (
                    <tr key={b.id} className="hover:bg-slate-50">
                      <td className="px-4 py-2.5 font-medium text-slate-800">{b.category}</td>
                      <td className="px-4 py-2.5 text-slate-500 text-xs">{formatDate(b.due_date)}</td>
                      <td className={`px-4 py-2.5 text-right font-medium ${b.is_income ? "text-emerald-600" : "text-slate-700"}`}>{b.is_income ? "+" : ""}{formatGBP(b.amount)}</td>
                      <td className="px-4 py-2.5 text-right"><span className={`text-xs px-2 py-0.5 rounded-full ${statusColor(b.status)}`}>{b.status}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {propTransactions.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-slate-900">Recent transactions</h2>
                <Link to="/finance?tab=transactions" className="text-xs text-[hsl(var(--sage))] hover:underline flex items-center gap-1">All transactions <ExternalLink className="w-3 h-3" /></Link>
              </div>
              <table className="w-full text-sm">
                <tbody className="divide-y divide-slate-100">
                  {[...propTransactions].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 6).map((t) => (
                    <tr key={t.id} className="hover:bg-slate-50">
                      <td className="px-4 py-2.5 text-slate-800">{t.type}</td>
                      <td className="px-4 py-2.5 text-slate-500 text-xs">{formatDate(t.date)}</td>
                      <td className={`px-4 py-2.5 text-right font-medium ${t.type?.includes("received") ? "text-emerald-600" : "text-slate-700"}`}>{t.type?.includes("received") ? "+" : ""}{formatGBP(t.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>

        <TabsContent value="maintenance" className="mt-4">
          <div className="space-y-2">
            {propTickets.length === 0 && (
              <div className="bg-slate-50 rounded-xl border border-dashed border-slate-200 p-8 text-center">
                <Wrench className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-sm text-slate-500">No maintenance history for this property.</p>
              </div>
            )}
            {[...propTickets].sort((a, b) => new Date(b.created_date || 0) - new Date(a.created_date || 0)).map((t) => {
              const tenant = tenants.find((x) => x.id === t.tenant_id);
              return (
                <Link key={t.id} to="/maintenance?status=open" className="block bg-white rounded-xl border border-slate-200 p-4 hover:border-[hsl(var(--sage))] hover:shadow-sm transition-all">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <p className="text-sm font-medium text-slate-800 truncate">{t.description}</p>
                    <span className={`text-xs px-1.5 py-0.5 rounded-full border shrink-0 ${urgencyColor(t.urgency)}`}>{t.urgency}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <span className={`px-1.5 py-0.5 rounded-full ${statusColor(t.status)}`}>{t.status}</span>
                    {tenant && <span>· {tenant.name}</span>}
                    {t.appointment_date && <span>· visit {formatDate(t.appointment_date)}</span>}
                    {t.cost_estimate != null && <span>· est. {formatGBP(t.cost_estimate)}</span>}
                  </div>
                </Link>
              );
            })}
          </div>
        </TabsContent>

        <TabsContent value="inventory" className="mt-4">
          <InventorySection propertyId={id} equipment={equipment} reload={reload} />
        </TabsContent>

        <TabsContent value="documents" className="mt-4">
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            {propCompliance.length === 0 ? (
              <div className="p-8 text-center">
                <FileCheck className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-sm text-slate-500">No compliance documents recorded — add one from the Calendar tab.</p>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-xs text-slate-500 uppercase">
                  <tr><th className="text-left px-4 py-3">Document</th><th className="text-left px-4 py-3">Provider</th><th className="text-left px-4 py-3">Issued</th><th className="text-left px-4 py-3">Expires</th><th className="text-left px-4 py-3">Status</th><th className="px-4 py-3"></th></tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {[...propCompliance].sort((a, b) => new Date(a.expiry_date || 0) - new Date(b.expiry_date || 0)).map((c) => (
                    <tr key={c.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-medium text-slate-800">{c.category}</td>
                      <td className="px-4 py-3 text-slate-600">{c.provider || "—"}</td>
                      <td className="px-4 py-3 text-slate-600">{formatDate(c.issue_date)}</td>
                      <td className="px-4 py-3 text-slate-600">{formatDate(c.expiry_date)}{daysUntil(c.expiry_date) !== null && daysUntil(c.expiry_date) <= 60 && <span className="text-xs text-amber-600 ml-1">({daysUntil(c.expiry_date)}d)</span>}</td>
                      <td className="px-4 py-3"><span className={`text-xs px-2 py-0.5 rounded-full ${statusColor(c.status)}`}>{c.status}</span></td>
                      <td className="px-4 py-3 text-right">{c.file_url && <a href={c.file_url} target="_blank" rel="noreferrer" className="text-xs text-[hsl(var(--sage))] hover:underline">View</a>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </TabsContent>

        <TabsContent value="calendar" className="mt-4">
          <PropertyCalendar events={events} onAdd={(kind) => setAddEventKind(kind)} />
        </TabsContent>
      </Tabs>

      <EditPropertyModal open={editOpen} onClose={() => setEditOpen(false)} onSaved={reload} property={property} />
      <AddEventModal open={!!addEventKind} onClose={() => setAddEventKind(null)} onSaved={reload} propertyId={id} kind={addEventKind} />
    </div>
  );
}

function EditPropertyModal({ open, onClose, onSaved, property }) {
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);

  React.useEffect(() => {
    if (open && property) {
      setForm({
        name: property.name || "",
        address: property.address || "",
        postcode: property.postcode || "",
        property_type: property.property_type || "House",
        hmo_status: property.hmo_status || "Not HMO",
        units_count: property.units_count ?? 1,
        purchase_value: property.purchase_value ?? "",
        monthly_rent_expected: property.monthly_rent_expected ?? "",
        council_tax_band: property.council_tax_band || "",
        notes: property.notes || "",
      });
    }
  }, [open, property]);

  const setInput = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async () => {
    if (!form.name || !form.address) { toast.error("Name and address are required"); return; }
    setSaving(true);
    try {
      await base44.entities.Property.update(property.id, {
        ...form,
        units_count: parseInt(form.units_count) || 1,
        purchase_value: form.purchase_value === "" ? null : parseFloat(form.purchase_value),
        monthly_rent_expected: form.monthly_rent_expected === "" ? null : parseFloat(form.monthly_rent_expected),
      });
      await logActivity(base44, { property_id: property.id, event_type: "Property update", description: `Property details updated: ${form.name}` });
      toast.success("Property updated");
      onSaved();
      onClose();
    } catch (e) {
      toast.error("Failed to update property");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Edit property</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3 py-2">
          <div className="col-span-2 space-y-1.5"><Label>Property name</Label><Input value={form.name || ""} onChange={setInput("name")} /></div>
          <div className="col-span-2 space-y-1.5"><Label>Address</Label><Input value={form.address || ""} onChange={setInput("address")} /></div>
          <div className="space-y-1.5"><Label>Postcode</Label><Input value={form.postcode || ""} onChange={setInput("postcode")} /></div>
          <div className="space-y-1.5"><Label>Property type</Label><Select value={form.property_type} onValueChange={(v) => setForm((f) => ({ ...f, property_type: v }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{["House", "Flat", "HMO", "Bungalow", "Studio", "Maisonette", "Commercial"].map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent></Select></div>
          <div className="space-y-1.5"><Label>HMO status</Label><Select value={form.hmo_status} onValueChange={(v) => setForm((f) => ({ ...f, hmo_status: v }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{["Not HMO", "Licensed HMO", "HMO (unlicensed)"].map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent></Select></div>
          <div className="space-y-1.5"><Label>Beds / rooms</Label><Input type="number" value={form.units_count ?? 1} onChange={setInput("units_count")} /></div>
          <div className="space-y-1.5"><Label>Property value (£)</Label><Input type="number" value={form.purchase_value ?? ""} onChange={setInput("purchase_value")} placeholder="e.g. 350000" /></div>
          <div className="space-y-1.5"><Label>Expected rent (£/mo)</Label><Input type="number" value={form.monthly_rent_expected ?? ""} onChange={setInput("monthly_rent_expected")} /></div>
          <div className="space-y-1.5"><Label>Council tax band</Label><Select value={form.council_tax_band || "none"} onValueChange={(v) => setForm((f) => ({ ...f, council_tax_band: v === "none" ? "" : v }))}><SelectTrigger><SelectValue placeholder="—" /></SelectTrigger><SelectContent><SelectItem value="none">—</SelectItem>{["A", "B", "C", "D", "E", "F", "G", "H"].map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent></Select></div>
          <div className="col-span-2 space-y-1.5"><Label>Notes</Label><Input value={form.notes || ""} onChange={setInput("notes")} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={saving}>Save changes</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
