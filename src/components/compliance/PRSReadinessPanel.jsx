import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { ShieldCheck, AlertTriangle, ChevronRight, User, BadgeCheck } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { daysUntil, formatDate, logActivity } from "@/lib/kieUtils";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// PRS Database readiness. Since 30 April 2026, Section 8 possession needs an
// active PRS registration (penalties £7,000 / £40,000 for non-registration),
// so this panel checks whether each property's data is complete enough to
// register, names every gap with a jump-to-fix link, and rolls it all up
// into a portfolio readiness score.
// ---------------------------------------------------------------------------

const STATUS_STYLE = {
  Registered: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  "Ready to register": "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300",
  "Missing data": "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
};

const inDate = (records, category, propertyId) => {
  const r = records.find((c) => c.property_id === propertyId && c.category === category && c.expiry_date);
  if (!r) return { ok: false };
  const d = daysUntil(r.expiry_date);
  return { ok: d != null && d >= 0, record: r };
};

export function propertyChecks(property, { compliance, tenancies, tenants }) {
  const activeTenancy = tenancies.find(
    (t) => t.property_id === property.id && (t.status === "Active" || t.status === "Periodic")
  );
  const tenant = activeTenancy ? tenants.find((t) => t.id === activeTenancy.tenant_id) : null;
  const propTo = `/properties/${property.id}`;
  const checks = [
    { key: "address", label: "Address", ok: !!property.address, fixTo: propTo },
    { key: "postcode", label: "Postcode / UPRN", ok: !!property.postcode, fixTo: propTo },
    { key: "type", label: "Property type", ok: !!property.property_type, fixTo: propTo },
    { key: "tenure", label: "Tenure", ok: !!property.tenure, fixTo: propTo },
    {
      key: "hmo",
      label: property.hmo_status === "Licensed HMO" ? "HMO licence" : "HMO status",
      ok:
        property.hmo_status === "Licensed HMO"
          ? inDate(compliance, "HMO licence", property.id).ok
          : !!property.hmo_status,
      fixTo: property.hmo_status === "Licensed HMO" ? "/compliance?new=1" : propTo,
    },
    { key: "units", label: "Unit count", ok: (property.units_count || 0) > 0, fixTo: propTo },
    { key: "epc", label: "EPC rating / reference", ok: inDate(compliance, "EPC", property.id).ok, fixTo: "/compliance?new=1" },
    { key: "gas", label: "Gas safety certificate", ok: inDate(compliance, "Gas Safety Certificate", property.id).ok, fixTo: "/compliance?new=1" },
    { key: "eicr", label: "EICR", ok: inDate(compliance, "EICR", property.id).ok, fixTo: "/compliance?new=1" },
  ];
  if (activeTenancy) {
    checks.push({
      key: "deposit",
      label: "Deposit protection scheme / reference",
      ok: !!(activeTenancy.deposit_scheme || tenant?.deposit_scheme),
      fixTo: tenant ? `/tenants/${tenant.id}` : "/tenants",
    });
    checks.push({
      key: "tenancy",
      label: "Tenancy start date",
      ok: !!activeTenancy.start_date,
      fixTo: tenant ? `/tenants/${tenant.id}` : "/tenants",
    });
  }
  return checks;
}

export default function PRSReadinessPanel({ properties, compliance, tenancies, tenants, prsRegistrations, reload }) {
  const [landlord, setLandlord] = useState(null); // parsed AppSetting or null
  const [landlordOpen, setLandlordOpen] = useState(false);
  const [registerFor, setRegisterFor] = useState(null); // property being marked registered

  useEffect(() => {
    let alive = true;
    base44.entities.AppSetting.filter({ key: "landlord_details" })
      .then((rows) => {
        if (!alive) return;
        try {
          setLandlord(rows?.[0] ? { id: rows[0].id, ...JSON.parse(rows[0].value) } : null);
        } catch {
          setLandlord(null);
        }
      })
      .catch(() => {});
    return () => { alive = false; };
  }, [landlordOpen]);

  const rows = useMemo(() => {
    return properties.map((p) => {
      const registration = (prsRegistrations || []).find(
        (r) => r.property_id === p.id && r.registration_number && (r.status === "Active" || r.status === "Expiring soon")
      );
      const checks = propertyChecks(p, { compliance, tenancies, tenants });
      const landlordOk = !!(landlord?.name && landlord?.address);
      const allChecks = [
        ...checks,
        { key: "landlord", label: "Landlord details", ok: landlordOk, fixTo: null, portfolio: true },
        // Self-managing landlords have no agent — recorded as satisfied.
        { key: "agent", label: "Agent details", ok: true, na: true },
      ];
      const gaps = allChecks.filter((c) => !c.ok);
      const status = registration ? "Registered" : gaps.length === 0 ? "Ready to register" : "Missing data";
      return { property: p, registration, checks: allChecks, gaps, status };
    });
  }, [properties, compliance, tenancies, tenants, prsRegistrations, landlord]);

  const score = useMemo(() => {
    let ok = 0, total = 0;
    for (const r of rows) {
      for (const c of r.checks) {
        if (c.na) continue;
        total++;
        if (c.ok || r.status === "Registered") ok++;
      }
    }
    return total > 0 ? Math.round((ok / total) * 100) : 0;
  }, [rows]);

  const registered = rows.filter((r) => r.status === "Registered").length;

  return (
    <div className="space-y-4">
      {/* Portfolio roll-up */}
      <div className="rounded-xl border bg-card p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex-1 min-w-[220px]">
            <div className="flex items-baseline justify-between mb-1.5">
              <p className="text-sm font-semibold">Portfolio readiness</p>
              <p className="text-2xl font-semibold tabular-nums">{score}%</p>
            </div>
            <Progress value={score} className="h-2" />
            <p className="text-xs text-muted-foreground mt-1.5">
              {registered}/{rows.length} properties registered · a Section 8 possession order requires an active
              PRS Database registration. Penalties: £7,000 (civil) to £40,000 (continued breach).
            </p>
          </div>
          <button
            onClick={() => setLandlordOpen(true)}
            className={cn(
              "inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border text-sm font-medium transition-colors",
              landlord?.name ? "bg-card hover:bg-muted" : "border-amber-300 bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300 dark:border-amber-500/30",
            )}
          >
            <User className="w-4 h-4" />
            {landlord?.name ? `Landlord: ${landlord.name}` : "Add landlord details"}
          </button>
        </div>
      </div>

      {/* Per-property readiness */}
      <div className="rounded-xl border bg-card divide-y divide-border">
        {rows.map(({ property, registration, gaps, status }) => (
          <div key={property.id} className="px-4 py-3">
            <div className="flex items-center gap-2 flex-wrap">
              <Link to={`/properties/${property.id}`} className="text-sm font-medium hover:underline">
                {property.name}
              </Link>
              <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium", STATUS_STYLE[status])}>
                {status === "Registered" ? <BadgeCheck className="w-3 h-3" /> : status === "Missing data" ? <AlertTriangle className="w-3 h-3" /> : <ShieldCheck className="w-3 h-3" />}
                {status}
              </span>
              {registration && (
                <span className="text-xs text-muted-foreground">
                  {registration.registration_number}
                  {registration.expiry_date ? ` · expires ${formatDate(registration.expiry_date)}` : ""}
                </span>
              )}
              {status !== "Registered" && (
                <button
                  onClick={() => setRegisterFor(property)}
                  className="ml-auto text-xs font-medium text-[hsl(var(--sage))] hover:underline shrink-0"
                >
                  Record registration
                </button>
              )}
            </div>
            {status === "Missing data" && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {gaps.map((g) =>
                  g.key === "landlord" ? (
                    <button
                      key={g.key}
                      onClick={() => setLandlordOpen(true)}
                      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300 hover:opacity-80"
                    >
                      {g.label} <ChevronRight className="w-2.5 h-2.5" />
                    </button>
                  ) : (
                    <Link
                      key={g.key}
                      to={g.fixTo || "#"}
                      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300 hover:opacity-80"
                    >
                      {g.label} <ChevronRight className="w-2.5 h-2.5" />
                    </Link>
                  )
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      <LandlordDetailsDialog
        open={landlordOpen}
        onOpenChange={setLandlordOpen}
        existing={landlord}
      />
      <RecordRegistrationDialog
        property={registerFor}
        onClose={() => setRegisterFor(null)}
        onSaved={() => { setRegisterFor(null); reload(); }}
      />
    </div>
  );
}

function LandlordDetailsDialog({ open, onOpenChange, existing }) {
  const [form, setForm] = useState({ name: "", address: "", email: "", phone: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setForm({ name: existing?.name || "", address: existing?.address || "", email: existing?.email || "", phone: existing?.phone || "" });
  }, [open, existing]);

  const save = async () => {
    if (!form.name || !form.address) {
      toast.error("Name and address are required for PRS registration");
      return;
    }
    setSaving(true);
    try {
      const value = JSON.stringify(form);
      if (existing?.id) {
        await base44.entities.AppSetting.update(existing.id, { value });
      } else {
        await base44.entities.AppSetting.create({ key: "landlord_details", value });
      }
      toast.success("Landlord details saved");
      onOpenChange(false);
    } catch (e) {
      toast.error(`Couldn't save: ${e?.message || "unknown error"}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !saving && onOpenChange(v)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Landlord details</DialogTitle></DialogHeader>
        <p className="text-xs text-muted-foreground -mt-1">
          Used for every PRS Database registration in this workspace.
        </p>
        <div className="space-y-3 py-1">
          <div className="space-y-1.5"><Label className="text-xs">Full name *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
          <div className="space-y-1.5"><Label className="text-xs">Correspondence address *</Label><Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label className="text-xs">Email</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
            <div className="space-y-1.5"><Label className="text-xs">Phone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
          </div>
        </div>
        <DialogFooter>
          <button onClick={() => onOpenChange(false)} disabled={saving} className="px-3.5 py-2 border bg-card hover:bg-muted rounded-lg text-sm font-medium">Cancel</button>
          <button onClick={save} disabled={saving} className="px-3.5 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-60">{saving ? "Saving…" : "Save"}</button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RecordRegistrationDialog({ property, onClose, onSaved }) {
  const [form, setForm] = useState({ registration_number: "", scheme_name: "Other", issue_date: "", expiry_date: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (property) setForm({ registration_number: "", scheme_name: "Other", issue_date: new Date().toISOString().slice(0, 10), expiry_date: "" });
  }, [property]);

  const save = async () => {
    if (!form.registration_number) {
      toast.error("Enter the PRS registration number");
      return;
    }
    setSaving(true);
    try {
      const rec = await base44.entities.PRSRegistration.create({
        property_id: property.id,
        registration_number: form.registration_number,
        scheme_name: form.scheme_name,
        issue_date: form.issue_date || null,
        expiry_date: form.expiry_date || null,
        status: "Active",
        is_demo: !!property.is_demo,
        source: "manual",
      });
      await logActivity(base44, {
        property_id: property.id,
        event_type: "Document upload",
        description: `PRS Database registration recorded: ${form.registration_number}`,
        related_id: rec.id,
      });
      toast.success("Registration recorded");
      onSaved();
    } catch (e) {
      toast.error(`Couldn't save: ${e?.message || "unknown error"}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={!!property} onOpenChange={(v) => !saving && !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Record PRS registration — {property?.name}</DialogTitle></DialogHeader>
        <div className="space-y-3 py-1">
          <div className="space-y-1.5"><Label className="text-xs">Registration number *</Label><Input value={form.registration_number} onChange={(e) => setForm({ ...form, registration_number: e.target.value })} placeholder="e.g. PRS-2026-01234567" /></div>
          <div className="space-y-1.5">
            <Label className="text-xs">Scheme</Label>
            <Select value={form.scheme_name} onValueChange={(v) => setForm({ ...form, scheme_name: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {["The Property Ombudsman", "Property Redress Scheme", "PRS Scotland", "Rent Smart Wales", "Other"].map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label className="text-xs">Issued</Label><Input type="date" value={form.issue_date} onChange={(e) => setForm({ ...form, issue_date: e.target.value })} /></div>
            <div className="space-y-1.5"><Label className="text-xs">Expires</Label><Input type="date" value={form.expiry_date} onChange={(e) => setForm({ ...form, expiry_date: e.target.value })} /></div>
          </div>
        </div>
        <DialogFooter>
          <button onClick={onClose} disabled={saving} className="px-3.5 py-2 border bg-card hover:bg-muted rounded-lg text-sm font-medium">Cancel</button>
          <button onClick={save} disabled={saving} className="px-3.5 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-60">{saving ? "Saving…" : "Record"}</button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
