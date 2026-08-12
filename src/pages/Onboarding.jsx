import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  Building2, Users, HardHat, FileCheck, Palmtree, Check, ArrowRight, ArrowLeft,
  Plus, Trash2, Upload, MessageSquare, ShieldCheck, PartyPopper,
} from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { useKieData } from "@/lib/useKieData";
import { logActivity } from "@/lib/kieUtils";
import ImportContractorsModal from "@/components/shared/ImportContractorsModal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// First run for a brand-new landlord. Five steps, each independently skippable
// and each writing real records — no staging area, so a landlord who bails
// after step 2 still keeps their properties and tenants.
//
// The order matters: properties must exist before tenants (a tenant needs a
// property), and tenants carry the phone number the WhatsApp pipeline routes
// on, which is why step 2 pushes hard for it.
// ---------------------------------------------------------------------------

const PROPERTY_TYPES = ["House", "Flat", "HMO", "Bungalow", "Studio", "Maisonette", "Commercial"];
const CERTS = [
  { key: "Gas Safety Certificate", label: "Gas safety (CP12)", months: 12, hint: "Annual — legally required where there's gas" },
  { key: "EICR", label: "Electrical (EICR)", months: 60, hint: "Every 5 years" },
  { key: "EPC", label: "EPC", months: 120, hint: "Every 10 years" },
];

function StepShell({ icon: Icon, title, blurb, children, onBack, onNext, nextLabel = "Continue", onSkip, busy, canNext = true }) {
  return (
    <div className="space-y-5">
      <div className="flex items-start gap-3">
        <div className="w-11 h-11 rounded-xl bg-[hsl(var(--sage-light))] flex items-center justify-center shrink-0">
          <Icon className="w-5 h-5 text-[hsl(var(--sage))]" />
        </div>
        <div className="min-w-0">
          <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
          <p className="text-sm text-muted-foreground mt-0.5">{blurb}</p>
        </div>
      </div>
      {children}
      <div className="flex items-center gap-2 pt-1">
        {onBack && (
          <Button variant="ghost" onClick={onBack} className="gap-1.5">
            <ArrowLeft className="w-4 h-4" /> Back
          </Button>
        )}
        <div className="flex-1" />
        {onSkip && <Button variant="ghost" onClick={onSkip}>Skip for now</Button>}
        <Button onClick={onNext} disabled={busy || !canNext} className="gap-1.5">
          {busy ? "Saving…" : nextLabel} <ArrowRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}

function RowCard({ children, onRemove }) {
  return (
    <div className="rounded-xl border bg-card p-3 space-y-2 relative">
      {onRemove && (
        <button
          onClick={onRemove}
          aria-label="Remove"
          className="absolute top-2 right-2 p-1 rounded hover:bg-muted text-muted-foreground hover:text-rose-600"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      )}
      {children}
    </div>
  );
}

export default function Onboarding() {
  const navigate = useNavigate();
  const { workspace } = useAuth();
  const { properties, tenants, contractors, reload } = useKieData();
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

  // Step 1 — properties
  const blankProperty = { name: "", address: "", postcode: "", property_type: "Flat", monthly_rent_expected: "" };
  const [propRows, setPropRows] = useState([{ ...blankProperty }]);
  const [savedProps, setSavedProps] = useState([]);

  // Step 2 — tenants
  const blankTenant = { name: "", phone: "", email: "", property_id: "", rent_amount: "", consent_status: "Granted" };
  const [tenantRows, setTenantRows] = useState([{ ...blankTenant }]);

  // Step 3 — compliance
  const [certRows, setCertRows] = useState({}); // { [propertyId]: { [certKey]: issueDate } }

  // Step 4 — short lets
  const [icalRows, setIcalRows] = useState({}); // { [propertyId]: { airbnb, booking } }

  const availableProps = useMemo(
    () => (savedProps.length ? savedProps : properties),
    [savedProps, properties],
  );

  // A landlord who already has data doesn't need the wizard.
  useEffect(() => {
    if (properties.length > 0 && step === 0 && savedProps.length === 0) {
      setStep(1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [properties.length]);

  const saveProperties = async () => {
    const rows = propRows.filter((r) => r.name.trim() && r.address.trim());
    if (rows.length === 0) { setStep(1); return; }
    setBusy(true);
    try {
      const created = [];
      for (const r of rows) {
        const p = await base44.entities.Property.create({
          name: r.name.trim(),
          address: r.address.trim(),
          postcode: r.postcode.trim() || undefined,
          property_type: r.property_type,
          monthly_rent_expected: r.monthly_rent_expected ? Number(r.monthly_rent_expected) : undefined,
          occupancy_status: "Vacant",
          units_count: 1,
          source: "onboarding",
        });
        created.push(p);
      }
      setSavedProps(created);
      toast.success(`${created.length} propert${created.length === 1 ? "y" : "ies"} added`);
      reload();
      setStep(1);
    } catch (e) {
      toast.error(`Couldn't save: ${e?.message || "unknown error"}`);
    } finally {
      setBusy(false);
    }
  };

  const saveTenants = async () => {
    const rows = tenantRows.filter((r) => r.name.trim() && r.phone.trim() && r.property_id);
    if (rows.length === 0) { setStep(2); return; }
    setBusy(true);
    try {
      for (const r of rows) {
        const tenant = await base44.entities.Tenant.create({
          name: r.name.trim(),
          phone: r.phone.trim(),
          email: r.email.trim() || undefined,
          property_id: r.property_id,
          rent_amount: r.rent_amount ? Number(r.rent_amount) : undefined,
          payment_status: "Paid",
          consent_status: r.consent_status,
          source: "onboarding",
        });
        // A tenancy is what the rest of the app reasons about (rent, notices).
        // Periodic by default: fixed terms ended in England on 1 May 2026.
        await base44.entities.Tenancy.create({
          tenant_id: tenant.id,
          property_id: r.property_id,
          rent_amount: r.rent_amount ? Number(r.rent_amount) : undefined,
          start_date: new Date().toISOString().slice(0, 10),
          status: "Periodic",
          source: "onboarding",
        });
        await base44.entities.Property.update(r.property_id, { occupancy_status: "Fully occupied" }).catch(() => {});
      }
      toast.success(`${rows.length} tenant${rows.length === 1 ? "" : "s"} added`);
      reload();
      setStep(2);
    } catch (e) {
      toast.error(`Couldn't save: ${e?.message || "unknown error"}`);
    } finally {
      setBusy(false);
    }
  };

  const saveCompliance = async () => {
    const entries = [];
    for (const [propertyId, certs] of Object.entries(certRows)) {
      for (const [category, issue] of Object.entries(certs)) {
        if (!issue) continue;
        const meta = CERTS.find((c) => c.key === category);
        const d = new Date(issue);
        if (isNaN(d.getTime())) continue;
        const expiry = new Date(d);
        expiry.setMonth(expiry.getMonth() + (meta?.months || 12));
        entries.push({ propertyId, category, issue, expiry: expiry.toISOString().slice(0, 10) });
      }
    }
    if (entries.length === 0) { setStep(3); return; }
    setBusy(true);
    try {
      const today = new Date().toISOString().slice(0, 10);
      for (const e of entries) {
        await base44.entities.ComplianceRecord.create({
          property_id: e.propertyId,
          category: e.category,
          issue_date: e.issue,
          expiry_date: e.expiry,
          status: e.expiry < today ? "Overdue" : "Compliant",
          source: "onboarding",
        });
      }
      toast.success(`${entries.length} certificate${entries.length === 1 ? "" : "s"} logged — renewals now tracked`);
      reload();
      setStep(3);
    } catch (e) {
      toast.error(`Couldn't save: ${e?.message || "unknown error"}`);
    } finally {
      setBusy(false);
    }
  };

  const saveIcal = async () => {
    const rows = Object.entries(icalRows).filter(([, v]) => v.airbnb || v.booking);
    if (rows.length === 0) { setStep(4); return; }
    setBusy(true);
    try {
      for (const [propertyId, v] of rows) {
        await base44.entities.Property.update(propertyId, {
          is_short_let: true,
          airbnb_ical_url: v.airbnb || undefined,
          booking_ical_url: v.booking || undefined,
        });
      }
      const res = await base44.functions.invoke("sync_short_let_ical", {}).catch(() => null);
      const created = res?.data?.created;
      toast.success(created ? `Calendars connected — ${created} bookings imported` : "Calendars connected");
      reload();
      setStep(4);
    } catch (e) {
      toast.error(`Couldn't connect: ${e?.message || "unknown error"}`);
    } finally {
      setBusy(false);
    }
  };

  const finish = async () => {
    await logActivity(base44, {
      event_type: "Property update",
      description: "Portfolio set up — onboarding completed",
      severity: "info",
    }).catch(() => {});
    await base44.entities.AppSetting.create({ key: "onboarding_complete", value: new Date().toISOString() }).catch(() => {});
    reload();
    navigate("/");
  };

  const STEPS = [
    { label: "Properties", icon: Building2 },
    { label: "Tenants", icon: Users },
    { label: "Compliance", icon: FileCheck },
    { label: "Short lets", icon: Palmtree },
    { label: "Contractors", icon: HardHat },
  ];

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Set up your portfolio</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Five short steps. Everything you add is saved as you go, and you can skip anything and come back to it.
        </p>
      </div>

      {/* Progress rail */}
      <div className="flex items-center gap-1.5">
        {STEPS.map((s, i) => (
          <button
            key={s.label}
            onClick={() => i < step && setStep(i)}
            disabled={i > step}
            className={cn(
              "flex-1 flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-medium transition-colors",
              i === step ? "bg-[hsl(var(--sage-light))] text-[hsl(var(--sage))]"
                : i < step ? "text-muted-foreground hover:bg-muted cursor-pointer"
                : "text-muted-foreground/40",
            )}
          >
            {i < step ? <Check className="w-3.5 h-3.5 shrink-0" /> : <s.icon className="w-3.5 h-3.5 shrink-0" />}
            <span className="truncate hidden sm:inline">{s.label}</span>
          </button>
        ))}
      </div>

      <div className="rounded-xl border bg-card p-5">
        {/* ---------------- Step 1: properties ---------------- */}
        {step === 0 && (
          <StepShell
            icon={Building2}
            title="Add your properties"
            blurb="Just the basics — you can fill in the detail later, or import a whole spreadsheet instead."
            onNext={saveProperties}
            busy={busy}
            onSkip={() => setStep(1)}
          >
            <div className="space-y-2.5">
              {propRows.map((r, i) => (
                <RowCard key={i} onRemove={propRows.length > 1 ? () => setPropRows(propRows.filter((_, j) => j !== i)) : null}>
                  <div className="grid sm:grid-cols-2 gap-2">
                    <Input
                      placeholder="Name, e.g. 7 Willow Court"
                      value={r.name}
                      onChange={(e) => setPropRows(propRows.map((x, j) => j === i ? { ...x, name: e.target.value } : x))}
                    />
                    <Input
                      placeholder="Address"
                      value={r.address}
                      onChange={(e) => setPropRows(propRows.map((x, j) => j === i ? { ...x, address: e.target.value } : x))}
                    />
                    <Input
                      placeholder="Postcode"
                      value={r.postcode}
                      onChange={(e) => setPropRows(propRows.map((x, j) => j === i ? { ...x, postcode: e.target.value } : x))}
                    />
                    <div className="flex gap-2">
                      <Select
                        value={r.property_type}
                        onValueChange={(v) => setPropRows(propRows.map((x, j) => j === i ? { ...x, property_type: v } : x))}
                      >
                        <SelectTrigger className="flex-1"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {PROPERTY_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <Input
                        placeholder="Rent pcm"
                        inputMode="numeric"
                        value={r.monthly_rent_expected}
                        onChange={(e) => setPropRows(propRows.map((x, j) => j === i ? { ...x, monthly_rent_expected: e.target.value } : x))}
                        className="w-28"
                      />
                    </div>
                  </div>
                </RowCard>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => setPropRows([...propRows, { ...blankProperty }])} className="gap-1.5">
                <Plus className="w-3.5 h-3.5" /> Add another
              </Button>
              <Button variant="outline" size="sm" onClick={() => navigate("/import")} className="gap-1.5">
                <Upload className="w-3.5 h-3.5" /> Import from a spreadsheet instead
              </Button>
            </div>
          </StepShell>
        )}

        {/* ---------------- Step 2: tenants ---------------- */}
        {step === 1 && (
          <StepShell
            icon={Users}
            title="Add your tenants"
            blurb="The phone number matters most: it's how the app recognises a tenant when they message, and routes it to you."
            onBack={() => setStep(0)}
            onNext={saveTenants}
            busy={busy}
            onSkip={() => setStep(2)}
          >
            {availableProps.length === 0 ? (
              <p className="text-sm text-muted-foreground">Add a property first — tenants live in one.</p>
            ) : (
              <>
                <div className="space-y-2.5">
                  {tenantRows.map((r, i) => (
                    <RowCard key={i} onRemove={tenantRows.length > 1 ? () => setTenantRows(tenantRows.filter((_, j) => j !== i)) : null}>
                      <div className="grid sm:grid-cols-2 gap-2">
                        <Input
                          placeholder="Full name"
                          value={r.name}
                          onChange={(e) => setTenantRows(tenantRows.map((x, j) => j === i ? { ...x, name: e.target.value } : x))}
                        />
                        <Input
                          placeholder="Mobile, e.g. 07700 900123"
                          value={r.phone}
                          onChange={(e) => setTenantRows(tenantRows.map((x, j) => j === i ? { ...x, phone: e.target.value } : x))}
                        />
                        <Input
                          placeholder="Email (optional)"
                          value={r.email}
                          onChange={(e) => setTenantRows(tenantRows.map((x, j) => j === i ? { ...x, email: e.target.value } : x))}
                        />
                        <div className="flex gap-2">
                          <Select
                            value={r.property_id}
                            onValueChange={(v) => setTenantRows(tenantRows.map((x, j) => j === i ? { ...x, property_id: v } : x))}
                          >
                            <SelectTrigger className="flex-1"><SelectValue placeholder="Property" /></SelectTrigger>
                            <SelectContent>
                              {availableProps.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                            </SelectContent>
                          </Select>
                          <Input
                            placeholder="Rent pcm"
                            inputMode="numeric"
                            value={r.rent_amount}
                            onChange={(e) => setTenantRows(tenantRows.map((x, j) => j === i ? { ...x, rent_amount: e.target.value } : x))}
                            className="w-28"
                          />
                        </div>
                      </div>
                      <label className="flex items-start gap-2 text-xs text-muted-foreground">
                        <input
                          type="checkbox"
                          checked={r.consent_status === "Granted"}
                          onChange={(e) => setTenantRows(tenantRows.map((x, j) => j === i ? { ...x, consent_status: e.target.checked ? "Granted" : "Pending" } : x))}
                          className="mt-0.5 rounded border-border"
                        />
                        This tenant has agreed to be contacted about their tenancy on WhatsApp
                      </label>
                    </RowCard>
                  ))}
                </div>
                <Button variant="outline" size="sm" onClick={() => setTenantRows([...tenantRows, { ...blankTenant }])} className="gap-1.5">
                  <Plus className="w-3.5 h-3.5" /> Add another
                </Button>
                <p className="text-xs text-muted-foreground flex items-start gap-1.5">
                  <MessageSquare className="w-3.5 h-3.5 mt-0.5 shrink-0 text-[hsl(var(--sage))]" />
                  Save the number exactly as the tenant uses on WhatsApp. When they message the KIE number, the app
                  matches it here, files the message under this tenancy, triages it and raises a job if it's urgent.
                </p>
              </>
            )}
          </StepShell>
        )}

        {/* ---------------- Step 3: compliance ---------------- */}
        {step === 2 && (
          <StepShell
            icon={FileCheck}
            title="When were the certificates issued?"
            blurb="Enter the issue date and we'll work out the renewal, warn you before it lapses, and raise the job to book it."
            onBack={() => setStep(1)}
            onNext={saveCompliance}
            busy={busy}
            onSkip={() => setStep(3)}
          >
            {availableProps.length === 0 ? (
              <p className="text-sm text-muted-foreground">No properties yet — skip this and come back.</p>
            ) : (
              <div className="space-y-3">
                {availableProps.map((p) => (
                  <RowCard key={p.id}>
                    <p className="text-sm font-medium">{p.name}</p>
                    <div className="grid sm:grid-cols-3 gap-2">
                      {CERTS.map((c) => (
                        <label key={c.key} className="block">
                          <span className="block text-[11px] font-medium text-muted-foreground mb-1" title={c.hint}>
                            {c.label}
                          </span>
                          <Input
                            type="date"
                            value={certRows[p.id]?.[c.key] || ""}
                            onChange={(e) => setCertRows({
                              ...certRows,
                              [p.id]: { ...(certRows[p.id] || {}), [c.key]: e.target.value },
                            })}
                          />
                        </label>
                      ))}
                    </div>
                  </RowCard>
                ))}
              </div>
            )}
          </StepShell>
        )}

        {/* ---------------- Step 4: short lets ---------------- */}
        {step === 3 && (
          <StepShell
            icon={Palmtree}
            title="Holiday lets on Airbnb or Booking.com?"
            blurb="Paste each listing's calendar-export link and bookings flow in automatically, with turnaround cleans raised after every checkout."
            onBack={() => setStep(2)}
            onNext={saveIcal}
            busy={busy}
            onSkip={() => setStep(4)}
            nextLabel="Connect & sync"
          >
            {availableProps.length === 0 ? (
              <p className="text-sm text-muted-foreground">No properties yet — skip this and come back.</p>
            ) : (
              <div className="space-y-3">
                {availableProps.map((p) => (
                  <RowCard key={p.id}>
                    <p className="text-sm font-medium">{p.name}</p>
                    <Input
                      placeholder="Airbnb calendar link (airbnb.co.uk/calendar/ical/….ics)"
                      value={icalRows[p.id]?.airbnb || ""}
                      onChange={(e) => setIcalRows({ ...icalRows, [p.id]: { ...(icalRows[p.id] || {}), airbnb: e.target.value.trim() } })}
                    />
                    <Input
                      placeholder="Booking.com calendar link (optional)"
                      value={icalRows[p.id]?.booking || ""}
                      onChange={(e) => setIcalRows({ ...icalRows, [p.id]: { ...(icalRows[p.id] || {}), booking: e.target.value.trim() } })}
                    />
                  </RowCard>
                ))}
                <div className="rounded-lg bg-muted/60 px-3 py-2.5 text-xs text-muted-foreground space-y-1">
                  <p className="font-medium text-foreground">Where to find the link</p>
                  <p>Airbnb: Calendar → Availability → Connect to another website → Export calendar.</p>
                  <p>Booking.com: Rates &amp; Availability → Sync calendars → Export.</p>
                  <p>
                    Calendars carry dates, a reservation reference and sometimes the guest's first name — that's all
                    either platform publishes. Neither offers a public API for individual hosts, so guest emails and
                    payouts aren't available to import.
                  </p>
                </div>
              </div>
            )}
          </StepShell>
        )}

        {/* ---------------- Step 5: contractors ---------------- */}
        {step === 4 && (
          <StepShell
            icon={HardHat}
            title="Who do you call when something breaks?"
            blurb="Add your regulars and the app can dispatch them itself — the right trade, with the job already written."
            onBack={() => setStep(3)}
            onNext={finish}
            busy={busy}
            nextLabel="Finish setup"
          >
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => setImportOpen(true)} className="gap-1.5">
                <Upload className="w-4 h-4" /> Paste my contractor list
              </Button>
              <Button variant="outline" onClick={() => navigate("/contractors?new=1")} className="gap-1.5">
                <Plus className="w-4 h-4" /> Add one at a time
              </Button>
            </div>
            {contractors.length > 0 && (
              <div className="rounded-xl border divide-y divide-border">
                {contractors.slice(0, 6).map((c) => (
                  <div key={c.id} className="flex items-center gap-2.5 px-3 py-2">
                    <HardHat className="w-4 h-4 text-orange-500 shrink-0" />
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm font-medium truncate">{c.name}</span>
                      <span className="block text-xs text-muted-foreground truncate">
                        {c.trade}{(c.accreditations || []).length ? ` · ${c.accreditations.join(", ")}` : ""}
                      </span>
                    </span>
                  </div>
                ))}
              </div>
            )}
            <div className="rounded-lg bg-[hsl(var(--sage-light))] px-3 py-2.5 flex items-start gap-2">
              <ShieldCheck className="w-4 h-4 text-[hsl(var(--sage))] mt-0.5 shrink-0" />
              <p className="text-xs text-[hsl(var(--sage))]">
                Your portfolio is private to your account. Nobody else signing up can see it, and you choose who to
                invite from Integrations → Workspace access.
              </p>
            </div>
          </StepShell>
        )}
      </div>

      {/* Summary strip */}
      <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5"><Building2 className="w-3.5 h-3.5" /> {properties.length} properties</span>
        <span className="inline-flex items-center gap-1.5"><Users className="w-3.5 h-3.5" /> {tenants.length} tenants</span>
        <span className="inline-flex items-center gap-1.5"><HardHat className="w-3.5 h-3.5" /> {contractors.length} contractors</span>
        <button onClick={finish} className="ml-auto inline-flex items-center gap-1.5 font-medium text-[hsl(var(--sage))] hover:underline">
          <PartyPopper className="w-3.5 h-3.5" /> I'm done — take me to the dashboard
        </button>
      </div>

      <ImportContractorsModal open={importOpen} onClose={() => setImportOpen(false)} onImported={reload} />
    </div>
  );
}
