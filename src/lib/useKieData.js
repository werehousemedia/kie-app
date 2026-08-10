import { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useDemoFilter } from "@/lib/DemoFilterContext";

// ---------------------------------------------------------------------------
// Shared data store.
//
// Every page used to mount its own copy of this hook and fire 15 parallel
// entity queries — so clicking around the app produced request bursts that
// tripped the platform rate limiter (HTTP 429), and one failed query blanked
// every list on screen. This store fixes that structurally:
//   • ONE shared fetch, cached for TTL — navigation renders instantly from
//     cache instead of re-querying the world.
//   • Promise.allSettled + per-key retry with backoff — a throttled query
//     retries; a failed one falls back to the last good data for that key.
//   • Failures are surfaced via `error` (rendered by DataHealthBanner in the
//     app layout) — never a silent blank page.
// ---------------------------------------------------------------------------

// Entities whose demo records are hidden when the toggle is on.
// Contractors and IntegrationLogs stay visible in both modes.
const DEMO_FILTERED = [
  "properties", "units", "tenants", "equipment", "conversations",
  "messages", "triages", "tickets", "compliance", "bills",
  "transactions", "activity", "tenancies",
];

const EMPTY = {
  properties: [], units: [], tenants: [], equipment: [], conversations: [],
  messages: [], triages: [], tickets: [], contractors: [], compliance: [],
  bills: [], transactions: [], activity: [], integrationLogs: [], tenancies: [],
};

const SOURCES = {
  properties: () => base44.entities.Property.list(),
  units: () => base44.entities.Unit.list(),
  tenants: () => base44.entities.Tenant.list(),
  equipment: () => base44.entities.Equipment.list(),
  conversations: () => base44.entities.Conversation.list(),
  messages: () => base44.entities.Message.list(),
  triages: () => base44.entities.AITriage.list(),
  tickets: () => base44.entities.MaintenanceTicket.list(),
  contractors: () => base44.entities.Contractor.list(),
  compliance: () => base44.entities.ComplianceRecord.list(),
  bills: () => base44.entities.Bill.list(),
  transactions: () => base44.entities.Transaction.list(),
  activity: () => base44.entities.ActivityEvent.list("-timestamp", 200),
  integrationLogs: () => base44.entities.IntegrationLog.list("-timestamp", 100),
  tenancies: () => base44.entities.Tenancy.list(),
};

const TTL_MS = 30_000;

let cache = null;      // last good data, merged per key
let fetchedAt = 0;
let inflight = null;
let failedKeys = [];
let version = 0;
const listeners = new Set();

function notify() {
  version++;
  for (const l of [...listeners]) l();
}

async function fetchKey(key, attempt = 0) {
  try {
    return await SOURCES[key]();
  } catch (err) {
    if (attempt < 2) {
      // Backoff with jitter — 429s clear within a second or two.
      await new Promise((r) => setTimeout(r, 700 * (attempt + 1) + Math.random() * 500));
      return fetchKey(key, attempt + 1);
    }
    throw err;
  }
}

function load(force = false) {
  if (inflight) return inflight;
  if (!force && cache && Date.now() - fetchedAt < TTL_MS) return Promise.resolve();
  inflight = (async () => {
    const keys = Object.keys(SOURCES);
    const settled = await Promise.allSettled(keys.map((k) => fetchKey(k)));
    const next = { ...(cache || EMPTY) }; // failures keep the last good value
    const failed = [];
    settled.forEach((res, i) => {
      if (res.status === "fulfilled") {
        next[keys[i]] = res.value || [];
      } else {
        failed.push(keys[i]);
        console.warn(`useKieData: ${keys[i]} failed to load`, res.reason);
      }
    });
    cache = next;
    fetchedAt = Date.now();
    failedKeys = failed;
  })().finally(() => {
    inflight = null;
    notify();
  });
  notify();
  return inflight;
}

export function useKieData() {
  const { hideDemo } = useDemoFilter();
  const [, setTick] = useState(0);

  useEffect(() => {
    const listener = () => setTick((t) => t + 1);
    listeners.add(listener);
    load();
    return () => listeners.delete(listener);
  }, []);

  const raw = cache || EMPTY;
  const loading = !cache; // only the very first load shows spinners
  const error = failedKeys.length > 0
    ? `Some data couldn't refresh (${failedKeys.join(", ")}). Showing the last loaded values.`
    : null;

  const data = useMemo(() => {
    if (!hideDemo) return raw;
    const out = { ...raw };
    for (const k of DEMO_FILTERED) out[k] = (raw[k] || []).filter((x) => !x.is_demo);
    return out;
  }, [raw, hideDemo]);

  return { ...data, loading, error, refreshing: !!inflight, reload: () => load(true) };
}

// Store internals for DataHealthBanner (kept JSX-free in this .js module).
export function subscribeKieData(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
export function getKieDataFailures() {
  return failedKeys;
}
export function reloadKieData() {
  return load(true);
}
