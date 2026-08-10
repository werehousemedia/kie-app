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

export function useKieData() {
  const { hideDemo } = useDemoFilter();
  const [raw, setRaw] = useState({
    properties: [], units: [], tenants: [], equipment: [], conversations: [],
    messages: [], triages: [], tickets: [], contractors: [], compliance: [],
    bills: [], transactions: [], activity: [], integrationLogs: [], tenancies: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [
        properties, units, tenants, equipment, conversations, messages,
        triages, tickets, contractors, compliance, bills, transactions, activity, integrationLogs,
        tenancies
      ] = await Promise.all([
        base44.entities.Property.list(),
        base44.entities.Unit.list(),
        base44.entities.Tenant.list(),
        base44.entities.Equipment.list(),
        base44.entities.Conversation.list(),
        base44.entities.Message.list(),
        base44.entities.AITriage.list(),
        base44.entities.MaintenanceTicket.list(),
        base44.entities.Contractor.list(),
        base44.entities.ComplianceRecord.list(),
        base44.entities.Bill.list(),
        base44.entities.Transaction.list(),
        base44.entities.ActivityEvent.list("-timestamp", 200),
        base44.entities.IntegrationLog.list("-timestamp", 100),
        base44.entities.Tenancy.list(),
      ]);
      setRaw({
        properties: properties || [], units: units || [], tenants: tenants || [],
        equipment: equipment || [], conversations: conversations || [], messages: messages || [],
        triages: triages || [], tickets: tickets || [], contractors: contractors || [],
        compliance: compliance || [], bills: bills || [], transactions: transactions || [],
        activity: activity || [], integrationLogs: integrationLogs || [], tenancies: tenancies || [],
      });
    } catch (e) {
      setError(e.message || "Failed to load data");
    } finally {
      setLoading(false);
    }
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