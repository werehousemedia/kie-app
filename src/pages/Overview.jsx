import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  RefreshCw,
  Building2,
  Wallet,
  Wrench,
  MessageSquare,
  FileCheck,
  CheckCircle2,
  AlertTriangle,
  ChevronRight,
  Plus,
  Send,
  Banknote,
  CalendarDays,
  Upload,
} from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useKieData } from "@/lib/useKieData";
import { buildPropertyEvents, KIND_META } from "@/lib/calendarEvents";
import { formatGBP, formatDate, daysUntil, urgencyColor, statusColor, timeAgo } from "@/lib/kieUtils";
import PageHeader from "@/components/shared/PageHeader";
import EmptyState from "@/components/shared/EmptyState";
import { PageSkeleton } from "@/components/shared/Skeletons";
import { TenantAvatar } from "@/components/shared/TenantChip";

const greeting = () => {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
};

function SectionCard({ title, to, toLabel, children }) {
  return (
    <div className="rounded-xl border bg-card">
      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        {to && (
          <Link to={to} className="text-xs font-medium text-[hsl(var(--sage))] hover:underline">
            {toLabel || "View all"}
          </Link>
        )}
      </div>
      {children}
    </div>
  );
}

export default function Overview() {
  const navigate = useNavigate();
  const data = useKieData();
  const {
    properties, tenants, bills, tickets, compliance, conversations,
    tenancies, equipment, units, shortLets, loading, reload,
  } = data;
  const [syncing, setSyncing] = useState(false);
  const [lastSynced, setLastSynced] = useState(null);

  useEffect(() => {
    let alive = true;
    base44.entities.ImportTemplate.filter({ is_default: true })
      .then((rows) => {
        if (alive && rows?.[0]?.last_synced) setLastSynced(rows[0].last_synced);
      })
      .catch(() => {});
    return () => { alive = false; };
  }, [syncing]);

  const syncNow = async () => {
    setSyncing(true);
    try {
      const res = await base44.functions.invoke("sync_from_sheet", {});
      const d = res?.data || {};
      if (d.error) throw new Error(d.error);
      const created = Object.values(d.created || {}).reduce((a, b) => a + b, 0);
      const updated = Object.values(d.updated || {}).reduce((a, b) => a + b, 0);
      const warn = (d.warnings || []).length;
      toast.success(
        `Synced from sheet — ${created} created, ${updated} updated${warn ? `, ${warn} warning${warn === 1 ? "" : "s"}` : ""}`
      );
      reload();
    } catch (e) {
      const msg = e?.response?.data?.error || e?.message || "Unknown error";
      if (String(msg).includes("No default sheet")) {
        toast.error("No default sheet configured", {
          action: { label: "Set up", onClick: () => navigate("/import") },
        });
      } else {
        toast.error(`Sync failed: ${msg}`);
      }
    } finally {
      setSyncing(false);
    }
  };

  const m = useMemo(() => {
    const rentDue = bills.filter((b) => b.category === "Rent" && b.status === "Due").reduce((s, b) => s + (b.amount || 0), 0);
    const overdueRent = bills.filter((b) => b.category === "Rent" && b.status === "Overdue").reduce((s, b) => s + (b.amount || 0), 0);
    const upcomingBills = bills.filter((b) => {
      const d = daysUntil(b.due_date);
      return b.status !== "Paid" && d != null && d >= 0 && d <= 30;
    });
    const openTickets = tickets.filter((t) => t.status !== "Complete" && t.status !== "Cancelled");
    const emergencies = openTickets.filter((t) => t.urgency === "emergency").length;
    const activeTenancies = tenancies.filter((t) => t.status === "Active");
    const monthlyIncome = activeTenancies.length > 0
      ? activeTenancies.reduce((s, t) => s + (t.rent_amount || 0), 0)
      : tenants.reduce((s, t) => s + (t.rent_amount || 0), 0);
    const monthlyExpenses = bills.filter((b) => {
      const d = daysUntil(b.due_date);
      return !b.is_income && b.status !== "Paid" && d != null && d >= -31 && d <= 31;
    }).reduce((s, b) => s + (b.amount || 0), 0);
    const portfolioValue = properties.reduce((s, p) => s + (p.purchase_value || 0), 0);
    const blendedYield = portfolioValue > 0 && monthlyIncome > 0
      ? ((monthlyIncome * 12) / portfolioValue) * 100
      : null;
    // Honest occupancy: real unit records when they exist, else tenant count.
    const occupiedUnits = units.length > 0
      ? units.filter((u) => u.occupancy_status === "Occupied").length
      : tenants.length;
    const totalUnits = units.length > 0
      ? units.length
      : properties.reduce((s, p) => s + (p.units_count || 1), 0);
    return {
      rentDue, overdueRent, upcomingBills, openTickets, emergencies,
      monthlyIncome, monthlyExpenses, portfolioValue, blendedYield,
      occupiedUnits, totalUnits,
    };
  }, [bills, tickets, tenancies, tenants, properties, units]);

  const upcomingEvents = useMemo(() => {
    const events = buildPropertyEvents({ propertyId: null, bills, tickets, compliance, equipment, tenancies, tenants, properties, shortLets });
    const today = new Date().toISOString().slice(0, 10);
    const end = new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10);
    return events.filter((e) => e.date >= today && e.date <= end).slice(0, 8);
  }, [bills, tickets, compliance, equipment, tenancies, tenants, properties, shortLets]);

  const attention = useMemo(() => {
    const items = [];
    if (m.overdueRent > 0) {
      items.push({
        id: "rent", severity: "critical",
        title: `${formatGBP(m.overdueRent)} rent overdue`,
        sub: "Chase or record payments",
        to: "/finance?tab=rent&status=Overdue",
      });
    }
    for (const t of m.openTickets) {
      if (t.urgency === "emergency" || t.urgency === "high") {
        items.push({
          id: `t_${t.id}`, severity: "critical",
          title: (t.description || "Maintenance issue").slice(0, 70),
          sub: `${properties.find((p) => p.id === t.property_id)?.name || ""} · ${t.urgency}`,
          to: `/maintenance?ticket=${t.id}`,
        });
      }
    }
    for (const c of compliance) {
      const d = daysUntil(c.expiry_date);
      if (d != null && d <= 30) {
        items.push({
          id: `c_${c.id}`, severity: d < 0 ? "critical" : "warning",
          title: d < 0 ? `${c.category} — ${Math.abs(d)}d overdue` : `${c.category} expires in ${d}d`,
          sub: properties.find((p) => p.id === c.property_id)?.name || "",
          to: d < 0 ? "/compliance?status=overdue" : "/compliance?status=expiring",
        });
      }
    }
    items.sort((a, b) => (a.severity === b.severity ? 0 : a.severity === "critical" ? -1 : 1));
    return items;
  }, [m.overdueRent, m.openTickets, compliance, properties]);

  const recentConversations = useMemo(
    () => [...conversations].sort((a, b) => String(b.last_message_at || "").localeCompare(String(a.last_message_at || ""))).slice(0, 4),
    [conversations]
  );
  const recentTickets = useMemo(
    () => [...tickets].sort((a, b) => String(b.created_date || "").localeCompare(String(a.created_date || ""))).slice(0, 4),
    [tickets]
  );

  if (loading) return <PageSkeleton />;

  if (properties.length === 0) {
    return (
      <div className="animate-fade-in">
        <PageHeader title={`${greeting()}, Ed`} subtitle="Let's get your portfolio set up" />
        <div className="mt-6 rounded-xl border bg-card">
          <EmptyState
            icon={Upload}
            title="No properties yet"
            description="Import your portfolio from the Google Sheet in a couple of minutes — properties, tenants, rents and compliance all arrive together."
            action={
              <Link to="/import" className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 transition-opacity">
                <Upload className="w-4 h-4" /> Import from sheet
              </Link>
            }
          />
        </div>
      </div>
    );
  }

  const quickActions = [
    { label: "Record payment", icon: Banknote, to: "/finance?tab=rent" },
    { label: "Message", icon: Send, to: "/whatsapp" },
    { label: "New job", icon: Wrench, to: "/maintenance?new=1" },
    { label: "Add bill", icon: Plus, to: "/finance?new=1" },
  ];

  return (
    <div className="space-y-5 animate-fade-in">
      <PageHeader
        title={`${greeting()}, Ed`}
        subtitle={new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}
        actions={
          <button
            onClick={syncNow}
            disabled={syncing}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 border bg-card hover:bg-muted rounded-lg text-sm font-medium transition-colors disabled:opacity-60"
          >
            <RefreshCw className={`w-4 h-4 ${syncing ? "animate-spin" : ""}`} />
            {syncing ? "Syncing…" : "Sync"}
            {!syncing && lastSynced && (
              <span className="hidden sm:inline text-xs text-muted-foreground font-normal">
                · {timeAgo(lastSynced)}
              </span>
            )}
          </button>
        }
      />

      {/* Quick-action verb bar */}
      <div className="grid grid-cols-4 gap-2 sm:max-w-md">
        {quickActions.map((a) => {
          const Icon = a.icon;
          return (
            <Link
              key={a.label}
              to={a.to}
              className="flex flex-col items-center gap-1.5 py-3 rounded-xl border bg-card hover:bg-muted active:scale-[0.97] transition-all"
            >
              <div className="w-10 h-10 rounded-full bg-[hsl(var(--sage-light))] flex items-center justify-center">
                <Icon className="w-[18px] h-[18px] text-[hsl(var(--sage))]" />
              </div>
              <span className="text-[11px] font-medium text-center leading-tight">{a.label}</span>
            </Link>
          );
        })}
      </div>

      {/* Attention queue — the reason this page exists */}
      {attention.length === 0 ? (
        <div className="rounded-xl border bg-card px-4 py-4 flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-emerald-100 dark:bg-emerald-500/15 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div>
            <p className="text-sm font-medium">You're all caught up</p>
            <p className="text-xs text-muted-foreground">No overdue rent, urgent jobs or compliance deadlines.</p>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border bg-card">
          <div className="flex items-center gap-2 px-4 pt-4 pb-2">
            <AlertTriangle className="w-4 h-4 text-amber-500" />
            <h2 className="text-sm font-semibold">Needs attention</h2>
            <span className="ml-auto text-xs text-muted-foreground tabular-nums">{attention.length} item{attention.length === 1 ? "" : "s"}</span>
          </div>
          <div className="divide-y divide-border">
            {attention.slice(0, 6).map((a) => (
              <Link key={a.id} to={a.to} className="flex items-center gap-3 px-4 py-3 hover:bg-muted transition-colors">
                <span className={`w-2 h-2 rounded-full shrink-0 ${a.severity === "critical" ? "bg-rose-500" : "bg-amber-500"}`} />
                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-medium truncate">{a.title}</span>
                  {a.sub && <span className="block text-xs text-muted-foreground truncate">{a.sub}</span>}
                </span>
                <ChevronRight className="w-4 h-4 text-muted-foreground/50 shrink-0" />
              </Link>
            ))}
          </div>
          {attention.length > 6 && (
            <p className="px-4 py-2.5 text-xs text-muted-foreground border-t">
              +{attention.length - 6} more in the notification bell
            </p>
          )}
        </div>
      )}

      {/* KPI tiles — every number drills down */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Link to="/properties" className="rounded-xl border bg-card p-4 hover:bg-muted/60 transition-colors">
          <p className="text-xs font-medium text-muted-foreground">Portfolio</p>
          <p className="text-2xl font-semibold tracking-tight tabular-nums mt-1">{properties.length}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{m.occupiedUnits}/{m.totalUnits} units occupied</p>
        </Link>
        <Link to="/finance?tab=rent" className="rounded-xl border bg-card p-4 hover:bg-muted/60 transition-colors">
          <p className="text-xs font-medium text-muted-foreground">Monthly income</p>
          <p className="text-2xl font-semibold tracking-tight tabular-nums mt-1">{formatGBP(m.monthlyIncome)}</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {m.blendedYield ? `${m.blendedYield.toFixed(1)}% gross yield` : `${formatGBP(m.rentDue)} rent due`}
          </p>
        </Link>
        <Link
          to="/finance?tab=rent&status=Overdue"
          className={`rounded-xl border p-4 transition-colors ${m.overdueRent > 0 ? "bg-rose-50 border-rose-200 hover:bg-rose-100/70 dark:bg-rose-500/10 dark:border-rose-500/30 dark:hover:bg-rose-500/15" : "bg-card hover:bg-muted/60"}`}
        >
          <p className={`text-xs font-medium ${m.overdueRent > 0 ? "text-rose-600 dark:text-rose-300" : "text-muted-foreground"}`}>Overdue rent</p>
          <p className={`text-2xl font-semibold tracking-tight tabular-nums mt-1 ${m.overdueRent > 0 ? "text-rose-700 dark:text-rose-300" : ""}`}>{formatGBP(m.overdueRent)}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{m.overdueRent > 0 ? "needs chasing" : "nothing overdue"}</p>
        </Link>
        <Link to="/maintenance?status=open" className="rounded-xl border bg-card p-4 hover:bg-muted/60 transition-colors">
          <p className="text-xs font-medium text-muted-foreground">Open maintenance</p>
          <p className="text-2xl font-semibold tracking-tight tabular-nums mt-1">{m.openTickets.length}</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {m.emergencies > 0 ? <span className="text-rose-600 dark:text-rose-400 font-medium">{m.emergencies} emergency</span> : "no emergencies"}
          </p>
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          {/* Property health */}
          <SectionCard title="Property health" to="/properties" toLabel="All properties">
            <div className="divide-y divide-border">
              {properties.map((p) => {
                const pTickets = m.openTickets.filter((t) => t.property_id === p.id).length;
                const pExpiring = compliance.filter((c) => {
                  const d = daysUntil(c.expiry_date);
                  return c.property_id === p.id && d != null && d <= 60;
                }).length;
                return (
                  <Link key={p.id} to={`/properties/${p.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-muted transition-colors">
                    <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
                      <Building2 className="w-4 h-4 text-muted-foreground" />
                    </div>
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm font-medium truncate">{p.name}</span>
                      <span className="block text-xs text-muted-foreground truncate">{p.address}</span>
                    </span>
                    <span className="flex items-center gap-1.5 shrink-0">
                      {pTickets > 0 && (
                        <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300">
                          <Wrench className="w-3 h-3" />{pTickets}
                        </span>
                      )}
                      {pExpiring > 0 && (
                        <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">
                          <FileCheck className="w-3 h-3" />{pExpiring}
                        </span>
                      )}
                      <span className={`hidden sm:inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColor(p.occupancy_status)}`}>
                        {p.occupancy_status || "—"}
                      </span>
                    </span>
                  </Link>
                );
              })}
            </div>
          </SectionCard>

          {/* Coming up */}
          <SectionCard title="Coming up — next 14 days">
            {upcomingEvents.length === 0 ? (
              <EmptyState compact icon={CalendarDays} title="Nothing due in the next two weeks" description="Rent, bills, services and compliance dates will appear here." />
            ) : (
              <div className="divide-y divide-border">
                {upcomingEvents.map((e) => (
                  <Link key={e.id} to={e.to} className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted transition-colors">
                    <span className={`w-2 h-2 rounded-full shrink-0 ${KIND_META[e.kind]?.dot || "bg-muted-foreground"}`} />
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm truncate">{e.label}</span>
                      {e.sub && <span className="block text-xs text-muted-foreground truncate">{e.sub}</span>}
                    </span>
                    <span className="text-xs text-muted-foreground tabular-nums shrink-0">{formatDate(e.date)}</span>
                  </Link>
                ))}
              </div>
            )}
          </SectionCard>
        </div>

        <div className="space-y-4">
          {/* Money summary */}
          <SectionCard title="Money" to="/finance" toLabel="Finance">
            <div className="px-4 pb-4 space-y-2.5">
              <Link to="/finance?tab=rent" className="flex items-baseline justify-between hover:opacity-80">
                <span className="text-sm text-muted-foreground">Monthly income</span>
                <span className="text-sm font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">+{formatGBP(m.monthlyIncome)}</span>
              </Link>
              <Link to="/finance?tab=bills" className="flex items-baseline justify-between hover:opacity-80">
                <span className="text-sm text-muted-foreground">Unpaid bills (±31d)</span>
                <span className="text-sm font-semibold tabular-nums">{formatGBP(m.monthlyExpenses)}</span>
              </Link>
              <div className="border-t pt-2.5 flex items-baseline justify-between">
                <span className="text-sm font-medium">Net position</span>
                <span className={`text-base font-semibold tabular-nums ${m.monthlyIncome - m.monthlyExpenses < 0 ? "text-rose-600 dark:text-rose-400" : ""}`}>
                  {formatGBP(m.monthlyIncome - m.monthlyExpenses)}
                </span>
              </div>
              {m.portfolioValue > 0 && (
                <Link to="/properties" className="flex items-baseline justify-between hover:opacity-80">
                  <span className="text-xs text-muted-foreground">Portfolio value</span>
                  <span className="text-xs font-medium tabular-nums text-muted-foreground">{formatGBP(m.portfolioValue)}</span>
                </Link>
              )}
            </div>
          </SectionCard>

          {/* Recent inbox */}
          <SectionCard title="Inbox" to="/whatsapp" toLabel="Open inbox">
            {recentConversations.length === 0 ? (
              <EmptyState compact icon={MessageSquare} title="No conversations yet" description="Tenant WhatsApp messages arrive here with AI triage." />
            ) : (
              <div className="divide-y divide-border">
                {recentConversations.map((c) => {
                  const tenant = tenants.find((t) => t.id === c.tenant_id);
                  return (
                    <Link key={c.id} to={`/whatsapp?conversation=${c.id}`} className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted transition-colors">
                      <TenantAvatar tenant={tenant} size="md" />
                      <span className="flex-1 min-w-0">
                        <span className="flex items-center gap-2">
                          <span className="text-sm font-medium truncate">{tenant?.name || "Tenant"}</span>
                          {(c.unread_count || 0) > 0 && (
                            <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-[hsl(var(--sage))] text-white text-[10px] font-bold flex items-center justify-center tabular-nums">{c.unread_count}</span>
                          )}
                        </span>
                        <span className="block text-xs text-muted-foreground truncate">{c.last_message || "—"}</span>
                      </span>
                      <span className="text-[11px] text-muted-foreground shrink-0">{timeAgo(c.last_message_at)}</span>
                    </Link>
                  );
                })}
              </div>
            )}
          </SectionCard>

          {/* Recent maintenance */}
          <SectionCard title="Maintenance" to="/maintenance" toLabel="All jobs">
            {recentTickets.length === 0 ? (
              <EmptyState compact icon={Wrench} title="No jobs yet" description="Maintenance jobs — including ones the AI raises from tenant messages — appear here." />
            ) : (
              <div className="divide-y divide-border">
                {recentTickets.map((t) => (
                  <Link key={t.id} to={`/maintenance?ticket=${t.id}`} className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted transition-colors">
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm truncate">{(t.description || "Maintenance job").slice(0, 50)}</span>
                      <span className="block text-xs text-muted-foreground truncate">
                        {properties.find((p) => p.id === t.property_id)?.name || ""} · {t.status}
                      </span>
                    </span>
                    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium shrink-0 ${urgencyColor(t.urgency)}`}>
                      {t.urgency || "low"}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </SectionCard>
        </div>
      </div>
    </div>
  );
}