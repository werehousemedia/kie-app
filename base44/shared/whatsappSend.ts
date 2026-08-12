// Outbound WhatsApp delivery, shared by the inbound webhook (auto-replies)
// and send_whatsapp (landlord replies typed in the app).
//
// Channel model: ONE Meta Cloud API number serves every landlord workspace.
// Tenants message that number; the inbound pipeline routes by tenant phone to
// the right workspace. Credentials therefore belong to the app operator's
// workspace, not to each landlord — read them from there.
//
// Meta's rule: you may free-text a person only within 24h of THEIR last
// message (the "customer service window"). Outside it, only pre-approved
// templates deliver. sendWhatsApp surfaces that as a normal failure so the UI
// can fall back to a wa.me deep link rather than silently dropping the reply.

export const OPERATOR_WORKSPACE = "ws_kie_main";
const GRAPH_VERSION = "v21.0";

export type WaSettings = {
  wa_access_token?: string;
  wa_phone_number_id?: string;
  wa_verify_token?: string;
  wa_app_secret?: string;
};

export async function getWaSettings(db: any): Promise<WaSettings> {
  const rows = await db.AppSetting.filter({ workspace_id: OPERATOR_WORKSPACE });
  const out: Record<string, string> = {};
  for (const r of rows) out[r.key] = r.value || "";
  return out as WaSettings;
}

export function waConfigured(s: WaSettings): boolean {
  return !!(s.wa_access_token && s.wa_phone_number_id);
}

// International digits only, UK-aware. "07743 967238" → "447743967238".
export function toWaNumber(phone: string): string {
  let d = String(phone || "").replace(/[^0-9]/g, "");
  if (d.startsWith("00")) d = d.slice(2);
  if (d.startsWith("0")) d = "44" + d.slice(1);
  else if (d.length === 10 && d.startsWith("7")) d = "44" + d;
  return d;
}

export type SendResult = {
  ok: boolean;
  detail: string;
  /** true when the failure is "no channel configured" rather than a send error */
  notConfigured?: boolean;
};

export async function sendWhatsApp(
  settings: WaSettings,
  to: string,
  text: string,
): Promise<SendResult> {
  if (!waConfigured(settings)) {
    return {
      ok: false,
      notConfigured: true,
      detail: "WhatsApp channel not connected — message saved to the thread only.",
    };
  }
  const number = toWaNumber(to);
  if (!number) return { ok: false, detail: "No valid phone number for this recipient." };

  try {
    const res = await fetch(
      `https://graph.facebook.com/${GRAPH_VERSION}/${settings.wa_phone_number_id}/messages`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${settings.wa_access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: number,
          type: "text",
          text: { preview_url: false, body: String(text).slice(0, 4000) },
        }),
      },
    );
    const raw = await res.text();
    if (res.ok) return { ok: true, detail: "sent" };

    // Meta's 24h-window rejection is the one operators hit constantly — name it.
    let detail = raw.slice(0, 300);
    try {
      const err = JSON.parse(raw)?.error;
      if (err?.code === 131047 || /re-?engagement|24 hours/i.test(err?.message || "")) {
        detail = "Outside WhatsApp's 24-hour reply window — the tenant must message first, or use an approved template.";
      } else if (err?.message) {
        detail = err.message;
      }
    } catch { /* keep raw */ }
    return { ok: false, detail };
  } catch (e) {
    return { ok: false, detail: (e as Error).message };
  }
}
