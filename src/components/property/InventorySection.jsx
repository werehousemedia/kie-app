import React, { useMemo, useState } from "react";
import { formatGBP, formatDate, daysUntil } from "@/lib/kieUtils";
import { Plus, Sofa, Flame, Tv, Refrigerator, TreeDeciduous, Shield, Package, CookingPot } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import AddInventoryModal, { CATEGORIES } from "./AddInventoryModal";

const CATEGORY_ICONS = {
  "Heating & boiler": Flame,
  "Appliance": Refrigerator,
  "Furniture": Sofa,
  "Electronics": Tv,
  "Kitchen": CookingPot,
  "Garden": TreeDeciduous,
  "Safety & security": Shield,
  "Other": Package,
};

const CONDITION_COLORS = {
  "New": "bg-emerald-100 text-emerald-700",
  "Good": "bg-emerald-50 text-emerald-600",
  "Fair": "bg-amber-50 text-amber-700",
  "Worn": "bg-amber-100 text-amber-800",
  "Needs replacing": "bg-rose-100 text-rose-700",
};

function itemName(e) {
  return [e.make, e.model].filter(Boolean).join(" ") || e.type || "Item";
}

// Boiler-era records predate `category` — bucket them sensibly.
function itemCategory(e) {
  if (e.category) return e.category;
  if (e.type === "Boiler" || e.type === "Heating") return "Heating & boiler";
  if (e.type === "Appliance") return "Appliance";
  if (e.type === "Electrical") return "Electronics";
  if (e.type === "Security") return "Safety & security";
  if (e.type === "Furniture") return "Furniture";
  return "Other";
}

export default function InventorySection({ propertyId, equipment, reload }) {
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [selected, setSelected] = useState(null);

  const items = useMemo(() => equipment.filter((e) => e.property_id === propertyId), [equipment, propertyId]);
  const totalValue = items.reduce((s, e) => s + (e.current_value ?? e.purchase_price ?? 0), 0);
  const grouped = useMemo(() => {
    const g = new Map();
    for (const cat of CATEGORIES) g.set(cat, []);
    for (const item of items) g.get(itemCategory(item))?.push(item) ?? g.set(itemCategory(item), [item]);
    return [...g.entries()].filter(([, list]) => list.length > 0);
  }, [items]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-slate-500">
          {items.length} item{items.length === 1 ? "" : "s"}
          {totalValue > 0 && <> · est. value <span className="font-semibold text-slate-700">{formatGBP(totalValue)}</span></>}
        </p>
        <button onClick={() => { setEditing(null); setAddOpen(true); }} className="flex items-center gap-1.5 px-3 py-1.5 bg-[hsl(var(--navy))] text-white rounded-lg text-xs font-medium hover:bg-[hsl(var(--navy-light))]">
          <Plus className="w-3.5 h-3.5" /> Add item
        </button>
      </div>

      {items.length === 0 && (
        <div className="bg-slate-50 rounded-xl border border-dashed border-slate-200 p-8 text-center">
          <Sofa className="w-8 h-8 text-slate-300 mx-auto mb-2" />
          <p className="text-sm text-slate-500">No furniture or inventory recorded yet.</p>
          <p className="text-xs text-slate-400 mt-1">Add sofas, beds, appliances, boilers — anything that lives in this property.</p>
        </div>
      )}

      {grouped.map(([category, list]) => {
        const Icon = CATEGORY_ICONS[category] || Package;
        return (
          <div key={category}>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2 flex items-center gap-1.5"><Icon className="w-3.5 h-3.5" /> {category} ({list.length})</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {list.map((e) => {
                const serviceDays = e.next_service_due ? daysUntil(e.next_service_due) : null;
                const warrantyDays = e.warranty_expiry ? daysUntil(e.warranty_expiry) : null;
                return (
                  <button key={e.id} onClick={() => setSelected(e)} className="bg-white rounded-xl border border-slate-200 p-3.5 text-left hover:border-[hsl(var(--sage))] hover:shadow-sm transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--sage))]">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <p className="text-sm font-medium text-slate-800 truncate">{itemName(e)}</p>
                      {e.condition && <span className={`text-[11px] px-1.5 py-0.5 rounded-full shrink-0 ${CONDITION_COLORS[e.condition] || "bg-slate-100 text-slate-600"}`}>{e.condition}</span>}
                    </div>
                    <p className="text-xs text-slate-500">{e.location || "—"}{(e.current_value ?? e.purchase_price) != null && <> · {formatGBP(e.current_value ?? e.purchase_price)}</>}</p>
                    <div className="flex flex-wrap gap-1.5 mt-1.5">
                      {serviceDays !== null && serviceDays <= 60 && <span className={`text-[11px] px-1.5 py-0.5 rounded-full ${serviceDays < 0 ? "bg-rose-50 text-rose-700" : "bg-amber-50 text-amber-700"}`}>Service {serviceDays < 0 ? `${Math.abs(serviceDays)}d overdue` : `in ${serviceDays}d`}</span>}
                      {warrantyDays !== null && warrantyDays >= 0 && warrantyDays <= 90 && <span className="text-[11px] px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-600">Warranty ends in {warrantyDays}d</span>}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* Item detail drawer */}
      <Sheet open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <SheetContent className="overflow-y-auto sm:max-w-md">
          {selected && (
            <>
              <SheetHeader>
                <SheetTitle>{itemName(selected)}</SheetTitle>
              </SheetHeader>
              {selected.photo_url && <img src={selected.photo_url} alt={itemName(selected)} className="w-full rounded-lg mt-3 object-cover max-h-52" />}
              <div className="grid grid-cols-2 gap-x-4 gap-y-3 mt-4 text-sm">
                {[
                  ["Category", itemCategory(selected)],
                  ["Condition", selected.condition],
                  ["Location", selected.location],
                  ["Supplier", selected.supplier],
                  ["Purchase date", selected.purchase_date && formatDate(selected.purchase_date)],
                  ["Purchase price", selected.purchase_price != null && formatGBP(selected.purchase_price)],
                  ["Current value", selected.current_value != null && formatGBP(selected.current_value)],
                  ["Warranty expiry", selected.warranty_expiry && formatDate(selected.warranty_expiry)],
                  ["Replacement due", selected.replacement_due && formatDate(selected.replacement_due)],
                  ["Fuel type", selected.fuel_type],
                  ["Installed", selected.install_date && formatDate(selected.install_date)],
                  ["Last service", selected.last_service_date && formatDate(selected.last_service_date)],
                  ["Next service", selected.next_service_due && formatDate(selected.next_service_due)],
                ].filter(([, v]) => v).map(([label, value]) => (
                  <div key={label}><p className="text-xs text-slate-400">{label}</p><p className="font-medium text-slate-800">{value}</p></div>
                ))}
              </div>
              {selected.notes && <div className="mt-4"><p className="text-xs text-slate-400 mb-1">Notes</p><p className="text-sm text-slate-700">{selected.notes}</p></div>}
              {selected.receipt_url && <a href={selected.receipt_url} target="_blank" rel="noreferrer" className="inline-block mt-3 text-sm text-[hsl(var(--sage))] hover:underline">View receipt →</a>}
              <div className="mt-5">
                <Button variant="outline" size="sm" onClick={() => { setEditing(selected); setSelected(null); setAddOpen(true); }}>Edit item</Button>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      <AddInventoryModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onSaved={reload}
        propertyId={propertyId}
        item={editing}
      />
    </div>
  );
}
