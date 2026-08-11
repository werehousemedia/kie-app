import React, { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { logActivity } from "@/lib/kieUtils";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Upload, Loader2 } from "lucide-react";
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
  warranty_expiry: "", replacement_due: "", next_service_due: "", fuel_type: "",
  install_date: "", last_service_date: "", photo_url: "", receipt_url: "", notes: "",
};

// "" stays null; garbage never becomes NaN in a payload.
const numOrNull = (v) => {
  if (v === "" || v == null) return null;
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : null;
};

// YYYY-MM-DD + 12 months, formatted locally (no UTC drift).
function plus12Months(iso) {
  const d = new Date(`${iso}T00:00:00`);
  if (isNaN(d.getTime())) return "";
  d.setMonth(d.getMonth() + 12);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function UploadField({ label, value, uploading, accept, onSelect, onClear }) {
  const inputRef = useRef(null);
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onSelect(f); e.target.value = ""; }}
      />
      <div className="flex items-center gap-2 flex-wrap">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="inline-flex items-center gap-1.5 px-3 py-2 border bg-card hover:bg-muted text-foreground rounded-lg text-xs font-medium active:scale-[0.98] transition-all disabled:opacity-60"
        >
          {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
          {uploading ? "Uploading…" : value ? "Replace" : "Upload"}
        </button>
        {value && !uploading && (
          <>
            <a href={value} target="_blank" rel="noreferrer" className="text-xs text-[hsl(var(--sage))] hover:underline">View</a>
            <button type="button" onClick={onClear} className="text-xs text-muted-foreground hover:text-foreground" aria-label={`Remove ${label.toLowerCase()}`}>Remove</button>
          </>
        )}
      </div>
    </div>
  );
}

// Add OR edit an inventory item (pass `item` to edit).
export default function AddInventoryModal({ open, onClose, onSaved, propertyId, item }) {
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState({ photo: false, receipt: false });
  const isEdit = !!item;

  useEffect(() => {
    if (open) setForm(item ? { ...EMPTY, ...Object.fromEntries(Object.entries(item).filter(([k]) => k in EMPTY).map(([k, v]) => [k, v ?? ""])) } : EMPTY);
  }, [open, item]);

  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v }));
  const setInput = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const isHeating = form.category === "Heating & boiler";

  // Boilers: a recorded service implies the next one in 12 months. Only fills
  // when the field is empty — the user's own value always wins.
  const setLastService = (e) => {
    const v = e.target.value;
    setForm((f) => ({
      ...f,
      last_service_date: v,
      next_service_due: f.next_service_due || (f.category === "Heating & boiler" && v ? plus12Months(v) : f.next_service_due),
    }));
  };

  const upload = (field, key, label) => async (file) => {
    setUploading((u) => ({ ...u, [key]: true }));
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setForm((f) => ({ ...f, [field]: file_url }));
      toast.success(`${label} uploaded`);
    } catch (e) {
      toast.error(`${label} upload failed${e?.message ? `: ${e.message}` : ""}`);
    } finally {
      setUploading((u) => ({ ...u, [key]: false }));
    }
  };

  const busy = saving || uploading.photo || uploading.receipt;

  const handleSubmit = async () => {
    if (busy) return;
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
        purchase_price: numOrNull(form.purchase_price),
        current_value: numOrNull(form.current_value),
        warranty_expiry: form.warranty_expiry || null,
        replacement_due: form.replacement_due || null,
        next_service_due: form.next_service_due || null,
        fuel_type: isHeating && form.fuel_type ? form.fuel_type : null,
        install_date: form.install_date || null,
        last_service_date: form.last_service_date || null,
        photo_url: form.photo_url || null,
        receipt_url: form.receipt_url || null,
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
      toast.error(`${isEdit ? "Failed to update item" : "Failed to add item"}${e?.message ? `: ${e.message}` : ""}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{isEdit ? "Edit item" : "Add furniture / inventory item"}</DialogTitle></DialogHeader>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 py-2">
          <div className="space-y-1.5"><Label className="text-xs font-medium text-muted-foreground">Category</Label><Select value={form.category} onValueChange={set("category")}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select></div>
          <div className="space-y-1.5"><Label className="text-xs font-medium text-muted-foreground">Condition</Label><Select value={form.condition} onValueChange={set("condition")}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{CONDITIONS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select></div>
          <div className="space-y-1.5"><Label className="text-xs font-medium text-muted-foreground">Name / make</Label><Input value={form.make} onChange={setInput("make")} placeholder="e.g. IKEA, Worcester Bosch" /></div>
          <div className="space-y-1.5"><Label className="text-xs font-medium text-muted-foreground">Model</Label><Input value={form.model} onChange={setInput("model")} placeholder="e.g. KIVIK 3-seat sofa" /></div>
          <div className="space-y-1.5"><Label className="text-xs font-medium text-muted-foreground">Location in property</Label><Input value={form.location} onChange={setInput("location")} placeholder="e.g. Living room" /></div>
          <div className="space-y-1.5"><Label className="text-xs font-medium text-muted-foreground">Supplier</Label><Input value={form.supplier} onChange={setInput("supplier")} /></div>
          <div className="space-y-1.5"><Label className="text-xs font-medium text-muted-foreground">Purchase date</Label><Input type="date" value={form.purchase_date} onChange={setInput("purchase_date")} /></div>
          <div className="space-y-1.5"><Label className="text-xs font-medium text-muted-foreground">Purchase price (£)</Label><Input type="number" inputMode="decimal" value={form.purchase_price} onChange={setInput("purchase_price")} /></div>
          <div className="space-y-1.5"><Label className="text-xs font-medium text-muted-foreground">Current value (£)</Label><Input type="number" inputMode="decimal" value={form.current_value} onChange={setInput("current_value")} /></div>
          <div className="space-y-1.5"><Label className="text-xs font-medium text-muted-foreground">Warranty expiry</Label><Input type="date" value={form.warranty_expiry} onChange={setInput("warranty_expiry")} /></div>
          <div className="space-y-1.5"><Label className="text-xs font-medium text-muted-foreground">Replacement due</Label><Input type="date" value={form.replacement_due} onChange={setInput("replacement_due")} /></div>
          <div className="space-y-1.5"><Label className="text-xs font-medium text-muted-foreground">Next service due</Label><Input type="date" value={form.next_service_due} onChange={setInput("next_service_due")} /></div>
          {isHeating && (
            <>
              <div className="space-y-1.5"><Label className="text-xs font-medium text-muted-foreground">Fuel type</Label><Select value={form.fuel_type || ""} onValueChange={set("fuel_type")}><SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger><SelectContent>{["Gas", "Electric", "Oil", "LPG", "Heat pump", "Other"].map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}</SelectContent></Select></div>
              <div className="space-y-1.5"><Label className="text-xs font-medium text-muted-foreground">Install date</Label><Input type="date" value={form.install_date} onChange={setInput("install_date")} /></div>
              <div className="space-y-1.5"><Label className="text-xs font-medium text-muted-foreground">Last service</Label><Input type="date" value={form.last_service_date} onChange={setLastService} /></div>
            </>
          )}
          <UploadField label="Photo" value={form.photo_url} uploading={uploading.photo} accept="image/*" onSelect={upload("photo_url", "photo", "Photo")} onClear={() => setForm((f) => ({ ...f, photo_url: "" }))} />
          <UploadField label="Receipt" value={form.receipt_url} uploading={uploading.receipt} accept="image/*,.pdf" onSelect={upload("receipt_url", "receipt", "Receipt")} onClear={() => setForm((f) => ({ ...f, receipt_url: "" }))} />
          <div className="sm:col-span-2 space-y-1.5"><Label className="text-xs font-medium text-muted-foreground">Notes</Label><Textarea rows={2} value={form.notes} onChange={setInput("notes")} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={busy}>{saving ? "Saving…" : isEdit ? "Save changes" : "Add item"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
