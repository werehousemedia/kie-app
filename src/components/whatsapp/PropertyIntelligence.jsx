import React from "react";
import {
  AlertTriangle, ShieldCheck, Wrench, FileWarning, User,
  Building2, Calendar, Phone, Mail, CheckCircle2, XCircle, Loader2,
} from "lucide-react";
import { useKieData } from "@/lib/useKieData";
import { formatGBP, formatDate, daysUntil, urgencyColor, statusColor, matchContractors } from "@/lib/kieUtils";

export default function PropertyIntelligence({ property, tenant, triageIssueType, onAssignContractor }) {
  const { equipment, compliance, tickets, contractors, bills } = useKieData();

  if (!property) {
    return (
      <div className="w-80 border-l border-slate-200 bg-white p-6 text-center">
        <Building2 className="w-8 h-8 text-slate-300 mx-auto mb-2" />
        <p className="text-sm text-slate-400">Select a conversation to see property intelligence</p>
      </div>
    );
  }

  const propEquipment = equipment.filter((e) => e.property_id === property.id);
  const propCompliance = compliance.filter((c) => c.property_id === property.id);
  const propTickets = tickets.filter((t) => t.property_id === property.id && t.status !== "Complete" && t.status !== "Cancelled");
  const propBills = bills.filter((b) => b.property_id === property.id && b.status !== "Paid");

  const complianceIssues = propCompliance.filter((c) => {
    const d = daysUntil(c.expiry_date);
    return d !== null && d <= 60;
  });
  const equipmentServiceDue = propEquipment.filter((e) => {
    const d = daysUntil(e.next_service_due);
    return d !== null && d <= 60;
  });
  const urgentTickets = propTickets.filter((t) => t.urgency === "emergency" || t.urgency === "high");

  const matchedContractors = triageIssueType ? matchContractors(contractors, triageIssueType, property.postcode) : [];

  return (
    <div className="w-80 border-l border-slate-200 bg-white overflow-y-auto">
      <div className="p-4 border-b border-slate-200">
        <div className="flex items-center gap-2 mb-1">
          <Building2 className="w-4 h-4 text-slate-500" />
          <h3 className="text-sm font-semibold text-slate-900">Property Intelligence</h3>
        </div>
        <p className="text-sm font-medium text-slate-800">{property.name}</p>
        <p className="text-xs text-slate-500">{property.address}, {property.postcode}</p>
        <div className="flex items-center gap-1.5 mt-2">
          <span className={`text-xs px-2 py-0.5 rounded-full ${statusColor(property.occupancy_status)}`}>{property.occupancy_status}</span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">{property.property_type}</span>
          {property.hmo_status !== "Not HMO" && <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-700">{property.hmo_status}</span>}
        </div>
      </div>

      {(complianceIssues.length > 0 || equipmentServiceDue.length > 0 || urgentTickets.length > 0) && (
        <div className="m-4 p-3 bg-rose-50 border border-rose-200 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-4 h-4 text-rose-600" />
            <p className="text-sm font-semibold text-rose-900">Action needed</p>
          </div>
          <div className="space-y-1.5">
            {complianceIssues.map((c) => (
              <div key={c.id} className="flex items-center gap-2 text-xs text-rose-700">
                <FileWarning className="w-3.5 h-3.5 shrink-0" />
                <span>{c.category} expires in {daysUntil(c.expiry_date)}d</span>
              </div>
            ))}
            {equipmentServiceDue.map((e) => (
              <div key={e.id} className="flex items-center gap-2 text-xs text-rose-700">
                <Wrench className="w-3.5 h-3.5 shrink-0" />
                <span>{e.type} service due in {daysUntil(e.next_service_due)}d</span>
              </div>
            ))}
            {urgentTickets.map((t) => (
              <div key={t.id} className="flex items-center gap-2 text-xs text-rose-700">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                <span className="capitalize">{t.urgency}: {t.description?.slice(0, 40)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {tenant && (
        <div className="px-4 py-3 border-b border-slate-100">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Tenant</p>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center">
              <User className="w-4 h-4 text-slate-500" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-slate-800">{tenant.name}</p>
              <p className="text-xs text-slate-500">{tenant.phone}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 mt-2">
            <span className={`text-xs px-2 py-0.5 rounded-full ${statusColor(tenant.payment_status)}`}>{tenant.payment_status}</span>
            <span className="text-xs text-slate-500">{formatGBP(tenant.rent_amount)}/mo</span>
          </div>
        </div>
      )}

      <div className="px-4 py-3 border-b border-slate-100">
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Equipment Register</p>
        {propEquipment.length === 0 ? (
          <p className="text-xs text-slate-400">No equipment registered</p>
        ) : (
          <div className="space-y-2">
            {propEquipment.map((e) => {
              const serviceDue = daysUntil(e.next_service_due);
              return (
                <div key={e.id} className="p-2.5 bg-slate-50 rounded-lg">
                  <div className="flex items-center justify-between mb-0.5">
                    <p className="text-sm font-medium text-slate-800">{e.make} {e.model}</p>
                    <span className="text-[10px] text-slate-400 uppercase">{e.type}</span>
                  </div>
                  <p className="text-xs text-slate-500">Installed {formatDate(e.install_date)}</p>
                  {serviceDue !== null && (
                    <p className={`text-xs mt-0.5 ${serviceDue < 0 ? "text-rose-600" : serviceDue <= 30 ? "text-amber-600" : "text-slate-400"}`}>
                      Next service: {formatDate(e.next_service_due)} ({serviceDue < 0 ? `${Math.abs(serviceDue)}d overdue` : `in ${serviceDue}d`})
                    </p>
                  )}
                  {e.warranty_info && <p className="text-xs text-slate-400 mt-0.5">Warranty: {e.warranty_info}</p>}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="px-4 py-3 border-b border-slate-100">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Compliance</p>
          <ShieldCheck className="w-3.5 h-3.5 text-slate-400" />
        </div>
        {propCompliance.length === 0 ? (
          <p className="text-xs text-slate-400">No compliance records</p>
        ) : (
          <div className="space-y-1.5">
            {propCompliance.map((c) => {
              const d = daysUntil(c.expiry_date);
              return (
                <div key={c.id} className="flex items-center justify-between text-xs">
                  <span className="text-slate-600">{c.category}</span>
                  <span className={`px-1.5 py-0.5 rounded-full ${statusColor(c.status)}`}>
                    {d !== null && d >= 0 ? `${d}d` : c.status}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {propTickets.length > 0 && (
        <div className="px-4 py-3 border-b border-slate-100">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Open Tickets ({propTickets.length})</p>
          <div className="space-y-1.5">
            {propTickets.map((t) => (
              <div key={t.id} className="p-2 bg-slate-50 rounded-lg">
                <div className="flex items-center justify-between mb-0.5">
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${urgencyColor(t.urgency)}`}>{t.urgency}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${statusColor(t.status)}`}>{t.status}</span>
                </div>
                <p className="text-xs text-slate-600 truncate">{t.description}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {matchedContractors.length > 0 && (
        <div className="px-4 py-3 border-b border-slate-100">
          <div className="flex items-center gap-1.5 mb-2">
            <Wrench className="w-3.5 h-3.5 text-[hsl(var(--sage))]" />
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Matched Contractors</p>
          </div>
          <div className="space-y-2">
            {matchedContractors.slice(0, 4).map((c) => (
              <div key={c.id} className="p-2.5 bg-slate-50 rounded-lg">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-1.5">
                    <p className="text-sm font-medium text-slate-800">{c.name}</p>
                    {c.preferred && <span className="text-[9px] bg-[hsl(var(--sage))] text-white px-1 py-0.5 rounded-full">PREFERRED</span>}
                  </div>
                  <span className="text-xs text-amber-500">★ {c.rating}</span>
                </div>
                <p className="text-xs text-slate-500">{c.trade} · {c.coverage_area}</p>
                <div className="flex items-center justify-between mt-1.5">
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${statusColor(c.availability)}`}>{c.availability}</span>
                  <button
                    onClick={() => onAssignContractor?.(c)}
                    className="text-xs font-medium text-[hsl(var(--sage))] hover:underline"
                  >
                    Assign →
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {propBills.length > 0 && (
        <div className="px-4 py-3">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Upcoming Bills</p>
          <div className="space-y-1.5">
            {propBills.slice(0, 4).map((b) => {
              const d = daysUntil(b.due_date);
              return (
                <div key={b.id} className="flex items-center justify-between text-xs">
                  <span className="text-slate-600">{b.category}</span>
                  <div className="text-right">
                    <p className="font-medium text-slate-700">{formatGBP(b.amount)}</p>
                    <p className={`text-[10px] ${d < 0 ? "text-rose-500" : "text-slate-400"}`}>{d < 0 ? `${Math.abs(d)}d overdue` : `in ${d}d`}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}