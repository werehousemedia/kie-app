// Pull Airbnb / Booking.com reservations from each short-let property's iCal
// feeds into ShortLetBooking rows (deduped by iCal UID). Turnaround cleans are
// booked by the Short Lets page's automation pass, which runs on next visit —
// this function only lands the bookings.
// Auth: an authenticated app user OR an X-Sync-Secret header matching the
// default ImportTemplate's sync_secret (same convention as sync_from_sheet).
import { createClientFromRequest } from "npm:@base44/sdk@0.8.40";
import { WS_FALLBACK } from "../../shared/workspace.ts";
import { parseIcs, BLOCKED_PATTERNS } from "../../shared/icalParse.ts";


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
        const notes = [
          ev.reservationCode ? `Reservation ${ev.reservationCode}` : null,
          ev.phoneLast4 ? `Guest phone ends ${ev.phoneLast4}` : null,
        ].filter(Boolean).join(" · ") || undefined;
        await entities.ShortLetBooking.create({
          workspace_id: wsOf(feed.propertyId),
          property_id: feed.propertyId,
          platform: feed.platform,
          guest_name: ev.guestName,
          guests_count: ev.guests || undefined,
          check_in: ev.start,
          check_out: ev.end,
          status: "Confirmed",
          external_id: ev.uid,
          reservation_code: ev.reservationCode || undefined,
          notes,
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