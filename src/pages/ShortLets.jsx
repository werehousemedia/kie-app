import React, { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import {
  Palmtree,
  Plus,
  RefreshCw,
  Sparkles,
  CalendarDays,
  Banknote,
  SprayCan,
  Copy,
  XCircle,
  MoonStar,
} from "lucide-react";
import { base44 } from "@/api/base44Client";
import { format, addDays } from "date-fns";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as ReTooltip } from "recharts";
import { useKieData } from "@/lib/useKieData";
import { useDateRange } from "@/lib/DateRangeContext";
import DateRangePicker from "@/components/shared/DateRangePicker";
import { formatGBP, formatDate, daysUntil, statusColor, logActivity } from "@/lib/kieUtils";
import { runTaskEngine } from "@/lib/taskUtils";
import PageHeader from "@/components/shared/PageHeader";
import EmptyState from "@/components/shared/EmptyState";
import { PageSkeleton } from "@/components/shared/Skeletons";
import PropertyLink from "@/components/shared/PropertyLink";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

const PLATFORM_CHIP = {
  Airbnb: "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300",
  "Booking.com": "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300",
  Direct: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  Other: "bg-muted text-muted-foreground",
};

const GUEST_TEMPLATES = [
  {
    name: "Check-in instructions",
    body: "Hi {{guest}}! Looking forward to hosting you at {{property}}. Check-in is from 3pm — the key safe code will be sent on the morning of arrival. Any questions, just message me here. Safe travels!",
  },
  {
    name: "House rules reminder",
    body: "Hi {{guest}}, a quick note on the house: no smoking, no parties, and quiet hours from 10pm (it's a residential street). Bins go out Sunday night. Enjoy your stay!",
  },
  {
    name: "Checkout reminder",
    body: "Hi {{guest}}, hope you've enjoyed {{property}}! Checkout is by 10am tomorrow — please pop used towels in the bath, load the dishwasher, and drop the keys back in the key safe. Thanks for staying!",
  },
];

const nightsBetween = (a, b) => {
  if (!a || !b) return 0;
  return Math.round((new Date(b.slice(0, 10)) - new Date(a.slice(0, 10))) / 86400000);
};
const todayStr = () => new Date().toISOString().slice(0, 10);

// One automation pass per session — don't re-book cleans on every visit.
let autoBookRan = false;

export default function ShortLets() {
  const { shortLets, properties, contractors, tickets, reload, loading } = useKieData();
  const { range, label: rangeLabel } = useDateRange();
  const [searchParams, setSearchParams] = useSearchParams();
  const [addOpen, setAddOpen] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [bookingCleanId, setBookingCleanId] = useState(null);
  const [autoBooked, setAutoBooked] = useState(0);
  const [occScope, setOccScope] = useState("portfolio");
  const [listMode, setListMode] = useState("upcoming");

  useEffect(() => {
    if (searchParams.get("new") === "1") {
      setAddOpen(true);
      setSearchParams((p) => { p.delete("new"); return p; }, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cleaners = useMemo(
    () =>
      contractors
        .filter((c) => c.trade === "Cleaning")
        .sort((a, b) => (b.preferred === true) - (a.preferred === true)),
    [contractors]
  );

  const resolveCleaner = (property) => {
    if (property?.cleaning_contractor_id) {
      const chosen = contractors.find((c) => c.id === property.cleaning_contractor_id);
      if (chosen) return chosen;
    }
    return cleaners.find((c) => c.availability === "Available") || cleaners[0] || null;
  };

  // The turnaround automation Ed asked for: any live booking without a clean
  // gets one booked against the property's cleaner (or best available).
  const bookClean = async (booking, { silent = false } = {}) => {
    const property = properties.find((p) => p.id === booking.property_id);
    const cleaner = resolveCleaner(property);
    setBookingCleanId(booking.id);
    try {
      const ticket = await base44.entities.MaintenanceTicket.create({
        property_id: booking.property_id,
        issue_type: "general",
        urgency: "medium",
        status: cleaner ? "Contractor requested" : "New",
        description: `Turnaround clean — ${booking.guest_name || "guest"} checks out ${formatDate(booking.check_out)} (${booking.platform || "short let"})`,
        contractor_id: cleaner?.id,
        appointment_date: new Date(`${booking.check_out.slice(0, 10)}T11:00:00`).toISOString(),
        is_demo: booking.is_demo || false,
        source: "automation",
      });
      await base44.entities.ShortLetBooking.update(booking.id, { cleaning_ticket_id: ticket.id });
      await logActivity(base44, {
        property_id: booking.property_id,
        event_type: "Maintenance created",
        description: `Turnaround clean ${cleaner ? `booked with ${cleaner.name}` : "created (no cleaner on file)"} for ${formatDate(booking.check_out)}`,
        related_id: ticket.id,
      });
      runTaskEngine({ refresh: !silent }); // surface the matching Task immediately
      if (!silent) {
        toast.success(cleaner ? `Clean booked with ${cleaner.name} for ${formatDate(booking.check_out)}` : "Clean created — assign a cleaner in Maintenance");
        reload();
      }
      return true;
    } catch (e) {
      if (!silent) toast.error(`Couldn't book clean: ${e?.message || "unknown error"}`);
      return false;
    } finally {
      setBookingCleanId(null);
    }
  };

  // Auto-book pass: once per session, after data lands.
  useEffect(() => {
    if (loading || autoBookRan) return;
    autoBookRan = true;
    const candidates = shortLets.filter((b) => {
      const property = properties.find((p) => p.id === b.property_id);
      return (
        property?.is_short_let &&
        b.status !== "Cancelled" &&
        !b.cleaning_ticket_id &&
        b.check_out && b.check_out.slice(0, 10) >= todayStr()
      );
    });
    if (candidates.length === 0) return;
    (async () => {
      let n = 0;
      for (const b of candidates) {
        if (await bookClean(b, { silent: true })) n++;
      }
      if (n > 0) {
        setAutoBooked(n);
        toast.success(`Auto-booked ${n} turnaround clean${n === 1 ? "" : "s"}`);
        reload();
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, shortLets.length]);

  const syncCalendars = async () => {
    setSyncing(true);
    try {
      const res = await base44.functions.invoke("sync_short_let_ical", {});
      const d = res?.data || {};
      if (d.error) throw new Error(d.error);
      toast.success(
        `Calendars synced — ${d.created || 0} new booking${(d.created || 0) === 1 ? "" : "s"}${d.skipped ? `, ${d.skipped} already known` : ""}${d.feeds === 0 ? ". No iCal URLs configured yet — add them below." : ""}`
      );
      autoBookRan = false; // let the automation pass pick up the new bookings
      reload();
    } catch (e) {
      toast.error(`Sync failed: ${e?.response?.data?.error || e.message}`);
    } finally {
      setSyncing(false);
    }
  };

  const cancelBooking = async (booking) => {
    try {
      await base44.entities.ShortLetBooking.update(booking.id, { status: "Cancelled" });
      const clean = tickets.find((t) => t.id === booking.cleaning_ticket_id);
      if (clean && !["Complete", "Cancelled"].includes(clean.status)) {
        await base44.entities.MaintenanceTicket.update(clean.id, { status: "Cancelled" });
      }
      await logActivity(base44, {
        property_id: booking.property_id,
        event_type: "Property update",
        description: `Short-let booking cancelled — ${booking.guest_name || "guest"} (${formatDate(booking.check_in)})${clean ? ", clean cancelled too" : ""}`,
      });
      toast.success("Booking cancelled" + (clean ? " — turnaround clean cancelled too" : ""));
      reload();
    } catch (e) {
      toast.error(`Couldn't cancel: ${e?.message || "unknown error"}`);
    }
  };

  const live = useMemo(
    () => shortLets.filter((b) => b.status !== "Cancelled"),
    [shortLets]
  );
  const today = todayStr();
  const upcoming = useMemo(
    () =>
      [...live]
        .filter((b) => b.check_out && b.check_out.slice(0, 10) >= today)
        .sort((a, b) => a.check_in.localeCompare(b.check_in)),
    [live, today]
  );
  const checkInsToday = upcoming.filter((b) => b.check_in?.slice(0, 10) === today);
  const checkOutsToday = upcoming.filter((b) => b.check_out?.slice(0, 10) === today);

  // Selected range as yyyy-MM-dd bounds. Nights window is [start, end+1).
  const rangeYMD = useMemo(() => {
    if (!range?.start || !range?.end) return null;
    return {
      s: format(range.start, "yyyy-MM-dd"),
      e: format(range.end, "yyyy-MM-dd"),
      nightEnd: format(addDays(range.end, 1), "yyyy-MM-dd"),
    };
  }, [range]);

  // Nights of a stay that fall inside the selected range.
  const nightsInRange = (b) => {
    if (!rangeYMD || !b.check_in || !b.check_out) return 0;
    const from = b.check_in.slice(0, 10) > rangeYMD.s ? b.check_in.slice(0, 10) : rangeYMD.s;
    const to = b.check_out.slice(0, 10) < rangeYMD.nightEnd ? b.check_out.slice(0, 10) : rangeYMD.nightEnd;
    return Math.max(0, nightsBetween(from, to));
  };

  const stats = useMemo(() => {
    // Range-driven money + nights (the picker drives these two).
    const payoutInRange = live
      .filter((b) => rangeYMD && (b.check_in || "").slice(0, 10) >= rangeYMD.s && (b.check_in || "").slice(0, 10) <= rangeYMD.e)
      .reduce((s, b) => s + (b.total_payout || 0), 0);
    const nightsInRangeTotal = live.reduce((s, b) => s + nightsInRange(b), 0);
    const in7 = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
    const checkinsNext7 = upcoming.filter((b) => b.check_in >= today && b.check_in <= in7).length;
    const needClean = upcoming.filter((b) => !b.cleaning_ticket_id).length;
    return { payoutInRange, nightsInRangeTotal, checkinsNext7, needClean };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [live, upcoming, today, rangeYMD]);

  // Occupancy: % of available nights booked in the selected range, for one
  // short-let property or the whole short-let portfolio.
  const occupancy = useMemo(() => {
    const slProps = properties.filter((p) => p.is_short_let);
    const scopeProps = occScope === "portfolio" ? slProps : slProps.filter((p) => p.id === occScope);
    if (!rangeYMD || scopeProps.length === 0) return null;
    const rangeNights = nightsBetween(rangeYMD.s, rangeYMD.nightEnd);
    const totalNights = rangeNights * scopeProps.length;
    const scopeIds = new Set(scopeProps.map((p) => p.id));
    const bookedNights = live
      .filter((b) => scopeIds.has(b.property_id))
      .reduce((s, b) => s + nightsInRange(b), 0);
    const booked = Math.min(bookedNights, totalNights);
    const vacant = Math.max(0, totalNights - booked);
    const pct = totalNights > 0 ? Math.round((booked / totalNights) * 100) : 0;
    return { booked, vacant, totalNights, pct, propCount: scopeProps.length };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [live, properties, occScope, rangeYMD]);

  // Bookings overlapping the selected range (for the "In range" list mode).
  const inRangeBookings = useMemo(
    () =>
      [...live]
        .filter((b) => nightsInRange(b) > 0)
        .sort((a, b) => a.check_in.localeCompare(b.check_in)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [live, rangeYMD]
  );

  // Gap nights: short windows between consecutive bookings per property.
  const gaps = useMemo(() => {
    const out = [];
    const byProp = {};
    for (const b of upcoming) (byProp[b.property_id] ||= []).push(b);
    for (const [pid, list] of Object.entries(byProp)) {
      const sorted = [...list].sort((a, b) => a.check_in.localeCompare(b.check_in));
      for (let i = 0; i < sorted.length - 1; i++) {
        const gap = nightsBetween(sorted[i].check_out, sorted[i + 1].check_in);
        if (gap > 0 && gap <= 2) {
          out.push({
            id: `${sorted[i].id}_${sorted[i + 1].id}`,
            property: properties.find((p) => p.id === pid),
            nights: gap,
            from: sorted[i].check_out,
            to: sorted[i + 1].check_in,
          });
        }
      }
    }
    return out;
  }, [upcoming, properties]);

  const copyTemplate = async (tpl) => {
    try {
      await navigator.clipboard.writeText(tpl.body);
      toast.success(`"${tpl.name}" copied — paste into Airbnb/Booking chat`);
    } catch {
      toast.error("Couldn't access the clipboard");
    }
  };

  if (loading) return <PageSkeleton />;

  const shortLetProps = properties.filter((p) => p.is_short_let);

  return (
    <div className="space-y-5 animate-fade-in">
      <PageHeader
        title="Short lets"
        subtitle="Airbnb & Booking.com operations — bookings, turnarounds, gap nights"
        actions={
          <>
            <DateRangePicker />
            <button
              onClick={syncCalendars}
              disabled={syncing}
              className="inline-flex items-center gap-1.5 px-3 py-2 border bg-card hover:bg-muted rounded-lg text-sm font-medium transition-colors disabled:opacity-60"
            >
              <RefreshCw className={`w-4 h-4 ${syncing ? "animate-spin" : ""}`} />
              <span className="hidden sm:inline">{syncing ? "Syncing…" : "Sync calendars"}</span>
            </button>
            <button
              onClick={() => setAddOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
            >
              <Plus className="w-4 h-4" /> Add booking
            </button>
          </>
        }
      />

      {/* KPI tiles */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="rounded-xl border bg-card p-4">
          <p className="text-xs font-medium text-muted-foreground truncate" title={rangeLabel}>Payout · {rangeLabel}</p>
          <p className="text-2xl font-semibold tracking-tight tabular-nums mt-1">{formatGBP(stats.payoutInRange)}</p>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <p className="text-xs font-medium text-muted-foreground truncate" title={rangeLabel}>Nights booked · {rangeLabel}</p>
          <p className="text-2xl font-semibold tracking-tight tabular-nums mt-1">{stats.nightsInRangeTotal}</p>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <p className="text-xs font-medium text-muted-foreground">Check-ins · 7d</p>
          <p className="text-2xl font-semibold tracking-tight tabular-nums mt-1">{stats.checkinsNext7}</p>
        </div>
        <div className={`rounded-xl border p-4 ${stats.needClean > 0 ? "bg-amber-50 border-amber-200 dark:bg-amber-500/10 dark:border-amber-500/25" : "bg-card"}`}>
          <p className={`text-xs font-medium ${stats.needClean > 0 ? "text-amber-700 dark:text-amber-300" : "text-muted-foreground"}`}>Cleans to book</p>
          <p className="text-2xl font-semibold tracking-tight tabular-nums mt-1">{stats.needClean}</p>
          {autoBooked > 0 && (
            <p className="text-[11px] text-muted-foreground mt-0.5 flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-[hsl(var(--sage))]" /> {autoBooked} auto-booked just now
            </p>
          )}
        </div>
      </div>

      {/* Today strip */}
      {(checkInsToday.length > 0 || checkOutsToday.length > 0) && (
        <div className="rounded-xl border bg-card divide-y divide-border">
          {checkOutsToday.map((b) => {
            const clean = tickets.find((t) => t.id === b.cleaning_ticket_id);
            return (
              <div key={`out_${b.id}`} className="flex items-center gap-3 px-4 py-3">
                <SprayCan className="w-4 h-4 text-violet-500 shrink-0" />
                <span className="flex-1 min-w-0 text-sm truncate">
                  <span className="font-medium">{b.guest_name || "Guest"}</span> checks out today —{" "}
                  <PropertyLink property={properties.find((p) => p.id === b.property_id)} />
                </span>
                {clean ? (
                  <Link to={`/maintenance?ticket=${clean.id}`} className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColor(clean.status)}`}>
                    Clean: {clean.status}
                  </Link>
                ) : (
                  <button onClick={() => bookClean(b)} disabled={bookingCleanId === b.id} className="text-xs font-medium text-[hsl(var(--sage))] hover:underline">
                    {bookingCleanId === b.id ? "Booking…" : "Book clean"}
                  </button>
                )}
              </div>
            );
          })}
          {checkInsToday.map((b) => (
            <div key={`in_${b.id}`} className="flex items-center gap-3 px-4 py-3">
              <CalendarDays className="w-4 h-4 text-emerald-500 shrink-0" />
              <span className="flex-1 min-w-0 text-sm truncate">
                <span className="font-medium">{b.guest_name || "Guest"}</span> checks in today —{" "}
                <PropertyLink property={properties.find((p) => p.id === b.property_id)} />
              </span>
              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${PLATFORM_CHIP[b.platform] || PLATFORM_CHIP.Other}`}>
                {b.platform}
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          {/* Bookings — upcoming, or everything in the picked range */}
          <div className="rounded-xl border bg-card">
            <div className="px-4 pt-4 pb-2 flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold">
                {listMode === "upcoming" ? "Upcoming bookings" : `Bookings · ${rangeLabel}`}
              </h2>
              <div className="flex rounded-lg border overflow-hidden">
                {[["upcoming", "Upcoming"], ["range", "In range"]].map(([v, l]) => (
                  <button
                    key={v}
                    onClick={() => setListMode(v)}
                    className={`px-2.5 py-1 text-[11px] font-medium transition-colors ${listMode === v ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:bg-muted"}`}
                  >
                    {l}
                  </button>
                ))}
              </div>
            </div>
            {(listMode === "upcoming" ? upcoming : inRangeBookings).length === 0 ? (
              <EmptyState
                icon={Palmtree}
                title="No bookings yet"
                description="Add a booking manually, or paste your Airbnb/Booking.com iCal links below and hit Sync calendars — new stays then book their own turnaround clean."
                action={
                  <button onClick={() => setAddOpen(true)} className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 transition-opacity">
                    <Plus className="w-4 h-4" /> Add booking
                  </button>
                }
              />
            ) : (
              <div className="divide-y divide-border">
                {(listMode === "upcoming" ? upcoming : inRangeBookings).map((b) => {
                  const property = properties.find((p) => p.id === b.property_id);
                  const clean = tickets.find((t) => t.id === b.cleaning_ticket_id);
                  const nights = nightsBetween(b.check_in, b.check_out);
                  const inProgress = b.check_in?.slice(0, 10) <= today && b.check_out?.slice(0, 10) > today;
                  return (
                    <div key={b.id} className="flex items-center gap-3 px-4 py-3 border-l-[3px] border-l-pink-500">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium shrink-0 ${PLATFORM_CHIP[b.platform] || PLATFORM_CHIP.Other}`}>
                        {b.platform || "Other"}
                      </span>
                      <span className="flex-1 min-w-0">
                        <span className="flex items-center gap-2">
                          <span className="text-sm font-medium truncate">{b.guest_name || "Guest"}</span>
                          {inProgress && (
                            <span className="inline-flex items-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300 px-2 py-0.5 text-[10px] font-medium">
                              staying now
                            </span>
                          )}
                        </span>
                        <span className="block text-xs text-muted-foreground truncate">
                          {property?.name} · {formatDate(b.check_in)} → {formatDate(b.check_out)} · {nights} night{nights === 1 ? "" : "s"}
                          {b.guests_count ? ` · ${b.guests_count} guests` : ""}
                        </span>
                      </span>
                      <span className="hidden sm:block text-sm font-semibold tabular-nums shrink-0">
                        {b.total_payout ? formatGBP(b.total_payout) : "—"}
                      </span>
                      {clean ? (
                        <Link to={`/maintenance?ticket=${clean.id}`} className={`hidden md:inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium shrink-0 ${statusColor(clean.status)}`}>
                          Clean: {clean.status === "Contractor requested" ? "booked" : clean.status}
                        </Link>
                      ) : (
                        <button
                          onClick={() => bookClean(b)}
                          disabled={bookingCleanId === b.id}
                          className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border bg-card hover:bg-muted text-xs font-medium transition-colors"
                        >
                          <SprayCan className="w-3.5 h-3.5" />
                          {bookingCleanId === b.id ? "Booking…" : "Book clean"}
                        </button>
                      )}
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <button aria-label="Cancel booking" className="shrink-0 p-1.5 rounded-lg text-muted-foreground hover:text-rose-600 hover:bg-muted transition-colors">
                            <XCircle className="w-4 h-4" />
                          </button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Cancel this booking?</AlertDialogTitle>
                            <AlertDialogDescription>
                              {b.guest_name || "Guest"} at {property?.name}, {formatDate(b.check_in)} → {formatDate(b.check_out)}.
                              {b.cleaning_ticket_id ? " The turnaround clean will be cancelled too." : ""}
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Keep booking</AlertDialogCancel>
                            <AlertDialogAction onClick={() => cancelBooking(b)} className="bg-rose-600 hover:bg-rose-700 text-white">
                              Cancel booking
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Gap nights */}
          {gaps.length > 0 && (
            <div className="rounded-xl border bg-card">
              <div className="px-4 pt-4 pb-2 flex items-center gap-1.5">
                <MoonStar className="w-4 h-4 text-muted-foreground" />
                <h2 className="text-sm font-semibold">Gap nights worth filling</h2>
              </div>
              <div className="divide-y divide-border">
                {gaps.map((g) => (
                  <div key={g.id} className="px-4 py-2.5 text-sm">
                    <span className="font-medium tabular-nums">{g.nights} night{g.nights === 1 ? "" : "s"}</span> free at{" "}
                    <PropertyLink property={g.property} /> between {formatDate(g.from)} and {formatDate(g.to)} — consider a min-stay tweak or a gap-night discount.
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="space-y-4">
          {/* Occupancy — % of available nights booked in the selected range */}
          <div className="rounded-xl border bg-card p-4">
            <div className="flex items-center justify-between gap-2 mb-1">
              <h2 className="text-sm font-semibold">Occupancy</h2>
              <Select value={occScope} onValueChange={setOccScope}>
                <SelectTrigger className="h-7 w-[150px] text-xs bg-card"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="portfolio">Whole portfolio</SelectItem>
                  {shortLetProps.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <p className="text-xs text-muted-foreground mb-1">{rangeLabel}</p>
            {!occupancy ? (
              <p className="text-sm text-muted-foreground py-6 text-center">
                Turn on short-let mode for a property below to track occupancy.
              </p>
            ) : (
              <div className="relative h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={[
                        { name: "Booked", value: occupancy.booked },
                        { name: "Vacant", value: occupancy.vacant },
                      ]}
                      dataKey="value"
                      innerRadius={58}
                      outerRadius={80}
                      startAngle={90}
                      endAngle={-270}
                      strokeWidth={0}
                      paddingAngle={occupancy.booked > 0 && occupancy.vacant > 0 ? 2 : 0}
                    >
                      <Cell fill="#ec4899" />
                      <Cell fill="hsl(var(--muted))" />
                    </Pie>
                    <ReTooltip
                      formatter={(v, name) => [`${v} night${v === 1 ? "" : "s"}`, name]}
                      contentStyle={{ borderRadius: 8, fontSize: 12 }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-3xl font-semibold tabular-nums">{occupancy.pct}%</span>
                  <span className="text-[11px] text-muted-foreground">
                    {occupancy.booked}/{occupancy.totalNights} nights
                  </span>
                </div>
              </div>
            )}
            {occupancy && occScope === "portfolio" && occupancy.propCount > 1 && (
              <p className="text-[11px] text-muted-foreground text-center">
                across {occupancy.propCount} short-let properties
              </p>
            )}
          </div>

          {/* Property setup */}
          <PropertySetup properties={properties} cleaners={cleaners} reload={reload} />

          {/* Guest templates */}
          <div className="rounded-xl border bg-card">
            <div className="px-4 pt-4 pb-2">
              <h2 className="text-sm font-semibold">Guest message templates</h2>
              <p className="text-xs text-muted-foreground">Copy, then paste into the Airbnb / Booking.com chat.</p>
            </div>
            <div className="divide-y divide-border">
              {GUEST_TEMPLATES.map((t) => (
                <div key={t.name} className="px-4 py-2.5 flex items-center gap-2">
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm font-medium">{t.name}</span>
                    <span className="block text-xs text-muted-foreground truncate">{t.body}</span>
                  </span>
                  <button
                    onClick={() => copyTemplate(t)}
                    aria-label={`Copy ${t.name}`}
                    className="shrink-0 p-2 rounded-lg border bg-card hover:bg-muted transition-colors"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {shortLetProps.length === 0 && (
            <div className="rounded-xl border bg-[hsl(var(--sage-light))]/50 p-4 text-sm">
              <p className="font-medium flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-[hsl(var(--sage))]" /> Get started
              </p>
              <p className="text-muted-foreground text-xs mt-1">
                Flip a property to short-let mode above, pick its cleaning contractor, and paste the iCal links from
                Airbnb (Calendar → Availability → Connect calendars) and Booking.com (Rates & Availability → Sync calendars).
                From then on, every new booking books its own turnaround clean.
              </p>
            </div>
          )}
        </div>
      </div>

      <AddBookingModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        properties={properties}
        onCreated={async (booking, autoClean) => {
          reload();
          if (autoClean) await bookClean(booking);
        }}
      />
    </div>
  );
}

function PropertySetup({ properties, cleaners, reload }) {
  const [drafts, setDrafts] = useState({});
  const [savingId, setSavingId] = useState(null);

  const draftFor = (p) =>
    drafts[p.id] || {
      is_short_let: p.is_short_let || false,
      cleaning_contractor_id: p.cleaning_contractor_id || "auto",
      airbnb_ical_url: p.airbnb_ical_url || "",
      booking_ical_url: p.booking_ical_url || "",
    };
  const setDraft = (p, patch) =>
    setDrafts((d) => ({ ...d, [p.id]: { ...draftFor(p), ...patch } }));
  const isDirty = (p) => {
    const d = draftFor(p);
    return (
      d.is_short_let !== (p.is_short_let || false) ||
      (d.cleaning_contractor_id === "auto" ? "" : d.cleaning_contractor_id) !== (p.cleaning_contractor_id || "") ||
      d.airbnb_ical_url !== (p.airbnb_ical_url || "") ||
      d.booking_ical_url !== (p.booking_ical_url || "")
    );
  };

  const save = async (p) => {
    const d = draftFor(p);
    setSavingId(p.id);
    try {
      await base44.entities.Property.update(p.id, {
        is_short_let: d.is_short_let,
        cleaning_contractor_id: d.cleaning_contractor_id === "auto" ? null : d.cleaning_contractor_id,
        airbnb_ical_url: d.airbnb_ical_url.trim() || null,
        booking_ical_url: d.booking_ical_url.trim() || null,
      });
      await logActivity(base44, {
        property_id: p.id,
        event_type: "Property update",
        description: `Short-let settings updated for ${p.name}`,
      });
      toast.success(`${p.name} short-let settings saved`);
      setDrafts((prev) => { const n = { ...prev }; delete n[p.id]; return n; });
      reload();
    } catch (e) {
      toast.error(`Couldn't save: ${e?.message || "unknown error"}`);
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="rounded-xl border bg-card">
      <div className="px-4 pt-4 pb-2">
        <h2 className="text-sm font-semibold">Listing setup</h2>
        <p className="text-xs text-muted-foreground">Short-let mode per property, cleaner, and calendar feeds.</p>
      </div>
      <div className="divide-y divide-border">
        {properties.map((p) => {
          const d = draftFor(p);
          return (
            <div key={p.id} className="px-4 py-3 space-y-2.5">
              <label className="flex items-center gap-3">
                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-medium truncate">{p.name}</span>
                  <span className="block text-xs text-muted-foreground truncate">{p.address}</span>
                </span>
                <Switch
                  checked={d.is_short_let}
                  onCheckedChange={(v) => setDraft(p, { is_short_let: v })}
                  aria-label={`Short-let mode for ${p.name}`}
                />
              </label>
              {d.is_short_let && (
                <div className="space-y-2 animate-fade-in">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Turnaround cleaner</label>
                    <Select
                      value={d.cleaning_contractor_id}
                      onValueChange={(v) => setDraft(p, { cleaning_contractor_id: v })}
                    >
                      <SelectTrigger className="mt-1 h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="auto">Auto — best available cleaner</SelectItem>
                        {cleaners.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.name}
                            {c.preferred ? " ★" : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {cleaners.length === 0 && (
                      <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-1">
                        No Cleaning-trade contractors yet — add one in Contractors so cleans can auto-book.
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Airbnb iCal URL</label>
                    <Input
                      value={d.airbnb_ical_url}
                      onChange={(e) => setDraft(p, { airbnb_ical_url: e.target.value })}
                      placeholder="https://www.airbnb.co.uk/calendar/ical/…"
                      className="mt-1 h-9"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Booking.com iCal URL</label>
                    <Input
                      value={d.booking_ical_url}
                      onChange={(e) => setDraft(p, { booking_ical_url: e.target.value })}
                      placeholder="https://ical.booking.com/v1/export?…"
                      className="mt-1 h-9"
                    />
                  </div>
                </div>
              )}
              {isDirty(p) && (
                <div className="flex justify-end">
                  <button
                    onClick={() => save(p)}
                    disabled={savingId === p.id}
                    className="px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-xs font-medium hover:opacity-90 transition-opacity disabled:opacity-60"
                  >
                    {savingId === p.id ? "Saving…" : "Save"}
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function AddBookingModal({ open, onClose, properties, onCreated }) {
  const empty = {
    property_id: "",
    platform: "Airbnb",
    guest_name: "",
    guests_count: "",
    check_in: "",
    check_out: "",
    nightly_rate: "",
    total_payout: "",
    notes: "",
  };
  const [form, setForm] = useState(empty);
  const [autoClean, setAutoClean] = useState(true);
  const [saving, setSaving] = useState(false);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const nights = nightsBetween(form.check_in, form.check_out);
  const parsed = (v) => {
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : null;
  };

  const submit = async () => {
    if (!form.property_id || !form.check_in || !form.check_out) {
      toast.error("Property, check-in and check-out are required");
      return;
    }
    if (form.check_out <= form.check_in) {
      toast.error("Check-out must be after check-in");
      return;
    }
    setSaving(true);
    try {
      const rate = parsed(form.nightly_rate);
      const payout = parsed(form.total_payout) ?? (rate && nights > 0 ? rate * nights : null);
      const booking = await base44.entities.ShortLetBooking.create({
        property_id: form.property_id,
        platform: form.platform,
        guest_name: form.guest_name.trim() || null,
        guests_count: parsed(form.guests_count),
        check_in: form.check_in,
        check_out: form.check_out,
        nightly_rate: rate,
        total_payout: payout,
        status: "Confirmed",
        notes: form.notes.trim() || null,
        is_demo: false,
        source: "manual",
      });
      await logActivity(base44, {
        property_id: form.property_id,
        event_type: "Property update",
        description: `Short-let booking added — ${form.guest_name || "guest"} (${form.platform}), ${nights} night${nights === 1 ? "" : "s"}`,
      });
      toast.success("Booking added");
      setForm(empty);
      onClose();
      await onCreated(booking, autoClean);
    } catch (e) {
      toast.error(`Couldn't add booking: ${e?.message || "unknown error"}`);
    } finally {
      setSaving(false);
    }
  };

  const sorted = [...properties].sort((a, b) => (b.is_short_let === true) - (a.is_short_let === true));

  return (
    <Dialog open={open} onOpenChange={(v) => !saving && !v && onClose()}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add booking</DialogTitle>
          <DialogDescription>
            New stays can book their own turnaround clean automatically.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 mt-1">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Property *</label>
              <Select value={form.property_id} onValueChange={(v) => set("property_id", v)}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Choose property" />
                </SelectTrigger>
                <SelectContent>
                  {sorted.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                      {p.is_short_let ? " 🏖" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Platform</label>
              <Select value={form.platform} onValueChange={(v) => set("platform", v)}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {["Airbnb", "Booking.com", "Direct", "Other"].map((p) => (
                    <SelectItem key={p} value={p}>{p}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Guest name</label>
              <Input value={form.guest_name} onChange={(e) => set("guest_name", e.target.value)} className="mt-1" placeholder="e.g. Sarah M" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Guests</label>
              <Input type="number" min="1" value={form.guests_count} onChange={(e) => set("guests_count", e.target.value)} className="mt-1" placeholder="2" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Check-in *</label>
              <Input type="date" value={form.check_in} onChange={(e) => set("check_in", e.target.value)} className="mt-1" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Check-out *</label>
              <Input type="date" value={form.check_out} onChange={(e) => set("check_out", e.target.value)} className="mt-1" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Nightly rate £</label>
              <Input type="number" min="0" step="1" value={form.nightly_rate} onChange={(e) => set("nightly_rate", e.target.value)} className="mt-1" placeholder="120" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">
                Total payout £{nights > 0 && form.nightly_rate ? ` (auto: ${nights} × ${form.nightly_rate})` : ""}
              </label>
              <Input type="number" min="0" step="1" value={form.total_payout} onChange={(e) => set("total_payout", e.target.value)} className="mt-1" placeholder="leave blank to auto-calc" />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Notes</label>
            <Input value={form.notes} onChange={(e) => set("notes", e.target.value)} className="mt-1" placeholder="e.g. late arrival, dog staying" />
          </div>
          <label className="flex items-center gap-3 rounded-xl border px-3.5 py-2.5">
            <SprayCan className="w-4 h-4 text-muted-foreground shrink-0" />
            <span className="flex-1 text-sm font-medium">Auto-book turnaround clean</span>
            <Switch checked={autoClean} onCheckedChange={setAutoClean} />
          </label>
          <div className="flex justify-end gap-2">
            <button onClick={onClose} disabled={saving} className="px-3.5 py-2 border bg-card hover:bg-muted rounded-lg text-sm font-medium transition-colors">
              Cancel
            </button>
            <button onClick={submit} disabled={saving} className="px-3.5 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-60">
              {saving ? "Adding…" : "Add booking"}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}