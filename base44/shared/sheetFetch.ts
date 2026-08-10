// Fetch and normalize Google Sheet tabs via the app's googlesheets connector.
// Shared by parse_source (wizard) and sync_from_sheet (auto-sync).

export type SheetTab = { name: string; headers: string[]; rows: Record<string, any>[]; empty: boolean };
export type SheetFetchResult = { tabs?: SheetTab[]; error?: { message: string; status: number } };

export async function fetchSheetTabs(base44: any, sheetUrl: string): Promise<SheetFetchResult> {
  const match = String(sheetUrl).match(/\/d\/([a-zA-Z0-9-_]+)/);
  if (!match) {
    return { error: { message: "That doesn't look like a Google Sheet URL. Paste the full link from your browser.", status: 400 } };
  }
  const spreadsheetId = match[1];

  const conn = await base44.asServiceRole.connectors.getConnection("googlesheets");
  const accessToken = conn.accessToken;

  const metaRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets.properties.title`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (metaRes.status === 403) {
    return { error: { message: "Can't access this sheet. Make sure it's shared with your connected Google account (Viewer access is enough) or the link is 'Anyone with the link'.", status: 403 } };
  }
  if (!metaRes.ok) {
    const err = await metaRes.json().catch(() => ({}));
    return { error: { message: err.error?.message || "Failed to read the spreadsheet.", status: metaRes.status } };
  }
  const meta = await metaRes.json();
  const tabNames = (meta.sheets || []).map((s: any) => s.properties.title).filter(Boolean);

  const tabs: SheetTab[] = [];
  for (const tabName of tabNames) {
    // "A:Z5000" is parsed by Google as "row 5000 to end" and 400s on smaller
    // grids — it must be the bounded "A1:Z5000" (clamped to the actual grid).
    const range = encodeURIComponent(`${tabName}!A1:Z5000`);
    const valuesRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}?valueRenderOption=FORMATTED_VALUE`,
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
  return { tabs };
}
