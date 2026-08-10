// Derive calendar events for a property from existing entities. No event
// table exists on purpose: every dot on the calendar IS a real record, so
// clicking through always lands on live data.

const KIND_META = {
  rent: { label: "Rent", dot: "bg-emerald-500" },
  bill: { label: "Bills", dot: "bg-slate-400" },
  maintenance: { label: "Maintenance", dot: "bg-blue-500" },
  service: { label: "Service due", dot: "bg-amber-500" },
  warranty: { label: "Warranty", dot: "bg-amber-500" },
  compliance: { label: "Compliance", dot: "bg-rose-500" },
  tenancy: { label: "Tenancy", dot: "bg-[hsl(var(--navy))]" },
};

export { KIND_META };

export function buildPropertyEvents({ propertyId, bills = [], tickets = [], compliance = [], equipment = [], tenancies = [], tenants = [], properties = [] }) {
  const events = [];
  const forProp = (list) => (propertyId ? list.filter((x) => x.property_id === propertyId) : list);
  const propName = (id) => properties.find((p) => p.id === id)?.name;
  const gbp = (n) => `£${Math.round(n || 0).toLocaleString("en-GB")}`;

  for (const b of forProp(bills)) {
    if (!b.due_date) continue;
    const isRent = b.category === "Rent";
    events.push({
      id: `bill_${b.id}`,
      date: b.due_date.slice(0, 10),
      kind: isRent ? "rent" : "bill",
      label: `${b.category} — ${gbp(b.amount)}${b.status === "Overdue" ? " (overdue)" : ""}`,
      sub: propName(b.property_id),
      to: isRent ? "/finance?tab=rent" : "/finance?tab=bills",
      sourceId: b.id,
    });
  }

  for (const t of forProp(tickets)) {
    if (!t.appointment_date || t.status === "Complete" || t.status === "Cancelled") continue;
    events.push({
      id: `ticket_${t.id}`,
      date: t.appointment_date.slice(0, 10),
      kind: "maintenance",
      label: `${(t.description || "Maintenance visit").slice(0, 50)}`,
      sub: propName(t.property_id),
      to: "/maintenance?status=open",
      sourceId: t.id,
    });
  }

  for (const e of forProp(equipment)) {
    const itemName = [e.make, e.model].filter(Boolean).join(" ") || e.type;
    if (e.next_service_due) {
      events.push({
        id: `service_${e.id}`,
        date: e.next_service_due.slice(0, 10),
        kind: "service",
        label: `${itemName} service due`,
        sub: propName(e.property_id),
        to: e.property_id ? `/properties/${e.property_id}?tab=inventory` : "/properties",
        sourceId: e.id,
      });
    }
    if (e.warranty_expiry) {
      events.push({
        id: `warranty_${e.id}`,
        date: e.warranty_expiry.slice(0, 10),
        kind: "warranty",
        label: `${itemName} warranty expires`,
        sub: propName(e.property_id),
        to: e.property_id ? `/properties/${e.property_id}?tab=inventory` : "/properties",
        sourceId: e.id,
      });
    }
  }

  for (const c of forProp(compliance)) {
    if (!c.expiry_date) continue;
    events.push({
      id: `compliance_${c.id}`,
      date: c.expiry_date.slice(0, 10),
      kind: "compliance",
      label: `${c.category} expires`,
      sub: propName(c.property_id),
      to: "/compliance?status=expiring",
      sourceId: c.id,
    });
  }

  for (const ty of forProp(tenancies)) {
    const tenant = tenants.find((t) => t.id === ty.tenant_id);
    const who = tenant?.name || "Tenant";
    if (ty.start_date) {
      events.push({
        id: `tenancy_start_${ty.id}`,
        date: ty.start_date.slice(0, 10),
        kind: "tenancy",
        label: `${who} moves in`,
        sub: propName(ty.property_id),
        to: tenant ? `/tenants/${tenant.id}` : "/tenants",
        sourceId: ty.id,
      });
    }
    if (ty.end_date) {
      events.push({
        id: `tenancy_end_${ty.id}`,
        date: ty.end_date.slice(0, 10),
        kind: "tenancy",
        label: `${who} tenancy ends`,
        sub: propName(ty.property_id),
        to: tenant ? `/tenants/${tenant.id}` : "/tenants",
        sourceId: ty.id,
      });
    }
  }

  return events.sort((a, b) => a.date.localeCompare(b.date));
}
