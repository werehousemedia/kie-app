// Job dispatch text — the app writes the message so the landlord doesn't have
// to. One tap then opens WhatsApp with the whole job already typed: what,
// where, how urgent, and who to call for access.
// Pure module (no SDK import) so it can be unit-tested outside the browser.

export function composeJobMessage({ task, property, contractor, tenant, businessName = "KIE Property" }) {
  const lines = [];
  lines.push(`Hi${contractor?.name ? ` ${contractor.name}` : ""} — job request from ${businessName}.`);
  lines.push("");
  if (property) {
    lines.push(`Property: ${[property.name, property.address, property.postcode].filter(Boolean).join(", ")}`);
  }
  lines.push(`Job: ${task?.title || "Maintenance visit"}`);
  if (task?.description && task.description !== task.title) {
    lines.push(`Details: ${String(task.description).slice(0, 300)}`);
  }
  if (task?.urgency) {
    const urgencyNote = task.urgency === "emergency"
      ? "EMERGENCY — please attend as soon as you can"
      : task.urgency === "high" ? "High — needs attention within 24–48h" : task.urgency;
    lines.push(`Urgency: ${urgencyNote}`);
  }
  if (task?.due_date) lines.push(`Needed by: ${task.due_date.slice(0, 10).split("-").reverse().join("/")}`);
  if (tenant?.name) {
    lines.push(`Access: ${tenant.name}${tenant.phone ? ` on ${tenant.phone}` : ""} — please arrange a time directly.`);
  }
  lines.push("");
  lines.push("Can you confirm you can take this and when you'd attend? Thanks.");
  return lines.join("\n");
}

// wa.me deep link with the message pre-typed. UK numbers normalised.
export function waDispatchLink(phone, text) {
  if (!phone) return null;
  let digits = String(phone).replace(/[^0-9]/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.startsWith("0")) digits = "44" + digits.slice(1);
  else if (digits.length === 10 && digits.startsWith("7")) digits = "44" + digits;
  if (!digits) return null;
  return `https://wa.me/${digits}?text=${encodeURIComponent(String(text).slice(0, 1500))}`;
}
