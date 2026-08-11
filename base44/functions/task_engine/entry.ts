// Unified Task engine — derives open Tasks from live entity state so the
// Open Tasks page and Calendar always reflect reality. Idempotent: every
// auto-created task carries a source_key and the engine never duplicates one.
// It also auto-completes tasks whose source record has been resolved.
//
// Runs daily via the cron automation (see function.jsonc), and is invoked
// fire-and-forget from the UI after events that should surface immediately
// (e.g. a maintenance ticket being created). Like nightly_sync it accepts
// unauthenticated calls from the platform scheduler, so it returns nothing
// sensitive (counts only) and rate-limits itself.
import { createClientFromRequest } from "npm:@base44/sdk@0.8.40";

const MIN_INTERVAL_MS = 5 * 60 * 1000;
const STALE_ENQUIRY_DAYS = 7;
const COMPLIANCE_WINDOW_DAYS = 30;
const DAY_MS = 86400000;

type Rec = Record<string, any>;

function daysUntil(dateStr?: string | null): number | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  return Math.ceil((d.getTime() - Date.now()) / DAY_MS);
}

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const db = base44.asServiceRole.entities;

    const force = new URL(req.url).searchParams.get("force") === "1";
    const settings: Rec[] = await db.AppSetting.filter({ key: "task_engine_last_run" });
    const lastRunSetting = settings[0];
    if (
      !force &&
      lastRunSetting?.value &&
      Date.now() - new Date(lastRunSetting.value).getTime() < MIN_INTERVAL_MS
    ) {
      return Response.json({ ok: true, skipped: "ran recently" });
    }

    const [tasks, tickets, compliance, bills, conversations, messages, properties, tenancies] =
      (await Promise.all([
        db.Task.list("-created_date", 500),
        db.MaintenanceTicket.list("-created_date", 500),
        db.ComplianceRecord.list("-expiry_date", 500),
        db.Bill.list("-due_date", 500),
        db.Conversation.list("-last_message_at", 200),
        db.Message.list("-timestamp", 1000),
        db.Property.list(),
        db.Tenancy.list(),
      ])) as Rec[][];

    const propName = (id?: string) => properties.find((p) => p.id === id)?.name || "property";
    const tenantForProperty = (propertyId?: string) =>
      tenancies.find(
        (t) => t.property_id === propertyId && (t.status === "Active" || t.status === "Periodic")
      )?.tenant_id;

    const existingByKey = new Map<string, Rec>();
    for (const t of tasks) if (t.source_key) existingByKey.set(t.source_key, t);

    // ---- Desired auto-tasks from current state --------------------------------
    const desired: Rec[] = [];

    // 1. Open maintenance tickets
    for (const t of tickets) {
      if (t.status === "Complete" || t.status === "Cancelled") continue;
      if (!t.property_id) continue;
      desired.push({
        source_key: `maintenance:${t.id}`,
        title: (t.description || "Maintenance job").slice(0, 90),
        category: "Maintenance",
        urgency: t.urgency || "medium",
        status: "Open",
        due_date: t.appointment_date ? t.appointment_date.slice(0, 10) : undefined,
        property_id: t.property_id,
        tenant_id: t.tenant_id || undefined,
        contractor_id: t.contractor_id || undefined,
        source: "auto:maintenance",
        source_type: "MaintenanceTicket",
        source_id: t.id,
        is_demo: !!t.is_demo,
      });
    }

    // 2. Compliance overdue / expiring within 30 days
    for (const c of compliance) {
      const d = daysUntil(c.expiry_date);
      if (d == null || d > COMPLIANCE_WINDOW_DAYS || !c.property_id) continue;
      const overdue = d < 0;
      desired.push({
        source_key: `compliance:${c.id}:${(c.expiry_date || "").slice(0, 10)}`,
        title: `Book ${c.category} — ${propName(c.property_id)}`,
        category: "Compliance",
        urgency: overdue ? (c.category === "Gas Safety Certificate" ? "emergency" : "high") : "medium",
        status: "Open",
        due_date: (c.expiry_date || "").slice(0, 10) || undefined,
        property_id: c.property_id,
        source: "auto:compliance",
        source_type: "ComplianceRecord",
        source_id: c.id,
        is_demo: !!c.is_demo,
      });
    }

    // 3. Overdue rent
    for (const b of bills) {
      if (b.category !== "Rent" || !b.property_id) continue;
      const d = daysUntil(b.due_date);
      const overdue = b.status === "Overdue" || (b.status !== "Paid" && d != null && d < 0);
      if (!overdue) continue;
      desired.push({
        source_key: `rent:${b.id}`,
        title: `Chase overdue rent — ${propName(b.property_id)} (£${Math.round(b.amount || 0)})`,
        category: "Rent",
        urgency: "high",
        status: "Open",
        due_date: (b.due_date || "").slice(0, 10) || undefined,
        property_id: b.property_id,
        tenant_id: tenantForProperty(b.property_id),
        source: "auto:rent",
        source_type: "Bill",
        source_id: b.id,
        is_demo: !!b.is_demo,
      });
    }

    // 4. Medium-urgency WhatsApp enquiries with no landlord reply for 7+ days.
    //    "Reply" = a landlord or sent-AI message after the tenant's last one.
    for (const c of conversations) {
      if (c.urgency !== "medium") continue;
      if (c.status !== "Active" && c.status !== "Awaiting reply") continue;
      if (!c.property_id) continue;
      const convMsgs = messages.filter((m) => m.conversation_id === c.id);
      const lastTenant = convMsgs
        .filter((m) => m.sender === "tenant")
        .map((m) => m.timestamp)
        .sort()
        .pop();
      const lastReply = convMsgs
        .filter((m) => m.sender === "landlord" || m.sender === "ai")
        .map((m) => m.timestamp)
        .sort()
        .pop();
      let staleSince: string | undefined;
      if (lastTenant && (!lastReply || lastReply < lastTenant)) {
        staleSince = lastTenant;
      } else if (convMsgs.length === 0 && (c.unread_count || 0) > 0) {
        staleSince = c.last_message_at; // no Message rows — fall back to conversation metadata
      }
      if (!staleSince) continue;
      const staleDays = (Date.now() - new Date(staleSince).getTime()) / DAY_MS;
      if (isNaN(staleDays) || staleDays < STALE_ENQUIRY_DAYS) continue;
      desired.push({
        source_key: `enquiry:${c.id}:${String(staleSince).slice(0, 10)}`,
        title: `Follow-up needed — enquiry at ${propName(c.property_id)}`,
        description: (c.last_message || "").slice(0, 200),
        category: "General",
        urgency: "medium",
        status: "Open",
        property_id: c.property_id,
        tenant_id: c.tenant_id || undefined,
        source: "auto:enquiry",
        source_type: "Conversation",
        source_id: c.id,
        is_demo: !!c.is_demo,
      });
    }

    // ---- Create what's missing ------------------------------------------------
    let created = 0;
    for (const d of desired) {
      if (existingByKey.has(d.source_key)) continue; // respect existing (incl. manually completed)
      const clean: Rec = {};
      for (const [k, v] of Object.entries(d)) if (v !== undefined) clean[k] = v;
      const task = await db.Task.create(clean);
      created++;
      await db.ActivityEvent.create({
        property_id: d.property_id,
        tenant_id: d.tenant_id,
        event_type: "Task created",
        description: `Task created: ${d.title}`,
        severity: d.urgency === "high" || d.urgency === "emergency" ? "warning" : "info",
        related_id: task.id,
        timestamp: new Date().toISOString(),
        source: "task_engine",
        is_demo: !!d.is_demo,
      });
    }

    // ---- Auto-complete tasks whose source has been resolved -------------------
    const desiredKeys = new Set(desired.map((d) => d.source_key));
    let completed = 0;
    for (const t of tasks) {
      if (t.status === "Done" || !t.source_key || !String(t.source || "").startsWith("auto:")) continue;
      let resolved = false;
      if (t.source === "auto:maintenance") {
        const src = tickets.find((x) => x.id === t.source_id);
        resolved = !src || src.status === "Complete" || src.status === "Cancelled";
      } else if (t.source === "auto:compliance") {
        const src = compliance.find((x) => x.id === t.source_id);
        // Renewed (expiry moved => key no longer desired) or safely in date.
        resolved = !src || !desiredKeys.has(t.source_key);
      } else if (t.source === "auto:rent") {
        const src = bills.find((x) => x.id === t.source_id);
        resolved = !src || src.status === "Paid" || !desiredKeys.has(t.source_key);
      } else if (t.source === "auto:enquiry") {
        const src = conversations.find((x) => x.id === t.source_id);
        if (!src || src.status === "Resolved") {
          resolved = true;
        } else {
          const reply = messages
            .filter((m) => m.conversation_id === t.source_id && (m.sender === "landlord" || m.sender === "ai"))
            .map((m) => m.timestamp)
            .sort()
            .pop();
          resolved = !!reply && reply > (t.created_date || "");
        }
      }
      if (!resolved) continue;
      await db.Task.update(t.id, { status: "Done", completed_at: new Date().toISOString() });
      completed++;
      await db.ActivityEvent.create({
        property_id: t.property_id,
        event_type: "Task update",
        description: `Task auto-completed (source resolved): ${t.title}`,
        severity: "info",
        related_id: t.id,
        timestamp: new Date().toISOString(),
        source: "task_engine",
        is_demo: !!t.is_demo,
      });
    }

    const nowIso = new Date().toISOString();
    if (lastRunSetting) {
      await db.AppSetting.update(lastRunSetting.id, { value: nowIso });
    } else {
      await db.AppSetting.create({ key: "task_engine_last_run", value: nowIso });
    }

    return Response.json({ ok: true, created, completed });
  } catch (_error) {
    return Response.json({ ok: false });
  }
}
