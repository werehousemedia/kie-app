import React, { useState } from "react";
import { useKieData } from "@/lib/useKieData";
import { base44 } from "@/api/base44Client";
import { formatGBP, formatDate, daysUntil, statusColor, logActivity } from "@/lib/kieUtils";
import { TrendingUp, TrendingDown, Wallet, Calendar, Plus, CheckCircle2, Bell } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from "recharts";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";

export default function Finance() {
  const { bills, transactions, properties, tenants, reload, loading } = useKieData();
  const [addOpen, setAddOpen] = useState(false);
  const [tab, setTab] = useState("overview");

  if (loading) return <div className="flex items-center justify-center h-96"><div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin" /></div>;

  const rentExpected = bills.filter((b) => b.category === "Rent" && b.is_income).reduce((s, b) => s + (b.amount || 0), 0);
  const rentReceived = transactions.filter((t) => t.type === "Rent received").reduce((s, t) => s + (t.amount || 0), 0);
  const overdueRent = bills.filter((b) => b.category === "Rent" && b.status === "Overdue").reduce((s, b) => s + (b.amount || 0), 0);
  const billsDue = bills.filter((b) => b.status !== "Paid" && !b.is_income).reduce((s, b) => s + (b.amount || 0), 0);
  const contractorCosts = transactions.filter((t) => t.type === "Contractor payment").reduce((s, t) => s + (t.amount || 0), 0);
  const netCashflow = rentReceived - billsDue - contractorCosts;

  const chartData = [
    { month: "Mar", income: 4200, outgoings: 1800 },
    { month: "Apr", income: 4200, outgoings: 2100 },
    { month: "May", income: 4350, outgoings: 1950 },
    { month: "Jun", income: 4200, outgoings: 2400 },
    { month: "Jul", income: 4350, outgoings: 1650 },
    { month: "Aug", income: rentReceived || 4200, outgoings: billsDue + contractorCosts || 2000 },
  ];

  const markPaid = async (bill) => {
    await base44.entities.Bill.update(bill.id, { status: "Paid" });
    await base44.entities.Transaction.create({
      property_id: bill.property_id, type: bill.is_income ? "Rent received" : "Bill paid", amount: bill.amount,
      date: new Date().toISOString().slice(0, 10), category: bill.category, status: "Completed", simulated: true,
    });
    await logActivity(base44, { property_id: bill.property_id, event_type: "Bill update", description: `${bill.category} marked as paid (${formatGBP(bill.amount)})`, related_id: bill.id });
    toast.success("Marked as paid (simulated)");
    reload();
  };

  const sendReminder = async (bill) => {
    const tenant = tenants.find((t) => t.property_id === bill.property_id);
    await logActivity(base44, { property_id: bill.property_id, tenant_id: tenant?.id, event_type: "Rent reminder", description: `Rent reminder sent for ${bill.category} (${formatGBP(bill.amount)})` });
    toast.success("Reminder sent (simulated)");
    reload();
  };

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold text-slate-900">Finance & Bills</h1><p className="text-sm text-amber-600 mt-0.5">⚠ Prototype — all payments are simulated</p></div>
        <button onClick={() => setAddOpen(true)} className="flex items-center gap-2 px-4 py-2 bg-[hsl(var(--navy))] text-white rounded-lg text-sm font-medium hover:bg-[hsl(var(--navy-light))]"><Plus className="w-4 h-4" /> Add bill</button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-white rounded-xl border border-slate-200 p-4"><div className="flex items-center gap-2 mb-1"><TrendingUp className="w-4 h-4 text-emerald-500" /><span className="text-xs text-slate-500">Rent expected</span></div><p className="text-lg font-bold">{formatGBP(rentExpected)}</p></div>
        <div className="bg-white rounded-xl border border-slate-200 p-4"><div className="flex items-center gap-2 mb-1"><CheckCircle2 className="w-4 h-4 text-emerald-500" /><span className="text-xs text-slate-500">Rent received</span></div><p className="text-lg font-bold">{formatGBP(rentReceived)}</p></div>
        <div className="bg-white rounded-xl border border-slate-200 p-4"><div className="flex items-center gap-2 mb-1"><Wallet className="w-4 h-4 text-rose-500" /><span className="text-xs text-slate-500">Overdue rent</span></div><p className="text-lg font-bold text-rose-600">{formatGBP(overdueRent)}</p></div>
        <div className="bg-white rounded-xl border border-slate-200 p-4"><div className="flex items-center gap-2 mb-1"><Calendar className="w-4 h-4 text-amber-500" /><span className="text-xs text-slate-500">Bills due</span></div><p className="text-lg font-bold">{formatGBP(billsDue)}</p></div>
        <div className="bg-white rounded-xl border border-slate-200 p-4"><div className="flex items-center gap-2 mb-1"><TrendingDown className="w-4 h-4 text-slate-500" /><span className="text-xs text-slate-500">Contractor costs</span></div><p className="text-lg font-bold">{formatGBP(contractorCosts)}</p></div>
        <div className={`rounded-xl border p-4 ${netCashflow >= 0 ? "bg-emerald-50 border-emerald-200" : "bg-rose-50 border-rose-200"}`}><div className="flex items-center gap-2 mb-1"><span className="text-xs text-slate-500">Net cash flow</span></div><p className={`text-lg font-bold ${netCashflow >= 0 ? "text-emerald-700" : "text-rose-700"}`}>{formatGBP(netCashflow)}</p></div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="rent">Rent</TabsTrigger>
          <TabsTrigger value="bills">Bills</TabsTrigger>
          <TabsTrigger value="subscriptions">Subscriptions</TabsTrigger>
          <TabsTrigger value="contractor">Contractor</TabsTrigger>
          <TabsTrigger value="transactions">Transactions</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <h3 className="text-sm font-semibold text-slate-900 mb-4">Monthly cash flow</h3>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="month" tick={{ fontSize: 12, fill: "#64748b" }} />
                <YAxis tick={{ fontSize: 12, fill: "#64748b" }} tickFormatter={(v) => `£${v}`} />
                <Tooltip formatter={(v) => formatGBP(v)} contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="income" name="Income" fill="hsl(160 43% 46%)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="outgoings" name="Outgoings" fill="hsl(222 47% 30%)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <h3 className="text-sm font-semibold text-slate-900 mb-3">Upcoming money timeline</h3>
            <div className="space-y-2">
              {bills.filter((b) => b.status !== "Paid").sort((a, b) => new Date(a.due_date) - new Date(b.due_date)).map((b) => {
                const prop = properties.find((p) => p.id === b.property_id);
                const d = daysUntil(b.due_date);
                return (
                  <div key={b.id} className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-slate-50">
                    <div className={`w-1 h-8 rounded-full ${b.is_income ? "bg-emerald-400" : "bg-slate-300"}`} />
                    <div className="flex-1"><p className="text-sm font-medium text-slate-800">{b.category}</p><p className="text-xs text-slate-500">{prop?.name} · {formatDate(b.due_date)}</p></div>
                    <p className={`text-sm font-semibold ${b.is_income ? "text-emerald-600" : "text-slate-700"}`}>{b.is_income ? "+" : ""}{formatGBP(b.amount)}</p>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${statusColor(b.status)}`}>{b.status}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="rent">
          <BillTable bills={bills.filter((b) => b.category === "Rent")} properties={properties} tenants={tenants} onMarkPaid={markPaid} onReminder={sendReminder} showReminder />
        </TabsContent>
        <TabsContent value="bills">
          <BillTable bills={bills.filter((b) => !b.is_income && ["Council tax", "Gas", "Electricity", "Water", "Insurance", "Maintenance", "Other"].includes(b.category))} properties={properties} onMarkPaid={markPaid} />
        </TabsContent>
        <TabsContent value="subscriptions">
          <BillTable bills={bills.filter((b) => b.category === "Subscription")} properties={properties} onMarkPaid={markPaid} />
        </TabsContent>
        <TabsContent value="contractor">
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs text-slate-500 uppercase"><tr><th className="text-left px-4 py-3">Date</th><th className="text-left px-4 py-3">Property</th><th className="text-right px-4 py-3">Amount</th><th className="text-left px-4 py-3">Status</th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {transactions.filter((t) => t.type === "Contractor payment").map((t) => (
                  <tr key={t.id}><td className="px-4 py-3">{formatDate(t.date)}</td><td className="px-4 py-3">{properties.find((p) => p.id === t.property_id)?.name || "—"}</td><td className="px-4 py-3 text-right font-medium">{formatGBP(t.amount)}</td><td className="px-4 py-3"><span className={`text-xs px-2 py-0.5 rounded-full ${statusColor(t.status)}`}>{t.status}</span></td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>
        <TabsContent value="transactions">
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs text-slate-500 uppercase"><tr><th className="text-left px-4 py-3">Date</th><th className="text-left px-4 py-3">Type</th><th className="text-left px-4 py-3">Property</th><th className="text-right px-4 py-3">Amount</th><th className="text-left px-4 py-3">Status</th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {transactions.map((t) => (
                  <tr key={t.id}><td className="px-4 py-3">{formatDate(t.date)}</td><td className="px-4 py-3">{t.type}</td><td className="px-4 py-3">{properties.find((p) => p.id === t.property_id)?.name || "—"}</td><td className={`px-4 py-3 text-right font-medium ${t.type.includes("received") ? "text-emerald-600" : "text-slate-700"}`}>{t.type.includes("received") ? "+" : ""}{formatGBP(t.amount)}</td><td className="px-4 py-3"><span className={`text-xs px-2 py-0.5 rounded-full ${statusColor(t.status)}`}>{t.status}</span></td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>
      </Tabs>

      <AddBillModal open={addOpen} onClose={() => setAddOpen(false)} onCreated={reload} properties={properties} />
    </div>
  );
}

function BillTable({ bills, properties, tenants, onMarkPaid, onReminder, showReminder }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-xs text-slate-500 uppercase">
          <tr><th className="text-left px-4 py-3">Category</th><th className="text-left px-4 py-3">Property</th><th className="text-left px-4 py-3">Due</th><th className="text-right px-4 py-3">Amount</th><th className="text-left px-4 py-3">Status</th><th className="px-4 py-3"></th></tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {bills.map((b) => (
            <tr key={b.id} className="hover:bg-slate-50">
              <td className="px-4 py-3 font-medium text-slate-800">{b.category}</td>
              <td className="px-4 py-3 text-slate-600">{properties.find((p) => p.id === b.property_id)?.name || "—"}</td>
              <td className="px-4 py-3 text-slate-600">{formatDate(b.due_date)}</td>
              <td className="px-4 py-3 text-right font-medium">{formatGBP(b.amount)}</td>
              <td className="px-4 py-3"><span className={`text-xs px-2 py-0.5 rounded-full ${statusColor(b.status)}`}>{b.status}</span></td>
              <td className="px-4 py-3">
                <div className="flex items-center gap-1">
                  {b.status !== "Paid" && <button onClick={() => onMarkPaid(b)} className="text-xs px-2 py-1 rounded-md bg-emerald-50 text-emerald-700 hover:bg-emerald-100 font-medium">Mark paid</button>}
                  {showReminder && b.status !== "Paid" && <button onClick={() => onReminder(b)} className="text-xs px-2 py-1 rounded-md bg-blue-50 text-blue-700 hover:bg-blue-100 font-medium flex items-center gap-1"><Bell className="w-3 h-3" /> Remind</button>}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AddBillModal({ open, onClose, onCreated, properties }) {
  const [form, setForm] = useState({ property_id: "", category: "Council tax", due_date: "", amount: 0, status: "Due", notes: "", is_income: false });
  const [saving, setSaving] = useState(false);
  const handleSubmit = async () => {
    if (!form.due_date || !form.amount) { toast.error("Due date and amount required"); return; }
    setSaving(true);
    try {
      const b = await base44.entities.Bill.create(form);
      await logActivity(base44, { property_id: form.property_id, event_type: "Bill update", description: `Bill added: ${form.category} (${formatGBP(form.amount)})`, related_id: b.id });
      toast.success("Bill added"); onCreated(); onClose();
      setForm({ property_id: "", category: "Council tax", due_date: "", amount: 0, status: "Due", notes: "", is_income: false });
    } catch (e) { toast.error("Failed"); } finally { setSaving(false); }
  };
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Add bill</DialogTitle></DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1.5"><Label>Property</Label><Select value={form.property_id} onValueChange={(v) => setForm({ ...form, property_id: v })}><SelectTrigger><SelectValue placeholder="Select property" /></SelectTrigger><SelectContent>{properties.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent></Select></div>
          <div className="space-y-1.5"><Label>Category</Label><Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v, is_income: v === "Rent" })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{["Rent", "Council tax", "Gas", "Electricity", "Water", "Insurance", "Subscription", "Maintenance", "Other"].map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent></Select></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>Due date</Label><Input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Amount (£)</Label><Input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: parseFloat(e.target.value) })} /></div>
          </div>
          <div className="space-y-1.5"><Label>Status</Label><Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{["Due", "Overdue", "Paid", "Scheduled"].map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent></Select></div>
        </div>
        <DialogFooter><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={handleSubmit} disabled={saving}>Add bill</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}