// Google Sheet communications log. Every tenant message handled by the AI
// pipeline appends one row. The spreadsheet is created on first use and its
// id kept in AppSetting{key:"comms_log_sheet_id"}. Requires the googlesheets
// connector to have write scope (https://www.googleapis.com/auth/spreadsheets);
// until that scope is granted, calls fail gracefully and the caller records
// the failure in IntegrationLog.

const SHEET_TITLE = "KIE Communications Log";
const TAB = "Log";
export const COMMS_HEADER = [
  "Timestamp", "Tenant", "Property address", "Issue raised", "Issue type",
  "Urgency", "AI action taken", "Ticket", "Conversation",
];

async function token(base44: any): Promise<string> {
  const conn = await base44.asServiceRole.connectors.getConnection("googlesheets");
  return conn.accessToken;
}

export async function ensureCommsSheet(base44: any, db: any): Promise<{ sheetId?: string; error?: string }> {
  const settings = await db.AppSetting.filter({ key: "comms_log_sheet_id" });
  if (settings[0]?.value) return { sheetId: settings[0].value };

  const accessToken = await token(base44);
  const createRes = await fetch("https://sheets.googleapis.com/v4/spreadsheets", {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      properties: { title: SHEET_TITLE },
      sheets: [{ properties: { title: TAB } }],
    }),
  });
  if (!createRes.ok) {
    const err = await createRes.json().catch(() => ({}));
    return { error: err.error?.message || `Could not create log spreadsheet (HTTP ${createRes.status}) — check the Google connector has write access.` };
  }
  const created = await createRes.json();
  const sheetId = created.spreadsheetId;

  // Header row
  await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(`${TAB}!A1`)}?valueInputOption=USER_ENTERED`,
    {
      method: "PUT",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ values: [COMMS_HEADER] }),
    }
  );

  if (settings[0]) {
    await db.AppSetting.update(settings[0].id, { value: sheetId });
  } else {
    await db.AppSetting.create({ key: "comms_log_sheet_id", value: sheetId });
  }
  return { sheetId };
}

export async function appendCommsRow(base44: any, db: any, row: (string | number)[]): Promise<{ ok: boolean; sheetId?: string; error?: string }> {
  const ensured = await ensureCommsSheet(base44, db);
  if (!ensured.sheetId) return { ok: false, error: ensured.error };

  const accessToken = await token(base44);
  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${ensured.sheetId}/values/${encodeURIComponent(`${TAB}!A1`)}:append?valueInputOption=USER_ENTERED`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ values: [row] }),
    }
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    return { ok: false, sheetId: ensured.sheetId, error: err.error?.message || `Append failed (HTTP ${res.status})` };
  }
  return { ok: true, sheetId: ensured.sheetId };
}
