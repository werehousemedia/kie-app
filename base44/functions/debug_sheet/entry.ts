// Temporary diagnostic for sheet-fetch issues. Secret-protected via the
// default ImportTemplate's sync_secret. Remove once sync is proven.
import { createClientFromRequest } from "npm:@base44/sdk@0.8.40";

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const templates = await base44.asServiceRole.entities.ImportTemplate.filter({ is_default: true });
    const template = templates[0];
    if (!template || req.headers.get("X-Sync-Secret") !== template.sync_secret) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const match = String(template.sheet_url).match(/\/d\/([a-zA-Z0-9-_]+)/);
    const spreadsheetId = match?.[1];
    const conn = await base44.asServiceRole.connectors.getConnection("googlesheets");
    const accessToken = conn.accessToken;
    const out: any = { spreadsheetId, tokenPresent: !!accessToken };

    const metaRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets.properties.title`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    out.metaStatus = metaRes.status;
    const meta = await metaRes.json().catch(() => ({}));
    out.metaBody = metaRes.ok ? (meta.sheets || []).map((s: any) => s.properties.title) : meta;

    if (metaRes.ok) {
      const firstTab = (meta.sheets || [])[1]?.properties?.title || (meta.sheets || [])[0]?.properties?.title;
      out.probedTab = firstTab;
      out.ranges = {};
      for (const range of [`${firstTab}!A:Z5000`, `${firstTab}!A1:Z5000`, `${firstTab}!A:Z`]) {
        const r = await fetch(
          `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}?valueRenderOption=FORMATTED_VALUE`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );
        const body = await r.json().catch(() => ({}));
        out.ranges[range] = { status: r.status, rows: body.values?.length ?? null, error: r.ok ? null : body.error?.message };
      }
    }

    return Response.json(out);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
