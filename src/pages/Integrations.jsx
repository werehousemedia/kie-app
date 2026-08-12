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
  Users,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import { useTheme } from "next-themes";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { useKieData } from "@/lib/useKieData";
import { timeAgo, statusColor } from "@/lib/kieUtils";
import { useDemoFilter } from "@/lib/DemoFilterContext";
import PageHeader from "@/components/shared/PageHeader";
import EmptyState from "@/components/shared/EmptyState";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

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

// The WhatsApp channel is operator-level: one Meta Cloud API number serves
// every landlord, and inbound messages are routed to the right workspace by
// the tenant's phone number. Only the app owner (platform admin) configures it.
function WhatsAppChannelCard() {
  const { user } = useAuth();
  const isOperator = user?.role === "admin";
  const [settings, setSettings] = useState({});
  const [values, setValues] = useState({ wa_phone_number_id: "", wa_access_token: "", wa_verify_token: "", wa_app_secret: "" });
  const [busy, setBusy] = useState(false);

  const load = () =>
    base44.entities.AppSetting.list("-created_date", 100)
      .then((rows) => {
        const map = {};
        for (const r of rows) if (r.key?.startsWith("wa_")) map[r.key] = r;
        setSettings(map);
      })
      .catch(() => {});
  useEffect(() => { if (isOperator) load(); }, [isOperator]);

  const connected = !!(settings.wa_access_token?.value && settings.wa_phone_number_id?.value);

  const save = async () => {
    setBusy(true);
    try {
      for (const [key, value] of Object.entries(values)) {
        if (!value.trim()) continue;
        const existing = settings[key];
        if (existing) await base44.entities.AppSetting.update(existing.id, { value: value.trim() });
        else await base44.entities.AppSetting.create({ key, value: value.trim() });
      }
      toast.success("WhatsApp channel settings saved");
      setValues({ wa_phone_number_id: "", wa_access_token: "", wa_verify_token: "", wa_app_secret: "" });
      load();
    } catch (e) {
      toast.error(`Couldn't save: ${e?.message || "unknown error"}`);
    } finally {
      setBusy(false);
    }
  };

  if (!isOperator) {
    return (
      <Card icon={MessageSquare} title="WhatsApp channel" chip="Managed for you" chipTone="good">
        <p>
          Your tenants message the KIE number and their messages appear in your Inbox, triaged, with a job
          raised automatically when something's urgent.
        </p>
        <p>Add each tenant's mobile exactly as they use it on WhatsApp — that's how the app knows who's writing.</p>
        <Link to="/whatsapp" className="inline-flex items-center gap-1 text-[hsl(var(--sage))] font-medium hover:underline">
          Open the Inbox <ExternalLink className="w-3 h-3" />
        </Link>
      </Card>
    );
  }

  return (
    <Card
      icon={MessageSquare}
      title="WhatsApp channel (operator)"
      chip={connected ? "Connected" : "Not connected"}
      chipTone={connected ? "good" : "warn"}
    >
      <p>
        Meta Cloud API credentials for the shared inbound number. Inbound messages route to whichever
        landlord has that tenant's phone on file; replies sent from the Inbox go out through this number.
      </p>
      <p className="text-muted-foreground">
        Webhook URL: <code className="text-[10px]">https://kie-app.base44.app/functions/whatsapp_webhook</code>
      </p>
      <div className="grid gap-1.5 pt-1">
        {[
          { key: "wa_phone_number_id", label: "Phone number ID" },
          { key: "wa_access_token", label: "Permanent access token" },
          { key: "wa_verify_token", label: "Webhook verify token" },
          { key: "wa_app_secret", label: "App secret (optional)" },
        ].map((f) => (
          <Input
            key={f.key}
            type={f.key === "wa_access_token" || f.key === "wa_app_secret" ? "password" : "text"}
            value={values[f.key]}
            onChange={(e) => setValues({ ...values, [f.key]: e.target.value })}
            placeholder={settings[f.key]?.value ? `${f.label} — saved, type to replace` : f.label}
            className="h-8 text-xs"
          />
        ))}
        <button
          onClick={save}
          disabled={busy}
          className="self-start px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-xs font-medium hover:opacity-90 disabled:opacity-60"
        >
          {busy ? "Saving…" : "Save credentials"}
        </button>
      </div>
    </Card>
  );
}

// Workspace sharing: who can see this portfolio. Invited emails join THIS
// workspace on their next sign-in; everyone else who registers gets their own
// empty workspace and can never see this one (row-level security).
function WorkspaceAccessCard() {
  const { user, workspace } = useAuth();
  const [invites, setInvites] = useState([]);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("editor");
  const [busy, setBusy] = useState(false);
  const canManage = workspace?.role === "owner" || user?.role === "admin";

  const loadInvites = () =>
    base44.entities.WorkspaceInvite.list("-created_date", 50).then(setInvites).catch(() => {});
  useEffect(() => { loadInvites(); }, []);

  const sendInvite = async () => {
    const e = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) {
      toast.error("Enter a valid email address");
      return;
    }
    setBusy(true);
    try {
      await base44.entities.WorkspaceInvite.create({
        email: e,
        role,
        status: "pending",
        invited_by: user?.email || "",
      });
      toast.success(`${e} will join this workspace when they next sign in`);
      setEmail("");
      loadInvites();
    } catch (err) {
      toast.error(`Couldn't invite: ${err?.message || "unknown error"}`);
    } finally {
      setBusy(false);
    }
  };

  const revoke = async (inv) => {
    try {
      await base44.entities.WorkspaceInvite.update(inv.id, { status: "revoked" });
      toast.success(`Invite for ${inv.email} revoked`);
      loadInvites();
    } catch (err) {
      toast.error(`Couldn't revoke: ${err?.message || "unknown error"}`);
    }
  };

  return (
    <Card
      icon={Users}
      title="Workspace access"
      chip={workspace ? (workspace.id === "ws_kie_main" ? "KIE portfolio" : "Your workspace") : "…"}
      chipTone="good"
    >
      <p className="flex items-start gap-1.5">
        <ShieldCheck className="w-3.5 h-3.5 mt-0.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
        Every account only ever sees its own workspace's data. People you invite here join THIS
        workspace; anyone else who signs up starts with an empty portfolio of their own.
      </p>
      {invites.length > 0 && (
        <div className="rounded-lg border divide-y divide-border mt-2">
          {invites.filter((i) => i.status !== "revoked").map((inv) => (
            <div key={inv.id} className="flex items-center gap-2 px-2.5 py-2">
              <span className="flex-1 min-w-0 truncate text-foreground">{inv.email}</span>
              <span className="text-[10px] uppercase font-medium text-muted-foreground">{inv.role}</span>
              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${inv.status === "accepted" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300" : "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300"}`}>
                {inv.status}
              </span>
              {canManage && inv.status === "pending" && (
                <button onClick={() => revoke(inv)} aria-label={`Revoke invite for ${inv.email}`} className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-rose-600">
                  <XCircle className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
      {canManage && (
        <div className="flex gap-1.5 pt-2">
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="name@example.com"
            className="h-8 text-xs"
          />
          <Select value={role} onValueChange={setRole}>
            <SelectTrigger className="h-8 w-[90px] text-xs shrink-0"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="editor">Editor</SelectItem>
              <SelectItem value="viewer">Viewer</SelectItem>
            </SelectContent>
          </Select>
          <button
            onClick={sendInvite}
            disabled={busy}
            className="px-3 h-8 bg-primary text-primary-foreground rounded-lg text-xs font-medium hover:opacity-90 disabled:opacity-60 shrink-0"
          >
            {busy ? "…" : "Invite"}
          </button>
        </div>
      )}
    </Card>
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

        <WhatsAppChannelCard />

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

        <WorkspaceAccessCard />
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