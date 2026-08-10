import React, { useMemo } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useKieData } from "@/lib/useKieData";
import { formatGBP, formatDate, daysUntil, statusColor, timeAgo } from "@/lib/kieUtils";
import PropertyLink from "@/components/shared/PropertyLink";
import { TenantAvatar } from "@/components/shared/TenantChip";
import {
  ArrowLeft, Phone, Mail, MessageSquare, ShieldCheck, Users, Wallet,
  CalendarDays, FileCheck, History, TrendingUp, AlertTriangle,
} from "lucide-react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

const UTILITY_CATEGORIES = ["Gas", "Electricity", "Water", "Council tax", "Internet", "Service charge"];

function humanizeMonths(totalMonths) {
  if (totalMonths == null || totalMonths < 0) return "—";
  const years = Math.floor(totalMonths / 12);
  const months = totalMonths % 12;
  if (years === 0) return `${months} month${months === 1 ? "" : "s"}`;
  if (months === 0) return `${years} year${years === 1 ? "" : "s"}`;
  return `${years} year${years === 1 ? "" : "s"} ${months} month${months === 1 ? "" : "s"}`;
}

function monthsBetween(startStr, endStr) {
  if (!startStr) return null;
  const start = new Date(startStr);
  const end = endStr ? new Date(endStr) : new Date();
  if (isNaN(start.getTime())) return null;
  return Math.max(0, (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth()));
}

export default function TenantProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { tenants, properties, units, tenancies, bills, transactions, compliance, conversations, tickets, loading } = useKieData();

  const tenant = tenants.find((t) => t.id === id);
  const myTenancies = useMemo(
    () => tenancies.filter((ty) => ty.tenant_id === id).sort((a, b) => String(b.start_date || "").localeCompare(String(a.start_date || ""))),
    [tenancies, id]
  );
  const currentTenancy = myTenancies.find((ty) => ty.status !== "Ended") || myTenancies[0];

  if (loading) return <div className="flex items-center justify-center h-96"><div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin" /></div>;

  if (!tenant) {
    return (
      <div className="text-center py-20">
        <Users className="w-10 h-10 text-slate-300 mx-auto mb-3" />
        <p className="text-slate-600 font-medium">Tenant not found</p>
        <Link to="/tenants" className="text-sm text-[hsl(var(--sage))] hover:underline mt-2 inline-block">← Back to tenants</Link>
      </div>
    );
  }

  const property = properties.find((p) => p.id === tenant.property_id);
  const unit = units.find((u) => u.id === tenant.unit_id);
  const conv = conversations.find((c) => c.tenant_id === tenant.id);
  const myTickets = tickets.filter((t) => t.tenant_id === tenant.id);

  // Rent history across all tenancies (oldest first for the chart)
  const rentHistory = myTenancies
    .flatMap((ty) => (ty.rent_history || []).map((h) => ({ ...h, tenancyId: ty.id })))
    .filter((h) => h.date && h.amount != null)
    .sort((a, b) => String(a.date).localeCompare(String(b.date)));

  // Ecosystem tenure: earliest tenancy start → now (or last end if all ended)
  const earliest = myTenancies.length > 0 ? myTenancies[myTenancies.length - 1] : null;
  const allEnded = myTenancies.length > 0 && myTenancies.every((ty) => ty.status === "Ended");
  const tenureMonths = earliest ? monthsBetween(earliest.start_date, allEnded ? myTenancies[0].end_date : null) : monthsBetween(tenant.tenancy_start);
  const residenceMonths = currentTenancy ? monthsBetween(currentTenancy.start_date, currentTenancy.status === "Ended" ? currentTenancy.end_date : null) : null;

  // Payments: transactions for this tenant + rent bills for their property
  const myTransactions = transactions.filter((t) => t.tenant_id === tenant.id);
  const rentBills = bills
    .filter((b) => b.category === "Rent" && b.property_id === tenant.property_id)
    .sort((a, b) => String(b.due_date || "").localeCompare(String(a.due_date || "")));
  const outstanding = rentBills.filter((b) => b.status !== "Paid").reduce((s, b) => s + (b.amount || 0), 0);

  // Utilities for their property
  const utilityBills = bills.filter((b) => b.property_id === tenant.property_id && UTILITY_CATEGORIES.includes(b.category));
  const utilitiesByCategory = UTILITY_CATEGORIES.map((cat) => {
    const list = utilityBills.filter((b) => b.category === cat);
    if (list.length === 0) return null;
    const months = new Set(list.map((b) => String(b.due_date || "").slice(0, 7))).size || 1;
    const total = list.reduce((s, b) => s + (b.amount || 0), 0);
    return { category: cat, avg: total / months, list: list.sort((a, b) => String(b.due_date || "").localeCompare(String(a.due_date || ""))) };
  }).filter(Boolean);

  // Documents: records tied to this tenant, or tenancy-ish docs on their property
  const docs = compliance.filter((c) =>
    c.tenant_id === tenant.id ||
    (c.property_id === tenant.property_id && ["Tenancy agreement", "Inventory", "Deposit Protection Certificate"].includes(c.category))
  );

  const contractStatus = (() => {
    const end = currentTenancy?.end_date || tenant.tenancy_end;
    if (!end) return { label: "Open-ended", cls: "bg-slate-100 text-slate-600" };
    const d = daysUntil(end);
    if (d === null) return { label: "Open-ended", cls: "bg-slate-100 text-slate-600" };
    if (d < 0) return { label: `Ended ${formatDate(end)}`, cls: "bg-slate-100 text-slate-600" };
    if (d <= 60) return { label: `Ends in ${d}d`, cls: "bg-amber-100 text-amber-700" };
    return { label: `Active until ${formatDate(end)}`, cls: "bg-emerald-100 text-emerald-700" };
  })();

  const emailLooksValid = !tenant.email || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(tenant.email);

  return (
    <div className="space-y-5 animate-fade-in">
      <button onClick={() => navigate("/tenants")} className="text-sm text-slate-500 hover:text-slate-800 flex items-center gap-1"><ArrowLeft className="w-3.5 h-3.5" /> Tenants</button>

      {/* Header */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 sm:p-6">
        <div className="flex items-start gap-4 flex-wrap">
          <TenantAvatar tenant={tenant} size="lg" />
          <div className="flex-1 min-w-[200px]">
            <h1 className="text-2xl font-bold text-slate-900">{tenant.name}</h1>
            <p className="text-sm text-slate-500 mt-0.5">
              <PropertyLink property={property} className="text-slate-600 font-medium" />
              {unit && <> · {unit.unit_label}</>}
            </p>
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <span className={`text-xs px-2.5 py-1 rounded-full ${contractStatus.cls}`}>{contractStatus.label}</span>
              <span className={`text-xs px-2.5 py-1 rounded-full ${statusColor(tenant.payment_status)}`}>Payment: {tenant.payment_status}</span>
              <span className={`text-xs px-2.5 py-1 rounded-full ${tenant.consent_status === "Granted" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}><ShieldCheck className="w-3 h-3 inline mr-0.5" />{tenant.consent_status}</span>
            </div>
          </div>
          <div className="flex flex-col gap-1.5 text-sm">
            <a href={`tel:${tenant.phone}`} className="flex items-center gap-2 text-slate-600 hover:text-slate-900"><Phone className="w-3.5 h-3.5 text-slate-400" />{tenant.phone}</a>
            {tenant.email && (
              <a href={`mailto:${tenant.email}`} className={`flex items-center gap-2 hover:text-slate-900 ${emailLooksValid ? "text-slate-600" : "text-amber-600"}`}>
                <Mail className="w-3.5 h-3.5 text-slate-400" />{tenant.email}
                {!emailLooksValid && <AlertTriangle className="w-3.5 h-3.5" title="This email looks invalid" />}
              </a>
            )}
            {conv && <Link to="/whatsapp" className="flex items-center gap-2 text-[hsl(var(--sage))] hover:underline"><MessageSquare className="w-3.5 h-3.5" /> WhatsApp conversation</Link>}
          </div>
        </div>

        {/* Key figures */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 mt-5">
          <div className="p-3 bg-slate-50 rounded-lg"><p className="text-xs text-slate-400">Current rent</p><p className="text-base font-bold text-slate-900">{formatGBP(currentTenancy?.rent_amount ?? tenant.rent_amount)}/mo</p></div>
          <div className="p-3 bg-slate-50 rounded-lg"><p className="text-xs text-slate-400">Deposit</p><p className="text-base font-bold text-slate-900">{tenant.deposit_amount ? formatGBP(tenant.deposit_amount) : "—"}</p>{(currentTenancy?.deposit_scheme || tenant.deposit_scheme) && <p className="text-[11px] text-slate-500">{currentTenancy?.deposit_scheme || tenant.deposit_scheme}</p>}</div>
          <div className="p-3 bg-slate-50 rounded-lg"><p className="text-xs text-slate-400">Moved in</p><p className="text-base font-bold text-slate-900">{formatDate(currentTenancy?.start_date || tenant.tenancy_start)}</p><p className="text-[11px] text-slate-500">{humanizeMonths(residenceMonths)} in residence</p></div>
          <div className="p-3 bg-slate-50 rounded-lg"><p className="text-xs text-slate-400">Tenant since</p><p className="text-base font-bold text-slate-900">{formatDate(earliest?.start_date || tenant.tenancy_start)}</p><p className="text-[11px] text-slate-500">{humanizeMonths(tenureMonths)} in ecosystem</p></div>
          <div className="p-3 bg-slate-50 rounded-lg"><p className="text-xs text-slate-400">Outstanding</p><p className={`text-base font-bold ${outstanding > 0 ? "text-rose-600" : "text-emerald-600"}`}>{formatGBP(outstanding)}</p></div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Rent history */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h2 className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2"><TrendingUp className="w-4 h-4 text-slate-400" /> Rent history</h2>
          {rentHistory.length === 0 ? (
            <p className="text-sm text-slate-400">No rent history yet — it builds automatically as rents change.</p>
          ) : (
            <>
              {rentHistory.length >= 2 && (
                <div className="h-40 mb-3">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={rentHistory.map((h) => ({ date: formatDate(h.date), amount: h.amount }))} margin={{ top: 5, right: 10, bottom: 0, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="#94a3b8" />
                      <YAxis tick={{ fontSize: 11 }} stroke="#94a3b8" tickFormatter={(v) => `£${v}`} width={50} />
                      <Tooltip formatter={(v) => [`£${v}`, "Rent"]} />
                      <Line type="stepAfter" dataKey="amount" stroke="hsl(160 30% 45%)" strokeWidth={2} dot={{ r: 3 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
              <table className="w-full text-sm">
                <thead><tr className="text-xs text-slate-400"><th className="text-left py-1 font-medium">From</th><th className="text-right py-1 font-medium">Monthly rent</th></tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {[...rentHistory].reverse().map((h, i) => (
                    <tr key={i}><td className="py-1.5 text-slate-600">{formatDate(h.date)}</td><td className="py-1.5 text-right font-medium text-slate-800">{formatGBP(h.amount)}</td></tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </div>

        {/* Payment history */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2"><Wallet className="w-4 h-4 text-slate-400" /> Payments</h2>
            <Link to="/finance?tab=rent" className="text-xs text-[hsl(var(--sage))] hover:underline">Finance →</Link>
          </div>
          {rentBills.length === 0 && myTransactions.length === 0 ? (
            <p className="text-sm text-slate-400">No rent bills or payments recorded yet — add them in Finance.</p>
          ) : (
            <div className="space-y-1 max-h-72 overflow-y-auto">
              {rentBills.slice(0, 12).map((b) => {
                const late = b.status === "Overdue" || (b.status !== "Paid" && daysUntil(b.due_date) !== null && daysUntil(b.due_date) < 0);
                const daysLate = late ? Math.abs(daysUntil(b.due_date) ?? 0) : 0;
                return (
                  <Link key={b.id} to="/finance?tab=rent" className={`flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50 ${late ? "border-l-2 border-rose-400" : ""}`}>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-slate-700">Rent — due {formatDate(b.due_date)}</p>
                      {late && <p className="text-[11px] text-rose-600 font-medium">{daysLate}d late</p>}
                    </div>
                    <span className="text-sm font-medium text-slate-800">{formatGBP(b.amount)}</span>
                    <span className={`text-xs px-1.5 py-0.5 rounded-full shrink-0 ${statusColor(b.status)}`}>{b.status}</span>
                  </Link>
                );
              })}
              {myTransactions.slice(0, 6).map((t) => (
                <Link key={t.id} to="/finance?tab=transactions" className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50">
                  <div className="flex-1 min-w-0"><p className="text-sm text-slate-700">{t.type} · {formatDate(t.date)}</p></div>
                  <span className="text-sm font-medium text-emerald-600">+{formatGBP(t.amount)}</span>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Utilities */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h2 className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2"><CalendarDays className="w-4 h-4 text-slate-400" /> Utilities at {property?.name || "property"}</h2>
          {utilitiesByCategory.length === 0 ? (
            <p className="text-sm text-slate-400">No utility bills recorded for this property yet — add them in Finance and averages appear here.</p>
          ) : (
            <div className="space-y-3">
              {utilitiesByCategory.map(({ category, avg, list }) => (
                <details key={category} className="group">
                  <summary className="flex items-center justify-between cursor-pointer list-none p-2 rounded-lg hover:bg-slate-50">
                    <span className="text-sm text-slate-700">{category}</span>
                    <span className="text-sm font-semibold text-slate-800">{formatGBP(avg)}/mo avg</span>
                  </summary>
                  <div className="pl-2 pb-1 space-y-0.5">
                    {list.slice(0, 8).map((b) => (
                      <div key={b.id} className="flex items-center justify-between text-xs text-slate-500 py-1">
                        <span>{formatDate(b.due_date)}</span>
                        <span className="flex items-center gap-2">{formatGBP(b.amount)} <span className={`px-1.5 py-0.5 rounded-full ${statusColor(b.status)}`}>{b.status}</span></span>
                      </div>
                    ))}
                  </div>
                </details>
              ))}
            </div>
          )}
        </div>

        {/* Documents */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2"><FileCheck className="w-4 h-4 text-slate-400" /> Contracts & documents</h2>
            {property && <Link to={`/properties/${property.id}?tab=documents`} className="text-xs text-[hsl(var(--sage))] hover:underline">All property docs →</Link>}
          </div>
          {docs.length === 0 ? (
            <p className="text-sm text-slate-400">No documents linked yet. Tenancy agreements, deposit certificates and inventories added in Compliance appear here.</p>
          ) : (
            <div className="space-y-1">
              {docs.map((d) => (
                <div key={d.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-slate-700">{d.category}</p>
                    <p className="text-[11px] text-slate-400">{d.issue_date && `Issued ${formatDate(d.issue_date)}`}{d.expiry_date && ` · expires ${formatDate(d.expiry_date)}`}</p>
                  </div>
                  <span className={`text-xs px-1.5 py-0.5 rounded-full ${statusColor(d.status)}`}>{d.status}</span>
                  {d.file_url ? (
                    <a href={d.file_url} target="_blank" rel="noreferrer" className="text-xs text-[hsl(var(--sage))] hover:underline shrink-0">View</a>
                  ) : (
                    <span className="text-xs text-slate-300 shrink-0">No file</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Residence history */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <h2 className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2"><History className="w-4 h-4 text-slate-400" /> Residence history</h2>
        {myTenancies.length === 0 ? (
          <p className="text-sm text-slate-400">No tenancy records yet.</p>
        ) : (
          <div className="space-y-2">
            {myTenancies.map((ty) => {
              const p = properties.find((x) => x.id === ty.property_id);
              const u = units.find((x) => x.id === ty.unit_id);
              const dur = monthsBetween(ty.start_date, ty.status === "Ended" ? ty.end_date : null);
              return (
                <div key={ty.id} className="flex items-center gap-3 p-3 rounded-lg border border-slate-100 hover:bg-slate-50">
                  <span className={`w-2 h-2 rounded-full shrink-0 ${ty.status === "Active" ? "bg-emerald-500" : ty.status === "Upcoming" ? "bg-blue-500" : "bg-slate-300"}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800"><PropertyLink property={p} />{u && <span className="text-slate-500 font-normal"> · {u.unit_label}</span>}</p>
                    <p className="text-xs text-slate-500">{formatDate(ty.start_date)} → {ty.status === "Ended" ? formatDate(ty.end_date) : ty.status === "Upcoming" ? `starts ${formatDate(ty.start_date)}` : "current"} · {humanizeMonths(dur)}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-medium text-slate-800">{formatGBP(ty.rent_amount)}/mo</p>
                    <span className={`text-xs px-1.5 py-0.5 rounded-full ${ty.status === "Active" ? "bg-emerald-100 text-emerald-700" : ty.status === "Upcoming" ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-500"}`}>{ty.status}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Maintenance raised by this tenant */}
      {myTickets.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h2 className="text-sm font-semibold text-slate-900 mb-3">Maintenance raised ({myTickets.length})</h2>
          <div className="space-y-1">
            {myTickets.map((t) => (
              <Link key={t.id} to="/maintenance?status=open" className="flex items-center justify-between gap-2 p-2 rounded-lg hover:bg-slate-50">
                <span className="text-sm text-slate-700 truncate">{t.description}</span>
                <span className={`text-xs px-1.5 py-0.5 rounded-full shrink-0 ${statusColor(t.status)}`}>{t.status}</span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
