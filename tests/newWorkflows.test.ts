import { strict as assert } from "node:assert";
import { parseIcs, enrich, BLOCKED_PATTERNS } from "../base44/shared/icalParse.ts";
import { toWaNumber } from "../base44/shared/whatsappSend.ts";
import { parseContractorLine, parseContractorList } from "../src/lib/contractorImport.js";
import { composeJobMessage, waDispatchLink } from "../src/lib/jobMessage.js";

// ---------------------------------------------------------------------------
// iCal — real-shaped Airbnb / Booking.com feeds
// ---------------------------------------------------------------------------

const AIRBNB_FEED = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Airbnb Inc//Hosting Calendar 1.0.0//EN
BEGIN:VEVENT
DTEND;VALUE=DATE:20260820
DTSTART;VALUE=DATE:20260815
UID:1234abcd-ef56@airbnb.com
SUMMARY:Reserved
DESCRIPTION:Reservation URL: https://www.airbnb.co.uk/hosting/reservations/d
 etails/HMABC12345\\nPhone Number (Last 4 Digits): 4471\\nGuest: Priya Raman\\n2
  guests
END:VEVENT
BEGIN:VEVENT
DTEND;VALUE=DATE:20260901
DTSTART;VALUE=DATE:20260828
UID:blocked-01@airbnb.com
SUMMARY:Airbnb (Not available)
END:VEVENT
END:VCALENDAR`;

const events = parseIcs(AIRBNB_FEED);
assert.equal(events.length, 2, "both VEVENTs parse");

const booking = events[0];
assert.equal(booking.start, "2026-08-15");
assert.equal(booking.end, "2026-08-20");
assert.equal(booking.uid, "1234abcd-ef56@airbnb.com");
// folded DESCRIPTION lines must rejoin before extraction
assert.equal(booking.reservationCode, "HMABC12345", "reservation code from folded URL");
assert.equal(booking.phoneLast4, "4471");
assert.equal(booking.guestName, "Priya Raman");
assert.equal(booking.guests, 2);

// A block is parsed but recognised as a block, not a guest stay.
assert.ok(BLOCKED_PATTERNS.test(events[1].summary), "block detected");
assert.equal(events[1].guestName, null, "generic summary is never a guest name");

// Booking.com style: guest name straight in SUMMARY, no description.
const bdc = parseIcs(`BEGIN:VEVENT
DTSTART;VALUE=DATE:20260901
DTEND;VALUE=DATE:20260905
UID:bdc-99
SUMMARY:Marta Kowalski (3 guests)
END:VEVENT`);
assert.equal(bdc[0].guestName, "Marta Kowalski", "trailing parenthetical stripped");
assert.equal(bdc[0].guests, 3);

// Generic summaries must not become guest names.
for (const s of ["Reserved", "CLOSED - Not available", "Blocked", "Airbnb", "Busy"]) {
  assert.equal(enrich(s, "").guestName, null, `"${s}" is not a guest name`);
}
// Nothing is invented when the feed is bare.
const bare = enrich("Reserved", "");
assert.equal(bare.reservationCode, null);
assert.equal(bare.phoneLast4, null);
assert.equal(bare.guests, null);

// Events missing required fields are skipped rather than half-imported.
assert.equal(parseIcs("BEGIN:VEVENT\nSUMMARY:No dates\nEND:VEVENT").length, 0);

// ---------------------------------------------------------------------------
// WhatsApp number normalisation — routing depends on this being exact
// ---------------------------------------------------------------------------

assert.equal(toWaNumber("07743 967238"), "447743967238");
assert.equal(toWaNumber("+44 7743 967238"), "447743967238");
assert.equal(toWaNumber("447743967238"), "447743967238");
assert.equal(toWaNumber("7743967238"), "447743967238");
assert.equal(toWaNumber("0044 7743 967238"), "447743967238");
assert.equal(toWaNumber("(07743) 967-238"), "447743967238");
assert.equal(toWaNumber(""), "");

// ---------------------------------------------------------------------------
// Contractor paste-import — any column order
// ---------------------------------------------------------------------------

const c1 = parseContractorLine("Kent Gas & Heat, Heating/Gas, 07700 900111, info@kentgas.co.uk, Tunbridge Wells TN");
assert.equal(c1.name, "Kent Gas & Heat");
assert.equal(c1.trade, "Heating/Gas");
assert.equal(c1.phone, "07700 900111");
assert.equal(c1.email, "info@kentgas.co.uk");
assert.equal(c1.coverage_area, "Tunbridge Wells TN");
assert.deepEqual(c1.accreditations, ["Gas Safe"], "gas work implies Gas Safe");

// Scrambled order, tab separated, explicit accreditation.
const c2 = parseContractorLine("07700 900222\tNICEIC\tBright Spark Electrical\tElectrical\tTN4");
assert.equal(c2.name, "Bright Spark Electrical");
assert.equal(c2.trade, "Electrical");
assert.equal(c2.phone, "07700 900222");
assert.deepEqual(c2.accreditations, ["NICEIC"]);

// Trade inferred from the business name when there's no trade column.
const c3 = parseContractorLine("Sparkle Cleaning Ltd; 07700 900333");
assert.equal(c3.trade, "Cleaning");
assert.equal(c3.phone, "07700 900333");
assert.deepEqual(c3.accreditations, [], "cleaners need no accreditation");

// A bare name still imports — it just can't be messaged.
const c4 = parseContractorLine("Dave the roofer");
assert.equal(c4.name, "Dave the roofer");
assert.equal(c4.trade, "Roofing");
assert.equal(c4.phone, "");

assert.equal(parseContractorLine(""), null);
assert.equal(parseContractorLine("   "), null);
assert.equal(parseContractorList("a@b.co\n\nKent Gas, 07700 900111").length, 1,
  "an email-only line has no name and is dropped");

// ---------------------------------------------------------------------------
// Job dispatch message
// ---------------------------------------------------------------------------

const msg = composeJobMessage({
  task: {
    title: "Book Gas Safety Certificate — 7 Willow Court",
    urgency: "emergency",
    due_date: "2026-02-10",
    description: "Certificate expired",
  },
  property: { name: "7 Willow Court", address: "12 Willow Rd", postcode: "TN1 2AB" },
  contractor: { name: "Kent Gas & Heat" },
  tenant: { name: "Oliver Steen", phone: "07700 900123" },
});
assert.ok(msg.includes("Kent Gas & Heat"), "addressed to the contractor");
assert.ok(msg.includes("7 Willow Court, 12 Willow Rd, TN1 2AB"), "full address");
assert.ok(msg.includes("EMERGENCY"), "emergency spelled out");
assert.ok(msg.includes("10/02/2026"), "UK date format");
assert.ok(msg.includes("Oliver Steen on 07700 900123"), "access contact included");

// No tenant on file: no dangling "Access:" line.
const msgNoTenant = composeJobMessage({
  task: { title: "Fix gutter" },
  property: { name: "Flat 3" },
  contractor: { name: "Bob" },
  tenant: null,
});
assert.ok(!msgNoTenant.includes("Access:"), "access line omitted when no tenant");

const link = waDispatchLink("07700 900111", "Hello there & goodbye");
assert.ok(link.startsWith("https://wa.me/447700900111?text="), "UK number normalised in link");
assert.ok(link.includes("%26"), "message is URL-encoded");
assert.equal(waDispatchLink("", "x"), null);

console.log("newWorkflows: all tests passed");
