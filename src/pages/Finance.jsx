import React, { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useKieData } from "@/lib/useKieData";
import { base44 } from "@/api/base44Client";
import PageHeader from "@/components/shared/PageHeader";
import EmptyState from "@/components/shared/EmptyState";
import PropertyLink from "@/components/shared/PropertyLink";
import TenantChip from "@/components/shared/TenantChip";
import { PageSkeleton } from "@/components/shared/Skeletons";
import { formatGBP, formatDate, daysUntil, statusColor, logActivity } from "@/lib/kieUtils";
import { Plus, CheckCircle2, Bell, AlertTriangle, X, BarChart3, Receipt, Wrench, TrendingUp, FilterX } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from "recharts";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";

const VALID_TABS = ["overview", "rent", "bills", "subscriptions", "contractor", "transactions"];
const BILL_CATEGORIES = ["Rent", "Council tax", "Gas", "Electricity", "Water", "Internet", "Service charge", "Insurance", "Subscription", "Maintenance", "Other"];
const EXPENSE_CATEGORIES = ["Council tax", "Gas", "Electricity", "Water", "Internet", "Service charge", "Insurance", "Maintenance", "Other"];

const BTN_PRIMARY = "inline-flex items-center gap-1.5 px-3.5 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 active:scale-[0.98] transition-all shadow-sm";
const BTN_SECONDARY = "inline-flex items-center gap-1.5 px-3.5 py-2 border bg-card hover:bg-muted text-foreground rounded-lg text-sm font-medium active:scale-[0.98] transition-all shadow-sm";
const BTN_ROW = "inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-lg border bg-card text-foreground hover:bg-muted transition-all active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none";
const CHIP = "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ";

// Transactions that count as money in (chart + net position use the same rule).
const isIncomeTx = (t) => /received|refund/i.test(t?.type || "");

// Auto-flip of stale Due bills runs once per session, not on every navigation.
let staleBillsFlipped = false;

export default function Finance() {
  const { bills, transactions, properties, tenants, reload, loading } = useKieData();
  const [searchParams, setSearchParams] = useSearchParams();
  const [addOpen, setAddOpen] = useState(false);
  const [pendingIds, setPendingIds] = useState(() => new Set());

  const tabParam = searchParams.get("tab");
  const tab = VALID_TABS.includes(tabParam) ? tabParam : "overview";
  const statusFilter = searchParams.get("status");

  // /finance?new=1 → open the create modal, then clean the URL.
  useEffect(() => {
    if (searchParams.get("new") === "1") {
      setAddOpen(true);
      setSearchParams((p) => { p.delete("new"); return p; }, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Quietly flip bills that are "Due" but past their due date to "Overdue".
  useEffect(() => {
    if (loading || staleBillsFlipped) return;
    staleBillsFlipped = true;
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const stale = bills.filter((b) => {
      if (b.status !== "Due" || !b.due_date) return false;
      const d = new Date(b.due_date);
      return !isNaN(d.getTime()) && d < startOfToday;
    });
    if (stale.length === 0) return;
    Promise.allSettled(stale.map((b) => base44.entities.Bill.update(b.id, { status: "Overdue" }))).then(() => reload());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, bills]);

  if (loading) return <PageSkeleton />;

  const setTab = (v) => setSearchParams((p) => { p.set("tab", v); return p; }, { replace: true });
  const clearStatus = () => setSearchParams((p) => { p.delete("status"); return p; }, { replace: true });
  const byStatus = (list) => (statusFilter ? list.filter((b) => b.status === statusFilter) : list);

  const now = new Date();
  const inThisMonth = (dateStr) => {
    if (!dateStr) return false;
    const d = new Date(dateStr);
    return !isNaN(d.getTime()) && d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  };

  // --- KPIs ---
  const rentExpected = bills.filter((b) => b.category === "Rent" && b.is_income).reduce((s, b) => s + (b.amount || 0), 0);
  const rentReceivedThisMonth = transactions.filter((t) => t.type === "Rent received" && inThisMonth(t.date)).reduce((s, t) => s + (t.amount || 0), 0);
  const overdueRent = bills.filter((b) => b.category === "Rent" && b.status === "Overdue").reduce((s, b) => s + (b.amount || 0), 0);
  const billsDue31 = bills.filter((b) => {
    if (b.is_income || b.status === "Paid") return false;
    const d = daysUntil(b.due_date);
    return d != null && d >= 0 && d <= 31;
  }).reduce((s, b) => s + (b.amount || 0), 0);
  const contractorCosts = transactions.filter((t) => t.type === "Contractor payment").reduce((s, t) => s + (t.amount || 0), 0);
  const monthTx = transactions.filter((t) => inThisMonth(t.date));
  const cashIn = monthTx.filter(isIncomeTx).reduce((s, t) => s + (t.amount || 0), 0);
  const cashOut = monthTx.filter((t) => !isIncomeTx(t)).reduce((s, t) => s + (t.amount || 0), 0);
  const netPosition = cashIn - cashOut;

  // --- Chart: last 6 calendar months, derived from real transactions ---
  const months = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({ key: `${d.getFullYear()}-${d.getMonth()}`, month: d.toLocaleDateString("en-GB", { month: "short" }), income: 0, outgoings: 0 });
  }
  const monthByKey = Object.fromEntries(months.map((m) => [m.key, m]));
  for (const t of transactions) {
    const d = new Date(t.date);
    if (isNaN(d.getTime())) continue;
    const bucket = monthByKey[`${d.getFullYear()}-${d.getMonth()}`];
    if (!bucket) continue;
    const amt = typeof t.amount === "number" && Number.isFinite(t.amount) ? t.amount : 0;
    if (isIncomeTx(t)) bucket.income += amt;
    else bucket.outgoings += amt;
  }

  const arrears = bills.filter((b) => b.category === "Rent" && b.status === "Overdue");
  const arrearsTotal = arrears.reduce((s, b) => s + (b.amount || 0), 0);

  const setPending = (id, on) => setPendingIds((prev) => {
    const next = new Set(prev);
    if (on) next.add(id); else next.delete(id);
    return next;
  });

  const markPaid = async (bill) => {
    if (pendingIds.has(bill.id)) return;
    setPending(bill.id, true);
    try {
      await base44.entities.Bill.update(bill.id, { status: "Paid" });
      await base44.entities.Transaction.create({
        property_id: bill.property_id, type: bill.is_income ? "Rent received" : "Bill paid", amount: bill.amount,
        date: new Date().toISOString().slice(0, 10), category: bill.category, status: "Completed", simulated: true,
      });
      await logActivity(base44, { property_id: bill.property_id, event_type: "Bill update", description: `${bill.category} marked as paid (${formatGBP(bill.amount)})`, related_id: bill.id });
      toast.success("Marked as paid (simulated)");
      await reload();
    } catch (e) {
      toast.error(`Couldn't mark as paid: ${e?.message || "unknown error"}`);
    } finally {
      setPending(bill.id, false);
    }
  };

  const sendReminder = async (bill) => {
    if (pendingIds.has(bill.id)) return;
    setPending(bill.id, true);
    try {
      const tenant = tenants.find((t) => t.property_id === bill.property_id);
      await logActivity(base44, { property_id: bill.property_id, tenant_id: tenant?.id, event_type: "Rent reminder", description: `Rent reminder sent for ${bill.category} (${formatGBP(bill.amount)})` });
      toast.success("Reminder logged — WhatsApp delivery coming with the real integration");
      await reload();
    } catch (e) {
      toast.error(`Couldn't log the reminder: ${e?.message || "unknown error"}`);
    } finally {
      setPending(bill.id, false);
    }
  };

  const upcoming = bills.filter((b) => b.status !== "Paid").sort((a, b) => new Date(a.due_date) - new Date(b.due_date));
  const sortedTx = [...transactions].sort((a, b) => new Date(b.date) - new Date(a.date));
  const contractorTx = sortedTx.filter((t) => t.type === "Contractor payment");

  return (
    <div className="space-y-5 animate-fade-in">
      <PageHeader
        title="Finance & Bills"
        subtitle="Prototype — all payments are simulated"
        actions={
          <button onClick={() => setAddOpen(true)} className={BTN_PRIMARY}>
            <Plus className="w-4 h-4" /> Add bill
          </button>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        <StatTile to="/finance?tab=rent" label="Rent expected" value={formatGBP(rentExpected)} sub="all rent bills" />
        <StatTile to="/finance?tab=transactions" label="Rent received" value={formatGBP(rentReceivedThisMonth)} sub="this month" tone={rentReceivedThisMonth > 0 ? "pos" : undefined} />
        <StatTile to="/finance?tab=rent&status=Overdue" label="Overdue rent" value={formatGBP(overdueRent)} sub={arrears.length > 0 ? `${arrears.length} bill${arrears.length === 1 ? "" : "s"}` : "all clear"} tone={overdueRent > 0 ? "neg" : undefined} />
        <StatTile to="/finance?tab=bills" label="Bills due" value={formatGBP(billsDue31)} sub="next 31 days" />
        <StatTile to="/finance?tab=contractor" label="Contractor costs" value={formatGBP(contractorCosts)} sub="all time" />
        <StatTile to="/finance?tab=transactions" label="Net position" value={formatGBP(netPosition)} sub="cash in − cash out this month" tone={netPosition >= 0 ? "pos" : "neg"} />
      </div>

      {arrears.length > 0 && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 dark:border-rose-500/30 dark:bg-rose-500/10 p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
            <p className="text-sm font-semibold text-rose-700 dark:text-rose-300">Rent arrears — {formatGBP(arrearsTotal)} overdue</p>
          </div>
          <div className="divide-y divide-rose-200/60 dark:divide-rose-500/20">
            {arrears.map((b) => {
              const prop = properties.find((p) => p.id === b.property_id);
              const tenant = tenants.find((t) => t.property_id === b.property_id);
              const pending = pendingIds.has(b.id);
              return (
                <div key={b.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 py-2.5">
                  <TenantChip tenant={tenant} size="sm" />
                  <span className="text-xs text-muted-foreground min-w-0 truncate"><PropertyLink property={prop} /></span>
                  <span className="text-sm font-semibold tabular-nums text-rose-600 dark:text-rose-400 ml-auto">{formatGBP(b.amount)}</span>
                  <div className="flex items-center gap-1.5">
                    <button onClick={() => sendReminder(b)} disabled={pending} className={BTN_ROW}>
                      <Bell className="w-3.5 h-3.5" /> Remind
                    </button>
                    <button onClick={() => markPaid(b)} disabled={pending} className={BTN_ROW}>
                      <CheckCircle2 className="w-3.5 h-3.5" /> {pending ? "Saving…" : "Mark paid"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <Tabs value={tab} onValueChange={setTab}>
        <div className="overflow-x-auto no-scrollbar -mx-1 px-1">
          <TabsList className="w-max">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="rent">Rent</TabsTrigger>
            <TabsTrigger value="bills">Bills</TabsTrigger>
            <TabsTrigger value="subscriptions">Subscriptions</TabsTrigger>
            <TabsTrigger value="contractor">Contractor</TabsTrigger>
            <TabsTrigger value="transactions">Transactions</TabsTrigger>
          </TabsList>
        </div>

        {statusFilter && (
          <div className="flex items-center gap-2 mt-3">
            <span className="text-xs text-muted-foreground">Filtered by</span>
            <button onClick={clearStatus} className="inline-flex items-center gap-1 rounded-full border bg-card px-2.5 py-1 text-xs font-medium text-foreground hover:bg-muted transition-colors active:scale-[0.98]" aria-label={`Clear status filter ${statusFilter}`}>
              Status: {statusFilter}
              <X className="w-3 h-3" />
            </button>
          </div>
        )}

        <TabsContent value="overview" className="mt-4 space-y-4">
          <div className="rounded-xl border bg-card p-5">
            <h3 className="text-sm font-semibold text-foreground mb-4">Monthly cash flow</h3>
            {transactions.length === 0 ? (
              <EmptyState
                compact
                icon={BarChart3}
                title="No transactions yet"
                description="Mark a bill as paid to record your first simulated payment — the chart builds itself from real activity."
                action={<button onClick={() => setAddOpen(true)} className={BTN_PRIMARY}><Plus className="w-4 h-4" /> Add bill</button>}
              />
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={months}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={{ stroke: "hsl(var(--border))" }} />
                  <YAxis tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} tickFormatter={(v) => `£${v}`} tickLine={false} axisLine={false} />
                  <Tooltip
                    formatter={(v) => formatGBP(v)}
                    contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12, color: "hsl(var(--foreground))" }}
                    labelStyle={{ color: "hsl(var(--foreground))", fontWeight: 600 }}
                    cursor={{ fill: "hsl(var(--muted))", opacity: 0.5 }}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="income" name="Income" fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="outgoings" name="Outgoings" fill="hsl(var(--chart-4))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="rounded-xl border bg-card">
            <div className="px-4 py-3 border-b">
              <h3 className="text-sm font-semibold text-foreground">Upcoming money timeline</h3>
            </div>
            {upcoming.length === 0 ? (
              <EmptyState compact icon={CheckCircle2} title="All settled" description="No unpaid bills right now." />
            ) : (
              <div className="divide-y divide-border">
                {upcoming.map((b) => {
                  const prop = properties.find((p) => p.id === b.property_id);
                  const d = daysUntil(b.due_date);
                  const dueHint = d == null ? null : d < 0 ? `${Math.abs(d)}d overdue` : d === 0 ? "due today" : `in ${d}d`;
                  return (
                    <div key={b.id} className="flex items-center gap-3 px-4 py-3 min-h-[56px] hover:bg-muted transition-colors border-l-[3px] border-l-teal-500">
                      <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
                        {b.is_income
                          ? <TrendingUp className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                          : <Receipt className="w-4 h-4 text-muted-foreground" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{b.category}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          <PropertyLink property={prop} /> · {formatDate(b.due_date)}{dueHint ? ` · ${dueHint}` : ""}
                        </p>
                      </div>
                      <p className={`text-sm font-semibold tabular-nums ${b.is_income ? "text-emerald-600 dark:text-emerald-400" : "text-foreground"}`}>
                        {b.is_income ? "+" : ""}{formatGBP(b.amount)}
                      </p>
                      <span className={CHIP + statusColor(b.status)}>{b.status}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="rent" className="mt-4">
          <BillTable
            bills={byStatus(bills.filter((b) => b.category === "Rent"))}
            properties={properties}
            onMarkPaid={markPaid}
            onReminder={sendReminder}
            showReminder
            pendingIds={pendingIds}
            statusFilter={statusFilter}
            onClearFilter={clearStatus}
            emptyTitle="No rent bills yet"
            emptyDescription="Add a rent bill to start tracking what's expected each month."
            onAdd={() => setAddOpen(true)}
          />
        </TabsContent>

        <TabsContent value="bills" className="mt-4">
          <BillTable
            bills={byStatus(bills.filter((b) => !b.is_income && EXPENSE_CATEGORIES.includes(b.category)))}
            properties={properties}
            onMarkPaid={markPaid}
            pendingIds={pendingIds}
            statusFilter={statusFilter}
            onClearFilter={clearStatus}
            emptyTitle="No bills yet"
            emptyDescription="Track council tax, utilities and other running costs here."
            onAdd={() => setAddOpen(true)}
          />
        </TabsContent>

        <TabsContent value="subscriptions" className="mt-4">
          <BillTable
            bills={byStatus(bills.filter((b) => b.category === "Subscription"))}
            properties={properties}
            onMarkPaid={markPaid}
            pendingIds={pendingIds}
            statusFilter={statusFilter}
            onClearFilter={clearStatus}
            emptyTitle="No subscriptions yet"
            emptyDescription="Recurring services you pay for — add one as a bill with the Subscription category."
            onAdd={() => setAddOpen(true)}
          />
        </TabsContent>

        <TabsContent value="contractor" className="mt-4">
          {contractorTx.length === 0 ? (
            <div className="rounded-xl border bg-card">
              <EmptyState compact icon={Wrench} title="No contractor payments" description="Payments to contractors appear here once maintenance work is paid for." />
            </div>
          ) : (
            <div className="rounded-xl border bg-card overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-xs text-muted-foreground uppercase">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium">Date</th>
                    <th className="text-left px-4 py-3 font-medium">Property</th>
                    <th className="text-right px-4 py-3 font-medium">Amount</th>
                    <th className="text-left px-4 py-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {contractorTx.map((t) => (
                    <tr key={t.id} className="hover:bg-muted transition-colors">
                      <td className="px-4 py-3 text-foreground whitespace-nowrap border-l-[3px] border-l-teal-500">{formatDate(t.date)}</td>
                      <td className="px-4 py-3 text-muted-foreground"><PropertyLink property={properties.find((p) => p.id === t.property_id)} /></td>
                      <td className="px-4 py-3 text-right font-medium tabular-nums text-foreground">{formatGBP(t.amount)}</td>
                      <td className="px-4 py-3"><span className={CHIP + statusColor(t.status)}>{t.status}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>

        <TabsContent value="transactions" className="mt-4">
          {sortedTx.length === 0 ? (
            <div className="rounded-xl border bg-card">
              <EmptyState
                compact
                icon={Receipt}
                title="No transactions yet"
                description="Mark a bill as paid to record your first simulated payment."
                action={<button onClick={() => setAddOpen(true)} className={BTN_PRIMARY}><Plus className="w-4 h-4" /> Add bill</button>}
              />
            </div>
          ) : (
            <>
              <div className="md:hidden rounded-xl border bg-card divide-y divide-border">
                {sortedTx.map((t) => {
                  const income = isIncomeTx(t);
                  return (
                    <div key={t.id} className="flex items-center gap-3 px-4 py-3 min-h-[56px] border-l-[3px] border-l-teal-500">
                      <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
                        {income
                          ? <TrendingUp className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                          : <Receipt className="w-4 h-4 text-muted-foreground" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{t.type || "Transaction"}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          <PropertyLink property={properties.find((p) => p.id === t.property_id)} /> · {formatDate(t.date)}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className={`text-sm font-semibold tabular-nums ${income ? "text-emerald-600 dark:text-emerald-400" : "text-foreground"}`}>
                          {income ? "+" : ""}{formatGBP(t.amount)}
                        </p>
                        <span className={CHIP + statusColor(t.status) + " mt-1"}>{t.status}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="hidden md:block rounded-xl border bg-card overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-xs text-muted-foreground uppercase">
                    <tr>
                      <th className="text-left px-4 py-3 font-medium">Date</th>
                      <th className="text-left px-4 py-3 font-medium">Type</th>
                      <th className="text-left px-4 py-3 font-medium">Property</th>
                      <th className="text-right px-4 py-3 font-medium">Amount</th>
                      <th className="text-left px-4 py-3 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {sortedTx.map((t) => {
                      const income = isIncomeTx(t);
                      return (
                        <tr key={t.id} className="hover:bg-muted transition-colors">
                          <td className="px-4 py-3 text-foreground whitespace-nowrap border-l-[3px] border-l-teal-500">{formatDate(t.date)}</td>
                          <td className="px-4 py-3 text-foreground">{t.type || "—"}</td>
                          <td className="px-4 py-3 text-muted-foreground"><PropertyLink property={properties.find((p) => p.id === t.property_id)} /></td>
                          <td className={`px-4 py-3 text-right font-medium tabular-nums ${income ? "text-emerald-600 dark:text-emerald-400" : "text-foreground"}`}>
                            {income ? "+" : ""}{formatGBP(t.amount)}
                          </td>
                          <td className="px-4 py-3"><span className={CHIP + statusColor(t.status)}>{t.status}</span></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </TabsContent>
      </Tabs>

      <AddBillModal open={addOpen} onClose={() => setAddOpen(false)} onCreated={reload} properties={properties} />
    </div>
  );
}

function StatTile({ to, label, value, sub, tone }) {
  const valueClass = tone === "pos"
    ? "text-emerald-600 dark:text-emerald-400"
    : tone === "neg"
      ? "text-rose-600 dark:text-rose-400"
      : "text-foreground";
  return (
    <Link to={to} className="block rounded-xl border bg-card p-4 hover:bg-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--sage))]">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-2xl font-semibold tracking-tight tabular-nums mt-1 ${valueClass}`}>{value}</p>
      {sub && <p className="text-[11px] text-muted-foreground mt-0.5">{sub}</p>}
    </Link>
  );
}

function RowActions({ bill, pending, onMarkPaid, onReminder, showReminder }) {
  if (bill.status === "Paid") return null;
  return (
    <div className="flex items-center gap-1.5">
      <button onClick={() => onMarkPaid(bill)} disabled={pending} className={BTN_ROW}>
        <CheckCircle2 className="w-3.5 h-3.5" /> {pending ? "Saving…" : "Mark paid"}
      </button>
      {showReminder && onReminder && (
        <button onClick={() => onReminder(bill)} disabled={pending} className={BTN_ROW}>
          <Bell className="w-3.5 h-3.5" /> Remind
        </button>
      )}
    </div>
  );
}

function BillTable({ bills, properties, onMarkPaid, onReminder, showReminder, pendingIds, statusFilter, onClearFilter, emptyTitle, emptyDescription, onAdd }) {
  if (bills.length === 0) {
    return (
      <div className="rounded-xl border bg-card">
        {statusFilter ? (
          <EmptyState
            compact
            icon={FilterX}
            title={`Nothing with status "${statusFilter}"`}
            description="Nothing matches — clear the filter to see everything."
            action={<button onClick={onClearFilter} className={BTN_SECONDARY}><X className="w-4 h-4" /> Clear filter</button>}
          />
        ) : (
          <EmptyState
            compact
            icon={Receipt}
            title={emptyTitle}
            description={emptyDescription}
            action={onAdd && <button onClick={onAdd} className={BTN_PRIMARY}><Plus className="w-4 h-4" /> Add bill</button>}
          />
        )}
      </div>
    );
  }
  return (
    <>
      <div className="md:hidden rounded-xl border bg-card divide-y divide-border">
        {bills.map((b) => {
          const prop = properties.find((p) => p.id === b.property_id);
          const pending = pendingIds.has(b.id);
          return (
            <div key={b.id} className="px-4 py-3 space-y-2.5 border-l-[3px] border-l-teal-500">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{b.category}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    <PropertyLink property={prop} /> · {formatDate(b.due_date)}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className={`text-sm font-semibold tabular-nums ${b.is_income ? "text-emerald-600 dark:text-emerald-400" : "text-foreground"}`}>
                    {b.is_income ? "+" : ""}{formatGBP(b.amount)}
                  </p>
                  <span className={CHIP + statusColor(b.status) + " mt-1"}>{b.status}</span>
                </div>
              </div>
              <RowActions bill={b} pending={pending} onMarkPaid={onMarkPaid} onReminder={onReminder} showReminder={showReminder} />
            </div>
          );
        })}
      </div>
      <div className="hidden md:block rounded-xl border bg-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs text-muted-foreground uppercase">
            <tr>
              <th className="text-left px-4 py-3 font-medium">Category</th>
              <th className="text-left px-4 py-3 font-medium">Property</th>
              <th className="text-left px-4 py-3 font-medium">Due</th>
              <th className="text-right px-4 py-3 font-medium">Amount</th>
              <th className="text-left px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {bills.map((b) => {
              const pending = pendingIds.has(b.id);
              return (
                <tr key={b.id} className="hover:bg-muted transition-colors">
                  <td className="px-4 py-3 font-medium text-foreground border-l-[3px] border-l-teal-500">{b.category}</td>
                  <td className="px-4 py-3 text-muted-foreground"><PropertyLink property={properties.find((p) => p.id === b.property_id)} /></td>
                  <td className={`px-4 py-3 whitespace-nowrap ${b.status === "Overdue" ? "text-rose-600 dark:text-rose-400 font-medium" : "text-muted-foreground"}`}>{formatDate(b.due_date)}</td>
                  <td className={`px-4 py-3 text-right font-medium tabular-nums ${b.is_income ? "text-emerald-600 dark:text-emerald-400" : "text-foreground"}`}>
                    {b.is_income ? "+" : ""}{formatGBP(b.amount)}
                  </td>
                  <td className="px-4 py-3"><span className={CHIP + statusColor(b.status)}>{b.status}</span></td>
                  <td className="px-4 py-3">
                    <RowActions bill={b} pending={pending} onMarkPaid={onMarkPaid} onReminder={onReminder} showReminder={showReminder} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

const BLANK_BILL = { property_id: "", category: "Council tax", due_date: "", amount: "", status: "Due", notes: "", is_income: false };

function AddBillModal({ open, onClose, onCreated, properties }) {
  const [form, setForm] = useState(BLANK_BILL);
  const [saving, setSaving] = useState(false);

  // Fresh form every time the dialog opens — no stale values from a cancelled attempt.
  useEffect(() => {
    if (open) {
      setForm(BLANK_BILL);
      setSaving(false);
    }
  }, [open]);

  const handleSubmit = async () => {
    if (saving) return;
    const amt = parseFloat(form.amount);
    if (!form.due_date || !Number.isFinite(amt) || amt <= 0) {
      toast.error("Due date and a valid amount are required");
      return;
    }
    setSaving(true);
    try {
      const payload = { ...form, amount: amt };
      const b = await base44.entities.Bill.create(payload);
      await logActivity(base44, { property_id: form.property_id, event_type: "Bill update", description: `Bill added: ${form.category} (${formatGBP(amt)})`, related_id: b.id });
      toast.success("Bill added");
      onCreated();
      onClose();
    } catch (e) {
      toast.error(`Couldn't add bill: ${e?.message || "unknown error"}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Add bill</DialogTitle></DialogHeader>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 py-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label className="text-xs font-medium text-muted-foreground">Property</Label>
            <Select value={form.property_id} onValueChange={(v) => setForm({ ...form, property_id: v })}>
              <SelectTrigger><SelectValue placeholder="Select property" /></SelectTrigger>
              <SelectContent>{properties.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground">Category</Label>
            <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v, is_income: v === "Rent" })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{BILL_CATEGORIES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground">Status</Label>
            <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{["Due", "Overdue", "Paid", "Scheduled"].map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground">Due date</Label>
            <Input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground">Amount (£)</Label>
            <Input type="number" min="0" step="0.01" inputMode="decimal" placeholder="0.00" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label className="text-xs font-medium text-muted-foreground">Notes</Label>
            <Textarea rows={3} placeholder="Optional — reference numbers, context, anything useful later" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={saving}>{saving ? "Saving…" : "Add bill"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
