import { createClientFromRequest } from "npm:@base44/sdk@0.8.40";
import { runImport } from "../../shared/importCore.ts";
import { stampEntities, WS_FALLBACK } from "../../shared/workspace.ts";

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const { tabs, mapping, preview = false } = await req.json();
    if (!tabs || !mapping?.tabMappings) {
      return Response.json({ error: "Missing tabs or mapping." }, { status: 400 });
    }

    // Imported records belong to the importing user's workspace.
    const workspaceId = (user as any).workspace_id || (user as any).data?.workspace_id || WS_FALLBACK;
    const results = await runImport(stampEntities(base44.asServiceRole.entities, workspaceId), tabs, mapping, { preview });
    return Response.json(results);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

// redeploy: sheetFetch range fix e3d52c2
