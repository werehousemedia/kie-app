// One-off: prove the client-demo path end-to-end via the live pipeline.
const res = await fetch("https://kie-app.base44.app/functions/handle_inbound_message", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "X-Sync-Secret": "d9cd59b0-28f8-43ce-9536-86b98e84fc9f",
  },
  body: JSON.stringify({
    tenant_id: "6a79fd7d8b2d16ed44894184",
    content:
      "Hi, water is pouring out of the bottom of the boiler and I can't find the stopcock. The kitchen floor is already soaked!",
  }),
});
const text = await res.text();
console.log("STATUS", res.status);
try {
  const d = JSON.parse(text);
  console.log(JSON.stringify({
    conversation_id: d.conversation_id,
    triage_urgency: d.triage?.urgency,
    triage_issue: d.triage?.issue_type,
    has_reply: !!d.triage?.suggested_reply,
    ticket_id: d.ticket_id || null,
    sheet_logged: d.sheet_logged,
    sheet_error: d.sheet_error || null,
  }, null, 1));
} catch {
  console.log(text.slice(0, 400));
}