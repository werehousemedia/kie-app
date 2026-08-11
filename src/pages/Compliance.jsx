import React, { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import {
  Plus,
  Search,
  FileCheck,
  Upload,
  ExternalLink,
  BellRing,
  ShieldAlert,
  HardHat,
} from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useKieData } from "@/lib/useKieData";
import { formatDate, daysUntil, statusColor, logActivity } from "@/lib/kieUtils";
import PageHeader from "@/components/shared/PageHeader";
import EmptyState from "@/components/shared/EmptyState";
import { ListSkeleton } from "@/components/shared/Skeletons";
import PropertyLink from "@/components/shared/PropertyLink";
import BookContractorDialog from "@/components/shared/BookContractorDialog";
import PRSReadinessPanel from "@/components/compliance/PRSReadinessPanel";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";

const CATEGORIES = [
  "Gas Safety Certificate", "EPC", "EICR", "Boiler service", "Smoke/CO alarm",
  "HMO licence", "Insurance", "Tenancy agreement", "Inventory",
  "Legionella Risk Assessment", "PAT Test", "Deposit Protection Certificate",
];

// Renewal cadence in months — drives the expiry auto-suggestion.
const CADENCE_MONTHS = {
  "Gas Safety Certificate": 12, "Boiler service": 12, "PAT Test": 12, Insurance: 12,
  EICR: 60, "HMO licence": 60, EPC: 120, "Legionella Risk Assessment": 24,
};

// KEEP: URL param → filter mapping.
const STATUS_PARAM_MAP = {
  expiring: "Expiring soon",
  overdue: "Overdue",
  missing: "Missing",
  compliant: "Compliant",
};

// KEEP: status derivation from days-to-expiry (0 / 60 thresholds).
const computeStatus = (record) => {
  if (!record.expiry_date) return record.status === "Missing" ? "Missing" : record.status || "Compliant";
  const d = daysUntil(record.expiry_date);
  if (d == null) return record.status || "Compliant";
  if (d < 0) return "Overdue";
  if (d <= 60) return "Expiring soon";
  return "Compliant";
};

const RAG_TINT = {
  Overdue: "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300",
  "Expiring soon": "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
  Missing: "bg-muted text-muted-foreground",
  Compliant: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
};

let driftFixRan = false;

export default function Compliance() {
  const { compliance, properties, tasks, tenancies, tenants, contractors, prsRegistrations, reload, loading } = useKieData();
  const [searchParams, setSearchParams] = useSearchParams();
  const [filter, setFilter] = useState(() => STATUS_PARAM_MAP[searchParams.get("status")] || null);
  const [text, setText] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [uploadingId, setUploadingId] = useState(null);
  const [creatingJobId, setCreatingJobId] = useState(null);
  const [bookingTask, setBookingTask] = useState(null);
  const fileInputRef = useRef(null);
  const uploadTargetRef = useRef(null);

  useEffect(() => {
    if (searchParams.get("new") === "1") {
      setAddOpen(true);
      setSearchParams((p) => { p.delete("new"); return p; }, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Records display their COMPUTED status; stored drift gets fixed quietly,
  // once per session (stored "Compliant" on an expired cert is a lie).
  useEffect(() => {
    if (loading || driftFixRan) return;
    driftFixRan = true;
    const stale = compliance.filter((c) => c.expiry_date && computeStatus(c) !== c.status);
    if (stale.length === 0) return;
    (async () => {
      for (const c of stale) {
        try {
          await base44.entities.ComplianceRecord.update(c.id, { status: computeStatus(c) });
        } catch {
          /* cosmetic repair — retry next session */
        }
      }
      reload();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

  const records = useMemo(
    () => compliance.map((c) => ({ ...c, computed: computeStatus(c) })),
    [compliance]
  );

  const counts = useMemo(() => ({
    Overdue: records.filter((r) => r.computed === "Overdue").length,
    "Expiring soon": records.filter((r) => r.computed === "Expiring soon").length,
    Missing: records.filter((r) => r.computed === "Missing").length,
    Compliant: records.filter((r) => r.computed === "Compliant").length,
  }), [records]);

  // KEEP: stat cards toggle the filter; clicking the active one clears it.
  const toggleFilter = (status) => {
    const next = filter === status ? null : status;
    setFilter(next);
    setSearchParams((p) => {
      const param = Object.entries(STATUS_PARAM_MAP).find(([, v]) => v === next)?.[0];
      if (param) p.set("status", param);
      else p.delete("status");
      return p;
    }, { replace: true });
  };

  const filtered = useMemo(() => {
    const q = text.trim().toLowerCase();
    return records
      .filter((r) => !filter || r.computed === filter)
      .filter((r) => {
        if (!q) return true;
        const prop = properties.find((p) => p.id === r.property_id);
        return [r.category, prop?.name].some((s) => (s || "").toLowerCase().includes(q));
      })
      .sort((a, b) => String(a.expiry_date || "9999").localeCompare(String(b.expiry_date || "9999")));
  }, [records, filter, text, properties]);

  // Per-property RAG board: worst status tints the row.
  const board = useMemo(() => {
    const rank = { Overdue: 0, Missing: 1, "Expiring soon": 2, Compliant: 3 };
    return properties.map((p) => {
      const rows = records.filter((r) => r.property_id === p.id);
      const worst = rows.reduce((w, r) => (rank[r.computed] < rank[w] ? r.computed : w), "Compliant");
      return { property: p, rows: [...rows].sort((a, b) => rank[a.computed] - rank[b.computed]), worst };
    });
  }, [properties, records]);

  const logReminder = async (record) => {
    const d = daysUntil(record.expiry_date);
    try {
      await logActivity(base44, {
        property_id: record.property_id,
        event_type: "Compliance reminder",
        description: `Reminder logged: ${record.category}${record.expiry_date ? ` (${d < 0 ? `${Math.abs(d)}d overdue` : `expires in ${d}d`})` : ""}`,
        related_id: record.id,
        severity: d != null && d < 0 ? "critical" : "warning",
      });
      toast.success("Reminder logged to the activity timeline");
      reload();
    } catch (e) {
      toast.error(`Couldn't log reminder: ${e?.message || "unknown error"}`);
    }
  };

  // "Create job": a Compliance Task for this record (reusing the one the task
  // engine already made if it exists), then straight into contractor booking.
  const createJob = async (record) => {
    setCreatingJobId(record.id);
    try {
      const propName = properties.find((p) => p.id === record.property_id)?.name || "property";
      const sourceKey = `compliance:${record.id}:${(record.expiry_date || "").slice(0, 10)}`;
      let task = tasks.find((t) => t.source_key === sourceKey && t.status !== "Done");
      if (!task) {
        const d = daysUntil(record.expiry_date);
        const overdue = d != null && d < 0;
        task = await base44.entities.Task.create({
          title: `Book ${record.category} — ${propName}`,
          category: "Compliance",
          urgency: overdue ? (record.category === "Gas Safety Certificate" ? "emergency" : "high") : "medium",
          status: "Open",
          due_date: (record.expiry_date || "").slice(0, 10) || undefined,
          property_id: record.property_id,
          source: "compliance_page",
          source_type: "ComplianceRecord",
          source_id: record.id,
          source_key: sourceKey,
          is_demo: !!record.is_demo,
        });
        await logActivity(base44, {
          property_id: record.property_id,
          event_type: "Task created",
          description: `Task created: Book ${record.category} — ${propName}`,
          related_id: task.id,
          severity: record.computed === "Overdue" ? "warning" : "info",
        });
        toast.success("Job created — pick a contractor");
        reload();
      }
      setBookingTask(task);
    } catch (e) {
      toast.error(`Couldn't create job: ${e?.message || "unknown error"}`);
    } finally {
      setCreatingJobId(null);
    }
  };

  const startUpload = (record) => {
    uploadTargetRef.current = record;
    fileInputRef.current?.click();
  };

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    const record = uploadTargetRef.current;
    e.target.value = "";
    if (!file || !record) return;
    setUploadingId(record.id);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      await base44.entities.ComplianceRecord.update(record.id, { file_url });
      await logActivity(base44, {
        property_id: record.property_id,
        event_type: "Document upload",
        description: `Certificate uploaded: ${record.category}`,
        related_id: record.id,
      });
      toast.success("Certificate uploaded");
      reload();
    } catch (err) {
      toast.error(`Upload failed: ${err?.message || "unknown error"}`);
    } finally {
      setUploadingId(null);
      uploadTargetRef.current = null;
    }
  };

  if (loading) {
    return (
      <div className="space-y-5">
        <PageHeader title="Compliance" subtitle="Loading records…" />
        <ListSkeleton rows={6} />
      </div>
    );
  }

  return (
    <div className="space-y-5 animate-fade-in">
      <PageHeader
        title="Compliance"
        subtitle="Certificates, licences and documents — tracked, not hoped for"
        actions={
          <button
            onClick={() => setAddOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
          >
            <Plus className="w-4 h-4" /> Add record
          </button>
        }
      />

      {/* RAG stat cards — tap to filter, tap again to clear */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {["Overdue", "Expiring soon", "Missing", "Compliant"].map((s) => (
          <button
            key={s}
            onClick={() => toggleFilter(s)}
            aria-pressed={filter === s}
            className={`rounded-xl border p-4 text-left transition-all active:scale-[0.99] ${
              filter === s ? "ring-2 ring-[hsl(var(--ring))] bg-muted/60" : "bg-card hover:bg-muted/60"
            }`}
          >
            <p className="text-xs font-medium text-muted-foreground">{s}</p>
            <p className={`text-2xl font-semibold tracking-tight tabular-nums mt-1 ${
              s === "Overdue" && counts[s] > 0 ? "text-rose-600 dark:text-rose-400"
              : s === "Expiring soon" && counts[s] > 0 ? "text-amber-600 dark:text-amber-400"
              : ""
            }`}>
              {counts[s]}
            </p>
          </button>
        ))}
      </div>

      <Tabs defaultValue="records" className="space-y-4">
        <TabsList>
          <TabsTrigger value="records">Certificates</TabsTrigger>
          <TabsTrigger value="prs">PRS Database readiness</TabsTrigger>
        </TabsList>
        <TabsContent value="records" className="space-y-4 mt-0">

      {/* Live certificate table sits directly under the status cards; the
          per-property health board follows it. */}
      <div className="relative sm:max-w-xs">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Search category or property…"
          className="w-full pl-9 pr-3 py-2 bg-muted rounded-lg text-sm border border-transparent focus:outline-none focus:bg-card focus:border-border transition-all"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border bg-card">
          {records.length === 0 ? (
            <EmptyState
              icon={FileCheck}
              title="No compliance records yet"
              description="Track gas safety, EICR, EPC and more — with expiry countdowns and reminders."
              action={
                <button onClick={() => setAddOpen(true)} className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 transition-opacity">
                  <Plus className="w-4 h-4" /> Add record
                </button>
              }
            />
          ) : (
            <EmptyState
              icon={Search}
              title="Nothing matches"
              action={
                <button onClick={() => { setText(""); toggleFilter(filter); }} className="text-sm font-medium text-[hsl(var(--sage))] hover:underline">
                  Clear filters
                </button>
              }
            />
          )}
        </div>
      ) : (
        <>
          {/* Mobile: card list */}
          <div className="md:hidden rounded-xl border bg-card divide-y divide-border">
            {filtered.map((r) => {
              const d = daysUntil(r.expiry_date);
              return (
                <div key={r.id} className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="flex-1 min-w-0 text-sm font-medium truncate">{r.category}</span>
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium shrink-0 ${statusColor(r.computed)}`}>
                      {r.computed}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    <PropertyLink property={properties.find((p) => p.id === r.property_id)} />
                    {r.expiry_date && (
                      <> · expires {formatDate(r.expiry_date)}{d != null && d < 0 ? ` (${Math.abs(d)}d overdue)` : d != null && d <= 60 ? ` (${d}d)` : ""}</>
                    )}
                  </p>
                  <div className="flex gap-3 mt-2">
                    {r.file_url ? (
                      <a href={r.file_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-medium text-[hsl(var(--sage))] hover:underline">
                        <ExternalLink className="w-3 h-3" /> View
                      </a>
                    ) : (
                      <button onClick={() => startUpload(r)} disabled={uploadingId === r.id} className="inline-flex items-center gap-1 text-xs font-medium text-[hsl(var(--sage))] hover:underline disabled:opacity-60">
                        <Upload className="w-3 h-3" /> {uploadingId === r.id ? "Uploading…" : "Upload"}
                      </button>
                    )}
                    {(r.computed === "Overdue" || r.computed === "Expiring soon") && (
                      <button onClick={() => createJob(r)} disabled={creatingJobId === r.id} className="inline-flex items-center gap-1 text-xs font-medium text-[hsl(var(--sage))] hover:underline disabled:opacity-60">
                        <HardHat className="w-3 h-3" /> {creatingJobId === r.id ? "Creating…" : "Create job"}
                      </button>
                    )}
                    {r.computed !== "Compliant" && (
                      <button onClick={() => logReminder(r)} className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground">
                        <BellRing className="w-3 h-3" /> Log reminder
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Desktop: table */}
          <div className="hidden md:block rounded-xl border bg-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[760px]">
                <thead>
                  <tr className="border-b text-left text-xs text-muted-foreground">
                    <th className="px-4 py-2.5 font-medium">Category</th>
                    <th className="px-4 py-2.5 font-medium">Property</th>
                    <th className="px-4 py-2.5 font-medium">Provider</th>
                    <th className="px-4 py-2.5 font-medium">Issued</th>
                    <th className="px-4 py-2.5 font-medium">Expires</th>
                    <th className="px-4 py-2.5 font-medium">Status</th>
                    <th className="px-4 py-2.5 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filtered.map((r) => {
                    const d = daysUntil(r.expiry_date);
                    return (
                      <tr key={r.id} className="hover:bg-muted/50">
                        <td className="px-4 py-2.5 font-medium">{r.category}</td>
                        <td className="px-4 py-2.5">
                          <PropertyLink property={properties.find((p) => p.id === r.property_id)} />
                        </td>
                        <td className="px-4 py-2.5 text-muted-foreground">{r.provider || "—"}</td>
                        <td className="px-4 py-2.5 text-muted-foreground tabular-nums">{formatDate(r.issue_date)}</td>
                        <td className="px-4 py-2.5 tabular-nums">
                          {formatDate(r.expiry_date)}
                          {d != null && d < 0 && <span className="text-rose-600 dark:text-rose-400 text-xs font-medium"> · {Math.abs(d)}d overdue</span>}
                          {d != null && d >= 0 && d <= 60 && <span className="text-amber-600 dark:text-amber-400 text-xs font-medium"> · {d}d</span>}
                        </td>
                        <td className="px-4 py-2.5">
                          <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColor(r.computed)}`}>
                            {r.computed}
                          </span>
                        </td>
                        <td className="px-4 py-2.5">
                          <div className="flex items-center justify-end gap-3">
                            {r.file_url ? (
                              <a href={r.file_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-medium text-[hsl(var(--sage))] hover:underline">
                                <ExternalLink className="w-3 h-3" /> View
                              </a>
                            ) : (
                              <button onClick={() => startUpload(r)} disabled={uploadingId === r.id} className="inline-flex items-center gap-1 text-xs font-medium text-[hsl(var(--sage))] hover:underline disabled:opacity-60">
                                <Upload className="w-3 h-3" /> {uploadingId === r.id ? "Uploading…" : "Upload"}
                              </button>
                            )}
                            {(r.computed === "Overdue" || r.computed === "Expiring soon") && (
                              <button onClick={() => createJob(r)} disabled={creatingJobId === r.id} className="inline-flex items-center gap-1 text-xs font-medium text-[hsl(var(--sage))] hover:underline disabled:opacity-60 whitespace-nowrap">
                                <HardHat className="w-3 h-3" /> {creatingJobId === r.id ? "Creating…" : "Create job"}
                              </button>
                            )}
                            {r.computed !== "Compliant" && (
                              <button onClick={() => logReminder(r)} className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground whitespace-nowrap">
                                <BellRing className="w-3 h-3" /> Log reminder
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Per-property RAG board — below the live table */}
      <div className="rounded-xl border bg-card">
        <div className="px-4 pt-4 pb-2 flex items-center gap-1.5">
          <ShieldAlert className="w-4 h-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold">Property health board</h2>
        </div>
        <div className="divide-y divide-border">
          {board.map(({ property, rows, worst }) => (
            <div key={property.id} className="px-4 py-3">
              <div className="flex items-center gap-2">
                <PropertyLink property={property} className="text-sm font-medium" />
                <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${RAG_TINT[worst]}`}>
                  {rows.length === 0 ? "No records" : worst}
                </span>
              </div>
              {rows.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {rows.map((r) => {
                    const d = daysUntil(r.expiry_date);
                    const label =
                      r.computed === "Missing" || d == null
                        ? `${r.category} · missing`
                        : d < 0
                          ? `${r.category} · ${Math.abs(d)}d overdue`
                          : `${r.category} · ${d}d`;
                    return (
                      <button
                        key={r.id}
                        onClick={() => { setFilter(r.computed); setText(r.category); }}
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium hover:opacity-80 transition-opacity ${RAG_TINT[r.computed]}`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

        </TabsContent>
        <TabsContent value="prs" className="mt-0">
          <PRSReadinessPanel
            properties={properties}
            compliance={compliance}
            tenancies={tenancies}
            tenants={tenants}
            prsRegistrations={prsRegistrations}
            reload={reload}
          />
        </TabsContent>
      </Tabs>

      <input ref={fileInputRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" className="hidden" onChange={handleFile} />

      <AddRecordModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        properties={properties}
        reload={reload}
      />

      <BookContractorDialog
        task={bookingTask}
        properties={properties}
        contractors={contractors}
        onClose={() => setBookingTask(null)}
        onBooked={() => { setBookingTask(null); reload(); }}
      />
    </div>
  );
}

function AddRecordModal({ open, onClose, properties, reload }) {
  const empty = { property_id: "", category: "Gas Safety Certificate", issue_date: "", expiry_date: "", provider: "", notes: "" };
  const [form, setForm] = useState(empty);
  const [file, setFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const [expiryTouched, setExpiryTouched] = useState(false);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  // Picking a category (or issue date) suggests the expiry from its cadence.
  useEffect(() => {
    if (!open || expiryTouched) return;
    const months = CADENCE_MONTHS[form.category];
    if (!months || !form.issue_date) return;
    const d = new Date(form.issue_date + "T00:00:00");
    if (isNaN(d.getTime())) return;
    d.setMonth(d.getMonth() + months);
    setForm((f) => ({ ...f, expiry_date: d.toISOString().slice(0, 10) }));
  }, [form.category, form.issue_date, open, expiryTouched]);

  const submit = async () => {
    if (!form.property_id) {
      toast.error("Choose a property");
      return;
    }
    setSaving(true);
    try {
      let file_url;
      if (file) {
        const up = await base44.integrations.Core.UploadFile({ file });
        file_url = up.file_url;
      }
      const status = form.expiry_date
        ? computeStatus({ expiry_date: form.expiry_date })
        : "Missing";
      const record = await base44.entities.ComplianceRecord.create({
        property_id: form.property_id,
        category: form.category,
        issue_date: form.issue_date || null,
        expiry_date: form.expiry_date || null,
        provider: form.provider || null,
        status,
        notes: form.notes || null,
        ...(file_url ? { file_url } : {}),
      });
      await logActivity(base44, {
        property_id: form.property_id,
        event_type: "Document upload",
        description: `Compliance record added: ${form.category}`,
        related_id: record.id,
      });
      toast.success("Record added");
      setForm(empty);
      setFile(null);
      setExpiryTouched(false);
      onClose();
      reload();
    } catch (e) {
      toast.error(`Couldn't add record: ${e?.message || "unknown error"}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !saving && !v && onClose()}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add compliance record</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 mt-1">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Property *</label>
              <Select value={form.property_id} onValueChange={(v) => set("property_id", v)}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Choose property" />
                </SelectTrigger>
                <SelectContent>
                  {properties.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Category</label>
              <Select value={form.category} onValueChange={(v) => set("category", v)}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Issue date</label>
              <Input type="date" value={form.issue_date} onChange={(e) => set("issue_date", e.target.value)} className="mt-1" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">
                Expiry date {CADENCE_MONTHS[form.category] && !expiryTouched && form.expiry_date ? <span className="text-[hsl(var(--sage))]">(suggested)</span> : ""}
              </label>
              <Input
                type="date"
                value={form.expiry_date}
                onChange={(e) => { setExpiryTouched(true); set("expiry_date", e.target.value); }}
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Provider / engineer</label>
              <Input value={form.provider} onChange={(e) => set("provider", e.target.value)} placeholder="e.g. SafeGas Ltd" className="mt-1" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Certificate file</label>
              <Input type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" onChange={(e) => setFile(e.target.files?.[0] || null)} className="mt-1" />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Notes</label>
            <Textarea value={form.notes} onChange={(e) => set("notes", e.target.value)} rows={2} className="mt-1" />
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={onClose} disabled={saving} className="px-3.5 py-2 border bg-card hover:bg-muted rounded-lg text-sm font-medium transition-colors">
              Cancel
            </button>
            <button onClick={submit} disabled={saving} className="px-3.5 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-60">
              {saving ? (file ? "Uploading…" : "Saving…") : "Add record"}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}