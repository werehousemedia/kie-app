import React, { useEffect, useMemo, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { toast } from "sonner";
import { Plus, Search, HardHat, Star, Phone, Mail, ShieldAlert, Trash2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useKieData } from "@/lib/useKieData";
import { formatGBP, formatDate, daysUntil, statusColor, logActivity } from "@/lib/kieUtils";
import PageHeader from "@/components/shared/PageHeader";
import EmptyState from "@/components/shared/EmptyState";
import { CardGridSkeleton } from "@/components/shared/Skeletons";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

const TRADES = ["Plumbing", "Heating/Gas", "Electrical", "General", "Carpentry", "Roofing", "Pest control", "Cleaning", "Locksmith", "Appliance repair"];
const AVAILABILITY = ["Available", "Limited", "Booked", "On holiday"];

function insuranceBadge(c) {
  const d = daysUntil(c.insurance_expiry);
  if (d == null) return null;
  if (d < 0)
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300 px-2 py-0.5 text-[11px] font-medium">
        <ShieldAlert className="w-3 h-3" /> Insurance expired {Math.abs(d)}d ago
      </span>
    );
  if (d <= 30)
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300 px-2 py-0.5 text-[11px] font-medium">
        <ShieldAlert className="w-3 h-3" /> Insurance expires in {d}d
      </span>
    );
  return (
    <span className="inline-flex items-center rounded-full bg-muted text-muted-foreground px-2 py-0.5 text-[11px] font-medium">
      Insured to {formatDate(c.insurance_expiry)}
    </span>
  );
}

const insuranceRisk = (c) => {
  const d = daysUntil(c.insurance_expiry);
  if (d == null) return 500; // unknown sorts after real risk but before healthy
  return d;
};

export default function Contractors() {
  const { contractors, tickets, reload, loading } = useKieData();
  const [searchParams, setSearchParams] = useSearchParams();
  const [text, setText] = useState("");
  const [sortRisk, setSortRisk] = useState(false);
  const [openId, setOpenId] = useState(searchParams.get("contractor") || null);
  const [addOpen, setAddOpen] = useState(false);

  useEffect(() => {
    if (searchParams.get("new") === "1") {
      setAddOpen(true);
      setSearchParams((p) => { p.delete("new"); return p; }, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    const id = searchParams.get("contractor");
    if (id) setOpenId(id);
  }, [searchParams]);

  const closeSheet = () => {
    setOpenId(null);
    setSearchParams((p) => { p.delete("contractor"); return p; }, { replace: true });
  };

  const activeJobs = useMemo(() => {
    const map = {};
    for (const t of tickets) {
      if (t.contractor_id && t.status !== "Complete" && t.status !== "Cancelled") {
        map[t.contractor_id] = (map[t.contractor_id] || 0) + 1;
      }
    }
    return map;
  }, [tickets]);

  const filtered = useMemo(() => {
    const q = text.trim().toLowerCase();
    let list = contractors.filter(
      (c) => !q || [c.name, c.trade, c.coverage_area].some((s) => (s || "").toLowerCase().includes(q))
    );
    list = [...list].sort((a, b) =>
      sortRisk
        ? insuranceRisk(a) - insuranceRisk(b)
        : (b.preferred === true) - (a.preferred === true) || (a.name || "").localeCompare(b.name || "")
    );
    return list;
  }, [contractors, text, sortRisk]);

  const preferredCount = contractors.filter((c) => c.preferred).length;
  const open = contractors.find((c) => c.id === openId) || null;

  if (loading) {
    return (
      <div className="space-y-5">
        <PageHeader title="Contractors" subtitle="Loading directory…" />
        <CardGridSkeleton cards={6} />
      </div>
    );
  }

  return (
    <div className="space-y-5 animate-fade-in">
      <PageHeader
        title="Contractors"
        subtitle={`${contractors.length} in your book · ${preferredCount} preferred`}
        actions={
          <button
            onClick={() => setAddOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
          >
            <Plus className="w-4 h-4" /> Add contractor
          </button>
        }
      />

      <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Search name, trade, area…"
            className="w-full pl-9 pr-3 py-2 bg-muted rounded-lg text-sm border border-transparent focus:outline-none focus:bg-card focus:border-border transition-all"
          />
        </div>
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <Switch checked={sortRisk} onCheckedChange={setSortRisk} aria-label="Sort by insurance risk" />
          Sort by insurance risk
        </label>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border bg-card">
          {contractors.length === 0 ? (
            <EmptyState
              icon={HardHat}
              title="No contractors yet"
              description="Build your book of trades — the AI uses it to suggest who to hire when tenants report issues."
              action={
                <button onClick={() => setAddOpen(true)} className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 transition-opacity">
                  <Plus className="w-4 h-4" /> Add contractor
                </button>
              }
            />
          ) : (
            <EmptyState
              icon={Search}
              title="Nothing matches"
              action={
                <button onClick={() => setText("")} className="text-sm font-medium text-[hsl(var(--sage))] hover:underline">
                  Clear search
                </button>
              }
            />
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((c) => (
            <button
              key={c.id}
              onClick={() => {
                setOpenId(c.id);
                setSearchParams((p) => { p.set("contractor", c.id); return p; }, { replace: true });
              }}
              className="rounded-xl border border-l-4 border-l-orange-500 bg-card p-4 text-left hover:bg-muted/60 active:scale-[0.99] transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))]"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
                  <HardHat className="w-5 h-5 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate flex items-center gap-1.5">
                    {c.name}
                    {c.preferred && <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-400 shrink-0" />}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {c.trade}
                    {c.rating ? ` · ${c.rating}★` : ""}
                    {c.coverage_area ? ` · ${c.coverage_area}` : ""}
                  </p>
                </div>
                <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium shrink-0 ${statusColor(c.availability)}`}>
                  {c.availability || "—"}
                </span>
              </div>
              <div className="flex items-center gap-1.5 flex-wrap mt-3">
                {insuranceBadge(c)}
                {(activeJobs[c.id] || 0) > 0 && (
                  <span className="inline-flex items-center rounded-full bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300 px-2 py-0.5 text-[11px] font-medium">
                    {activeJobs[c.id]} active job{activeJobs[c.id] === 1 ? "" : "s"}
                  </span>
                )}
                {c.avg_quote > 0 && (
                  <span className="inline-flex items-center rounded-full bg-muted text-muted-foreground px-2 py-0.5 text-[11px] font-medium tabular-nums">
                    ~{formatGBP(c.avg_quote)}
                  </span>
                )}
              </div>
            </button>
          ))}
        </div>
      )}

      <ContractorSheet
        contractor={open}
        onClose={closeSheet}
        tickets={tickets}
        reload={reload}
      />
      <ContractorFormModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        reload={reload}
      />
    </div>
  );
}

function ContractorSheet({ contractor, onClose, tickets, reload }) {
  const [editOpen, setEditOpen] = useState(false);
  if (!contractor) return null;

  const jobs = tickets
    .filter((t) => t.contractor_id === contractor.id)
    .sort((a, b) => String(b.created_date || "").localeCompare(String(a.created_date || "")))
    .slice(0, 8);

  const togglePreferred = async () => {
    try {
      await base44.entities.Contractor.update(contractor.id, { preferred: !contractor.preferred });
      toast.success(contractor.preferred ? "Removed from preferred" : "Marked as preferred");
      reload();
    } catch (e) {
      toast.error(`Couldn't update: ${e?.message || "unknown error"}`);
    }
  };

  const remove = async () => {
    try {
      await base44.entities.Contractor.delete(contractor.id);
      await logActivity(base44, {
        event_type: "Contractor assigned",
        description: `Contractor removed from book: ${contractor.name}`,
      });
      toast.success(`${contractor.name} removed`);
      onClose();
      reload();
    } catch (e) {
      toast.error(`Couldn't remove: ${e?.message || "unknown error"}`);
    }
  };

  return (
    <Sheet open={!!contractor} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader className="pb-3">
          <SheetTitle className="flex items-center gap-2 pr-8">
            {contractor.name}
            {contractor.preferred && <Star className="w-4 h-4 text-amber-500 fill-amber-400" />}
          </SheetTitle>
        </SheetHeader>
        <div className="space-y-4">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium">
              {contractor.trade}
            </span>
            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${statusColor(contractor.availability)}`}>
              {contractor.availability || "—"}
            </span>
            {insuranceBadge(contractor)}
          </div>

          <div className="text-sm space-y-1.5">
            {contractor.services && <p className="text-muted-foreground">{contractor.services}</p>}
            {contractor.coverage_area && (
              <p><span className="text-muted-foreground">Covers: </span>{contractor.coverage_area}</p>
            )}
            {contractor.rating > 0 && (
              <p><span className="text-muted-foreground">Rating: </span>{contractor.rating}★</p>
            )}
            {contractor.avg_quote > 0 && (
              <p className="tabular-nums"><span className="text-muted-foreground">Typical quote: </span>{formatGBP(contractor.avg_quote)}</p>
            )}
          </div>

          <div className="flex gap-2">
            {contractor.phone && (
              <a href={`tel:${contractor.phone}`} className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 border bg-card hover:bg-muted rounded-lg text-sm font-medium transition-colors">
                <Phone className="w-4 h-4" /> Call
              </a>
            )}
            {contractor.email && (
              <a href={`mailto:${contractor.email}`} className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 border bg-card hover:bg-muted rounded-lg text-sm font-medium transition-colors">
                <Mail className="w-4 h-4" /> Email
              </a>
            )}
          </div>

          <label className="flex items-center gap-3 rounded-xl border px-3.5 py-2.5">
            <Star className="w-4 h-4 text-muted-foreground" />
            <span className="flex-1 text-sm font-medium">Preferred contractor</span>
            <Switch checked={!!contractor.preferred} onCheckedChange={togglePreferred} />
          </label>

          <div>
            <p className="text-[11px] font-semibold text-muted-foreground mb-1.5">Job history</p>
            {jobs.length === 0 ? (
              <p className="text-xs text-muted-foreground">No jobs assigned yet.</p>
            ) : (
              <div className="space-y-1.5">
                {jobs.map((t) => (
                  <Link
                    key={t.id}
                    to={`/maintenance?ticket=${t.id}`}
                    className="flex items-center gap-2 text-xs hover:underline"
                  >
                    <span className="flex-1 min-w-0 truncate">{(t.description || "Job").slice(0, 50)}</span>
                    <span className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium shrink-0 ${statusColor(t.status)}`}>
                      {t.status}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </div>

          <div className="flex gap-2 pt-1">
            <button
              onClick={() => setEditOpen(true)}
              className="flex-1 px-3.5 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
            >
              Edit details
            </button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <button aria-label="Remove contractor" className="px-3 py-2 border bg-card hover:bg-muted rounded-lg text-rose-600 dark:text-rose-400 transition-colors">
                  <Trash2 className="w-4 h-4" />
                </button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Remove {contractor.name}?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Past jobs keep their records; the contractor just leaves your book.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Keep</AlertDialogCancel>
                  <AlertDialogAction onClick={remove} className="bg-rose-600 hover:bg-rose-700 text-white">
                    Remove
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
        <ContractorFormModal
          open={editOpen}
          onClose={() => setEditOpen(false)}
          contractor={contractor}
          reload={reload}
        />
      </SheetContent>
    </Sheet>
  );
}

function ContractorFormModal({ open, onClose, contractor, reload }) {
  const isEdit = !!contractor;
  const empty = {
    name: "", trade: "General", services: "", coverage_area: "", phone: "",
    email: "", availability: "Available", insurance_expiry: "", rating: "", avg_quote: "", preferred: false,
  };
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open && contractor) {
      setForm({
        name: contractor.name || "",
        trade: contractor.trade || "General",
        services: contractor.services || "",
        coverage_area: contractor.coverage_area || "",
        phone: contractor.phone || "",
        email: contractor.email || "",
        availability: contractor.availability || "Available",
        insurance_expiry: contractor.insurance_expiry || "",
        rating: contractor.rating ?? "",
        avg_quote: contractor.avg_quote ?? "",
        preferred: !!contractor.preferred,
      });
    } else if (open) {
      setForm(empty);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, contractor?.id]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const num = (v) => {
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : null;
  };

  const submit = async () => {
    if (!form.name.trim() || !form.trade) {
      toast.error("Name and trade are required");
      return;
    }
    setSaving(true);
    const payload = {
      name: form.name.trim(),
      trade: form.trade,
      services: form.services,
      coverage_area: form.coverage_area,
      phone: form.phone,
      email: form.email,
      availability: form.availability,
      insurance_expiry: form.insurance_expiry || null,
      rating: num(form.rating),
      preferred: form.preferred,
      avg_quote: num(form.avg_quote),
    };
    try {
      if (isEdit) {
        await base44.entities.Contractor.update(contractor.id, payload);
        toast.success("Contractor updated");
      } else {
        await base44.entities.Contractor.create(payload);
        toast.success("Contractor added");
      }
      onClose();
      reload();
    } catch (e) {
      toast.error(`Couldn't save: ${e?.message || "unknown error"}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !saving && !v && onClose()}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? `Edit ${contractor.name}` : "Add contractor"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 mt-1">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Name *</label>
              <Input value={form.name} onChange={(e) => set("name", e.target.value)} className="mt-1" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Trade *</label>
              <Select value={form.trade} onValueChange={(v) => set("trade", v)}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TRADES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Phone</label>
              <Input value={form.phone} onChange={(e) => set("phone", e.target.value)} className="mt-1" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Email</label>
              <Input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} className="mt-1" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Availability</label>
              <Select value={form.availability} onValueChange={(v) => set("availability", v)}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {AVAILABILITY.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Insurance expiry</label>
              <Input type="date" value={form.insurance_expiry} onChange={(e) => set("insurance_expiry", e.target.value)} className="mt-1" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Rating (0–5)</label>
              <Input type="number" min="0" max="5" step="0.1" value={form.rating} onChange={(e) => set("rating", e.target.value)} className="mt-1" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Typical quote £</label>
              <Input type="number" min="0" value={form.avg_quote} onChange={(e) => set("avg_quote", e.target.value)} className="mt-1" />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Services</label>
            <Input value={form.services} onChange={(e) => set("services", e.target.value)} className="mt-1" placeholder="e.g. emergency call-outs, boiler servicing" />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Coverage area</label>
            <Input value={form.coverage_area} onChange={(e) => set("coverage_area", e.target.value)} className="mt-1" placeholder="e.g. TN1–TN4, Tunbridge Wells" />
          </div>
          <label className="flex items-center gap-3 rounded-xl border px-3.5 py-2.5">
            <Star className="w-4 h-4 text-muted-foreground" />
            <span className="flex-1 text-sm font-medium">Preferred contractor</span>
            <Switch checked={form.preferred} onCheckedChange={(v) => set("preferred", v)} />
          </label>
          <div className="flex justify-end gap-2">
            <button onClick={onClose} disabled={saving} className="px-3.5 py-2 border bg-card hover:bg-muted rounded-lg text-sm font-medium transition-colors">
              Cancel
            </button>
            <button onClick={submit} disabled={saving} className="px-3.5 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-60">
              {saving ? "Saving…" : isEdit ? "Save changes" : "Add contractor"}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}