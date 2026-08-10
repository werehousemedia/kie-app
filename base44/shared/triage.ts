// Shared AI triage for tenant messages — used by ai_triage (manual button)
// and handle_inbound_message (autonomous pipeline). Keep the schema in sync
// with the AITriage entity.

export interface TriageContext {
  message: string;
  tenantName?: string;
  propertyName?: string;
  propertyAddress?: string;
  equipment?: any[];
  recentIssues?: string[];
}

export interface TriageResult {
  issue_type: string;
  urgency: string;
  suggested_reply: string;
  troubleshooting: string;
  equipment_context?: string;
  recommended_action: string;
  create_ticket: boolean;
  suggest_contractor_trade?: string;
}

export async function runTriage(base44: any, ctx: TriageContext): Promise<TriageResult> {
  const equipmentSummary = (ctx.equipment || [])
    .map((e) => `${e.type}: ${e.make || ""} ${e.model || ""} (last serviced ${e.last_service_date || "unknown"})`)
    .join("; ");

  const prompt = `You are an AI property management assistant for a UK landlord. A tenant has sent a WhatsApp message. Analyse it and provide operational triage guidance.

Tenant: ${ctx.tenantName || "Unknown"}
Property: ${ctx.propertyName || "Unknown"}, ${ctx.propertyAddress || ""}
Equipment at property: ${equipmentSummary || "No equipment registered"}
Recent issues at this property: ${(ctx.recentIssues || []).join(", ") || "None"}

Tenant message: "${ctx.message}"

Respond as JSON with this exact schema:
{
  "issue_type": "plumbing|heating|electricity|rent query|compliance|general|noise|security",
  "urgency": "low|medium|high|emergency",
  "suggested_reply": "A short, professional reply to send to the tenant (2-3 sentences, friendly but clear). Start by thanking them for raising the issue.",
  "troubleshooting": "Safe initial troubleshooting questions or suggestions for the tenant (bullet points)",
  "equipment_context": "Relevant equipment info that relates to this issue, or 'No relevant equipment'",
  "recommended_action": "What the landlord/agent should do next (1-2 sentences)",
  "create_ticket": true/false,
  "suggest_contractor_trade": "Plumbing|Heating/Gas|Electrical|General|etc"
}

Rules:
- UK English, professional but warm tone.
- For any gas/boiler/heating issue with safety implications, set urgency to "emergency" and mention Gas Safe engineer.
- For rent queries, issue_type is "rent query" and create_ticket is false.
- Only suggest creating a maintenance ticket for actual physical issues.
- Keep suggested_reply concise and actionable.`;

  const result = await base44.asServiceRole.integrations.Core.InvokeLLM({
    prompt,
    response_json_schema: {
      type: "object",
      properties: {
        issue_type: { type: "string" },
        urgency: { type: "string" },
        suggested_reply: { type: "string" },
        troubleshooting: { type: "string" },
        equipment_context: { type: "string" },
        recommended_action: { type: "string" },
        create_ticket: { type: "boolean" },
        suggest_contractor_trade: { type: "string" },
      },
      required: ["issue_type", "urgency", "suggested_reply", "troubleshooting", "recommended_action", "create_ticket"],
    },
  });
  return result as TriageResult;
}

export function fallbackReply(tenantName?: string, propertyName?: string): string {
  const first = String(tenantName || "").split(" ")[0];
  return `Thanks for raising this${first ? `, ${first}` : ""} — we've logged your message${propertyName ? ` for ${propertyName}` : ""} and your landlord has been notified. We'll be in touch shortly.`;
}
