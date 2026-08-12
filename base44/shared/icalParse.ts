// iCal parsing for short-let calendar feeds, kept separate from the sync
// function so it can be unit-tested against real Airbnb / Booking.com payloads.
//
// What the platforms actually publish in a calendar feed:
//   Airbnb       SUMMARY "Reserved" (occasionally the guest's first name) and a
//                DESCRIPTION carrying "Reservation URL: …/HMXYZ123", "Phone
//                Number (Last 4 Digits): 1234", sometimes "Guest: Jane Doe".
//   Booking.com  SUMMARY "CLOSED - Not available" for blocks, else the guest name.
// Neither feed carries an email, a full phone number or the payout — those need
// a partner API that neither platform grants small self-serve apps. Extract
// what is genuinely there and leave the rest empty rather than inventing it.

export type ParsedEvent = {
  uid: string;
  start: string; // YYYY-MM-DD
  end: string;   // YYYY-MM-DD
  summary: string;
  description: string;
  guestName: string | null;
  reservationCode: string | null;
  phoneLast4: string | null;
  guests: number | null;
};

export const BLOCKED_PATTERNS = /not available|blocked|closed|unavailable/i;

export function icsDateToIso(v: string): string | null {
  const m = v.trim().match(/^(\d{4})(\d{2})(\d{2})/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
}

const GENERIC_SUMMARY = /^(reserved|closed|not available|blocked|unavailable|busy|airbnb|booking)/i;

export function enrich(summary: string, description: string) {
  const text = `${summary}\n${description}`;
  const reservationCode =
    text.match(/reservation\s*(?:url|code)?[^A-Za-z0-9]{0,12}([A-Z0-9]{6,12})/i)?.[1] ||
    text.match(/reservations?\/(?:details\/)?([A-Z0-9]{6,12})/i)?.[1] ||
    null;
  const phoneLast4 = text.match(/last\s*4\s*digits?\)?\s*:?\s*(\d{4})/i)?.[1] || null;
  const guests = Number(text.match(/(\d+)\s*guests?/i)?.[1]) || null;

  let guestName: string | null = text.match(/^\s*Guest\s*:\s*(.+)$/im)?.[1]?.trim() || null;
  if (!guestName) {
    const s = summary.trim();
    if (s && !GENERIC_SUMMARY.test(s)) guestName = s.replace(/\s*\(.*\)\s*$/, "").trim().slice(0, 80);
  }
  return { guestName: guestName || null, reservationCode, phoneLast4, guests };
}

// Tolerant VEVENT reader: handles RFC-5545 line folding, DATE and DATE-TIME
// values, and property parameters (DTSTART;VALUE=DATE:20260812).
export function parseIcs(text: string): ParsedEvent[] {
  const unfolded = String(text).replace(/\r\n[ \t]/g, "").replace(/\n[ \t]/g, "").replace(/\r/g, "");
  const events: ParsedEvent[] = [];
  for (const block of unfolded.split("BEGIN:VEVENT").slice(1)) {
    const body = block.split("END:VEVENT")[0];
    const get = (name: string): string => {
      const m = body.match(new RegExp(`^${name}[^:\\n]*:(.*)$`, "m"));
      return m ? m[1].trim() : "";
    };
    const start = icsDateToIso(get("DTSTART"));
    const end = icsDateToIso(get("DTEND"));
    const uid = get("UID");
    if (!start || !end || !uid) continue;
    const summary = get("SUMMARY");
    const description = get("DESCRIPTION").replace(/\\n/g, "\n").replace(/\\,/g, ",");
    events.push({ uid, start, end, summary, description, ...enrich(summary, description) });
  }
  return events;
}
