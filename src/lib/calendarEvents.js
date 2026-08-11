// Derive calendar events for a property from existing entities. No event
// table exists on purpose: every dot on the calendar IS a real record, so
// clicking through always lands on live data.

// Dot colours follow the kind-of-thing taxonomy (src/lib/kindTaxonomy.js):
// finance teal · maintenance blue · compliance violet · tenant cyan ·
// booking pink · contractor orange · property indigo · message lime.
// Status (overdue etc.) stays in the label text — never in the dot colour.
const KIND_META = {
  rent: { label: "Rent", dot: "bg-teal-500", hex: "#14b8a6" },
  bill: { label: "Bills", dot: "bg-teal-500", hex: "#14b8a6" },
  maintenance: { label: "Maintenance", dot: "bg-blue-500", hex: "#3b82f6" },
  service: { label: "Service due", dot: "bg-blue-500", hex: "#3b82f6" },
  warranty: { label: "Warranty", dot: "bg-blue-500", hex: "#3b82f6" },
  compliance: { label: "Compliance", dot: "bg-violet-500", hex: "#8b5cf6" },
  tenancy: { label: "Tenancy", dot: "bg-cyan-500", hex: "#06b6d4" },
  booking: { label: "Short let", dot: "bg-pink-500", hex: "#ec4899" },
  contractor: { label: "Contractor", dot: "bg-orange-500", hex: "#f97316" },
  task: { label: "Task", dot: "bg-indigo-500", hex: "#6366f1" },
  message: { label: "Message", dot: "bg-lime-500", hex: "#84cc16" },
};

export { KIND_META };

export function buildPropertyEvents({ propertyId, bills = [], tickets = [], compliance = [], equipment = [], tenancies = [], tenants = [], properties = [], shortLets = [], tasks = [] }) {
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

  for (const b of forProp(shortLets)) {
    if (b.status === "Cancelled") continue;
    const guest = b.guest_name || "Guest";
    if (b.check_in) {
      events.push({
        id: `booking_in_${b.id}`,
        date: b.check_in.slice(0, 10),
        kind: "booking",
        label: `${guest} checks in (${b.platform || "Short let"})`,
        sub: propName(b.property_id),
        to: "/shortlets",
        sourceId: b.id,
      });
    }
    if (b.check_out) {
      events.push({
        id: `booking_out_${b.id}`,
        date: b.check_out.slice(0, 10),
        kind: "booking",
        label: `${guest} checks out — turnaround clean${b.cleaning_ticket_id ? " booked" : " NEEDED"}`,
        sub: propName(b.property_id),
        to: "/shortlets",
        sourceId: b.id,
      });
    }
  }

  // Tasks: only manual / page-created ones. Auto-derived tasks mirror records
  // that already have their own dot above (ticket appointments, compliance
  // expiries, rent bills) — plotting both would double every date.
  for (const t of forProp(tasks)) {
    if (!t.due_date || t.status === "Done") continue;
    if (String(t.source || "manual").startsWith("auto:")) continue;
    const kindByCategory = {
      Maintenance: "maintenance", Compliance: "compliance", Rent: "rent",
      Contractor: "contractor", General: "task",
    };
    events.push({
      id: `task_${t.id}`,
      date: t.due_date.slice(0, 10),
      kind: kindByCategory[t.category] || "task",
      label: t.title || "Task",
      sub: propName(t.property_id),
      to: "/tasks",
      sourceId: t.id,
    });
  }

  return events.sort((a, b) => a.date.localeCompare(b.date));
}
