import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { logActivity } from "@/lib/kieUtils";
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
// calendar-only row.
export default function AddEventModal({ open, onClose, onSaved, propertyId, kind }) {
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setForm(
        kind === "bill" ? { category: "Rent", amount: "", due_date: "", is_income: false }
        : kind === "maintenance" ? { description: "", urgency: "medium", issue_type: "general", appointment_date: "" }
        : { category: "Gas Safety Certificate", issue_date: "", expiry_date: "", provider: "" }
      );
    }
  }, [open, kind]);

  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v }));
  const setInput = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async () => {
    setSaving(true);
    try {
      if (kind === "bill") {
        if (!form.due_date || !form.amount) { toast.error("Due date and amount are required"); setSaving(false); return; }
        await base44.entities.Bill.create({
          property_id: propertyId, category: form.category, due_date: form.due_date,
          amount: parseFloat(form.amount), status: "Due", is_income: form.category === "Rent",
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
      toast.error("Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const titles = { bill: "Add bill / rent charge", maintenance: "Add maintenance job", compliance: "Add compliance record" };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>{titles[kind] || "Add event"}</DialogTitle></DialogHeader>
        <div className="space-y-3 py-2">
          {kind === "bill" && (
            <>
              <div className="space-y-1.5"><Label>Category</Label><Select value={form.category || ""} onValueChange={set("category")}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{BILL_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select></div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5"><Label>Due date</Label><Input type="date" value={form.due_date || ""} onChange={setInput("due_date")} /></div>
                <div className="space-y-1.5"><Label>Amount (£)</Label><Input type="number" value={form.amount || ""} onChange={setInput("amount")} /></div>
              </div>
            </>
          )}
          {kind === "maintenance" && (
            <>
              <div className="space-y-1.5"><Label>Description</Label><Textarea rows={2} value={form.description || ""} onChange={setInput("description")} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5"><Label>Issue type</Label><Select value={form.issue_type || ""} onValueChange={set("issue_type")}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{ISSUE_TYPES.map((c) => <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>)}</SelectContent></Select></div>
                <div className="space-y-1.5"><Label>Urgency</Label><Select value={form.urgency || ""} onValueChange={set("urgency")}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{["low", "medium", "high", "emergency"].map((c) => <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>)}</SelectContent></Select></div>
              </div>
              <div className="space-y-1.5"><Label>Appointment date (optional)</Label><Input type="date" value={form.appointment_date || ""} onChange={setInput("appointment_date")} /></div>
            </>
          )}
          {kind === "compliance" && (
            <>
              <div className="space-y-1.5"><Label>Document type</Label><Select value={form.category || ""} onValueChange={set("category")}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{COMPLIANCE_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select></div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5"><Label>Issue date</Label><Input type="date" value={form.issue_date || ""} onChange={setInput("issue_date")} /></div>
                <div className="space-y-1.5"><Label>Expiry date</Label><Input type="date" value={form.expiry_date || ""} onChange={setInput("expiry_date")} /></div>
              </div>
              <div className="space-y-1.5"><Label>Provider / engineer</Label><Input value={form.provider || ""} onChange={setInput("provider")} /></div>
            </>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={saving}>Add</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
