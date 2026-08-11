import React, { useMemo } from "react";
import { Link } from "react-router-dom";
import {
  Building2,
  ShieldAlert,
  Flame,
  Wrench,
  HardHat,
  Wallet,
  ChevronRight,
  Phone,
} from "lucide-react";
import { useKieData } from "@/lib/useKieData";
import { formatGBP, formatDate, daysUntil, statusColor, urgencyColor } from "@/lib/kieUtils";
import { TenantAvatar } from "@/components/shared/TenantChip";

const STANDARD_CERTS = ["Gas Safety Certificate", "EICR", "EPC"];

function Section({ icon: Icon, title, children, action }) {
  return (
    <div className="px-3 py-3 border-b last:border-b-0">
      <div className="flex items-center gap-1.5 mb-2">
        <Icon className="w-3.5 h-3.5 text-muted-foreground" />
        <p className="text-[11px] font-semibold text-muted-foreground">{title}</p>
        {action && <span className="ml-auto">{action}</span>}
      </div>
      {children}
    </div>
  );
}

// Right rail: everything the landlord needs to know about the property while
// talking to its tenant — compliance gaps FIRST (they're the liability).
export default function PropertyIntelligence({ property, tenant }) {
  const { equipment, compliance, tickets, contractors, bills } = useKieData();

  const gaps = useMemo(() => {
    if (!property) return [];
    const records = compliance.filter((c) => c.property_id === property.id);
    const out = [];
    for (const c of records) {
      const d = daysUntil(c.expiry_date);
      if (c.status === "Missing" || (!c.expiry_date && c.status !== "Compliant")) {
        out.push({ id: c.id, label: c.category, state: "missing" });
      } else if (d != null && d < 0) {
        out.push({ id: c.id, label: `${c.category} — ${Math.abs(d)}d overdue`, state: "overdue" });
      } else if (d != null && d <= 60) {
        out.push({ id: c.id, label: `${c.category} — ${d}d left`, state: "expiring" });
      }
    }
    const have = new Set(records.map((c) => c.category));
    const required = [...STANDARD_CERTS];
    if (property.hmo_status && property.hmo_status !== "Not HMO") required.push("HMO licence");
    for (const cat of required) {
      if (!have.has(cat)) out.push({ id: `absent_${cat}`, label: `${cat} — not on file`, state: "missing" });
    }
    const rank = { overdue: 0, missing: 1, expiring: 2 };
    return out.sort((a, b) => rank[a.state] - rank[b.state]);
  }, [compliance, property]);

  if (!property) {
    return (
      <div className="p-4 text-sm text-muted-foreground">
        Select a conversation to see property intelligence.
      </div>
    );
  }

  const propEquipment = equipment.filter((e) => e.property_id === property.id).slice(0, 5);
  const openTickets = tickets
    .filter((t) => t.property_id === property.id && t.status !== "Complete" && t.status !== "Cancelled")
    .slice(0, 4);
  const nearby = contractors
    .filter((c) => c.preferred || c.availability === "Available")
    .slice(0, 3);
  const recentBills = bills
    .filter((b) => b.property_id === property.id && b.status !== "Paid")
    .slice(0, 3);

  const GAP_STYLE = {
    overdue: "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300",
    missing: "bg-muted text-muted-foreground",
    expiring: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
  };

  return (
    <div className="h-full overflow-y-auto">
      <div className="px-3 py-3 border-b">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
            <Building2 className="w-4 h-4 text-muted-foreground" />
          </div>
          <div className="min-w-0">
            <Link to={`/properties/${property.id}`} className="text-sm font-semibold hover:underline truncate block">
              {property.name}
            </Link>
            <p className="text-xs text-muted-foreground truncate">{property.address}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5 mt-2">
          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${statusColor(property.occupancy_status)}`}>
            {property.occupancy_status || "—"}
          </span>
          <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium">
            {property.property_type}
          </span>
          {property.hmo_status && property.hmo_status !== "Not HMO" && (
            <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium">
              {property.hmo_status}
            </span>
          )}
        </div>
      </div>

      <Section
        icon={ShieldAlert}
        title="Compliance gaps"
        action={
          <Link to="/compliance" className="text-[11px] font-medium text-[hsl(var(--sage))] hover:underline">
            Fix <ChevronRight className="w-3 h-3 inline" />
          </Link>
        }
      >
        {gaps.length === 0 ? (
          <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
            All certificates in order ✓
          </p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {gaps.map((g) => (
              <Link
                key={g.id}
                to={g.state === "overdue" ? "/compliance?status=overdue" : g.state === "missing" ? "/compliance?status=missing" : "/compliance?status=expiring"}
                className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium hover:opacity-80 ${GAP_STYLE[g.state]}`}
              >
                {g.label}
              </Link>
            ))}
          </div>
        )}
      </Section>

      {tenant && (
        <Section icon={Phone} title="Tenant">
          <div className="flex items-center gap-2.5">
            <TenantAvatar tenant={tenant} size="md" />
            <div className="min-w-0 flex-1">
              <Link to={`/tenants/${tenant.id}`} className="text-sm font-medium hover:underline truncate block">
                {tenant.name}
              </Link>
              <p className="text-xs text-muted-foreground truncate">
                {tenant.phone || "no phone"} · rent {tenant.rent_amount ? formatGBP(tenant.rent_amount) : "—"}
              </p>
            </div>
            {tenant.payment_status && (
              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium shrink-0 ${statusColor(tenant.payment_status)}`}>
                {tenant.payment_status}
              </span>
            )}
          </div>
        </Section>
      )}

      {propEquipment.length > 0 && (
        <Section icon={Flame} title="Key equipment">
          <div className="space-y-1.5">
            {propEquipment.map((e) => (
              <div key={e.id} className="text-xs flex items-center gap-2">
                <span className="flex-1 min-w-0 truncate">
                  {[e.make, e.model].filter(Boolean).join(" ") || e.type}
                  <span className="text-muted-foreground"> · {e.location || e.type}</span>
                </span>
                {e.next_service_due && daysUntil(e.next_service_due) != null && daysUntil(e.next_service_due) <= 60 && (
                  <span className="text-[10px] text-amber-600 dark:text-amber-400 font-medium shrink-0">
                    service {daysUntil(e.next_service_due) < 0 ? "overdue" : `in ${daysUntil(e.next_service_due)}d`}
                  </span>
                )}
              </div>
            ))}
          </div>
        </Section>
      )}

      <Section icon={Wrench} title="Open jobs here">
        {openTickets.length === 0 ? (
          <p className="text-xs text-muted-foreground">No open maintenance.</p>
        ) : (
          <div className="space-y-1.5">
            {openTickets.map((t) => (
              <Link key={t.id} to={`/maintenance?ticket=${t.id}`} className="flex items-center gap-2 text-xs hover:underline">
                <span className="flex-1 min-w-0 truncate">{(t.description || "Job").slice(0, 50)}</span>
                <span className={`inline-flex items-center rounded-full border px-1.5 py-0.5 text-[10px] font-medium shrink-0 ${urgencyColor(t.urgency)}`}>
                  {t.urgency || "low"}
                </span>
              </Link>
            ))}
          </div>
        )}
      </Section>

      {nearby.length > 0 && (
        <Section icon={HardHat} title="Go-to contractors">
          <div className="space-y-1.5">
            {nearby.map((c) => (
              <div key={c.id} className="text-xs flex items-center gap-2">
                <span className="flex-1 min-w-0 truncate">
                  {c.name} <span className="text-muted-foreground">· {c.trade}</span>
                </span>
                <span className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium shrink-0 ${statusColor(c.availability)}`}>
                  {c.availability || "—"}
                </span>
              </div>
            ))}
          </div>
        </Section>
      )}

      {recentBills.length > 0 && (
        <Section icon={Wallet} title="Unpaid bills here">
          <div className="space-y-1.5">
            {recentBills.map((b) => (
              <div key={b.id} className="text-xs flex items-center gap-2">
                <span className="flex-1 min-w-0 truncate">
                  {b.category} <span className="text-muted-foreground">· due {formatDate(b.due_date)}</span>
                </span>
                <span className="font-medium tabular-nums shrink-0">{formatGBP(b.amount)}</span>
              </div>
            ))}
          </div>
        </Section>
      )}
    </div>
  );
}