import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  RefreshCw,
  Banknote,
  Wrench,
  MessageSquare,
  FileCheck,
  CheckCircle2,
  Plus,
  Send,
  Upload,
  ClipboardList,
} from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useKieData } from "@/lib/useKieData";
import { buildPropertyEvents } from "@/lib/calendarEvents";
import { formatGBP, daysUntil, timeAgo } from "@/lib/kieUtils";
import PageHeader from "@/components/shared/PageHeader";
import EmptyState from "@/components/shared/EmptyState";
import { PageSkeleton } from "@/components/shared/Skeletons";
import { CompactCalendar } from "@/components/shared/KieCalendar";
import { cn } from "@/lib/utils";

// No name in the greeting on purpose — there's no logged-in user profile yet,
// so it's just the time of day plus the date.
const greeting = () => {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
};

// Large icon-led attention tile. The icon tint is the kind-of-thing taxonomy
// colour; the number goes red only as a status signal when action is needed.
function AttentionTile({ to, icon: Icon, iconClass, iconBg, count, countLabel, label, urgentWhenNonZero = true }) {
  const active = count > 0;
  return (
    <Link
      to={to}
      className={cn(
        "flex flex-col gap-3 rounded-2xl border bg-card p-5 transition-all hover:shadow-md hover:-translate-y-0.5",
        active && urgentWhenNonZero && "border-rose-200 dark:border-rose-500/30",
      )}
    >
      <div className="flex items-start justify-between">
        <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center", iconBg)}>
          <Icon className={cn("w-6 h-6", iconClass)} />
        </div>
        {!active && <CheckCircle2 className="w-5 h-5 text-emerald-500/70" />}
      </div>
      <div>
        <p
          className={cn(
            "text-3xl font-semibold tracking-tight tabular-nums",
            active && urgentWhenNonZero ? "text-rose-600 dark:text-rose-400" : "text-foreground",
          )}
        >
          {countLabel ?? count}
        </p>
        <p className="text-sm text-muted-foreground mt-0.5 leading-snug">{label}</p>
      </div>
    </Link>
  );
}

export default function Overview() {
  const navigate = useNavigate();
  const data = useKieData();
  const {
    properties, bills, tickets, compliance, conversations,
    equipment, tenancies, tenants, shortLets, tasks, loading, reload,
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
    const overdueRentBills = bills.filter((b) => b.category === "Rent" && b.status === "Overdue");
    const overdueRent = overdueRentBills.reduce((s, b) => s + (b.amount || 0), 0);
    const urgentTickets = tickets.filter(
      (t) => t.status !== "Complete" && t.status !== "Cancelled" && (t.urgency === "high" || t.urgency === "emergency")
    ).length;
    const expiringCompliance = compliance.filter((c) => {
      const d = daysUntil(c.expiry_date);
      return d != null && d <= 30;
    }).length;
    const unread = conversations.reduce((n, c) => n + (c.unread_count || 0), 0);
    const openTasks = tasks.filter((t) => t.status !== "Done").length;
    return { overdueRentBills, overdueRent, urgentTickets, expiringCompliance, unread, openTasks };
  }, [bills, tickets, compliance, conversations, tasks]);

  const allEvents = useMemo(
    () => buildPropertyEvents({ propertyId: null, bills, tickets, compliance, equipment, tenancies, tenants, properties, shortLets, tasks }),
    [bills, tickets, compliance, equipment, tenancies, tenants, properties, shortLets, tasks]
  );

  if (loading) return <PageSkeleton />;

  if (properties.length === 0) {
    return (
      <div className="animate-fade-in">
        <PageHeader title={greeting()} subtitle="Let's get your portfolio set up" />
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
    { label: "Open Tasks", icon: ClipboardList, to: "/tasks" },
  ];

  return (
    <div className="space-y-5 animate-fade-in">
      <PageHeader
        title={greeting()}
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

      {/* Quick actions — simple icon row */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
        {quickActions.map((a) => {
          const Icon = a.icon;
          return (
            <Link
              key={a.label}
              to={a.to}
              className="inline-flex items-center gap-2 pl-2.5 pr-3.5 py-2 rounded-full border bg-card hover:bg-muted active:scale-[0.97] transition-all shrink-0"
            >
              <span className="w-7 h-7 rounded-full bg-[hsl(var(--sage-light))] flex items-center justify-center">
                <Icon className="w-4 h-4 text-[hsl(var(--sage))]" />
              </span>
              <span className="text-sm font-medium whitespace-nowrap">{a.label}</span>
            </Link>
          );
        })}
      </div>

      {/* The four things that need attention — icon-led, pre-filtered click-through */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <AttentionTile
          to="/finance?tab=rent&status=Overdue"
          icon={Banknote}
          iconBg="bg-teal-50 dark:bg-teal-500/15"
          iconClass="text-teal-600 dark:text-teal-400"
          count={m.overdueRentBills.length}
          countLabel={m.overdueRent > 0 ? formatGBP(m.overdueRent) : "£0"}
          label={
            m.overdueRent > 0
              ? `rent overdue across ${m.overdueRentBills.length} ${m.overdueRentBills.length === 1 ? "tenancy" : "tenancies"}`
              : "no rent overdue"
          }
        />
        <AttentionTile
          to="/maintenance?status=open&urgency=urgent"
          icon={Wrench}
          iconBg="bg-blue-50 dark:bg-blue-500/15"
          iconClass="text-blue-600 dark:text-blue-400"
          count={m.urgentTickets}
          label={m.urgentTickets > 0 ? "urgent maintenance jobs" : "no urgent maintenance"}
        />
        <AttentionTile
          to="/compliance?status=expiring"
          icon={FileCheck}
          iconBg="bg-violet-50 dark:bg-violet-500/15"
          iconClass="text-violet-600 dark:text-violet-400"
          count={m.expiringCompliance}
          label={m.expiringCompliance > 0 ? "certificates expiring or overdue" : "compliance up to date"}
        />
        <AttentionTile
          to="/whatsapp"
          icon={MessageSquare}
          iconBg="bg-lime-50 dark:bg-lime-500/15"
          iconClass="text-lime-600 dark:text-lime-400"
          count={m.unread}
          label={m.unread > 0 ? "unread WhatsApp messages" : "inbox clear"}
          urgentWhenNonZero={false}
        />
      </div>

      {/* Calendar — the next two weeks at a glance */}
      <div className="rounded-xl border bg-card">
        <div className="flex items-center justify-between px-4 pt-4 pb-2">
          <h2 className="text-sm font-semibold text-foreground">Coming up — next 14 days</h2>
          <Link to="/calendar" className="text-xs font-medium text-[hsl(var(--sage))] hover:underline">
            Full calendar
          </Link>
        </div>
        <CompactCalendar events={allEvents} />
      </div>
    </div>
  );
}
