import React, { useState, useEffect } from "react";
import { useKieData } from "@/lib/useKieData";
import { base44 } from "@/api/base44Client";
import { formatGBP, formatDate, statusColor, logActivity, daysUntil, waMeLink, gmailComposeLink } from "@/lib/kieUtils";
import { Search, Plus, MessageSquare, Users, AlertTriangle, Mail, Phone } from "lucide-react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { TenantAvatar } from "@/components/shared/TenantChip";
import PropertyLink from "@/components/shared/PropertyLink";
import PageHeader from "@/components/shared/PageHeader";
import EmptyState from "@/components/shared/EmptyState";
import { PageSkeleton } from "@/components/shared/Skeletons";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

const BTN_PRIMARY = "inline-flex items-center gap-1.5 px-3.5 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 active:scale-[0.98] transition-all shadow-sm";
const BTN_SECONDARY = "inline-flex items-center gap-1.5 px-3.5 py-2 border bg-card hover:bg-muted text-foreground rounded-lg text-sm font-medium active:scale-[0.98] transition-all shadow-sm";
const LABEL_CLS = "text-xs font-medium text-muted-foreground";

const consentChip = (status) =>
  status === "Granted"
    ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"
    : "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300";

// External contact actions: WhatsApp via wa.me, email via Gmail compose.
// Both open in a new tab; the MessageSquare icon stays the in-app inbox.
function ContactIcons({ tenant, size = "w-4 h-4" }) {
  const wa = waMeLink(tenant.phone);
  const gmail = gmailComposeLink(tenant.email);
  return (
    <span className="inline-flex items-center" onClick={(e) => e.stopPropagation()}>
    {wa && (
        <a
          href={wa}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`WhatsApp ${tenant.name} on ${tenant.phone}`}
          title="Open WhatsApp chat"
          className="p-1.5 rounded-lg hover:bg-muted inline-block active:scale-[0.98] transition-all"
        >
          <Phone className={`${size} text-emerald-600 dark:text-emerald-400`} />
        </a>
      )}
      {gmail && (
        <a
          href={gmail}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Email ${tenant.name} via Gmail`}
          title="Compose in Gmail"
          className="p-1.5 rounded-lg hover:bg-muted inline-block active:scale-[0.98] transition-all"
        >
          <Mail className={`${size} text-muted-foreground`} />
        </a>
      )}
      <Link
        to={`/whatsapp?tenant=${tenant.id}`}
        aria-label={`Open inbox conversation with ${tenant.name}`}
        title="Open in-app inbox"
        className="p-1.5 rounded-lg hover:bg-muted inline-block active:scale-[0.98] transition-all"
      >
        <MessageSquare className={`${size} text-muted-foreground`} />
      </Link>
    </span>
  );
}

export default function Tenants() {
  const { tenants, properties, bills, reload, loading } = useKieData();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();

  useEffect(() => {
    if (searchParams.get("new") === "1") {
      setAddOpen(true);
      setSearchParams((p) => { p.delete("new"); return p; }, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = tenants.filter((t) =>
    t.name?.toLowerCase().includes(search.toLowerCase()) || t.phone?.includes(search) || t.email?.toLowerCase().includes(search.toLowerCase())
  );
  const overdueTenants = tenants.filter((t) => t.payment_status === "Overdue");

  if (loading) return <PageSkeleton />;

  const propertyOf = (t) => properties.find((p) => p.id === t.property_id);

  // Days the earliest overdue rent bill for this tenant's property has been
  // outstanding — shown beside the red badge, matching Compliance's style.
  const rentOverdueDays = (t) => {
    if (t.payment_status !== "Overdue") return null;
    const bill = bills
      .filter((b) => b.category === "Rent" && b.status === "Overdue" && b.property_id === t.property_id)
      .sort((a, b) => String(a.due_date).localeCompare(String(b.due_date)))[0];
    const d = bill ? daysUntil(bill.due_date) : null;
    return d != null && d < 0 ? Math.abs(d) : null;
  };

  return (
    <div className="space-y-5 animate-fade-in">
      <PageHeader
        title="Tenants"
        subtitle={`${tenants.length} tenant${tenants.length === 1 ? "" : "s"} across ${properties.length} propert${properties.length === 1 ? "y" : "ies"}`}
        actions={
          <button onClick={() => setAddOpen(true)} className={BTN_PRIMARY}>
            <Plus className="w-4 h-4" /> Add tenant
          </button>
        }
      />

      {tenants.length > 0 && (
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, phone or email…"
            aria-label="Search tenants"
            className="w-full pl-9 pr-3 py-2 bg-card border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[hsl(var(--sage))]/30"
          />
        </div>
      )}

      {overdueTenants.length > 0 && (
        <div className="rounded-xl border bg-card p-4">
          <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
            Arrears — {overdueTenants.length} tenant{overdueTenants.length === 1 ? "" : "s"} overdue
          </p>
          <div className="flex flex-wrap gap-2 mt-2.5">
            {overdueTenants.map((t) => (
              <Link
                key={t.id}
                to={`/tenants/${t.id}`}
                className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium active:scale-[0.98] transition-all ${statusColor("Overdue")}`}
              >
                <TenantAvatar tenant={t} size="xs" />
                {t.name}
                <span className="opacity-70">· {propertyOf(t)?.name || "—"}</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {tenants.length === 0 ? (
        <div className="rounded-xl border bg-card">
          <EmptyState
            icon={Users}
            title="No tenants yet"
            description="Add your first tenant to start tracking rent, tenancy dates and consent."
            action={<button onClick={() => setAddOpen(true)} className={BTN_PRIMARY}><Plus className="w-4 h-4" /> Add tenant</button>}
          />
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border bg-card">
          <EmptyState
            icon={Search}
            title="Nothing matches"
            description={`No tenant matches “${search}”.`}
            action={<button onClick={() => setSearch("")} className={BTN_SECONDARY}>Clear search</button>}
          />
        </div>
      ) : (
        <>
          {/* Mobile: transaction-style row list */}
          <div className="md:hidden rounded-xl border bg-card divide-y divide-border overflow-hidden">
            {filtered.map((t) => {
              const prop = propertyOf(t);
              return (
                <div key={t.id} className="flex items-center gap-3 px-4 py-3 min-h-[56px] hover:bg-muted transition-colors">
                  <Link to={`/tenants/${t.id}`} className="flex items-center gap-3 flex-1 min-w-0">
                    <TenantAvatar tenant={t} size="md" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{t.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{prop?.name || "No property"}</p>
                    </div>
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium shrink-0 ${statusColor(t.payment_status)}`}>{t.payment_status || "—"}</span>
                  </Link>
                  <Link
                    to={`/whatsapp?tenant=${t.id}`}
                    onClick={(e) => e.stopPropagation()}
                    aria-label={`WhatsApp ${t.name}`}
                    className="p-2 rounded-lg hover:bg-muted active:scale-[0.98] transition-all shrink-0"
                  >
                    <MessageSquare className="w-4 h-4 text-muted-foreground" />
                  </Link>
                </div>
              );
            })}
          </div>

          {/* Desktop: full table */}
          <div className="hidden md:block rounded-xl border bg-card">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs text-muted-foreground uppercase">
                  <tr className="border-b">
                    <th className="text-left px-4 py-3 font-medium">Tenant</th>
                    <th className="text-left px-4 py-3 font-medium">Property</th>
                    <th className="text-left px-4 py-3 font-medium">Tenancy</th>
                    <th className="text-right px-4 py-3 font-medium">Rent</th>
                    <th className="text-left px-4 py-3 font-medium">Payment</th>
                    <th className="text-left px-4 py-3 font-medium">Consent</th>
                    <th className="px-4 py-3"><span className="sr-only">WhatsApp</span></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filtered.map((t) => {
                    const prop = propertyOf(t);
                    return (
                      <tr key={t.id} onClick={() => navigate(`/tenants/${t.id}`)} className="hover:bg-muted transition-colors cursor-pointer">
                        <td className="px-4 py-3">
                          <Link to={`/tenants/${t.id}`} onClick={(e) => e.stopPropagation()} className="flex items-center gap-2.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--sage))] rounded">
                            <TenantAvatar tenant={t} size="md" />
                            <span className="min-w-0">
                              <span className="block font-medium text-foreground truncate">{t.name}</span>
                              <span className="block text-xs text-muted-foreground truncate">{t.phone}</span>
                            </span>
                          </Link>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground"><PropertyLink property={prop} /></td>
                        <td className="px-4 py-3 text-muted-foreground text-xs whitespace-nowrap">{formatDate(t.tenancy_start)} → {formatDate(t.tenancy_end)}</td>
                        <td className="px-4 py-3 text-right font-medium text-foreground tabular-nums">{formatGBP(t.rent_amount)}</td>
                        <td className="px-4 py-3"><span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColor(t.payment_status)}`}>{t.payment_status || "—"}</span></td>
                        <td className="px-4 py-3"><span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${consentChip(t.consent_status)}`}>{t.consent_status || "—"}</span></td>
                        <td className="px-4 py-3">
                          <Link
                            to={`/whatsapp?tenant=${t.id}`}
                            onClick={(e) => e.stopPropagation()}
                            aria-label={`WhatsApp ${t.name}`}
                            className="p-1.5 rounded-lg hover:bg-muted inline-block active:scale-[0.98] transition-all"
                          >
                            <MessageSquare className="w-4 h-4 text-muted-foreground" />
                          </Link>
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

      <AddTenantModal open={addOpen} onClose={() => setAddOpen(false)} onCreated={reload} properties={properties} />
    </div>
  );
}

const EMPTY_FORM = { name: "", phone: "", email: "", property_id: "", tenancy_start: "", tenancy_end: "", rent_amount: "", consent_status: "Pending" };

function AddTenantModal({ open, onClose, onCreated, properties }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    if (saving) return;
    if (!form.name || !form.phone || !form.property_id) { toast.error("Name, phone and property are required"); return; }
    setSaving(true);
    try {
      const rentN = parseFloat(form.rent_amount);
      const rent = Number.isFinite(rentN) ? rentN : 0;
      const t = await base44.entities.Tenant.create({
        name: form.name, phone: form.phone, email: form.email, property_id: form.property_id,
        tenancy_start: form.tenancy_start, tenancy_end: form.tenancy_end,
        rent_amount: rent, payment_status: "Due", consent_status: form.consent_status, notes: "",
      });
      // Every tenant gets a Tenancy record — it drives rent/residence history
      const today = new Date().toISOString().slice(0, 10);
      const start = form.tenancy_start || today;
      await base44.entities.Tenancy.create({
        tenant_id: t.id, property_id: form.property_id,
        start_date: form.tenancy_start || null, end_date: form.tenancy_end || null,
        rent_amount: rent || 0,
        status: start > today ? "Upcoming" : "Active",
        rent_history: [{ date: start, amount: rent || 0 }],
        is_demo: false, source: "manual",
      });
      await logActivity(base44, { tenant_id: t.id, property_id: form.property_id, event_type: "Tenant update", description: `Tenant added: ${form.name}` });
      toast.success("Tenant added");
      onCreated();
      onClose();
      setForm(EMPTY_FORM);
    } catch (e) {
      toast.error(`Failed to add tenant${e?.message ? `: ${e.message}` : ""}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Add tenant</DialogTitle></DialogHeader>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 py-2">
          <div className="sm:col-span-2 space-y-1.5"><Label className={LABEL_CLS}>Full name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
          <div className="space-y-1.5"><Label className={LABEL_CLS}>Phone (UK)</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+44 7xxx xxx xxx" /></div>
          <div className="space-y-1.5"><Label className={LABEL_CLS}>Email</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
          <div className="sm:col-span-2 space-y-1.5">
            <Label className={LABEL_CLS}>Property</Label>
            {properties.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No properties yet — <Link to="/properties?new=1" className="underline decoration-[hsl(var(--sage))] decoration-2 underline-offset-2" onClick={onClose}>add a property first</Link>.
              </p>
            ) : (
              <Select value={form.property_id} onValueChange={(v) => setForm({ ...form, property_id: v })}>
                <SelectTrigger><SelectValue placeholder="Select property" /></SelectTrigger>
                <SelectContent>{properties.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
              </Select>
            )}
          </div>
          <div className="space-y-1.5"><Label className={LABEL_CLS}>Tenancy start</Label><Input type="date" value={form.tenancy_start} onChange={(e) => setForm({ ...form, tenancy_start: e.target.value })} /></div>
          <div className="space-y-1.5"><Label className={LABEL_CLS}>Tenancy end</Label><Input type="date" value={form.tenancy_end} onChange={(e) => setForm({ ...form, tenancy_end: e.target.value })} /></div>
          <div className="space-y-1.5"><Label className={LABEL_CLS}>Monthly rent (£)</Label><Input type="number" min="0" inputMode="decimal" value={form.rent_amount} onChange={(e) => setForm({ ...form, rent_amount: e.target.value })} /></div>
          <div className="space-y-1.5">
            <Label className={LABEL_CLS}>Consent status</Label>
            <Select value={form.consent_status} onValueChange={(v) => setForm({ ...form, consent_status: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{["Granted", "Pending", "Withdrawn"].map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter className="gap-2">
          <button onClick={onClose} className={BTN_SECONDARY} disabled={saving}>Cancel</button>
          <button onClick={handleSubmit} className={BTN_PRIMARY} disabled={saving}>{saving ? "Saving…" : "Add tenant"}</button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
