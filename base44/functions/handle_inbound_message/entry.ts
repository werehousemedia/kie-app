// Autonomous inbound-message pipeline. One call does everything a human
// operator used to do by hand:
//   resolve tenant → upsert conversation → store message → AI triage
//   → auto-reply to the tenant → maintenance ticket when warranted
//   → append a row to the Google Sheets communications log.
// Called by the in-app "Test incoming message" flow today, and by a real
// WhatsApp provider webhook (Meta Cloud API / Twilio) tomorrow — the input
// shape {phone|tenant_id, content} is provider-agnostic on purpose.
// Auth: app user OR X-Sync-Secret header (for unattended webhook calls).
import { createClientFromRequest } from "npm:@base44/sdk@0.8.40";
import { runTriage, fallbackReply } from "../../shared/triage.ts";
import { appendCommsRow } from "../../shared/commsLog.ts";
import { normalizePhone } from "../../shared/importUtils.ts";
import { stampEntities, WS_FALLBACK } from "../../shared/workspace.ts";

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    let db = base44.asServiceRole.entities;

    const user = await base44.auth.me().catch(() => null);
    if (!user) {
      const templates = await db.ImportTemplate.filter({ is_default: true });
      const secretOk = templates[0]?.sync_secret && req.headers.get("X-Sync-Secret") === templates[0].sync_secret;
      if (!secretOk) return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { tenant_id, phone, content } = await req.json();
    if (!content || (!tenant_id && !phone)) {
      return Response.json({ error: "Provide content plus tenant_id or phone." }, { status: 400 });
    }

    // --- Resolve tenant + context ---
    // One inbound number serves every landlord, so the sender's phone is what
    // decides whose workspace this message lands in. Matching runs across all
    // workspaces by design (service role) — nothing else can route it.
    const tenants = await db.Tenant.filter({ is_demo: { $ne: true } });
    const demoTenants = tenant_id ? await db.Tenant.filter({ id: tenant_id }) : [];
    let tenant: any = null;
    let ambiguous: any[] = [];
    if (tenant_id) {
      tenant = tenants.find((t: any) => t.id === tenant_id) || demoTenants[0] || null;
    } else {
      const wanted = normalizePhone(phone);
      const matches = tenants.filter((t: any) => normalizePhone(t.phone) === wanted);
      if (matches.length > 1) {
        // Same number registered by two landlords: pick the most recently
        // updated tenancy and flag it rather than guessing silently.
        ambiguous = matches;
        matches.sort((a: any, b: any) =>
          String(b.updated_date || b.created_date || "").localeCompare(String(a.updated_date || a.created_date || "")));
      }
      tenant = matches[0] || null;
    }
    if (!tenant) return Response.json({ error: "Tenant not found." }, { status: 404 });

    // Everything this pipeline creates belongs to the tenant's workspace.
    db = stampEntities(db, (tenant as any).workspace_id || WS_FALLBACK);

    const [properties, equipment, tickets, units] = await Promise.all([
      db.Property.filter({ id: tenant.property_id }),
      db.Equipment.filter({ property_id: tenant.property_id }),
      db.MaintenanceTicket.filter({ property_id: tenant.property_id }),
      tenant.unit_id ? db.Unit.filter({ id: tenant.unit_id }) : Promise.resolve([]),
    ]);
    const property = properties[0] || null;
    const unit = units[0] || null;
    const now = new Date().toISOString();

    // --- Conversation + tenant message ---
    const existingConvs = await db.Conversation.filter({ tenant_id: tenant.id });
    let conversation = existingConvs[0];
    if (!conversation) {
      conversation = await db.Conversation.create({
        tenant_id: tenant.id,
        property_id: tenant.property_id,
        status: "Active",
        urgency: "medium",
        unread_count: 1,
        last_message: content,
        last_message_at: now,
        channel: "WhatsApp",
        is_demo: !!tenant.is_demo,
      });
    }
    const tenantMessage = await db.Message.create({
      conversation_id: conversation.id,
      sender: "tenant",
      content,
      timestamp: now,
      delivery: "received",
      is_demo: !!tenant.is_demo,
    });

    if (ambiguous.length > 1) {
      await db.IntegrationLog.create({
        service: "WhatsApp",
        event: "Ambiguous sender",
        status: "pending",
        details: `${phone} matches ${ambiguous.length} tenants across workspaces — routed to ${tenant.name}. Ask the other landlord to correct the number.`,
        timestamp: now,
      });
    }

    // --- AI triage (never let an LLM failure kill the pipeline) ---
    let triage: any = null;
    let triageError: string | null = null;
    try {
      triage = await runTriage(base44, {
        message: content,
        tenantName: tenant.name,
        propertyName: property?.name,
        propertyAddress: property?.address,
        equipment,
        recentIssues: tickets.filter((t: any) => t.status !== "Complete" && t.status !== "Cancelled").map((t: any) => t.description).slice(0, 3),
      });
    } catch (e) {
      triageError = e.message || "triage failed";
    }

    let triageRecord: any = null;
    if (triage) {
      triageRecord = await db.AITriage.create({
        message_id: tenantMessage.id,
        conversation_id: conversation.id,
        property_id: tenant.property_id,
        issue_type: triage.issue_type,
        urgency: triage.urgency,
        suggested_reply: triage.suggested_reply,
        troubleshooting: triage.troubleshooting,
        equipment_context: triage.equipment_context,
        recommended_action: triage.recommended_action,
        created_at: now,
      });
    }

    // --- Auto-reply to the tenant ---
    const replyText = triage?.suggested_reply || fallbackReply(tenant.name, property?.name);
    // The webhook delivers this over the Graph API and is the only caller that
    // knows whether it landed; "logged" is the honest default for test sends.
    await db.Message.create({
      conversation_id: conversation.id,
      sender: "ai",
      content: replyText,
      timestamp: new Date().toISOString(),
      ai_triage_id: triageRecord?.id,
      delivery: "logged",
      is_demo: !!tenant.is_demo,
    });

    // --- Auto-ticket for genuine high-urgency physical issues ---
    let ticket: any = null;
    if (triage?.create_ticket && (triage.urgency === "high" || triage.urgency === "emergency")) {
      const validIssue = ["plumbing", "heating", "electricity", "appliance", "structural", "general"];
      ticket = await db.MaintenanceTicket.create({
        property_id: tenant.property_id,
        tenant_id: tenant.id,
        conversation_id: conversation.id,
        ai_triage_id: triageRecord?.id,
        issue_type: validIssue.includes(triage.issue_type) ? triage.issue_type : "general",
        urgency: triage.urgency,
        status: "AI triage",
        description: `From WhatsApp: ${content.slice(0, 200)}`,
        is_demo: !!tenant.is_demo,
      });
      if (triageRecord) await db.AITriage.update(triageRecord.id, { maintenance_ticket_id: ticket.id });
    }

    // --- Conversation status reflects triage ---
    await db.Conversation.update(conversation.id, {
      last_message: replyText,
      last_message_at: new Date().toISOString(),
      unread_count: (conversation.unread_count || 0) + 1,
      urgency: triage?.urgency || conversation.urgency,
      status: triage?.urgency === "emergency" ? "Escalated" : "Awaiting reply",
    });

    // --- Communications log row (Google Sheet) ---
    const aiAction = [
      "Auto-replied to tenant",
      ticket ? `created ${triage.urgency}-urgency maintenance ticket` : null,
      triage?.recommended_action ? `recommended: ${triage.recommended_action}` : null,
      triageError ? `(AI triage unavailable: ${triageError})` : null,
    ].filter(Boolean).join("; ");
    const sheet = await appendCommsRow(base44, db, [
      now,
      tenant.name,
      [property?.address, property?.postcode].filter(Boolean).join(", ") + (unit ? ` (${unit.unit_label})` : ""),
      content.slice(0, 300),
      triage?.issue_type || "unknown",
      triage?.urgency || "unknown",
      aiAction,
      ticket ? ticket.id : "",
      conversation.id,
    ]).catch((e: any) => ({ ok: false, error: e.message }));

    // --- Activity + integration logs ---
    await db.ActivityEvent.create({
      tenant_id: tenant.id,
      property_id: tenant.property_id,
      event_type: "WhatsApp message",
      description: `Incoming WhatsApp from ${tenant.name}: ${content.slice(0, 80)}`,
      timestamp: now,
      is_demo: !!tenant.is_demo,
      source: "whatsapp_pipeline",
    });
    if (triage) {
      await db.ActivityEvent.create({
        tenant_id: tenant.id,
        property_id: tenant.property_id,
        event_type: "AI triage",
        description: `AI auto-handled ${triage.issue_type} (${triage.urgency}): replied${ticket ? " + ticket created" : ""}`,
        related_id: triageRecord?.id,
        severity: triage.urgency === "emergency" ? "critical" : triage.urgency === "high" ? "warning" : "info",
        timestamp: new Date().toISOString(),
        is_demo: !!tenant.is_demo,
        source: "whatsapp_pipeline",
      });
    }
    await db.IntegrationLog.create({
      service: "Google Sheets",
      event: "Comms log append",
      status: sheet.ok ? "success" : "failed",
      details: sheet.ok ? `Logged message from ${tenant.name}` : (sheet.error || "unknown error"),
      timestamp: new Date().toISOString(),
    });

    return Response.json({
      conversation_id: conversation.id,
      triage,
      triage_error: triageError,
      reply: replyText,
      ticket_id: ticket?.id || null,
      sheet_logged: !!sheet.ok,
      sheet_id: sheet.sheetId || null,
      sheet_error: sheet.ok ? null : sheet.error,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
