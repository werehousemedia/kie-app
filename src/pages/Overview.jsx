import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useKieData } from "@/lib/useKieData";
import { buildPropertyEvents, KIND_META } from "@/lib/calendarEvents";
import { formatGBP, formatDate, daysUntil, urgencyColor, statusColor, timeAgo } from "@/lib/kieUtils";
import { toast } from "sonner";
import {
  Building2, Users, Wallet, AlertTriangle, Wrench, FileCheck, ArrowRight, MessageSquare,
  RefreshCw, ClipboardList, Sheet, Loader2,
} from "lucide-react";

function KpiCard({ label, value, sublabel, icon: Icon, tone = "navy", to }) {
  const tones = {
    navy: "bg-[hsl(var(--navy))] text-white",
    sage: "bg-[hsl(var(--sage))] text-white",
    white: "bg-white text-slate-800 border border-slate-200",
    amber: "bg-amber-50 text-amber-900 border border-amber-200",
    rose: "bg-rose-50 text-rose-900 border border-rose-200",
  };
  const inner = (
    <>
      <div className="flex items-start justify-between mb-3">
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${tone === "white" ? "bg-slate-100" : "bg-white/15"}`}>
          <Icon className="w-[18px] h-[18px]" />
        </div>
        {to && <ArrowRight className={`w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity ${tone === "white" ? "text-slate-400" : "text-white/60"}`} />}
      </div>
      <p className="text-2xl font-bold tracking-tight">{value}</p>
      <p className={`text-sm font-medium mt-0.5 ${tone === "white" ? "text-slate-500" : "text-white/70"}`}>{label}</p>
      {sublabel && <p className={`text-xs mt-1 ${tone === "white" ? "text-slate-400" : "text-white/50"}`}>{sublabel}</p>}
    </>
  );
  if (to) {
    return (
      <Link
        to={to}
        className={`group block rounded-xl p-5 ${tones[tone]} shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--sage))]`}
      >
        {inner}
      </Link>
    );
  }
  return <div className={`rounded-xl p-5 ${tones[tone]} shadow-sm`}>{inner}</div>;
}

export default function Overview() {
  const { properties, tenants, bills, tickets, compliance, conversations, activity, tenancies, equipment, loading, reload } = useKieData();
  const navigate = useNavigate();
  const [syncing, setSyncing] = useState(false);

  const syncNow = async () => {
    setSyncing(true);
    try {
      const res = await base44.functions.invoke("sync_from_sheet", {});
      const d = res.data || {};
      if (d.error) throw new Error(d.error);
      const created = Object.values(d.created || {}).reduce((a, b) => a + b, 0);
      const updated = Object.values(d.updated || {}).reduce((a, b) => a + b, 0);
      toast.success(`Synced from sheet: ${created} created, ${updated} updated${d.warnings?.length ? `, ${d.warnings.length} warnings` : ""}`);
      reload();
    } catch (e) {
      const msg = e.response?.data?.error || e.message || "Sync failed";
      if (msg.includes("No default sheet")) {
        toast.error(msg, { action: { label: "Set up", onClick: () => navigate("/import") } });
      } else {
        toast.error(msg);
      }
    } finally {
      setSyncing(false);
    }
  };

  if (loading) return <div className="flex items-center justify-center h-96"><div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin" /></div>;

  const occupiedUnits = tenants.filter((t) => t.payment_status !== "Overdue" || true).length;
  const rentDue = bills.filter((b) => b.category === "Rent" && b.status === "Due").reduce((s, b) => s + (b.amount || 0), 0);
  const overdueRent = bills.filter((b) => b.category === "Rent" && b.status === "Overdue").reduce((s, b) => s + (b.amount || 0), 0);
  const upcomingBills = bills.filter((b) => b.status !== "Paid" && daysUntil(b.due_date) !== null && daysUntil(b.due_date) >= 0 && daysUntil(b.due_date) <= 30);
  const openTickets = tickets.filter((t) => t.status !== "Complete" && t.status !== "Cancelled");
  const expiringCompliance = compliance.filter((c) => {
    const d = daysUntil(c.expiry_date);
    return d !== null && d <= 60;
  });
  const urgentConversations = conversations.filter((c) => c.urgency === "high" || c.urgency === "emergency");

  // Portfolio performance — tenancies are the income source of truth
  const activeTenancies = tenancies.filter((ty) => ty.status === "Active");
  const monthlyIncome = activeTenancies.length > 0
    ? activeTenancies.reduce((s, ty) => s + (ty.rent_amount || 0), 0)
    : tenants.reduce((s, t) => s + (t.rent_amount || 0), 0);
  const monthlyExpenses = bills.filter((b) => !b.is_income && b.status !== "Paid" && daysUntil(b.due_date) !== null && daysUntil(b.due_date) >= -31 && daysUntil(b.due_date) <= 31).reduce((s, b) => s + (b.amount || 0), 0);
  const portfolioValue = properties.reduce((s, p) => s + (p.purchase_value || 0), 0);
  const blendedYield = portfolioValue > 0 && monthlyIncome > 0 ? ((monthlyIncome * 12) / portfolioValue) * 100 : null;

  // Upcoming 14 days across the whole portfolio — same derivation as the property calendars
  const todayStr = new Date().toISOString().slice(0, 10);
  const horizon = new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10);
  const upcomingEvents = buildPropertyEvents({ propertyId: null, bills, tickets, compliance, equipment, tenancies, tenants, properties })
    .filter((e) => e.date >= todayStr && e.date <= horizon)
    .slice(0, 8);

  const needsAttention = [
    ...overdueRent > 0 ? [{ type: "Rent overdue", detail: `${formatGBP(overdueRent)} overdue rent`, severity: "critical", to: "/finance?tab=rent&status=Overdue" }] : [],
    ...openTickets.filter((t) => t.urgency === "emergency" || t.urgency === "high").map((t) => ({
      type: "Urgent repair", detail: t.description?.slice(0, 60), severity: "critical", to: `/maintenance?status=open&urgency=${t.urgency}`
    })),
    ...expiringCompliance.filter((c) => daysUntil(c.expiry_date) <= 30).map((c) => ({
      type: c.category, detail: `Expires ${formatDate(c.expiry_date)} (${daysUntil(c.expiry_date)}d)`, severity: "warning", to: "/compliance?status=expiring"
    })),
  ];

  const quickActions = [
    { label: "Add property", icon: Building2, to: "/properties" },
    { label: "Log tenant issue", icon: ClipboardList, to: "/whatsapp" },
    { label: "WhatsApp assistant", icon: MessageSquare, to: "/whatsapp" },
    { label: "Upload document", icon: FileCheck, to: "/compliance" },
    { label: "Add bill", icon: Wallet, to: "/finance" },
    { label: "Create job", icon: Wrench, to: "/maintenance" },
    { label: "Import from sheet", icon: Sheet, to: "/import" },
    { label: "Sync from sheet", icon: RefreshCw, onClick: syncNow },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Good morning, KIE Property</h1>
          <p className="text-sm text-slate-500 mt-0.5">Here's what needs your attention today.</p>
        </div>
        <button
          onClick={syncNow}
          disabled={syncing}
          className="flex items-center gap-2 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50 hover:border-[hsl(var(--sage))] disabled:opacity-60 shrink-0 transition-colors"
          title="Pull the latest data from your saved Google Sheet"
        >
          {syncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          {syncing ? "Syncing…" : "Sync from sheet"}
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard label="Total properties" value={properties.length} icon={Building2} tone="navy" to="/properties" />
        <KpiCard label="Occupied units" value={occupiedUnits} sublabel={`${tenants.length} tenants`} icon={Users} tone="white" to="/tenants" />
        <KpiCard label="Rent due this month" value={formatGBP(rentDue)} icon={Wallet} tone="sage" to="/finance?tab=rent&status=Due" />
        <KpiCard label="Overdue rent" value={formatGBP(overdueRent)} icon={AlertTriangle} tone={overdueRent > 0 ? "rose" : "white"} to="/finance?tab=rent&status=Overdue" />
        <KpiCard label="Upcoming bills (30d)" value={upcomingBills.length} sublabel={formatGBP(upcomingBills.reduce((s, b) => s + (b.amount || 0), 0))} icon={Wallet} tone="white" to="/finance?tab=bills" />
        <KpiCard label="Open maintenance" value={openTickets.length} sublabel={`${openTickets.filter(t => t.urgency === "emergency").length} emergency`} icon={Wrench} tone="white" to="/maintenance?status=open" />
        <KpiCard label="Compliance expiring (60d)" value={expiringCompliance.length} sublabel={`${expiringCompliance.filter(c => daysUntil(c.expiry_date) <= 30).length} within 30d`} icon={FileCheck} tone={expiringCompliance.length > 0 ? "amber" : "white"} to="/compliance?status=expiring" />
        <KpiCard label="Active conversations" value={conversations.length} sublabel={`${urgentConversations.length} urgent`} icon={MessageSquare} tone="white" to="/whatsapp" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {needsAttention.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-lg bg-rose-50 flex items-center justify-center">
                  <AlertTriangle className="w-4 h-4 text-rose-600" />
                </div>
                <h2 className="text-base font-semibold text-slate-900">Needs attention</h2>
                <span className="ml-auto text-xs font-medium text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full">{needsAttention.length} items</span>
              </div>
              <div className="space-y-2">
                {needsAttention.slice(0, 6).map((item, i) => (
                  <Link key={i} to={item.to} className="flex items-center gap-3 p-3 rounded-lg hover:bg-slate-50 transition-colors group">
                    <span className={`w-2 h-2 rounded-full shrink-0 ${item.severity === "critical" ? "bg-rose-500" : "bg-amber-500"}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-800">{item.type}</p>
                      <p className="text-xs text-slate-500 truncate">{item.detail}</p>
                    </div>
                    <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-slate-500" />
                  </Link>
                ))}
              </div>
            </div>
          )}

          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
            <h2 className="text-base font-semibold text-slate-900 mb-4">Property health</h2>
            <div className="space-y-2">
              {properties.map((p) => {
                const propCompliance = compliance.filter((c) => c.property_id === p.id);
                const expiring = propCompliance.filter((c) => {
                  const d = daysUntil(c.expiry_date);
                  return d !== null && d <= 60;
                }).length;
                const propTickets = openTickets.filter((t) => t.property_id === p.id).length;
                return (
                  <Link key={p.id} to={`/properties/${p.id}`} className="flex items-center gap-3 p-3 rounded-lg hover:bg-slate-50 transition-colors">
                    <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                      <Building2 className="w-5 h-5 text-slate-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-800 truncate">{p.name}</p>
                      <p className="text-xs text-slate-500 truncate">{p.address}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {propTickets > 0 && <span className="text-xs font-medium bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">{propTickets} open</span>}
                      {expiring > 0 && <span className="text-xs font-medium bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full">{expiring} expiring</span>}
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${statusColor(p.occupancy_status)}`}>{p.occupancy_status}</span>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
            <h2 className="text-base font-semibold text-slate-900 mb-4">Upcoming (14 days)</h2>
            {upcomingEvents.length === 0 && <p className="text-sm text-slate-400">Nothing due in the next two weeks.</p>}
            <div className="space-y-1">
              {upcomingEvents.map((e) => (
                <Link key={e.id} to={e.to} className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-slate-50 group">
                  <span className={`w-2 h-2 rounded-full shrink-0 ${KIND_META[e.kind]?.dot}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800 truncate group-hover:underline decoration-[hsl(var(--sage))] underline-offset-2">{e.label}</p>
                    {e.sub && <p className="text-xs text-slate-500">{e.sub}</p>}
                  </div>
                  <span className="text-xs text-slate-400 shrink-0">{formatDate(e.date)}</span>
                </Link>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
            <h2 className="text-base font-semibold text-slate-900 mb-4">Portfolio performance</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Link to="/finance?tab=rent" className="p-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors"><p className="text-xs text-slate-500">Monthly income</p><p className="text-lg font-bold text-emerald-600">{formatGBP(monthlyIncome)}</p></Link>
              <Link to="/finance?tab=bills" className="p-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors"><p className="text-xs text-slate-500">Bills due (±31d)</p><p className="text-lg font-bold text-slate-900">{formatGBP(monthlyExpenses)}</p></Link>
              <Link to="/finance" className="p-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors"><p className="text-xs text-slate-500">Net /mo</p><p className={`text-lg font-bold ${monthlyIncome - monthlyExpenses >= 0 ? "text-slate-900" : "text-rose-600"}`}>{formatGBP(monthlyIncome - monthlyExpenses)}</p></Link>
              <Link to="/properties" className="p-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors"><p className="text-xs text-slate-500">Portfolio value</p><p className="text-lg font-bold text-slate-900">{portfolioValue > 0 ? formatGBP(portfolioValue) : "—"}</p>{blendedYield && <p className="text-[11px] text-slate-500">{blendedYield.toFixed(1)}% gross yield</p>}</Link>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
            <h2 className="text-base font-semibold text-slate-900 mb-3">Quick actions</h2>
            <div className="grid grid-cols-2 gap-2">
              {quickActions.map((a) => {
                const Icon = a.icon;
                const cls = "flex flex-col items-center gap-1.5 p-3 rounded-lg border border-slate-200 hover:border-[hsl(var(--sage))] hover:bg-slate-50 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--sage))]";
                if (a.onClick) {
                  return (
                    <button key={a.label} onClick={a.onClick} disabled={syncing} className={`${cls} disabled:opacity-60`}>
                      <Icon className={`w-5 h-5 text-slate-600 ${a.label.startsWith("Sync") && syncing ? "animate-spin" : ""}`} />
                      <span className="text-xs font-medium text-slate-700 text-center">{a.label}</span>
                    </button>
                  );
                }
                return (
                  <Link key={a.label} to={a.to} className={cls}>
                    <Icon className="w-5 h-5 text-slate-600" />
                    <span className="text-xs font-medium text-slate-700 text-center">{a.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <MessageSquare className="w-4 h-4 text-slate-500" />
              <h2 className="text-base font-semibold text-slate-900">Recent WhatsApp</h2>
            </div>
            <div className="space-y-2">
              {conversations.slice(0, 4).map((c) => {
                const tenant = tenants.find((t) => t.id === c.tenant_id);
                const prop = properties.find((p) => p.id === c.property_id);
                return (
                  <Link key={c.id} to="/whatsapp" className="block p-2.5 rounded-lg hover:bg-slate-50">
                    <div className="flex items-center justify-between mb-0.5">
                      <p className="text-sm font-medium text-slate-800">{tenant?.name || "Unknown"}</p>
                      <span className={`text-xs px-1.5 py-0.5 rounded-full border ${urgencyColor(c.urgency)}`}>{c.urgency}</span>
                    </div>
                    <p className="text-xs text-slate-500 truncate">{c.last_message}</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">{prop?.name} · {timeAgo(c.last_message_at)}</p>
                  </Link>
                );
              })}
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <Wrench className="w-4 h-4 text-slate-500" />
              <h2 className="text-base font-semibold text-slate-900">Recent maintenance</h2>
            </div>
            <div className="space-y-2">
              {tickets.slice(0, 4).map((t) => {
                const prop = properties.find((p) => p.id === t.property_id);
                return (
                  <Link key={t.id} to="/maintenance" className="block p-2.5 rounded-lg hover:bg-slate-50">
                    <div className="flex items-center justify-between mb-0.5">
                      <p className="text-sm font-medium text-slate-800 truncate">{t.description?.slice(0, 40)}</p>
                      <span className={`text-xs px-1.5 py-0.5 rounded-full ${urgencyColor(t.urgency)}`}>{t.urgency}</span>
                    </div>
                    <p className="text-xs text-slate-500">{prop?.name} · <span className={statusColor(t.status)}>{t.status}</span></p>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}