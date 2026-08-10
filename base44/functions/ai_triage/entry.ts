// Manual triage endpoint (the "AI Triage" button). The actual prompt/LLM
// call lives in shared/triage.ts, shared with handle_inbound_message.
import { createClientFromRequest } from "npm:@base44/sdk@0.8.40";
import { runTriage } from "../../shared/triage.ts";

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { message, propertyName, propertyAddress, equipment, tenantName, recentIssues } = body;
    if (!message) return Response.json({ error: "Message is required" }, { status: 400 });

    const triage = await runTriage(base44, { message, propertyName, propertyAddress, equipment, tenantName, recentIssues });
    return Response.json({ triage });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
