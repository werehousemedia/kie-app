import { daysUntil } from "@/lib/kieUtils";

// Derive the notification list from live data — no notification table, every
// row IS a real record with a deep link, mirroring the calendarEvents design.
// Severity: critical (act today) > warning (act this month) > info (FYI).

const SEEN_KEY = "kie_notif_seen_v1";

function loadSeen() {
  try {
    return JSON.parse(localStorage.getItem(SEEN_KEY) || "{}");
  } catch {
    return {};
  }
}

export function buildNotifications({ compliance = [], tenants = [], tickets = [], conversations = [], bills = [], properties = [] }) {
  const items = [];
  const propName = (id) => properties.find((p) => p.id === id)?.name || "";

  for (const c of compliance) {
    if (!c.expiry_date) continue;
    const d = daysUntil(c.expiry_date);
    if (d == null) continue;
    if (d < 0) {
      items.push({
        id: `comp_over_${c.id}`, severity: "critical",
        title: `${c.category} expired`, sub: `${propName(c.property_id)} · ${Math.abs(d)}d overdue`,
        to: "/compliance?status=overdue", sortKey: d,
      });
    } else if (d <= 30) {
      items.push({
        id: `comp_soon_${c.id}`, severity: "warning",
        title: `${c.category} expires in ${d}d`, sub: propName(c.property_id),
        to: "/compliance?status=expiring", sortKey: d,
      });
    }
  }

  for (const t of tenants) {
    if (t.payment_status === "Overdue") {
      items.push({
        id: `rent_${t.id}`, severity: "critical",
        title: `Rent overdue — ${t.name}`, sub: propName(t.property_id),
        to: `/tenants/${t.id}`, sortKey: -100,
      });
    }
  }

  for (const t of tickets) {
    const open = t.status !== "Complete" && t.status !== "Cancelled";
    if (!open) continue;
    if (t.urgency === "emergency" || t.urgency === "high") {
      items.push({
        id: `ticket_${t.id}`, severity: t.urgency === "emergency" ? "critical" : "warning",
        title: `${t.urgency === "emergency" ? "Emergency" : "Urgent"}: ${(t.description || "maintenance issue").slice(0, 60)}`,
        sub: propName(t.property_id),
        to: `/maintenance?ticket=${t.id}`, sortKey: t.urgency === "emergency" ? -90 : -20,
      });
    } else if (t.status === "Awaiting landlord approval") {
      items.push({
        id: `approve_${t.id}`, severity: "warning",
        title: `Approval needed: ${(t.description || "maintenance job").slice(0, 60)}`,
        sub: propName(t.property_id),
        to: `/maintenance?ticket=${t.id}`, sortKey: -10,
      });
    }
  }

  for (const c of conversations) {
    if ((c.unread_count || 0) > 0) {
      const tenant = tenants.find((t) => t.id === c.tenant_id);
      items.push({
        id: `conv_${c.id}_${c.last_message_at || ""}`, severity: c.urgency === "emergency" || c.urgency === "high" ? "warning" : "info",
        title: `${c.unread_count} unread — ${tenant?.name || "Tenant"}`,
        sub: (c.last_message || "").slice(0, 70),
        to: `/whatsapp?conversation=${c.id}`, sortKey: 0,
      });
    }
  }

  for (const b of bills) {
    if (b.status === "Overdue") {
      items.push({
        id: `bill_${b.id}`, severity: "warning",
        title: `${b.category} bill overdue — £${Math.round(b.amount || 0).toLocaleString("en-GB")}`,
        sub: propName(b.property_id),
        to: b.category === "Rent" ? "/finance?tab=rent&status=Overdue" : "/finance?tab=bills&status=Overdue",
        sortKey: -5,
      });
    }
  }

  const order = { critical: 0, warning: 1, info: 2 };
  items.sort((a, b) => order[a.severity] - order[b.severity] || a.sortKey - b.sortKey);
  return items;
}

export function unseenCount(items) {
  const seen = loadSeen();
  return items.filter((i) => !seen[i.id]).length;
}

export function markAllSeen(items) {
  const seen = loadSeen();
  const now = Date.now();
  for (const i of items) seen[i.id] = now;
  // Prune entries no longer derivable so the store can't grow unbounded.
  const live = new Set(items.map((i) => i.id));
  for (const k of Object.keys(seen)) {
    if (!live.has(k) && now - seen[k] > 1000 * 60 * 60 * 24 * 30) delete seen[k];
  }
  try {
    localStorage.setItem(SEEN_KEY, JSON.stringify(seen));
  } catch {
    /* storage full/blocked — badge just stays, harmless */
  }
}