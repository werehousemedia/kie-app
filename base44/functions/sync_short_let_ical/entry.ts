// Pull Airbnb / Booking.com reservations from each short-let property's iCal
// feeds into ShortLetBooking rows (deduped by iCal UID). Turnaround cleans are
// booked by the Short Lets page's automation pass, which runs on next visit —
// this function only lands the bookings.
// Auth: an authenticated app user OR an X-Sync-Secret header matching the
// default ImportTemplate's sync_secret (same convention as sync_from_sheet).
import { createClientFromRequest } from "npm:@base44/sdk@0.8.40";
import { WS_FALLBACK } from "../../shared/workspace.ts";

type ParsedEvent = {
  uid: string;
  start: string; // YYYY-MM-DD
  end: string;   // YYYY-MM-DD
  summary: string;
};

function icsDateToIso(v: string): string | null {
  const m = v.trim().match(/^(\d{4})(\d{2})(\d{2})/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
}

// Minimal, tolerant VEVENT parser — handles folded lines and DATE/DATE-TIME.
function parseIcs(text: string): ParsedEvent[] {
  const unfolded = text.replace(/\r\n[ \t]/g, "").replace(/\r/g, "");
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
    events.push({ uid, start, end, summary: get("SUMMARY") });
  }
  return events;
}

const BLOCKED_PATTERNS = /not available|blocked|closed/i;

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);

    let authed = false;
    try {
      const me = await base44.auth.me();
      authed = !!me;
    } catch {
      authed = false;
    }
    if (!authed) {
      const secret = req.headers.get("X-Sync-Secret") || "";
      const templates = await base44.asServiceRole.entities.ImportTemplate.filter({ is_default: true });
      if (!secret || !templates[0]?.sync_secret || secret !== templates[0].sync_secret) {
        return Response.json({ error: "Unauthorised" }, { status: 401 });
      }
    }

    const entities = base44.asServiceRole.entities;
    const properties = await entities.Property.list();
    const wsOf = (pid: string) =>
      (properties.find((p: any) => p.id === pid) as any)?.workspace_id || WS_FALLBACK;
    const feeds: { propertyId: string; platform: string; url: string }[] = [];
    for (const p of properties) {
      if (!p.is_short_let) continue;
      if (p.airbnb_ical_url) feeds.push({ propertyId: p.id, platform: "Airbnb", url: p.airbnb_ical_url });
      if (p.booking_ical_url) feeds.push({ propertyId: p.id, platform: "Booking.com", url: p.booking_ical_url });
    }
    if (feeds.length === 0) {
      return Response.json({ ok: true, feeds: 0, created: 0, skipped: 0 });
    }

    const existing = await entities.ShortLetBooking.list(undefined, 1000);
    const known = new Set(existing.filter((b: any) => b.external_id).map((b: any) => b.external_id));

    let created = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const feed of feeds) {
      let text = "";
      try {
        const res = await fetch(feed.url, { headers: { "User-Agent": "KIE-Property/1.0" } });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        text = await res.text();
      } catch (e) {
        errors.push(`${feed.platform}: ${(e as Error).message}`);
        continue;
      }
      for (const ev of parseIcs(text)) {
        if (BLOCKED_PATTERNS.test(ev.summary)) continue;
        if (known.has(ev.uid)) {
          skipped++;
          continue;
        }
        const guest =
          ev.summary && !/^reserved$/i.test(ev.summary) && !/airbnb/i.test(ev.summary)
            ? ev.summary.slice(0, 80)
            : null;
        await entities.ShortLetBooking.create({
          workspace_id: wsOf(feed.propertyId),
          property_id: feed.propertyId,
          platform: feed.platform,
          guest_name: guest,
          check_in: ev.start,
          check_out: ev.end,
          status: "Confirmed",
          external_id: ev.uid,
          is_demo: false,
          source: "ical",
        });
        known.add(ev.uid);
        created++;
      }
    }

    await entities.IntegrationLog.create({
      workspace_id: WS_FALLBACK,
      service: "KIE Lettings",
      event: "Short-let iCal sync",
      status: errors.length && created === 0 ? "failed" : "success",
      details: `${feeds.length} feeds, ${created} new, ${skipped} known${errors.length ? `; errors: ${errors.join("; ")}` : ""}`,
      timestamp: new Date().toISOString(),
    });

    return Response.json({ ok: true, feeds: feeds.length, created, skipped, errors });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 500 });
  }
}