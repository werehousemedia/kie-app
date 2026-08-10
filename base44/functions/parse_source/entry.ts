import { createClientFromRequest } from "npm:@base44/sdk@0.8.40";

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { sheetUrl, fileUrl } = body;

    // --- Google Sheets path ---
    if (sheetUrl) {
      const match = String(sheetUrl).match(/\/d\/([a-zA-Z0-9-_]+)/);
      if (!match) return Response.json({ error: "That doesn't look like a Google Sheet URL. Paste the full link from your browser." }, { status: 400 });
      const spreadsheetId = match[1];

      const conn = await base44.asServiceRole.connectors.getConnection("googlesheets");
      const accessToken = conn.accessToken;

      const metaRes = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets.properties.title`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      if (metaRes.status === 403) {
        return Response.json({ error: "Can't access this sheet. Make sure it's shared with your connected Google account (Viewer access is enough) or the link is 'Anyone with the link'." }, { status: 403 });
      }
      if (!metaRes.ok) {
        const err = await metaRes.json().catch(() => ({}));
        return Response.json({ error: err.error?.message || "Failed to read the spreadsheet." }, { status: metaRes.status });
      }
      const meta = await metaRes.json();
      const tabNames = (meta.sheets || []).map((s) => s.properties.title).filter(Boolean);

      const tabs = [];
      for (const tabName of tabNames) {
        const range = encodeURIComponent(`${tabName}!A:Z5000`);
        const valuesRes = await fetch(
          `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );
        if (!valuesRes.ok) continue;
        const valuesData = await valuesRes.json();
        const rows = valuesData.values || [];
        if (rows.length === 0) { tabs.push({ name: tabName, headers: [], rows: [], empty: true }); continue; }
        const headers = rows[0].map((h: any) => String(h || "").trim()).filter((h: string, i: number, arr: string[]) => arr.indexOf(h) === i || h === "");
        const headerIdx = rows[0].map((h: any, i: number) => ({ h: String(h || "").trim(), i }));
        const dataRows = rows.slice(1).map((r: any[], idx: number) => {
          const obj: any = { _rowNumber: idx + 2 };
          for (const { h, i } of headerIdx) {
            if (h) obj[h] = r[i] !== undefined ? String(r[i]) : "";
          }
          return obj;
        }).filter((r: any) => Object.keys(r).some((k) => k !== "_rowNumber" && r[k] !== ""));
        tabs.push({ name: tabName, headers: headers.filter(Boolean), rows: dataRows, empty: dataRows.length === 0 });
      }
      return Response.json({ tabs });
    }

    // --- Uploaded file path ---
    if (fileUrl) {
      const result = await base44.asServiceRole.integrations.Core.ExtractDataFromUploadedFile({
        file_url: fileUrl,
        json_schema: {
          type: "object",
          properties: {
            rows: { type: "array", items: { type: "object", additionalProperties: true } },
          },
          required: ["rows"],
        },
      });
      if (result.status !== "success") {
        return Response.json({ error: result.details || "Could not read that file. Try a CSV or XLSX export." }, { status: 400 });
      }
      const extracted = result.output || [];
      const rows = Array.isArray(extracted) ? extracted : (extracted.rows || []);
      const dataRows = rows.map((r: any, idx: number) => ({ ...r, _rowNumber: idx + 2 }));
      const headers = dataRows.length > 0
        ? Object.keys(dataRows[0]).filter((k) => k !== "_rowNumber")
        : [];
      return Response.json({ tabs: [{ name: "Uploaded file", headers, rows: dataRows, empty: dataRows.length === 0 }] });
    }

    return Response.json({ error: "Provide either a sheetUrl or a fileUrl." }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}