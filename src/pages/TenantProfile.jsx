import React, { useMemo, useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { useKieData } from "@/lib/useKieData";
import { base44 } from "@/api/base44Client";
import { formatGBP, formatDate, daysUntil, statusColor, logActivity } from "@/lib/kieUtils";
import PropertyLink from "@/components/shared/PropertyLink";
import { TenantAvatar } from "@/components/shared/TenantChip";
import PageHeader from "@/components/shared/PageHeader";
import EmptyState from "@/components/shared/EmptyState";
import { PageSkeleton } from "@/components/shared/Skeletons";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Phone, Mail, MessageSquare, ShieldCheck, Users, Wallet,
  CalendarDays, FileCheck, History, TrendingUp, AlertTriangle,
  Pencil, CalendarClock, ChevronRight,
} from "lucide-react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { toast } from "sonner";

const UTILITY_CATEGORIES = ["Gas", "Electricity", "Water", "Council tax", "Internet", "Service charge"];

const BTN_PRIMARY = "inline-flex items-center gap-1.5 px-3.5 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 active:scale-[0.98] transition-all shadow-sm";
const BTN_SECONDARY = "inline-flex items-center gap-1.5 px-3.5 py-2 border bg-card hover:bg-muted text-foreground rounded-lg text-sm font-medium active:scale-[0.98] transition-all shadow-sm";
const LABEL_CLS = "text-xs font-medium text-muted-foreground";
const CHIP = "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium";

function humanizeMonths(totalMonths) {
  if (totalMonths == null || totalMonths < 0) return "—";
  const years = Math.floor(totalMonths / 12);
  const months = totalMonths % 12;
  if (years === 0) return `${months} month${months === 1 ? "" : "s"}`;
  if (months === 0) return `${years} year${years === 1 ? "" : "s"}`;
  return `${years} year${years === 1 ? "" : "s"} ${months} month${months === 1 ? "" : "s"}`;
}

function monthsBetween(startStr, endStr) {
  if (!startStr) return null;
  const start = new Date(startStr);
  const end = endStr ? new Date(endStr) : new Date();
  if (isNaN(start.getTime())) return null;
  return Math.max(0, (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth()));
}

export default function TenantProfile() {
  const { id } = useParams();
  const { tenants, properties, units, tenancies, bills, transactions, compliance, tickets, rentIncreases, loading, reload } = useKieData();
  const [editOpen, setEditOpen] = useState(false);
  const [increaseOpen, setIncreaseOpen] = useState(false);
  const [payingId, setPayingId] = useState(null);

  const tenant = tenants.find((t) => t.id === id);
  const myTenancies = useMemo(
    () => tenancies.filter((ty) => ty.tenant_id === id).sort((a, b) => String(b.start_date || "").localeCompare(String(a.start_date || ""))),
    [tenancies, id]
  );
  const currentTenancy = myTenancies.find((ty) => ty.status !== "Ended") || myTenancies[0];

  if (loading) return <PageSkeleton />;

  if (!tenant) {
    return (
      <div className="space-y-5 animate-fade-in">
        <div className="rounded-xl border bg-card">
          <EmptyState
            icon={Users}
            title="Tenant not found"
            description="This tenant may have been removed, or the link is out of date."
            action={<Link to="/tenants" className={BTN_SECONDARY}>Back to tenants</Link>}
          />
        </div>
      </div>
    );
  }

  const property = properties.find((p) => p.id === tenant.property_id);
  const unit = units.find((u) => u.id === tenant.unit_id);
  const myTickets = tickets.filter((t) => t.tenant_id === tenant.id);

  // Rent history across all tenancies (oldest first for the chart)
  const rentHistory = myTenancies
    .flatMap((ty) => (ty.rent_history || []).map((h) => ({ ...h, tenancyId: ty.id })))
    .filter((h) => h.date && h.amount != null)
    .sort((a, b) => String(a.date).localeCompare(String(b.date)));

  // Ecosystem tenure: earliest tenancy start → now (or last end if all ended)
  const earliest = myTenancies.length > 0 ? myTenancies[myTenancies.length - 1] : null;
  const allEnded = myTenancies.length > 0 && myTenancies.every((ty) => ty.status === "Ended");
  const tenureMonths = earliest ? monthsBetween(earliest.start_date, allEnded ? myTenancies[0].end_date : null) : monthsBetween(tenant.tenancy_start);
  const residenceMonths = currentTenancy ? monthsBetween(currentTenancy.start_date, currentTenancy.status === "Ended" ? currentTenancy.end_date : null) : null;

  // ----- Rent bills, scoped to THIS tenant where possible ------------------
  // 1. Bills that carry this tenant's id directly are always right.
  // 2. Otherwise fall back to property-level rent bills — safe when this
  //    tenant is the only active tenant at the property.
  // 3. When other active tenants share the property, still show the
  //    property-level list but label it explicitly as shared so the numbers
  //    are never silently wrong.
  const propertyRentBills = bills
    .filter((b) => b.category === "Rent" && b.property_id === tenant.property_id)
    .sort((a, b) => String(b.due_date || "").localeCompare(String(a.due_date || "")));
  const directRentBills = propertyRentBills.filter((b) => b.tenant_id === tenant.id);
  const hasActiveTenancy = (tenantId) => {
    const tys = tenancies.filter((ty) => ty.tenant_id === tenantId);
    if (tys.length === 0) return true; // no tenancy rows — assume current
    return tys.some((ty) => ty.status !== "Ended");
  };
  const activePeers = tenants.filter((t) => t.id !== tenant.id && t.property_id === tenant.property_id && hasActiveTenancy(t.id));
  const rentShared = directRentBills.length === 0 && activePeers.length > 0;
  const rentBills = directRentBills.length > 0 ? directRentBills : propertyRentBills;
  const outstanding = rentBills.filter((b) => b.status !== "Paid").reduce((s, b) => s + (b.amount || 0), 0);

  const myTransactions = transactions.filter((t) => t.tenant_id === tenant.id);

  // Utilities for their property
  const utilityBills = bills.filter((b) => b.property_id === tenant.property_id && UTILITY_CATEGORIES.includes(b.category));
  const utilitiesByCategory = UTILITY_CATEGORIES.map((cat) => {
    const list = utilityBills.filter((b) => b.category === cat);
    if (list.length === 0) return null;
    const months = new Set(list.map((b) => String(b.due_date || "").slice(0, 7))).size || 1;
    const total = list.reduce((s, b) => s + (b.amount || 0), 0);
    return { category: cat, avg: total / months, list: list.sort((a, b) => String(b.due_date || "").localeCompare(String(a.due_date || ""))) };
  }).filter(Boolean);

  // Documents: records tied to this tenant, or tenancy-ish docs on their property
  const docs = compliance.filter((c) =>
    c.tenant_id === tenant.id ||
    (c.property_id === tenant.property_id && ["Tenancy agreement", "Inventory", "Deposit Protection Certificate"].includes(c.category))
  );

  const contractEnd = currentTenancy?.end_date || tenant.tenancy_end;
  const endDays = contractEnd ? daysUntil(contractEnd) : null;
  const contractStatus = (() => {
    const neutral = "bg-slate-100 text-slate-600 dark:bg-slate-500/15 dark:text-slate-300";
    if (!contractEnd || endDays === null) return { label: "Periodic tenancy", cls: neutral };
    if (endDays < 0) return { label: `Ended ${formatDate(contractEnd)}`, cls: neutral };
    if (endDays <= 60) return { label: `Ends in ${endDays}d`, cls: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300" };
    return { label: `Active until ${formatDate(contractEnd)}`, cls: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300" };
  })();
  const renewalDue = endDays !== null && endDays >= 0 && endDays <= 60;

  const emailLooksValid = !tenant.email || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(tenant.email);

  const recordPayment = async (bill) => {
    if (payingId) return; // double-submit guard
    setPayingId(bill.id);
    try {
      await base44.entities.Bill.update(bill.id, { status: "Paid" });
      await base44.entities.Transaction.create({
        property_id: bill.property_id, type: "Rent received", amount: bill.amount,
        date: new Date().toISOString().slice(0, 10), category: bill.category, status: "Completed", simulated: true,
      });
      await logActivity(base44, { property_id: bill.property_id, event_type: "Bill update", description: `${bill.category} marked as paid (${formatGBP(bill.amount)})`, related_id: bill.id });
      if (tenant.payment_status === "Overdue" || tenant.payment_status === "Due") {
        await base44.entities.Tenant.update(tenant.id, { payment_status: "Paid" });
      }
      toast.success("Payment recorded (simulated)");
      reload();
    } catch (e) {
      toast.error(`Failed to record payment${e?.message ? `: ${e.message}` : ""}`);
    } finally {
      setPayingId(null);
    }
  };

  return (
    <div className="space-y-5 animate-fade-in">
      <PageHeader
        title={tenant.name}
        subtitle={property ? `${property.name}${unit ? ` · ${unit.unit_label}` : ""}` : "No property assigned"}
        backTo="/tenants"
        actions={
          <>
            <Link to={`/whatsapp?tenant=${tenant.id}`} className={BTN_SECONDARY}>
              <MessageSquare className="w-4 h-4" /> WhatsApp
            </Link>
            <button onClick={() => setEditOpen(true)} className={BTN_SECONDARY}>
              <Pencil className="w-4 h-4" /> Edit
            </button>
          </>
        }
      />

      {/* Identity card */}
      <div className="rounded-xl border bg-card p-5">
        <div className="flex items-start gap-4 flex-wrap">
          <TenantAvatar tenant={tenant} size="lg" />
          <div className="flex-1 min-w-[200px]">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`${CHIP} ${contractStatus.cls}`}>{contractStatus.label}</span>
              <span className={`${CHIP} ${statusColor(tenant.payment_status)}`}>Payment: {tenant.payment_status || "—"}</span>
              <span className={`${CHIP} ${tenant.consent_status === "Granted" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300" : "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300"}`}>
                <ShieldCheck className="w-3 h-3 mr-0.5" />{tenant.consent_status || "—"}
              </span>
            </div>
            <div className="flex flex-col gap-1.5 text-sm mt-3">
              {tenant.phone && (
                <a href={`tel:${tenant.phone}`} className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
                  <Phone className="w-3.5 h-3.5" />{tenant.phone}
                </a>
              )}
              {tenant.email && (
                <a href={`mailto:${tenant.email}`} className={`flex items-center gap-2 transition-colors ${emailLooksValid ? "text-muted-foreground hover:text-foreground" : "text-amber-600 dark:text-amber-400"}`}>
                  <Mail className="w-3.5 h-3.5" />{tenant.email}
                  {!emailLooksValid && <AlertTriangle className="w-3.5 h-3.5" title="This email looks invalid" />}
                </a>
              )}
              {property && (
                <span className="flex items-center gap-2 text-muted-foreground">
                  <History className="w-3.5 h-3.5" />
                  <PropertyLink property={property} className="text-sm" />
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Key figures */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 mt-5">
          <div className="p-3 bg-muted rounded-lg">
            <p className="text-xs text-muted-foreground">Current rent</p>
            <p className="text-base font-semibold text-foreground tabular-nums">{formatGBP(currentTenancy?.rent_amount ?? tenant.rent_amount)}/mo</p>
          </div>
          <div className="p-3 bg-muted rounded-lg">
            <p className="text-xs text-muted-foreground">Deposit</p>
            <p className="text-base font-semibold text-foreground tabular-nums">{tenant.deposit_amount ? formatGBP(tenant.deposit_amount) : "—"}</p>
            {(currentTenancy?.deposit_scheme || tenant.deposit_scheme) && <p className="text-[11px] text-muted-foreground">{currentTenancy?.deposit_scheme || tenant.deposit_scheme}</p>}
          </div>
          <div className="p-3 bg-muted rounded-lg">
            <p className="text-xs text-muted-foreground">Moved in</p>
            <p className="text-base font-semibold text-foreground">{formatDate(currentTenancy?.start_date || tenant.tenancy_start)}</p>
            <p className="text-[11px] text-muted-foreground">{humanizeMonths(residenceMonths)} in residence</p>
          </div>
          <div className="p-3 bg-muted rounded-lg">
            <p className="text-xs text-muted-foreground">Tenant since</p>
            <p className="text-base font-semibold text-foreground">{formatDate(earliest?.start_date || tenant.tenancy_start)}</p>
            <p className="text-[11px] text-muted-foreground">{humanizeMonths(tenureMonths)} in ecosystem</p>
          </div>
          <Link to="/finance?tab=rent" className="p-3 bg-muted rounded-lg hover:bg-muted/70 active:scale-[0.98] transition-all">
            <p className="text-xs text-muted-foreground">Outstanding</p>
            <p className={`text-base font-semibold tabular-nums ${outstanding > 0 ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400"}`}>{formatGBP(outstanding)}</p>
            {rentShared && <p className="text-[11px] text-muted-foreground">shared across property</p>}
          </Link>
        </div>
      </div>

      {/* Renewal nudge */}
      {renewalDue && property && (
        <Link to={`/properties/${property.id}`} className="flex items-center gap-3 rounded-xl border bg-card p-4 hover:bg-muted active:scale-[0.98] transition-all">
          <CalendarClock className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground">Tenancy ends in {endDays}d — plan renewal</p>
            <p className="text-xs text-muted-foreground truncate">Review the tenancy at {property.name}</p>
          </div>
          <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
        </Link>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Rent history */}
        <div className="rounded-xl border bg-card p-5">
          <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2"><TrendingUp className="w-4 h-4 text-muted-foreground" /> Rent history</h2>
          {rentHistory.length === 0 ? (
            <EmptyState compact icon={TrendingUp} title="No rent history yet" description="It is seeded when a tenancy is created and grows with each recorded rent change." />
          ) : (
            <>
              {rentHistory.length >= 2 && (
                <div className="h-40 mb-3">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={rentHistory.map((h) => ({ date: formatDate(h.date), amount: h.amount }))} margin={{ top: 5, right: 10, bottom: 0, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#94a3b8" strokeOpacity={0.25} />
                      <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#94a3b8" }} stroke="#94a3b8" />
                      <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} stroke="#94a3b8" tickFormatter={(v) => `£${v}`} width={50} />
                      <Tooltip formatter={(v) => [`£${v}`, "Rent"]} contentStyle={{ borderRadius: 8 }} />
                      <Line type="stepAfter" dataKey="amount" stroke="hsl(160 30% 45%)" strokeWidth={2} dot={{ r: 3 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="text-xs text-muted-foreground"><th className="text-left py-1 font-medium">From</th><th className="text-right py-1 font-medium">Monthly rent</th></tr></thead>
                  <tbody className="divide-y divide-border">
                    {[...rentHistory].reverse().map((h, i) => (
                      <tr key={i}><td className="py-1.5 text-muted-foreground">{formatDate(h.date)}</td><td className="py-1.5 text-right font-medium text-foreground tabular-nums">{formatGBP(h.amount)}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>

        {/* Rent increases — Section 13 / Form 4A notices. Periodic tenancies
            have no renewal point; rent changes happen through these notices. */}
        <div className="rounded-xl border bg-card p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <CalendarClock className="w-4 h-4 text-muted-foreground" /> Rent increases (Section 13)
            </h2>
            <button onClick={() => setIncreaseOpen(true)} className="text-xs text-[hsl(var(--sage))] hover:underline font-medium">
              Log increase
            </button>
          </div>
          {myIncreases.length === 0 ? (
            <EmptyState
              compact
              icon={CalendarClock}
              title="No rent increase notices"
              description="Log a Section 13 (Form 4A) notice here — the new rent applies automatically from its effective date."
            />
          ) : (
            <div className="divide-y divide-border">
              {myIncreases.map((n) => (
                <div key={n.id} className="py-2.5 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground tabular-nums">
                      {n.old_amount ? `${formatGBP(n.old_amount)} → ` : ""}{formatGBP(n.new_amount)}/mo
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Served {formatDate(n.notice_date)} · effective {formatDate(n.effective_date)}
                    </p>
                  </div>
                  <span className={`${CHIP} ${n.status === "Effective" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300" : n.status === "Disputed" ? "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300" : "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300"}`}>
                    {n.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Payments */}
        <div className="rounded-xl border bg-card p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-foreground flex items-center gap-2"><Wallet className="w-4 h-4 text-muted-foreground" /> Payments</h2>
            <Link to="/finance?tab=rent" className="text-xs text-[hsl(var(--sage))] hover:underline">Finance →</Link>
          </div>
          {rentBills.length === 0 && myTransactions.length === 0 ? (
            <EmptyState compact icon={Wallet} title="No rent bills or payments yet" description="Add rent bills in Finance and they appear here." action={<Link to="/finance?new=1" className={BTN_SECONDARY}>Add a bill</Link>} />
          ) : (
            <div className="space-y-1">
              {rentShared && (
                <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide pb-1">Property rent bills (shared)</p>
              )}
              {rentBills.slice(0, 12).map((b) => {
                const du = daysUntil(b.due_date);
                const late = b.status === "Overdue" || (b.status !== "Paid" && du !== null && du < 0);
                const daysLate = late ? Math.abs(du ?? 0) : 0;
                const unpaid = b.status !== "Paid";
                return (
                  <div key={b.id} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 p-2 rounded-lg hover:bg-muted transition-colors">
                    <Link to="/finance?tab=rent" className="flex-1 min-w-[140px]">
                      <p className="text-sm text-foreground">Rent — due {formatDate(b.due_date)}</p>
                      {late && <p className="text-[11px] text-rose-600 dark:text-rose-400 font-medium">{daysLate}d late</p>}
                    </Link>
                    <span className="text-sm font-medium text-foreground tabular-nums">{formatGBP(b.amount)}</span>
                    <span className={`${CHIP} shrink-0 ${statusColor(b.status)}`}>{b.status}</span>
                    {unpaid && (
                      <button
                        onClick={() => recordPayment(b)}
                        disabled={payingId !== null}
                        className="inline-flex items-center gap-1 px-2.5 py-1 border bg-card hover:bg-muted text-foreground rounded-lg text-xs font-medium active:scale-[0.98] transition-all disabled:opacity-50 shrink-0"
                      >
                        {payingId === b.id ? "Saving…" : "Record payment"}
                      </button>
                    )}
                  </div>
                );
              })}
              {myTransactions.slice(0, 6).map((t) => (
                <Link key={t.id} to="/finance?tab=transactions" className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted transition-colors">
                  <div className="flex-1 min-w-0"><p className="text-sm text-foreground truncate">{t.type} · {formatDate(t.date)}</p></div>
                  <span className="text-sm font-medium text-emerald-600 dark:text-emerald-400 tabular-nums">+{formatGBP(t.amount)}</span>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Utilities */}
        <div className="rounded-xl border bg-card p-5">
          <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2"><CalendarDays className="w-4 h-4 text-muted-foreground" /> Utilities at {property?.name || "property"}</h2>
          {utilitiesByCategory.length === 0 ? (
            <EmptyState compact icon={CalendarDays} title="No utility bills yet" description="Add them in Finance and monthly averages appear here." />
          ) : (
            <div className="space-y-1">
              {utilitiesByCategory.map(({ category, avg, list }) => (
                <details key={category} className="group">
                  <summary className="flex items-center justify-between cursor-pointer list-none p-2 rounded-lg hover:bg-muted transition-colors">
                    <span className="text-sm text-foreground">{category}</span>
                    <span className="text-sm font-semibold text-foreground tabular-nums">{formatGBP(avg)}/mo avg</span>
                  </summary>
                  <div className="pl-2 pb-1 space-y-0.5">
                    {list.slice(0, 8).map((b) => (
                      <div key={b.id} className="flex items-center justify-between text-xs text-muted-foreground py-1">
                        <span>{formatDate(b.due_date)}</span>
                        <span className="flex items-center gap-2 tabular-nums">{formatGBP(b.amount)} <span className={`${CHIP} px-1.5 ${statusColor(b.status)}`}>{b.status}</span></span>
                      </div>
                    ))}
                  </div>
                </details>
              ))}
            </div>
          )}
        </div>

        {/* Documents */}
        <div className="rounded-xl border bg-card p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-foreground flex items-center gap-2"><FileCheck className="w-4 h-4 text-muted-foreground" /> Contracts & documents</h2>
            {property && <Link to={`/properties/${property.id}?tab=documents`} className="text-xs text-[hsl(var(--sage))] hover:underline">All property docs →</Link>}
          </div>
          {docs.length === 0 ? (
            <EmptyState compact icon={FileCheck} title="No documents linked yet" description="Tenancy agreements, deposit certificates and inventories added in Compliance appear here." />
          ) : (
            <div className="space-y-1">
              {docs.map((d) => (
                <div key={d.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted transition-colors">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-foreground truncate">{d.category}</p>
                    <p className="text-[11px] text-muted-foreground">{d.issue_date && `Issued ${formatDate(d.issue_date)}`}{d.expiry_date && ` · expires ${formatDate(d.expiry_date)}`}</p>
                  </div>
                  <span className={`${CHIP} px-1.5 shrink-0 ${statusColor(d.status)}`}>{d.status}</span>
                  {d.file_url ? (
                    <a href={d.file_url} target="_blank" rel="noreferrer" className="text-xs text-[hsl(var(--sage))] hover:underline shrink-0">View</a>
                  ) : (
                    <span className="text-xs text-muted-foreground/60 shrink-0">No file</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Residence history */}
      <div className="rounded-xl border bg-card p-5">
        <h2 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2"><History className="w-4 h-4 text-muted-foreground" /> Residence history</h2>
        {myTenancies.length === 0 ? (
          <EmptyState compact icon={History} title="No tenancy records yet" description="A tenancy record is created automatically when a tenant is added." />
        ) : (
          <div className="divide-y divide-border">
            {myTenancies.map((ty) => {
              const p = properties.find((x) => x.id === ty.property_id);
              const u = units.find((x) => x.id === ty.unit_id);
              const dur = monthsBetween(ty.start_date, ty.status === "Ended" ? ty.end_date : null);
              return (
                <div key={ty.id} className="flex items-center gap-3 py-3">
                  <span className={`w-2 h-2 rounded-full shrink-0 ${ty.status === "Active" ? "bg-emerald-500" : ty.status === "Upcoming" ? "bg-blue-500" : "bg-muted-foreground/40"}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground"><PropertyLink property={p} />{u && <span className="text-muted-foreground font-normal"> · {u.unit_label}</span>}</p>
                    <p className="text-xs text-muted-foreground">{formatDate(ty.start_date)} → {ty.status === "Ended" ? formatDate(ty.end_date) : ty.status === "Upcoming" ? `starts ${formatDate(ty.start_date)}` : "current"} · {humanizeMonths(dur)}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-medium text-foreground tabular-nums">{formatGBP(ty.rent_amount)}/mo</p>
                    <span className={`${CHIP} px-1.5 ${statusColor(ty.status)}`}>{ty.status}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Maintenance raised by this tenant */}
      {myTickets.length > 0 && (
        <div className="rounded-xl border bg-card p-5">
          <h2 className="text-sm font-semibold text-foreground mb-2">Maintenance raised ({myTickets.length})</h2>
          <div className="divide-y divide-border">
            {myTickets.map((t) => (
              <Link key={t.id} to={`/maintenance?ticket=${t.id}`} className="flex items-center justify-between gap-2 py-2.5 hover:bg-muted rounded-lg px-2 -mx-2 transition-colors">
                <span className="text-sm text-foreground truncate">{t.description}</span>
                <span className={`${CHIP} px-1.5 shrink-0 ${statusColor(t.status)}`}>{t.status}</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      <EditTenantSheet open={editOpen} onOpenChange={setEditOpen} tenant={tenant} onSaved={reload} />
    </div>
  );
}

function EditTenantSheet({ open, onOpenChange, tenant, onSaved }) {
  const [form, setForm] = useState({ name: "", phone: "", email: "", consent_status: "Pending", notes: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open && tenant) {
      setForm({
        name: tenant.name || "",
        phone: tenant.phone || "",
        email: tenant.email || "",
        consent_status: tenant.consent_status || "Pending",
        notes: tenant.notes || "",
      });
    }
  }, [open, tenant]);

  const handleSave = async () => {
    if (saving) return; // double-submit guard
    if (!form.name || !form.phone) { toast.error("Name and phone are required"); return; }
    setSaving(true);
    try {
      await base44.entities.Tenant.update(tenant.id, {
        name: form.name, phone: form.phone, email: form.email,
        consent_status: form.consent_status, notes: form.notes,
      });
      await logActivity(base44, { tenant_id: tenant.id, property_id: tenant.property_id, event_type: "Tenant update", description: `Tenant updated: ${form.name}` });
      toast.success("Tenant updated");
      onSaved();
      onOpenChange(false);
    } catch (e) {
      toast.error(`Failed to update tenant${e?.message ? `: ${e.message}` : ""}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader><SheetTitle>Edit tenant</SheetTitle></SheetHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-1.5"><Label className={LABEL_CLS}>Full name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
          <div className="space-y-1.5"><Label className={LABEL_CLS}>Phone (UK)</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+44 7xxx xxx xxx" /></div>
          <div className="space-y-1.5"><Label className={LABEL_CLS}>Email</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
          <div className="space-y-1.5">
            <Label className={LABEL_CLS}>Consent status</Label>
            <Select value={form.consent_status} onValueChange={(v) => setForm({ ...form, consent_status: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{["Granted", "Pending", "Withdrawn"].map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5"><Label className={LABEL_CLS}>Notes</Label><Textarea rows={4} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Anything worth remembering about this tenant…" /></div>
        </div>
        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
          <button onClick={() => onOpenChange(false)} className={BTN_SECONDARY} disabled={saving}>Cancel</button>
          <button onClick={handleSave} className={BTN_PRIMARY} disabled={saving}>{saving ? "Saving…" : "Save changes"}</button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
