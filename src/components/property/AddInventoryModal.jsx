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

export const CATEGORIES = ["Heating & boiler", "Appliance", "Furniture", "Electronics", "Kitchen", "Garden", "Safety & security", "Other"];
export const CONDITIONS = ["New", "Good", "Fair", "Worn", "Needs replacing"];

const CATEGORY_TO_TYPE = {
  "Heating & boiler": "Boiler",
  "Appliance": "Appliance",
  "Furniture": "Furniture",
  "Electronics": "Electrical",
  "Kitchen": "Appliance",
  "Garden": "Other",
  "Safety & security": "Security",
  "Other": "Other",
};

const EMPTY = {
  category: "Furniture", make: "", model: "", location: "", condition: "Good",
  purchase_date: "", purchase_price: "", current_value: "", supplier: "",
  warranty_expiry: "", replacement_due: "", fuel_type: "", install_date: "",
  last_service_date: "", notes: "",
};

// Add OR edit an inventory item (pass `item` to edit).
export default function AddInventoryModal({ open, onClose, onSaved, propertyId, item }) {
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const isEdit = !!item;

  useEffect(() => {
    if (open) setForm(item ? { ...EMPTY, ...Object.fromEntries(Object.entries(item).filter(([k]) => k in EMPTY).map(([k, v]) => [k, v ?? ""])) } : EMPTY);
  }, [open, item]);

  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v }));
  const setInput = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const isHeating = form.category === "Heating & boiler";

  const handleSubmit = async () => {
    if (!form.make.trim()) { toast.error("Item name / make is required"); return; }
    setSaving(true);
    try {
      const data = {
        property_id: propertyId,
        type: CATEGORY_TO_TYPE[form.category] || "Other",
        category: form.category,
        make: form.make.trim(),
        model: form.model.trim(),
        location: form.location.trim(),
        condition: form.condition || null,
        supplier: form.supplier.trim(),
        notes: form.notes.trim(),
        purchase_date: form.purchase_date || null,
        purchase_price: form.purchase_price === "" ? null : parseFloat(form.purchase_price),
        current_value: form.current_value === "" ? null : parseFloat(form.current_value),
        warranty_expiry: form.warranty_expiry || null,
        replacement_due: form.replacement_due || null,
        fuel_type: isHeating && form.fuel_type ? form.fuel_type : null,
        install_date: form.install_date || null,
        last_service_date: form.last_service_date || null,
        is_demo: false,
        source: "manual",
      };
      if (isEdit) {
        await base44.entities.Equipment.update(item.id, data);
        await logActivity(base44, { property_id: propertyId, event_type: "Property update", description: `Inventory updated: ${data.make} ${data.model}`.trim() });
        toast.success("Item updated");
      } else {
        await base44.entities.Equipment.create(data);
        await logActivity(base44, { property_id: propertyId, event_type: "Property update", description: `Inventory added: ${data.make} ${data.model}`.trim() });
        toast.success("Item added");
      }
      onSaved();
      onClose();
    } catch (e) {
      toast.error(isEdit ? "Failed to update item" : "Failed to add item");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{isEdit ? "Edit item" : "Add furniture / inventory item"}</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3 py-2">
          <div className="space-y-1.5"><Label>Category</Label><Select value={form.category} onValueChange={set("category")}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select></div>
          <div className="space-y-1.5"><Label>Condition</Label><Select value={form.condition} onValueChange={set("condition")}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{CONDITIONS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select></div>
          <div className="space-y-1.5"><Label>Name / make</Label><Input value={form.make} onChange={setInput("make")} placeholder="e.g. IKEA, Worcester Bosch" /></div>
          <div className="space-y-1.5"><Label>Model</Label><Input value={form.model} onChange={setInput("model")} placeholder="e.g. KIVIK 3-seat sofa" /></div>
          <div className="space-y-1.5"><Label>Location in property</Label><Input value={form.location} onChange={setInput("location")} placeholder="e.g. Living room" /></div>
          <div className="space-y-1.5"><Label>Supplier</Label><Input value={form.supplier} onChange={setInput("supplier")} /></div>
          <div className="space-y-1.5"><Label>Purchase date</Label><Input type="date" value={form.purchase_date} onChange={setInput("purchase_date")} /></div>
          <div className="space-y-1.5"><Label>Purchase price (£)</Label><Input type="number" value={form.purchase_price} onChange={setInput("purchase_price")} /></div>
          <div className="space-y-1.5"><Label>Current value (£)</Label><Input type="number" value={form.current_value} onChange={setInput("current_value")} /></div>
          <div className="space-y-1.5"><Label>Warranty expiry</Label><Input type="date" value={form.warranty_expiry} onChange={setInput("warranty_expiry")} /></div>
          <div className="space-y-1.5"><Label>Replacement due</Label><Input type="date" value={form.replacement_due} onChange={setInput("replacement_due")} /></div>
          {isHeating && (
            <>
              <div className="space-y-1.5"><Label>Fuel type</Label><Select value={form.fuel_type || ""} onValueChange={set("fuel_type")}><SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger><SelectContent>{["Gas", "Electric", "Oil", "LPG", "Heat pump", "Other"].map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}</SelectContent></Select></div>
              <div className="space-y-1.5"><Label>Install date</Label><Input type="date" value={form.install_date} onChange={setInput("install_date")} /></div>
              <div className="space-y-1.5"><Label>Last service</Label><Input type="date" value={form.last_service_date} onChange={setInput("last_service_date")} /></div>
            </>
          )}
          <div className="col-span-2 space-y-1.5"><Label>Notes</Label><Textarea rows={2} value={form.notes} onChange={setInput("notes")} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={saving}>{isEdit ? "Save changes" : "Add item"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
