import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import {
  FileSpreadsheet,
  RefreshCw,
  CalendarDays,
  MessageSquare,
  Upload,
  Copy,
  ExternalLink,
  Moon,
  Eye,
} from "lucide-react";
import { useTheme } from "next-themes";
import { base44 } from "@/api/base44Client";
import { useKieData } from "@/lib/useKieData";
import { timeAgo, statusColor } from "@/lib/kieUtils";
import { useDemoFilter } from "@/lib/DemoFilterContext";
import PageHeader from "@/components/shared/PageHeader";
import EmptyState from "@/components/shared/EmptyState";
import { Switch } from "@/components/ui/switch";

function Card({ icon: Icon, title, chip, chipTone = "muted", children, action }) {
  const chipClass =
    chipTone === "good"
      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"
      : chipTone === "warn"
        ? "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300"
        : "bg-muted text-muted-foreground";
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="flex items-center gap-2.5 mb-2">
        <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
          <Icon className="w-4 h-4 text-muted-foreground" />
        </div>
        <p className="text-sm font-semibold flex-1 min-w-0 truncate">{title}</p>
        {chip && (
          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium shrink-0 ${chipClass}`}>
            {chip}
          </span>
        )}
      </div>
      <div className="text-xs text-muted-foreground space-y-1.5">{children}</div>
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

// Everything on this page is REAL: live sync state, a working sync button,
// the actual ICS feed URL, honest channel status, and the genuine event log.
// No decorative config forms.
export default function Integrations() {
  const { integrationLogs, reload } = useKieData();
  const { resolvedTheme, setTheme } = useTheme();
  const { hideDemo, setHideDemo } = useDemoFilter();
  const [template, setTemplate] = useState(null);
  const [templateLoaded, setTemplateLoaded] = useState(false);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    base44.entities.ImportTemplate.filter({ is_default: true })
      .then((rows) => setTemplate(rows?.[0] || null))
      .catch(() => {})
      .finally(() => setTemplateLoaded(true));
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
      toast.success(`Synced — ${created} created, ${updated} updated${warn ? `, ${warn} warning${warn === 1 ? "" : "s"}` : ""}`);
      reload();
    } catch (e) {
      toast.error(`Sync failed: ${e?.response?.data?.error || e.message}`);
    } finally {
      setSyncing(false);
    }
  };

  const icsUrl = useMemo(
    () => (template?.sync_secret ? `https://kie-app.base44.app/functions/calendar_feed?key=${template.sync_secret}` : null),
    [template]
  );

  const copyIcs = async () => {
    if (!icsUrl) return;
    try {
      await navigator.clipboard.writeText(icsUrl);
      toast.success("Calendar feed URL copied — add it in Google Calendar → Other calendars → From URL");
    } catch {
      toast.error("Couldn't access the clipboard");
    }
  };

  const recentLogs = integrationLogs.slice(0, 25);

  return (
    <div className="space-y-5 animate-fade-in">
      <PageHeader
        title="Integrations & Settings"
        subtitle="Live connections and app preferences — everything here is real"
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card
          icon={FileSpreadsheet}
          title="Google Sheets — source of truth"
          chip={!templateLoaded ? "…" : template ? "Connected" : "Not set up"}
          chipTone={template ? "good" : "warn"}
        >
          {template ? (
            <>
              <p>
                Property, tenant and rent data syncs one-way from your sheet nightly at 3am
                {template.last_synced ? ` — last synced ${timeAgo(template.last_synced)}` : ""}.
              </p>
              {template.sheet_url && (
                <a href={template.sheet_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[hsl(var(--sage))] font-medium hover:underline">
                  Open the sheet <ExternalLink className="w-3 h-3" />
                </a>
              )}
              <p className="text-amber-600 dark:text-amber-400">
                Comms-log writing needs the Sheets connector re-authorised with write access
                (Base44 dashboard → Connectors) — appends fail gracefully until then.
              </p>
            </>
          ) : (
            <p>Run the import wizard once to connect your sheet — it becomes the single source of truth for portfolio data.</p>
          )}
          <div className="flex gap-2 pt-1">
            {template && (
              <button
                onClick={syncNow}
                disabled={syncing}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-xs font-medium hover:opacity-90 transition-opacity disabled:opacity-60"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${syncing ? "animate-spin" : ""}`} />
                {syncing ? "Syncing…" : "Sync now"}
              </button>
            )}
            <Link to="/import" className="inline-flex items-center gap-1.5 px-3 py-1.5 border bg-card hover:bg-muted rounded-lg text-xs font-medium transition-colors">
              <Upload className="w-3.5 h-3.5" /> Import wizard
            </Link>
          </div>
        </Card>

        <Card
          icon={CalendarDays}
          title="Calendar feed (ICS)"
          chip={icsUrl ? "Live" : "Needs setup"}
          chipTone={icsUrl ? "good" : "warn"}
        >
          <p>
            Rent dates, compliance expiries, tenancy changes and short-let turnarounds as a
            subscribable calendar — updates automatically in Google/Apple Calendar.
          </p>
          {icsUrl ? (
            <button
              onClick={copyIcs}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 border bg-card hover:bg-muted rounded-lg text-xs font-medium transition-colors mt-1"
            >
              <Copy className="w-3.5 h-3.5" /> Copy feed URL
            </button>
          ) : (
            <p>Connect the sheet first — the feed shares its access key.</p>
          )}
        </Card>

        <Card icon={MessageSquare} title="WhatsApp channel" chip="Sandbox mode" chipTone="warn">
          <p>
            The inbound pipeline is live end-to-end: message → AI triage → auto-reply →
            auto-ticket → comms log. Try it from the Inbox with a demo scenario.
          </p>
          <p>Live WhatsApp delivery switches on with the Business API connector.</p>
          <Link to="/whatsapp" className="inline-flex items-center gap-1 text-[hsl(var(--sage))] font-medium hover:underline">
            Open the Inbox <ExternalLink className="w-3 h-3" />
          </Link>
        </Card>

        <div className="rounded-xl border bg-card p-4">
          <p className="text-sm font-semibold mb-2">App preferences</p>
          <div className="rounded-xl border divide-y divide-border">
            <label className="flex items-center gap-3 px-3.5 py-2.5">
              <Moon className="w-[18px] h-[18px] text-muted-foreground" />
              <span className="flex-1 text-sm font-medium">Dark mode</span>
              <Switch
                checked={resolvedTheme === "dark"}
                onCheckedChange={(v) => setTheme(v ? "dark" : "light")}
              />
            </label>
            <label className="flex items-center gap-3 px-3.5 py-2.5">
              <Eye className="w-[18px] h-[18px] text-muted-foreground" />
              <span className="flex-1 text-sm font-medium">Show demo data</span>
              <Switch checked={!hideDemo} onCheckedChange={(v) => setHideDemo(!v)} />
            </label>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Demo records (marked with the eye in the top bar) power client walkthroughs —
            hide them to see only your real portfolio.
          </p>
        </div>
      </div>

      <div className="rounded-xl border bg-card">
        <div className="px-4 pt-4 pb-2">
          <h2 className="text-sm font-semibold">Integration events</h2>
        </div>
        {recentLogs.length === 0 ? (
          <EmptyState compact icon={RefreshCw} title="No events yet" description="Syncs and integration activity appear here." />
        ) : (
          <div className="divide-y divide-border">
            {recentLogs.map((l) => (
              <div key={l.id} className="flex items-center gap-3 px-4 py-2.5">
                <span className="flex-1 min-w-0">
                  <span className="block text-sm truncate">
                    <span className="font-medium">{l.service}</span> — {l.event}
                  </span>
                  {l.details && <span className="block text-xs text-muted-foreground truncate">{l.details}</span>}
                </span>
                <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium shrink-0 ${statusColor(l.status)}`}>
                  {l.status}
                </span>
                <span className="text-[11px] text-muted-foreground shrink-0">{timeAgo(l.timestamp)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}