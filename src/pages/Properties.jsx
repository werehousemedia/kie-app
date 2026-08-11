import React, { useState, useEffect, useMemo } from "react";
import { useSearchParams, useNavigate, Navigate, Link } from "react-router-dom";
import { useKieData } from "@/lib/useKieData";
import { base44 } from "@/api/base44Client";
import { formatGBP, daysUntil, statusColor, logActivity } from "@/lib/kieUtils";
import {
  Building2, Search, LayoutGrid, List, Plus, MapPin, Users, Wrench, FileCheck,
  Sheet, ArrowUp, ArrowDown, ArrowUpDown, AlertTriangle,
} from "lucide-react";
import PageHeader from "@/components/shared/PageHeader";
import EmptyState from "@/components/shared/EmptyState";
import { CardGridSkeleton } from "@/components/shared/Skeletons";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";

const BTN_PRIMARY = "inline-flex items-center gap-1.5 px-3.5 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 active:scale-[0.98] transition-all shadow-sm";
const BTN_SECONDARY = "inline-flex items-center gap-1.5 px-3.5 py-2 border bg-card hover:bg-muted text-foreground rounded-lg text-sm font-medium active:scale-[0.98] transition-all shadow-sm";
const CHIP = "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ";

const VIEW_KEY = "kie_props_view";

const EMPTY_STATS = { tenants: 0, open: 0, expired: 0, expiring: 0 };

export default function Properties() {
  const { properties, tenants, compliance, tickets, units, reload, loading, error } = useKieData();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const [view, setViewState] = useState(() => {
    try { return localStorage.getItem(VIEW_KEY) === "table" ? "table" : "grid"; }
    catch { return "grid"; }
  });
  const [search, setSearch] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [sort, setSort] = useState({ key: null, dir: "asc" });

  const setView = (v) => {
    setViewState(v);
    try { localStorage.setItem(VIEW_KEY, v); } catch { /* storage unavailable — view stays for this session */ }
  };

  // ?new=1 → open the create modal, then clean the URL
  useEffect(() => {
    if (searchParams.get("new") === "1") {
      setAddOpen(true);
      setSearchParams((p) => { p.delete("new"); return p; }, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Per-property health stats, computed once per data change (not per keystroke)
  const stats = useMemo(() => {
    const m = new Map();
    for (const p of properties) m.set(p.id, { tenants: 0, open: 0, expired: 0, expiring: 0 });
    for (const t of tenants) {
      const s = m.get(t.property_id);
      if (s) s.tenants++;
    }
    for (const t of tickets) {
      if (t.status === "Complete" || t.status === "Cancelled") continue;
      const s = m.get(t.property_id);
      if (s) s.open++;
    }
    for (const c of compliance) {
      const s = m.get(c.property_id);
      if (!s) continue;
      const d = daysUntil(c.expiry_date);
      if (d === null) continue;
      if (d < 0) s.expired++;
      else if (d <= 60) s.expiring++;
    }
    return m;
  }, [properties, tenants, tickets, compliance]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    let list = properties.filter((p) =>
      p.name?.toLowerCase().includes(q) ||
      p.address?.toLowerCase().includes(q) ||
      p.postcode?.toLowerCase().includes(q)
    );
    if (sort.key) {
      const dir = sort.dir === "desc" ? -1 : 1;
      list = [...list].sort((a, b) => {
        const sa = stats.get(a.id) || EMPTY_STATS;
        const sb = stats.get(b.id) || EMPTY_STATS;
        switch (sort.key) {
          case "name": return dir * (a.name || "").localeCompare(b.name || "");
          case "rent": return dir * ((a.monthly_rent_expected || 0) - (b.monthly_rent_expected || 0));
          case "issues": return dir * (sa.open - sb.open);
          case "expiring": return dir * ((sa.expired * 1000 + sa.expiring) - (sb.expired * 1000 + sb.expiring));
          default: return 0;
        }
      });
    }
    return list;
  }, [properties, search, sort, stats]);

  // Legacy deep link: /properties?property=<id> → the detail route
  const propParam = searchParams.get("property");
  if (propParam) return <Navigate to={`/properties/${propParam}`} replace />;

  if (loading) {
    return (
      <div className="space-y-5 animate-fade-in">
        <PageHeader title="Properties" subtitle="Loading your portfolio…" />
        <CardGridSkeleton />
      </div>
    );
  }

  const toggleSort = (key) => setSort((s) =>
    s.key === key
      ? { key, dir: s.dir === "asc" ? "desc" : "asc" }
      : { key, dir: key === "name" ? "asc" : "desc" }
  );

  const openProperty = (id) => navigate(`/properties/${id}`);

  const renderCards = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {filtered.map((p) => {
        const s = stats.get(p.id) || EMPTY_STATS;
        return (
          <button
            key={p.id}
            onClick={() => openProperty(p.id)}
            className="rounded-xl border border-l-4 border-l-indigo-500 bg-card p-5 text-left hover:border-[hsl(var(--sage))] hover:border-l-indigo-500 hover:shadow-md active:scale-[0.98] transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--sage))]"
          >
            <div className="flex items-start justify-between mb-3">
              <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                <Building2 className="w-5 h-5 text-muted-foreground" />
              </div>
              <span className={CHIP + statusColor(p.occupancy_status)}>{p.occupancy_status}</span>
            </div>
            <h3 className="text-base font-semibold text-foreground truncate">{p.name}</h3>
            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5 truncate">
              <MapPin className="w-3 h-3 shrink-0" />
              <span className="truncate">{p.address}{p.postcode ? `, ${p.postcode}` : ""}</span>
            </p>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5" />{s.tenants} tenants</span>
              <span className="flex items-center gap-1"><Wrench className="w-3.5 h-3.5" />{s.open} open</span>
              {s.expired > 0 && (
                <span className="flex items-center gap-1 font-medium text-rose-600 dark:text-rose-400">
                  <FileCheck className="w-3.5 h-3.5" />{s.expired} expired
                </span>
              )}
              {s.expiring > 0 && (
                <span className="flex items-center gap-1 font-medium text-amber-600 dark:text-amber-400">
                  <FileCheck className="w-3.5 h-3.5" />{s.expiring} expiring
                </span>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );

  const renderTable = () => (
    <div className="rounded-xl border bg-card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="bg-muted/50 text-xs text-muted-foreground uppercase">
            <tr>
              <SortableTh label="Property" sortKey="name" sort={sort} onSort={toggleSort} />
              <th className="text-left px-4 py-3 font-medium">Type</th>
              <th className="text-left px-4 py-3 font-medium">Occupancy</th>
              <th className="text-left px-4 py-3 font-medium">Tenants</th>
              <SortableTh label="Open issues" sortKey="issues" sort={sort} onSort={toggleSort} />
              <SortableTh label="Compliance" sortKey="expiring" sort={sort} onSort={toggleSort} />
              <SortableTh label="Rent/mo" sortKey="rent" sort={sort} onSort={toggleSort} align="right" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filtered.map((p) => {
              const s = stats.get(p.id) || EMPTY_STATS;
              return (
                <tr key={p.id} onClick={() => openProperty(p.id)} className="hover:bg-muted transition-colors cursor-pointer">
                  <td className="px-4 py-3 border-l-[3px] border-l-indigo-500">
                    <Link
                      to={`/properties/${p.id}`}
                      onClick={(e) => e.stopPropagation()}
                      className="font-medium text-foreground hover:underline rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--sage))]"
                    >
                      {p.name}
                    </Link>
                    <p className="text-xs text-muted-foreground">{p.postcode}</p>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{p.property_type}</td>
                  <td className="px-4 py-3"><span className={CHIP + statusColor(p.occupancy_status)}>{p.occupancy_status}</span></td>
                  <td className="px-4 py-3 text-muted-foreground tabular-nums">{s.tenants}</td>
                  <td className="px-4 py-3 tabular-nums">
                    {s.open > 0
                      ? <span className="text-blue-600 dark:text-blue-400 font-medium">{s.open}</span>
                      : <span className="text-muted-foreground/50">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    {s.expired === 0 && s.expiring === 0
                      ? <span className="text-emerald-600 dark:text-emerald-400">OK</span>
                      : (
                        <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                          {s.expired > 0 && <span className="font-medium text-rose-600 dark:text-rose-400">{s.expired} expired</span>}
                          {s.expiring > 0 && <span className="font-medium text-amber-600 dark:text-amber-400">{s.expiring} expiring</span>}
                        </span>
                      )}
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-foreground tabular-nums">{formatGBP(p.monthly_rent_expected)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );

  const dataFailed = error && properties.length === 0;
  const firstUse = !error && properties.length === 0;
  const noResults = properties.length > 0 && filtered.length === 0;

  return (
    <div className="space-y-5 animate-fade-in">
      <PageHeader
        title="Properties"
        subtitle={`${properties.length} properties · ${units.length} units`}
        actions={
          <>
            <Link to="/import" className={BTN_SECONDARY}>
              <Sheet className="w-4 h-4" /> Import from sheet
            </Link>
            <button onClick={() => setAddOpen(true)} className={BTN_PRIMARY}>
              <Plus className="w-4 h-4" /> Add property
            </button>
          </>
        }
      />

      {properties.length > 0 && (
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search properties..."
              aria-label="Search properties"
              className="w-full pl-9 pr-3 py-2 bg-card border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[hsl(var(--sage))]/40"
            />
          </div>
          <div className="hidden md:flex items-center gap-1 bg-card border rounded-lg p-1">
            <button
              onClick={() => setView("grid")}
              aria-label="Grid view"
              aria-pressed={view === "grid"}
              title="Grid view"
              className={`p-1.5 rounded transition-colors ${view === "grid" ? "bg-muted" : "hover:bg-muted/60"}`}
            >
              <LayoutGrid className="w-4 h-4 text-muted-foreground" />
            </button>
            <button
              onClick={() => setView("table")}
              aria-label="Table view"
              aria-pressed={view === "table"}
              title="Table view"
              className={`p-1.5 rounded transition-colors ${view === "table" ? "bg-muted" : "hover:bg-muted/60"}`}
            >
              <List className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>
        </div>
      )}

      {dataFailed ? (
        <div className="rounded-xl border bg-card">
          <EmptyState
            icon={AlertTriangle}
            title="Couldn't load your portfolio"
            description={error}
            action={<button onClick={() => reload()} className={BTN_SECONDARY}>Try again</button>}
          />
        </div>
      ) : firstUse ? (
        <div className="rounded-xl border bg-card">
          <EmptyState
            icon={Building2}
            title="No properties yet"
            description="Add your first property, or import your whole portfolio from a spreadsheet."
            action={
              <div className="flex flex-wrap items-center justify-center gap-2">
                <button onClick={() => setAddOpen(true)} className={BTN_PRIMARY}>
                  <Plus className="w-4 h-4" /> Add property
                </button>
                <Link to="/import" className={BTN_SECONDARY}>
                  <Sheet className="w-4 h-4" /> Import from sheet
                </Link>
              </div>
            }
          />
        </div>
      ) : noResults ? (
        <div className="rounded-xl border bg-card">
          <EmptyState
            icon={Search}
            title="Nothing matches"
            description={`No properties match "${search}". Try a different name, address or postcode.`}
            action={<button onClick={() => setSearch("")} className={BTN_SECONDARY}>Clear search</button>}
          />
        </div>
      ) : view === "grid" ? (
        renderCards()
      ) : (
        <>
          {/* Below md the table view falls back to cards — 7 columns never fit a phone */}
          <div className="md:hidden">{renderCards()}</div>
          <div className="hidden md:block">{renderTable()}</div>
        </>
      )}

      <AddPropertyModal open={addOpen} onClose={() => setAddOpen(false)} onCreated={reload} />
    </div>
  );
}

function SortableTh({ label, sortKey, sort, onSort, align = "left" }) {
  const active = sort.key === sortKey;
  const Icon = active ? (sort.dir === "asc" ? ArrowUp : ArrowDown) : ArrowUpDown;
  return (
    <th
      aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}
      className={`px-4 py-3 font-medium ${align === "right" ? "text-right" : "text-left"}`}
    >
      <button
        onClick={() => onSort(sortKey)}
        className="inline-flex items-center gap-1 uppercase hover:text-foreground transition-colors rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--sage))]"
      >
        {label}
        <Icon className={`w-3 h-3 ${active ? "" : "opacity-40"}`} />
      </button>
    </th>
  );
}

const BLANK_FORM = {
  name: "", address: "", postcode: "",
  property_type: "House", hmo_status: "Not HMO",
  units_count: "1", monthly_rent_expected: "0", council_tax_band: "B",
};

const HMO_VALUES = ["Licensed HMO", "HMO (unlicensed)"];
const BASE_CHECKLIST = ["Gas Safety Certificate", "EICR", "EPC"];

function AddPropertyModal({ open, onClose, onCreated }) {
  const [form, setForm] = useState(BLANK_FORM);
  const [scaffold, setScaffold] = useState(true);
  const [saving, setSaving] = useState(false);

  const set = (key) => (value) => setForm((f) => ({ ...f, [key]: value }));

  const parsedUnits = (() => {
    const n = parseInt(form.units_count, 10);
    return Number.isFinite(n) && n > 0 ? n : 1;
  })();
  const isHmo = HMO_VALUES.includes(form.hmo_status);

  const handleSubmit = async () => {
    if (saving) return;
    if (!form.name.trim() || !form.address.trim()) {
      toast.error("Name and address are required");
      return;
    }
    const rentN = parseFloat(form.monthly_rent_expected);
    const payload = {
      name: form.name.trim(),
      address: form.address.trim(),
      postcode: form.postcode.trim(),
      property_type: form.property_type,
      hmo_status: form.hmo_status,
      units_count: parsedUnits,
      occupancy_status: "Vacant",
      monthly_rent_expected: Number.isFinite(rentN) && rentN >= 0 ? rentN : 0,
      council_tax_band: form.council_tax_band,
    };

    setSaving(true);
    let prop;
    try {
      prop = await base44.entities.Property.create(payload);
      await logActivity(base44, { property_id: prop.id, event_type: "Property update", description: `Property created: ${payload.name}` });
    } catch (e) {
      toast.error(e?.message ? `Failed to add property: ${e.message}` : "Failed to add property");
      setSaving(false);
      return;
    }

    let summary = "Property added";
    if (scaffold) {
      try {
        const categories = [...BASE_CHECKLIST];
        if (isHmo) categories.push("HMO licence");
        for (const category of categories) {
          await base44.entities.ComplianceRecord.create({
            property_id: prop.id,
            category,
            status: "Missing",
            source: "manual",
            is_demo: false,
          });
        }
        let unitsMade = 0;
        if (payload.units_count > 1) {
          for (let i = 1; i <= payload.units_count; i++) {
            await base44.entities.Unit.create({
              property_id: prop.id,
              unit_label: `Room ${i}`,
              occupancy_status: "Vacant",
              is_demo: false,
              source: "manual",
            });
            unitsMade++;
          }
        }
        await logActivity(base44, {
          property_id: prop.id,
          event_type: "Property update",
          description: `Compliance checklist set up for ${payload.name}: ${categories.length} certificates to track${unitsMade > 0 ? `, ${unitsMade} rooms created` : ""}`,
        });
        summary = `Property added — tracking ${categories.length} certificates${unitsMade > 0 ? `, ${unitsMade} rooms created` : ""}`;
      } catch (e) {
        toast.error(e?.message
          ? `Property added, but the checklist couldn't be finished: ${e.message}`
          : "Property added, but the compliance checklist couldn't be finished");
        onCreated();
        onClose();
        setForm(BLANK_FORM);
        setScaffold(true);
        setSaving(false);
        return;
      }
    }

    toast.success(summary);
    onCreated();
    onClose();
    setForm(BLANK_FORM);
    setScaffold(true);
    setSaving(false);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o && !saving) onClose(); }}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Add property</DialogTitle></DialogHeader>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 py-2">
          <div className="sm:col-span-2 space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground">Property name</Label>
            <Input value={form.name} onChange={(e) => set("name")(e.target.value)} placeholder="e.g. 7 Willow Court" />
          </div>
          <div className="sm:col-span-2 space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground">Address</Label>
            <Input value={form.address} onChange={(e) => set("address")(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground">Postcode</Label>
            <Input value={form.postcode} onChange={(e) => set("postcode")(e.target.value)} placeholder="e.g. TN1 1AA" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground">Property type</Label>
            <Select value={form.property_type} onValueChange={set("property_type")}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {["House", "Flat", "HMO", "Bungalow", "Studio", "Maisonette", "Commercial"].map((t) => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground">HMO status</Label>
            <Select value={form.hmo_status} onValueChange={set("hmo_status")}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {["Not HMO", "Licensed HMO", "HMO (unlicensed)"].map((t) => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground">Units/rooms</Label>
            <Input type="number" min="1" step="1" inputMode="numeric" value={form.units_count} onChange={(e) => set("units_count")(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground">Monthly rent (£)</Label>
            <Input type="number" min="0" step="0.01" inputMode="decimal" value={form.monthly_rent_expected} onChange={(e) => set("monthly_rent_expected")(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground">Council tax band</Label>
            <Select value={form.council_tax_band} onValueChange={set("council_tax_band")}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {["A", "B", "C", "D", "E", "F", "G", "H"].map((t) => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="sm:col-span-2 flex items-center justify-between gap-3 rounded-lg border p-3">
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground">Set up compliance checklist</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Creates Gas Safety, EICR and EPC trackers{isHmo ? ", plus HMO licence" : ""}{parsedUnits > 1 ? `, and ${parsedUnits} room records` : ""}.
              </p>
            </div>
            <Switch checked={scaffold} onCheckedChange={setScaffold} aria-label="Set up compliance checklist" />
          </div>
        </div>
        <DialogFooter className="gap-2">
          <button onClick={onClose} disabled={saving} className={BTN_SECONDARY + " disabled:opacity-50"}>Cancel</button>
          <button onClick={handleSubmit} disabled={saving} className={BTN_PRIMARY + " disabled:opacity-60"}>
            {saving ? "Saving…" : "Add property"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
