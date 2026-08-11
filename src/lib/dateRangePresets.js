import {
  startOfDay, endOfDay, startOfMonth, endOfMonth, subMonths, addMonths,
  startOfYear, endOfYear, subDays, addDays, subYears, format, parseISO, isWithinInterval,
} from "date-fns";

// ---------------------------------------------------------------------------
// Date-range presets — modelled on Shopify Analytics.
// Each preset returns { start, end } as inclusive day boundaries (Date objects).
// "compare" computes the comparison window for delta maths.
// ---------------------------------------------------------------------------

const day = (d) => startOfDay(d);
const now = () => new Date();

export const PRESETS = [
  { id: "today",        label: "Today",          range: () => ({ start: day(now()), end: endOfDay(now()) }) },
  { id: "yesterday",    label: "Yesterday",      range: () => ({ start: day(subDays(now(), 1)), end: endOfDay(subDays(now(), 1)) }) },
  { id: "last7",        label: "Last 7 days",     range: () => ({ start: day(subDays(now(), 6)), end: endOfDay(now()) }) },
  { id: "last30",       label: "Last 30 days",    range: () => ({ start: day(subDays(now(), 29)), end: endOfDay(now()) }) },
  { id: "last90",       label: "Last 90 days",   range: () => ({ start: day(subDays(now(), 89)), end: endOfDay(now()) }) },
  { id: "thisMonth",    label: "This month",     range: () => ({ start: startOfMonth(now()), end: endOfMonth(now()) }) },
  { id: "lastMonth",    label: "Last month",     range: () => ({ start: startOfMonth(subMonths(now(), 1)), end: endOfMonth(subMonths(now(), 1)) }) },
  { id: "next30",       label: "Next 30 days",   range: () => ({ start: day(now()), end: endOfDay(addDays(now(), 29)) }) },
  { id: "next3Months",  label: "Next 3 months",  range: () => ({ start: day(now()), end: endOfDay(addDays(now(), 89)) }) },
  { id: "next12Months", label: "Next 12 months", range: () => ({ start: day(now()), end: endOfDay(addMonths(day(now()), 12)) }) },
  { id: "ytd",          label: "Year to date",   range: () => ({ start: startOfYear(now()), end: endOfDay(now()) }) },
  { id: "yearRemaining",label: "Year remaining", range: () => ({ start: day(now()), end: endOfYear(now()) }) },
];

export const PRESET_BY_ID = Object.fromEntries(PRESETS.map((p) => [p.id, p]));

export function resolvePreset(id) {
  const p = PRESET_BY_ID[id];
  return p ? p.range() : null;
}

// Duration of a range in days (inclusive).
export function rangeDays({ start, end }) {
  return Math.round((endOfDay(end) - startOfDay(start)) / 86400000) + 1;
}

// Comparison window for a given range + mode.
export function comparisonRange({ start, end }, mode) {
  if (!mode || mode === "none") return null;
  if (mode === "previousPeriod") {
    const days = rangeDays({ start, end });
    return { start: day(subDays(start, days)), end: endOfDay(subDays(start, 1)) };
  }
  if (mode === "previousYear") {
    return { start: subYears(day(start), 1), end: subYears(endOfDay(end), 1) };
  }
  return null;
}

export const COMPARE_MODES = [
  { id: "none", label: "Off" },
  { id: "previousPeriod", label: "Previous period" },
  { id: "previousYear", label: "Previous year" },
];

// ---------------------------------------------------------------------------
// Entity date audit — each record type maps to one primary date field so the
// picker can filter any list without special-casing at the call site.
// Built-in created_date is the fallback for records with no semantic date.
// ---------------------------------------------------------------------------

const DATE_FIELDS = {
  Property: "created_date",
  Unit: "created_date",
  Tenant: "created_date",
  Equipment: "install_date",
  Conversation: "last_message_at",
  Message: "timestamp",
  AITriage: "created_at",
  MaintenanceTicket: "created_date",
  Contractor: "created_date",
  ComplianceRecord: "expiry_date",
  Bill: "due_date",
  Transaction: "date",
  ActivityEvent: "timestamp",
  IntegrationLog: "timestamp",
  Tenancy: "start_date",
  ShortLetBooking: "check_in",
};

export function getRecordDate(record, entityName) {
  if (!record) return null;
  const field = DATE_FIELDS[entityName];
  const v = field ? record[field] : record.created_date;
  if (!v) return null;
  const d = typeof v === "string" ? parseISO(v) : v;
  return isNaN(d) ? null : d;
}

export function inRange(record, entityName, { start, end }) {
  if (!start || !end) return true;
  const d = getRecordDate(record, entityName);
  if (!d) return false;
  try {
    return isWithinInterval(d, { start: day(start), end: endOfDay(end) });
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Delta maths — returns null when comparison isn't available.
// ---------------------------------------------------------------------------

export function computeDelta(current, previous) {
  if (previous == null || previous === 0) return null;
  return ((current - previous) / Math.abs(previous)) * 100;
}

export function formatRangeLabel({ start, end }) {
  if (!start || !end) return "All time";
  const sameDay = format(start, "dd/MM/yyyy") === format(end, "dd/MM/yyyy");
  return sameDay
    ? format(start, "dd MMM yyyy")
    : `${format(start, "dd MMM yyyy")} – ${format(end, "dd MMM yyyy")}`;
}