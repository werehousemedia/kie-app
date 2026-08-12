// Meta WhatsApp Cloud API webhook for the KIE Property assistant.
//   GET  → subscription verification (hub.challenge echo)
//   POST → inbound messages: run the autonomous pipeline (via the already-live
//          handle_inbound_message function) and send the AI reply back to the
//          tenant through the Graph API.
// Config lives in AppSetting rows:
//   wa_verify_token     — webhook verification token (paste into Meta)
//   wa_access_token     — permanent Graph API token (from Meta Business)
//   wa_phone_number_id  — the Cloud API phone number id for +44 7743 967238
//   wa_app_secret       — optional; enables X-Hub-Signature-256 validation
// Always answers POSTs with 200 quickly — Meta disables webhooks that error.
import { createClientFromRequest } from "npm:@base44/sdk@0.8.40";
import { stampEntities, WS_FALLBACK } from "../../shared/workspace.ts";
import { getWaSettings, sendWhatsApp } from "../../shared/whatsappSend.ts";

const PIPELINE_URL = "https://kie-app.base44.app/functions/handle_inbound_message";

// Credentials belong to the app operator's workspace: one number serves every
// landlord, and the pipeline routes each message to the right one by tenant
// phone. Scoping the read prevents another workspace's AppSetting rows from
// shadowing the real channel config.
const getSettings = getWaSettings;

async function validSignature(req: Request, body: string, appSecret: string): Promise<boolean> {
  const header = req.headers.get("x-hub-signature-256") || "";
  if (!header.startsWith("sha256=")) return false;
  const key = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(appSecret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
  const hex = [...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, "0")).join("");
  return header.slice(7) === hex;
}

export default async function(req: Request): Promise<Response> {
  const base44 = createClientFromRequest(req);
  const db = stampEntities(base44.asServiceRole.entities, WS_FALLBACK);

  // --- Meta subscription verification ---
  if (req.method === "GET") {
    const url = new URL(req.url);
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge") || "";
    const settings = await getSettings(db).catch(() => ({} as Record<string, string>));
    if (mode === "subscribe" && token && token === settings.wa_verify_token) {
      return new Response(challenge, { status: 200, headers: { "Content-Type": "text/plain" } });
    }
    return new Response("Forbidden", { status: 403 });
  }

  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  try {
    const body = await req.text();
    const settings = await getSettings(db);

    if (settings.wa_app_secret) {
      const ok = await validSignature(req, body, settings.wa_app_secret).catch(() => false);
      if (!ok) return new Response("Bad signature", { status: 401 });
    }

    const payload = JSON.parse(body);
    const templates = await db.ImportTemplate.filter({ is_default: true });
    const syncSecret = templates[0]?.sync_secret || "";

    const results: any[] = [];
    for (const entry of payload.entry || []) {
      for (const change of entry.changes || []) {
        const value = change.value || {};
        for (const msg of value.messages || []) {
          if (msg.type !== "text" || !msg.text?.body) {
            results.push({ from: msg.from, skipped: `unsupported type ${msg.type}` });
            continue;
          }
          const from = String(msg.from || ""); // e.g. "447743111222"
          const pipelineRes = await fetch(PIPELINE_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json", "X-Sync-Secret": syncSecret },
            body: JSON.stringify({ phone: from, content: msg.text.body }),
          });
          const pipeline = await pipelineRes.json().catch(() => ({}));

          if (pipelineRes.ok && pipeline.reply) {
            const sent = await sendWhatsApp(settings, from, pipeline.reply);
            results.push({ from, handled: true, ticket: pipeline.ticket_id, reply_sent: sent.ok, send_detail: sent.detail });
            if (!sent.ok) {
              await db.IntegrationLog.create({
                service: "WhatsApp",
                event: "Reply send",
                status: "failed",
                details: sent.detail,
                timestamp: new Date().toISOString(),
              });
            }
          } else {
            // Unknown numbers must not error the webhook — log and move on.
            results.push({ from, handled: false, reason: pipeline.error || `pipeline ${pipelineRes.status}` });
            await db.IntegrationLog.create({
              service: "WhatsApp",
              event: "Inbound message",
              status: "failed",
              details: `From ${from}: ${pipeline.error || pipelineRes.status}`,
              timestamp: new Date().toISOString(),
            });
          }
        }
      }
    }
    return Response.json({ ok: true, results });
  } catch (error) {
    // Still 200: Meta retries aggressively and disables noisy webhooks.
    return Response.json({ ok: false, error: error.message });
  }
}
