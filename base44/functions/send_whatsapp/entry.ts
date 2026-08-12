// Landlord-initiated outbound message: a reply typed in the app's Inbox, or a
// job dispatch to a contractor. Delivers over the Meta Cloud API when the
// channel is connected, and ALWAYS records what happened so the thread never
// lies about delivery — the UI falls back to a wa.me deep link when delivery
// isn't possible.
//
// Input: { conversation_id?, tenant_id?, contractor_id?, content, task_id? }
// Output: { delivered, detail, not_configured, wa_link, message_id }
import { createClientFromRequest } from "npm:@base44/sdk@0.8.40";
import { stampEntities, WS_FALLBACK } from "../../shared/workspace.ts";
import { getWaSettings, sendWhatsApp, toWaNumber } from "../../shared/whatsappSend.ts";

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const { conversation_id, tenant_id, contractor_id, content, task_id } = await req.json();
    if (!content || !String(content).trim()) {
      return Response.json({ error: "content is required" }, { status: 400 });
    }
    if (!conversation_id && !tenant_id && !contractor_id) {
      return Response.json({ error: "Provide conversation_id, tenant_id or contractor_id" }, { status: 400 });
    }

    const sr = base44.asServiceRole.entities;
    const workspace = (user as any).workspace_id || WS_FALLBACK;
    const db = stampEntities(sr, workspace);

    // --- Resolve the recipient, refusing anything outside the caller's workspace ---
    let recipient: any = null;
    let kind: "tenant" | "contractor" = "tenant";
    let conversation: any = null;

    if (conversation_id) {
      conversation = (await db.Conversation.filter({ id: conversation_id }))[0] || null;
      if (!conversation) return Response.json({ error: "Conversation not found" }, { status: 404 });
      recipient = (await db.Tenant.filter({ id: conversation.tenant_id }))[0] || null;
    } else if (tenant_id) {
      recipient = (await db.Tenant.filter({ id: tenant_id }))[0] || null;
    } else {
      kind = "contractor";
      recipient = (await db.Contractor.filter({ id: contractor_id }))[0] || null;
    }
    if (!recipient) return Response.json({ error: "Recipient not found" }, { status: 404 });

    const recipientWs = recipient.workspace_id || WS_FALLBACK;
    if (recipientWs !== workspace && (user as any).role !== "admin") {
      return Response.json({ error: "Recipient is outside your workspace" }, { status: 403 });
    }

    // --- Deliver ---
    const settings = await getWaSettings(sr);
    const sent = await sendWhatsApp(settings, recipient.phone, content);
    const now = new Date().toISOString();
    const waNumber = toWaNumber(recipient.phone);
    const wa_link = waNumber
      ? `https://wa.me/${waNumber}?text=${encodeURIComponent(String(content).slice(0, 1500))}`
      : null;

    // --- Record it (thread + evidence log) ---
    let messageId: string | null = null;
    if (kind === "tenant") {
      let convo = conversation;
      if (!convo) {
        const existing = await db.Conversation.filter({ tenant_id: recipient.id });
        convo = existing[0] || await db.Conversation.create({
          tenant_id: recipient.id,
          property_id: recipient.property_id,
          status: "Active",
          urgency: "low",
          unread_count: 0,
          channel: "WhatsApp",
          is_demo: !!recipient.is_demo,
        });
      }
      const msg = await db.Message.create({
        conversation_id: convo.id,
        sender: "landlord",
        content,
        timestamp: now,
        delivery: sent.ok ? "delivered" : (sent.notConfigured ? "logged" : "failed"),
        is_demo: !!recipient.is_demo,
      });
      messageId = msg.id;
      await db.Conversation.update(convo.id, {
        last_message: content,
        last_message_at: now,
        unread_count: 0,
      });
    }

    await db.ActivityEvent.create({
      property_id: kind === "tenant" ? recipient.property_id : (conversation?.property_id || undefined),
      tenant_id: kind === "tenant" ? recipient.id : undefined,
      event_type: kind === "tenant" ? "WhatsApp message" : "Contractor assigned",
      description: `${sent.ok ? "Sent" : "Drafted"} to ${recipient.name}: ${String(content).slice(0, 80)}`,
      related_id: task_id || messageId || undefined,
      timestamp: now,
      source: "app_reply",
    });

    if (!sent.ok && !sent.notConfigured) {
      await db.IntegrationLog.create({
        service: "WhatsApp",
        event: "Outbound send",
        status: "failed",
        details: `${recipient.name}: ${sent.detail}`,
        timestamp: now,
      });
    }

    return Response.json({
      delivered: sent.ok,
      not_configured: !!sent.notConfigured,
      detail: sent.detail,
      wa_link,
      message_id: messageId,
    });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
}
