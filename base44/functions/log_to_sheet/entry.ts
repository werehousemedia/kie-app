// Manual "Log to Sheet" from the WhatsApp console: appends the selected
// conversation's latest tenant message + triage to the communications log.
import { createClientFromRequest } from "npm:@base44/sdk@0.8.40";
import { appendCommsRow } from "../../shared/commsLog.ts";
import { stampEntities, WS_FALLBACK } from "../../shared/workspace.ts";

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const { conversation_id } = await req.json();
    if (!conversation_id) return Response.json({ error: "conversation_id required" }, { status: 400 });

    const db = stampEntities(base44.asServiceRole.entities, WS_FALLBACK);
    const [convs, messages, triages] = await Promise.all([
      db.Conversation.filter({ id: conversation_id }),
      db.Message.filter({ conversation_id }),
      db.AITriage.filter({ conversation_id }),
    ]);
    const conversation = convs[0];
    if (!conversation) return Response.json({ error: "Conversation not found" }, { status: 404 });

    const [tenants, properties] = await Promise.all([
      db.Tenant.filter({ id: conversation.tenant_id }),
      db.Property.filter({ id: conversation.property_id }),
    ]);
    const tenant = tenants[0];
    const property = properties[0];
    const lastTenantMsg = messages
      .filter((m: any) => m.sender === "tenant")
      .sort((a: any, b: any) => String(b.timestamp || "").localeCompare(String(a.timestamp || "")))[0];
    const latestTriage = triages
      .sort((a: any, b: any) => String(b.created_at || "").localeCompare(String(a.created_at || "")))[0];

    const sheet = await appendCommsRow(base44, db, [
      new Date().toISOString(),
      tenant?.name || "Unknown",
      [property?.address, property?.postcode].filter(Boolean).join(", "),
      (lastTenantMsg?.content || "").slice(0, 300),
      latestTriage?.issue_type || "unknown",
      latestTriage?.urgency || "unknown",
      latestTriage ? `Manually logged; recommended: ${latestTriage.recommended_action || "—"}` : "Manually logged (no triage)",
      latestTriage?.maintenance_ticket_id || "",
      conversation.id,
    ]);

    await db.IntegrationLog.create({
      service: "Google Sheets",
      event: "Comms log append",
      status: sheet.ok ? "success" : "failed",
      details: sheet.ok ? `Manually logged conversation with ${tenant?.name}` : (sheet.error || "unknown error"),
      timestamp: new Date().toISOString(),
    });

    if (!sheet.ok) return Response.json({ error: sheet.error || "Sheet append failed" }, { status: 502 });
    return Response.json({ ok: true, sheet_id: sheet.sheetId });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
