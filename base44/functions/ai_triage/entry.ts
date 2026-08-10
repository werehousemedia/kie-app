import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { message, propertyName, propertyAddress, equipment, tenantName, recentIssues } = body;

    if (!message) return Response.json({ error: 'Message is required' }, { status: 400 });

    const equipmentSummary = (equipment || [])
      .map((e) => `${e.type}: ${e.make || ''} ${e.model || ''} (last serviced ${e.last_service_date || 'unknown'})`)
      .join('; ');

    const prompt = `You are an AI property management assistant for a UK landlord. A tenant has sent a WhatsApp message. Analyse it and provide operational triage guidance.

Tenant: ${tenantName || 'Unknown'}
Property: ${propertyName || 'Unknown'}, ${propertyAddress || ''}
Equipment at property: ${equipmentSummary || 'No equipment registered'}
Recent issues at this property: ${(recentIssues || []).join(', ') || 'None'}

Tenant message: "${message}"

Respond as JSON with this exact schema:
{
  "issue_type": "plumbing|heating|electricity|rent query|compliance|general|noise|security",
  "urgency": "low|medium|high|emergency",
  "suggested_reply": "A short, professional reply to send to the tenant (2-3 sentences, friendly but clear)",
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

    return Response.json({ triage: result });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}