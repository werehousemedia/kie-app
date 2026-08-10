import { createClientFromRequest } from "npm:@base44/sdk@0.8.40";
import { fetchSheetTabs } from "../../shared/sheetFetch.ts";

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { sheetUrl, fileUrl } = body;

    // --- Google Sheets path ---
    if (sheetUrl) {
      const result = await fetchSheetTabs(base44, sheetUrl);
      if (result.error) return Response.json({ error: result.error.message }, { status: result.error.status });
      return Response.json({ tabs: result.tabs });
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

// redeploy: sheetFetch range fix e3d52c2
