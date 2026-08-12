// Parsing for the "paste your contractor list" importer. Landlords keep their
// regulars in a spreadsheet, a notes app or their phone, so accept comma, tab
// or semicolon separated lines in ANY column order: a UK phone number, an
// email and a known trade word are each recognisable wherever they land.
// Kept out of the modal so it can be unit-tested.

export const TRADES = [
  "Plumbing", "Heating/Gas", "Electrical", "General", "Carpentry",
  "Roofing", "Pest control", "Cleaning", "Locksmith", "Appliance repair",
];

export const ACCREDITATIONS = ["Gas Safe", "NICEIC", "DEA", "TrustMark", "NAPIT", "OFTEC"];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function parseContractorLine(line) {
  const parts = String(line).split(/[\t;,]/).map((s) => s.trim()).filter(Boolean);
  if (parts.length === 0) return null;

  const row = { name: "", trade: "", phone: "", email: "", coverage_area: "", accreditations: [] };
  const leftovers = [];

  for (const part of parts) {
    const digits = part.replace(/[^0-9]/g, "");
    if (!row.email && EMAIL_RE.test(part)) { row.email = part; continue; }
    if (!row.phone && digits.length >= 10 && digits.length <= 13 && /^[0-9+()\s-]+$/.test(part)) {
      row.phone = part;
      continue;
    }
    const tradeHit = TRADES.find((t) => t.toLowerCase() === part.toLowerCase())
      || TRADES.find((t) => part.toLowerCase() === t.toLowerCase().split("/")[0]);
    if (!row.trade && tradeHit) { row.trade = tradeHit; continue; }
    const accHit = ACCREDITATIONS.filter((a) => part.toLowerCase().includes(a.toLowerCase()));
    if (accHit.length) { row.accreditations.push(...accHit); continue; }
    leftovers.push(part);
  }

  row.name = leftovers.shift() || "";
  row.coverage_area = leftovers.join(", ");

  // Infer the trade from the business name when it wasn't its own column —
  // "Kent Gas & Heat" is obviously a heating firm.
  if (!row.trade) {
    const hay = `${row.name} ${row.coverage_area}`.toLowerCase();
    if (/gas|boiler|heat/.test(hay)) row.trade = "Heating/Gas";
    else if (/electric|spark/.test(hay)) row.trade = "Electrical";
    else if (/plumb|drain/.test(hay)) row.trade = "Plumbing";
    else if (/clean/.test(hay)) row.trade = "Cleaning";
    else if (/roof|gutter/.test(hay)) row.trade = "Roofing";
    else if (/lock/.test(hay)) row.trade = "Locksmith";
    else if (/pest/.test(hay)) row.trade = "Pest control";
    else if (/carpen|joiner/.test(hay)) row.trade = "Carpentry";
    else row.trade = "General";
  }

  // Gas and electrical work legally requires the accreditation, so assume the
  // landlord's existing regular holds it — they can correct it on the card.
  if (!row.accreditations.length) {
    if (row.trade === "Heating/Gas") row.accreditations = ["Gas Safe"];
    else if (row.trade === "Electrical") row.accreditations = ["NICEIC"];
  }
  row.accreditations = [...new Set(row.accreditations)];

  return row.name ? row : null;
}

export function parseContractorList(text) {
  return String(text)
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map(parseContractorLine)
    .filter(Boolean);
}
