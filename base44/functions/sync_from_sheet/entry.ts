// Re-run the sheet import from the saved default template. Called by the
// "Sync now" button (authenticated user) or an unattended scheduler sending
// the template's sync_secret in the X-Sync-Secret header.
import { createClientFromRequest } from "npm:@base44/sdk@0.8.40";
import { runImport } from "../../shared/importCore.ts";
import { fetchSheetTabs } from "../../shared/sheetFetch.ts";

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const templates = await base44.asServiceRole.entities.ImportTemplate.filter({ is_default: true });
    const template = templates[0];
    if (!template?.sheet_url) {
      return Response.json({ error: "No default sheet saved. Run the import wizard once and tick 'Save mapping & sheet'." }, { status: 400 });
    }

    const user = await base44.auth.me().catch(() => null);
    const secretOk = template.sync_secret && req.headers.get("X-Sync-Secret") === template.sync_secret;
    if (!user && !secretOk) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const fetched = await fetchSheetTabs(base44, template.sheet_url);
    if (fetched.error) {
      await base44.asServiceRole.entities.IntegrationLog.create({
        service: "Google Sheets",
        event: "Sync",
        status: "failed",
        details: fetched.error.message,
        timestamp: new Date().toISOString(),
      });
      return Response.json({ error: fetched.error.message }, { status: fetched.error.status });
    }

    const results = await runImport(
      base44.asServiceRole.entities,
      fetched.tabs,
      { tabMappings: template.tab_mappings },
      { preview: false },
    );

    const synced_at = new Date().toISOString();
    await base44.asServiceRole.entities.ImportTemplate.update(template.id, { last_synced: synced_at });
    return Response.json({ ...results, synced_at });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
