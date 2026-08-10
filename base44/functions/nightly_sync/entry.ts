// Nightly scheduled sync (see function.jsonc for the cron automation).
// Deliberately unauthenticated because the platform scheduler sends no
// credentials — so this endpoint returns NOTHING sensitive (no names,
// no counts) and rate-limits itself: it refuses to run more than once
// per 10 minutes. Full results go to IntegrationLog/ActivityEvent, and
// interactive syncs use sync_from_sheet instead.
import { createClientFromRequest } from "npm:@base44/sdk@0.8.40";
import { runImport } from "../../shared/importCore.ts";
import { fetchSheetTabs } from "../../shared/sheetFetch.ts";

const MIN_INTERVAL_MS = 10 * 60 * 1000;

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const templates = await base44.asServiceRole.entities.ImportTemplate.filter({ is_default: true });
    const template = templates[0];
    if (!template?.sheet_url) return Response.json({ ok: false });

    if (template.last_synced && Date.now() - new Date(template.last_synced).getTime() < MIN_INTERVAL_MS) {
      return Response.json({ ok: true, skipped: "recently synced" });
    }

    const fetched = await fetchSheetTabs(base44, template.sheet_url);
    if (fetched.error) {
      await base44.asServiceRole.entities.IntegrationLog.create({
        service: "Google Sheets",
        event: "Nightly sync",
        status: "failed",
        details: fetched.error.message,
        timestamp: new Date().toISOString(),
      });
      return Response.json({ ok: false });
    }

    await runImport(
      base44.asServiceRole.entities,
      fetched.tabs,
      { tabMappings: template.tab_mappings },
      { preview: false },
    );

    await base44.asServiceRole.entities.ImportTemplate.update(template.id, { last_synced: new Date().toISOString() });
    return Response.json({ ok: true });
  } catch (_error) {
    return Response.json({ ok: false });
  }
}

// redeploy: sheetFetch range fix e3d52c2
