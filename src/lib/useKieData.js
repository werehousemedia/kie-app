import { useState, useEffect, useCallback, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useDemoFilter } from "@/lib/DemoFilterContext";

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

// Every query degrades independently: one failing entity must never blank
// the whole app. Failures fall back to [] and are reported via `error`.
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

export function useKieData() {
  const { hideDemo } = useDemoFilter();
  const [raw, setRaw] = useState(EMPTY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadAll = useCallback(async () => {
    setLoading(true);
    const keys = Object.keys(SOURCES);
    const settled = await Promise.allSettled(keys.map((k) => SOURCES[k]()));
    const next = { ...EMPTY };
    const failed = [];
    settled.forEach((res, i) => {
      if (res.status === "fulfilled") {
        next[keys[i]] = res.value || [];
      } else {
        failed.push(keys[i]);
        console.warn(`useKieData: ${keys[i]} failed to load`, res.reason);
      }
    });
    setRaw(next);
    setError(failed.length > 0 ? `Some data failed to load: ${failed.join(", ")}` : null);
    setLoading(false);
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  const data = useMemo(() => {
    if (!hideDemo) return raw;
    const out = { ...raw };
    for (const k of DEMO_FILTERED) out[k] = (raw[k] || []).filter((x) => !x.is_demo);
    return out;
  }, [raw, hideDemo]);

  return { ...data, loading, error, reload: loadAll };
}
