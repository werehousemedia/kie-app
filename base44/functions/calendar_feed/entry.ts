// ICS calendar feed of all derived property events. Subscribe in Google Calendar:
// Other calendars → From URL → https://kie-app.base44.app/functions/calendar_feed?key=<sync_secret>
// Auth: ICS subscriptions can't send headers, so the key rides in the URL; it is the
// same sync_secret stored on the default ImportTemplate. Returns text/calendar.
import { createClientFromRequest } from "npm:@base44/sdk@0.8.40";

function icsEscape(s: string): string {
  return String(s ?? "").replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}
function icsDate(d: string): string {
  return d.slice(0, 10).replace(/-/g, "");
}
function nextDay(d: string): string {
  const dt = new Date(d.slice(0, 10) + "T00:00:00Z");
  dt.setUTCDate(dt.getUTCDate() + 1);
  return dt.toISOString().slice(0, 10).replace(/-/g, "");
}

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const url = new URL(req.url);
    const key = url.searchParams.get("key") || "";

    const templates = await base44.asServiceRole.entities.ImportTemplate.filter({ is_default: true });
    const template = templates[0];
    if (!template?.sync_secret || key !== template.sync_secret) {
      return new Response("Not found", { status: 404 }); // don't advertise the endpoint
    }

    const db = base44.asServiceRole.entities;
    const notDemo = { is_demo: { $ne: true } };
    const [properties, tenants, tenancies, bills, tickets, compliance, equipment] = await Promise.all([
      db.Property.filter(notDemo), db.Tenant.filter(notDemo), db.Tenancy.filter(notDemo),
      db.Bill.filter(notDemo), db.MaintenanceTicket.filter(notDemo),
      db.ComplianceRecord.filter(notDemo), db.Equipment.filter(notDemo),
    ]);
    const propName = (id: string) => properties.find((p: any) => p.id === id)?.name || "";
    const gbp = (n: number) => `£${Math.round(n || 0).toLocaleString("en-GB")}`;

    type Ev = { uid: string; date: string; title: string; desc: string };
    const events: Ev[] = [];

    for (const b of bills) {
      if (!b.due_date) continue;
      events.push({
        uid: `bill-${b.id}`, date: b.due_date,
        title: `${b.category} ${b.category === "Rent" ? "due" : "bill"} — ${gbp(b.amount)} — ${propName(b.property_id)}`,
        desc: `Status: ${b.status}`,
      });
    }
    for (const t of tickets) {
      if (!t.appointment_date || t.status === "Complete" || t.status === "Cancelled") continue;
      events.push({
        uid: `ticket-${t.id}`, date: t.appointment_date,
        title: `Maintenance visit — ${propName(t.property_id)}`,
        desc: String(t.description || ""),
      });
    }
    for (const c of compliance) {
      if (!c.expiry_date) continue;
      events.push({
        uid: `comp-${c.id}`, date: c.expiry_date,
        title: `${c.category} expires — ${propName(c.property_id)}`,
        desc: c.provider ? `Provider: ${c.provider}` : "",
      });
    }
    for (const e of equipment) {
      const item = [e.make, e.model].filter(Boolean).join(" ") || e.type;
      if (e.next_service_due) events.push({ uid: `svc-${e.id}`, date: e.next_service_due, title: `${item} service due — ${propName(e.property_id)}`, desc: "" });
      if (e.warranty_expiry) events.push({ uid: `war-${e.id}`, date: e.warranty_expiry, title: `${item} warranty expires — ${propName(e.property_id)}`, desc: "" });
    }
    for (const ty of tenancies) {
      const who = tenants.find((t: any) => t.id === ty.tenant_id)?.name || "Tenant";
      if (ty.start_date) events.push({ uid: `tys-${ty.id}`, date: ty.start_date, title: `${who} moves in — ${propName(ty.property_id)}`, desc: `Rent ${gbp(ty.rent_amount)}/mo` });
      if (ty.end_date) events.push({ uid: `tye-${ty.id}`, date: ty.end_date, title: `${who} tenancy ends — ${propName(ty.property_id)}`, desc: "Renewal decision needed" });
    }

    const now = new Date().toISOString().replace(/[-:]/g, "").slice(0, 15) + "Z";
    const lines = [
      "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//KIE Property//Calendar Feed//EN",
      "X-WR-CALNAME:KIE Property", "X-WR-TIMEZONE:Europe/London",
    ];
    for (const ev of events) {
      lines.push(
        "BEGIN:VEVENT",
        `UID:${ev.uid}@kie-app.base44.app`,
        `DTSTAMP:${now}`,
        `DTSTART;VALUE=DATE:${icsDate(ev.date)}`,
        `DTEND;VALUE=DATE:${nextDay(ev.date)}`,
        `SUMMARY:${icsEscape(ev.title)}`,
        ...(ev.desc ? [`DESCRIPTION:${icsEscape(ev.desc)}`] : []),
        "END:VEVENT",
      );
    }
    lines.push("END:VCALENDAR");
    return new Response(lines.join("\r\n"), {
      headers: { "Content-Type": "text/calendar; charset=utf-8", "Cache-Control": "no-cache" },
    });
  } catch (_e) {
    return new Response("Error", { status: 500 });
  }
}
