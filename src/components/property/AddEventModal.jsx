import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { logActivity } from "@/lib/kieUtils";
import { runTaskEngine } from "@/lib/taskUtils";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

const BILL_CATEGORIES = ["Rent", "Council tax", "Gas", "Electricity", "Water", "Internet", "Service charge", "Insurance", "Subscription", "Maintenance", "Other"];
const COMPLIANCE_CATEGORIES = ["Gas Safety Certificate", "EPC", "EICR", "Boiler service", "Smoke/CO alarm", "HMO licence", "Insurance", "Tenancy agreement", "Inventory", "Legionella Risk Assessment", "PAT Test", "Deposit Protection Certificate"];
const ISSUE_TYPES = ["plumbing", "heating", "electricity", "appliance", "structural", "general"];

// Calendar "add event": creates a REAL record (Bill, MaintenanceTicket or
// ComplianceRecord) with the property pre-filled — never a duplicate
// calendar-only row. `defaultDate` (YYYY-MM-DD) prefills the kind's date field
// so "add on this day" from the calendar lands ready to save.
export default function AddEventModal({ open, onClose, onSaved, propertyId, kind, defaultDate = "" }) {
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setForm(
        kind === "bill" ? { category: "Rent", amount: "", due_date: defaultDate || "" }
        : kind === "maintenance" ? { description: "", urgency: "medium", issue_type: "general", appointment_date: defaultDate || "" }
        : { category: "Gas Safety Certificate", issue_date: "", expiry_date: defaultDate || "", provider: "" }
      );
    }
  }, [open, kind, defaultDate]);

  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v }));
  const setInput = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async () => {
    if (saving) return;
    setSaving(true);
    try {
      if (kind === "bill") {
        if (!form.due_date || !form.amount) { toast.error("Due date and amount are required"); setSaving(false); return; }
        const amount = parseFloat(form.amount);
        if (!Number.isFinite(amount)) { toast.error("Amount must be a number"); setSaving(false); return; }
        await base44.entities.Bill.create({
          property_id: propertyId, category: form.category, due_date: form.due_date,
          amount, status: "Due", is_income: form.category === "Rent",
          is_demo: false, source: "manual",
        });
        await logActivity(base44, { property_id: propertyId, event_type: "Bill update", description: `${form.category} bill added (£${form.amount})` });
      } else if (kind === "maintenance") {
        if (!form.description) { toast.error("Description is required"); setSaving(false); return; }
        await base44.entities.MaintenanceTicket.create({
          property_id: propertyId, description: form.description, urgency: form.urgency,
          issue_type: form.issue_type, status: "New",
          appointment_date: form.appointment_date ? new Date(form.appointment_date).toISOString() : null,
          is_demo: false, source: "manual",
        });
        await logActivity(base44, { property_id: propertyId, event_type: "Maintenance created", description: `Job created: ${form.description.slice(0, 60)}` });
        runTaskEngine(); // surface the matching Task immediately
      } else {
        if (!form.expiry_date) { toast.error("Expiry date is required"); setSaving(false); return; }
        await base44.entities.ComplianceRecord.create({
          property_id: propertyId, category: form.category,
          issue_date: form.issue_date || null, expiry_date: form.expiry_date,
          provider: form.provider || "",
          status: (() => {
            const days = Math.floor((new Date(form.expiry_date).getTime() - Date.now()) / 86400000);
            return days < 0 ? "Overdue" : days <= 60 ? "Expiring soon" : "Compliant";
          })(),
          is_demo: false, source: "manual",
        });
        await logActivity(base44, { property_id: propertyId, event_type: "Document upload", description: `${form.category} recorded, expires ${form.expiry_date}` });
      }
      toast.success("Added");
      onSaved();
      onClose();
    } catch (e) {
      toast.error(`Failed to save${e?.message ? `: ${e.message}` : ""}`);
    } finally {
      setSaving(false);
    }
  };

  const titles = { bill: "Add bill / rent charge", maintenance: "Add maintenance job", compliance: "Add compliance record" };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{titles[kind] || "Add event"}</DialogTitle></DialogHeader>
        <div className="space-y-3 py-2">
          {kind === "bill" && (
            <>
              <div className="space-y-1.5"><Label className="text-xs font-medium text-muted-foreground">Category</Label><Select value={form.category || ""} onValueChange={set("category")}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{BILL_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select></div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5"><Label className="text-xs font-medium text-muted-foreground">Due date</Label><Input type="date" value={form.due_date || ""} onChange={setInput("due_date")} /></div>
                <div className="space-y-1.5"><Label className="text-xs font-medium text-muted-foreground">Amount (£)</Label><Input type="number" inputMode="decimal" value={form.amount || ""} onChange={setInput("amount")} /></div>
              </div>
            </>
          )}
          {kind === "maintenance" && (
            <>
              <div className="space-y-1.5"><Label className="text-xs font-medium text-muted-foreground">Description</Label><Textarea rows={2} value={form.description || ""} onChange={setInput("description")} placeholder="What needs doing?" /></div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5"><Label className="text-xs font-medium text-muted-foreground">Issue type</Label><Select value={form.issue_type || ""} onValueChange={set("issue_type")}><SelectTrigger className="capitalize"><SelectValue /></SelectTrigger><SelectContent>{ISSUE_TYPES.map((c) => <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>)}</SelectContent></Select></div>
                <div className="space-y-1.5"><Label className="text-xs font-medium text-muted-foreground">Urgency</Label><Select value={form.urgency || ""} onValueChange={set("urgency")}><SelectTrigger className="capitalize"><SelectValue /></SelectTrigger><SelectContent>{["low", "medium", "high", "emergency"].map((c) => <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>)}</SelectContent></Select></div>
              </div>
              <div className="space-y-1.5"><Label className="text-xs font-medium text-muted-foreground">Appointment date (optional)</Label><Input type="date" value={form.appointment_date || ""} onChange={setInput("appointment_date")} /></div>
            </>
          )}
          {kind === "compliance" && (
            <>
              <div className="space-y-1.5"><Label className="text-xs font-medium text-muted-foreground">Document type</Label><Select value={form.category || ""} onValueChange={set("category")}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{COMPLIANCE_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select></div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5"><Label className="text-xs font-medium text-muted-foreground">Issue date</Label><Input type="date" value={form.issue_date || ""} onChange={setInput("issue_date")} /></div>
                <div className="space-y-1.5"><Label className="text-xs font-medium text-muted-foreground">Expiry date</Label><Input type="date" value={form.expiry_date || ""} onChange={setInput("expiry_date")} /></div>
              </div>
              <div className="space-y-1.5"><Label className="text-xs font-medium text-muted-foreground">Provider / engineer</Label><Input value={form.provider || ""} onChange={setInput("provider")} /></div>
            </>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={saving}>{saving ? "Saving…" : "Add"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
