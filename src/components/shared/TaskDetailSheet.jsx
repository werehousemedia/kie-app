import React, { useMemo } from "react";
import { Link } from "react-router-dom";
import {
  Building2, HardHat, MessageSquare, Mail, Phone, ExternalLink,
  CalendarDays, Wrench, FileCheck, Wallet, CheckCircle2,
} from "lucide-react";
import { useKieData } from "@/lib/useKieData";
import {
  formatDate, formatDateTime, daysUntil, urgencyColor, formatGBP,
  waMeLink, gmailComposeLink, statusColor, timeAgo,
} from "@/lib/kieUtils";
import { kindMeta, taskKind } from "@/lib/kindTaxonomy";
import { TASK_STATUSES } from "@/lib/taskUtils";
import { TenantAvatar } from "@/components/shared/TenantChip";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

const statusPill = (s) =>
  s === "Done"
    ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"
    : s === "In progress"
      ? "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300"
      : "bg-slate-100 text-slate-600 dark:bg-slate-500/15 dark:text-slate-300";

function Section({ title, children }) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">{title}</p>
      {children}
    </div>
  );
}

function ActionButton({ href, to, onClick, icon: Icon, children, primary }) {
  const cls = cn(
    "inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors",
    primary
      ? "bg-primary text-primary-foreground hover:opacity-90"
      : "border bg-card hover:bg-muted"
  );
  if (href) {
    return (
      <a href={href} target="_blank" rel="noreferrer" className={cls}>
        <Icon className="w-3.5 h-3.5" /> {children}
      </a>
    );
  }
  if (to) {
    return (
      <Link to={to} className={cls}>
        <Icon className="w-3.5 h-3.5" /> {children}
      </Link>
    );
  }
  return (
    <button onClick={onClick} className={cls}>
      <Icon className="w-3.5 h-3.5" /> {children}
    </button>
  );
}

// Slide-over detail for one Task: what's happening, the record that spawned
// it, the property/tenant/contractor involved, and every relevant action.
export default function TaskDetailSheet({ task, onClose, onBook, onStatusChange }) {
  const { properties, tenants, contractors, tickets, compliance, bills, conversations, activity } = useKieData();

  const ctx = useMemo(() => {
    if (!task) return {};
    const property = properties.find((p) => p.id === task.property_id) || null;
    const tenant =
      tenants.find((t) => t.id === task.tenant_id) ||
      (property ? tenants.find((t) => t.property_id === property.id) : null) ||
      null;
    const contractor = contractors.find((c) => c.id === task.contractor_id) || null;
    const source =
      task.source_type === "MaintenanceTicket" ? tickets.find((x) => x.id === task.source_id)
      : task.source_type === "ComplianceRecord" ? compliance.find((x) => x.id === task.source_id)
      : task.source_type === "Bill" ? bills.find((x) => x.id === task.source_id)
      : task.source_type === "Conversation" ? conversations.find((x) => x.id === task.source_id)
      : null;
    const events = activity
      .filter((a) => a.related_id === task.id || a.related_id === task.source_id ||
        (a.property_id && a.property_id === task.property_id))
      .sort((a, b) => String(b.timestamp || "").localeCompare(String(a.timestamp || "")))
      .slice(0, 4);
    return { property, tenant, contractor, source, events };
  }, [task, properties, tenants, contractors, tickets, compliance, bills, conversations, activity]);

  if (!task) return null;
  const meta = kindMeta(taskKind(task));
  const KindIcon = meta.icon;
  const d = daysUntil(task.due_date);
  const overdue = d != null && d < 0 && task.status !== "Done";
  const { property, tenant, contractor, source, events } = ctx;

  const wa = waMeLink(tenant?.phone);
  const gmail = gmailComposeLink(tenant?.email);

  // Source-specific description + deep link.
  let sourceBlock = null;
  if (task.source_type === "MaintenanceTicket" && source) {
    sourceBlock = {
      icon: Wrench,
      label: "Maintenance job",
      to: `/maintenance?ticket=${source.id}`,
      linkLabel: "Open job",
      body: (
        <>
          <p className="text-sm">{source.description}</p>
          <p className="text-xs text-muted-foreground mt-1.5">
            Status <span className={cn("inline-flex rounded-full px-1.5 py-0.5 font-medium ml-0.5", statusColor(source.status))}>{source.status}</span>
            {source.appointment_date && <> · visit {formatDateTime(source.appointment_date)}</>}
            {source.cost_estimate != null && <> · est. {formatGBP(source.cost_estimate)}</>}
          </p>
        </>
      ),
    };
  } else if (task.source_type === "ComplianceRecord" && source) {
    sourceBlock = {
      icon: FileCheck,
      label: "Compliance record",
      to: "/compliance",
      linkLabel: "Open compliance",
      body: (
        <p className="text-sm">
          {source.category} {source.provider ? `(${source.provider}) ` : ""}
          {source.expiry_date && (
            <span className={cn(overdue && "text-rose-600 dark:text-rose-400 font-medium")}>
              — {d < 0 ? `expired ${formatDate(source.expiry_date)}, ${Math.abs(d)}d overdue` : `expires ${formatDate(source.expiry_date)} (${d}d)`}
            </span>
          )}
        </p>
      ),
    };
  } else if (task.source_type === "Bill" && source) {
    sourceBlock = {
      icon: Wallet,
      label: "Rent bill",
      to: "/finance?tab=rent&status=Overdue",
      linkLabel: "Open finance",
      body: (
        <p className="text-sm">
          {formatGBP(source.amount)} due {formatDate(source.due_date)}
          {overdue && <span className="text-rose-600 dark:text-rose-400 font-medium"> — {Math.abs(d)}d overdue</span>}
          {source.status && <span className="text-muted-foreground"> · {source.status}</span>}
        </p>
      ),
    };
  } else if (task.source_type === "Conversation" && source) {
    sourceBlock = {
      icon: MessageSquare,
      label: "WhatsApp conversation",
      to: `/whatsapp?conversation=${source.id}`,
      linkLabel: "Open conversation",
      body: (
        <>
          {source.last_message && <p className="text-sm italic">“{source.last_message.slice(0, 160)}”</p>}
          <p className="text-xs text-muted-foreground mt-1">
            {source.status}{source.unread_count > 0 ? ` · ${source.unread_count} unread` : ""} · last message {timeAgo(source.last_message_at)}
          </p>
        </>
      ),
    };
  }

  return (
    <Sheet open={!!task} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader className="text-left space-y-2">
          <div className="flex items-center gap-2">
            <span className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium", meta.chip)}>
              <KindIcon className="w-3 h-3" /> {task.category}
            </span>
            <span className={cn("inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium capitalize", urgencyColor(task.urgency))}>
              {task.urgency}
            </span>
          </div>
          <SheetTitle className="text-base leading-snug pr-6">{task.title}</SheetTitle>
          <SheetDescription className="flex items-center gap-3 text-xs">
            {task.due_date && (
              <span className={cn("inline-flex items-center gap-1 tabular-nums", overdue && "text-rose-600 dark:text-rose-400 font-semibold")}>
                <CalendarDays className="w-3.5 h-3.5" />
                {formatDate(task.due_date)}{overdue && ` · ${Math.abs(d)}d overdue`}
              </span>
            )}
            <span>Created {formatDate(task.created_date)}</span>
          </SheetDescription>
        </SheetHeader>

        <div className="mt-4 space-y-5">
          {/* Status control */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Status</span>
            <Select value={task.status} onValueChange={(v) => onStatusChange(task, v)}>
              <SelectTrigger className={cn("h-7 w-[130px] border-0 text-[11px] font-medium rounded-full px-2.5", statusPill(task.status))}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TASK_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
            {task.status !== "Done" && (
              <button
                onClick={() => onStatusChange(task, "Done")}
                className="ml-auto inline-flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400 hover:underline"
              >
                <CheckCircle2 className="w-3.5 h-3.5" /> Mark done
              </button>
            )}
          </div>

          {task.description && <p className="text-sm text-muted-foreground">{task.description}</p>}

          {/* What spawned this task */}
          {sourceBlock && (
            <Section title="What's happening">
              <div className={cn("rounded-xl border bg-card p-3 border-l-[3px]", meta.border)}>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1.5">
                  <sourceBlock.icon className="w-3.5 h-3.5" /> {sourceBlock.label}
                  <Link to={sourceBlock.to} className="ml-auto inline-flex items-center gap-1 font-medium text-[hsl(var(--sage))] hover:underline">
                    {sourceBlock.linkLabel} <ExternalLink className="w-3 h-3" />
                  </Link>
                </div>
                {sourceBlock.body}
              </div>
            </Section>
          )}

          {/* Property / tenant / contractor */}
          <Section title="Property & people">
            <div className="rounded-xl border divide-y divide-border">
              {property && (
                <Link to={`/properties/${property.id}`} className="flex items-center gap-2.5 px-3 py-2.5 hover:bg-muted transition-colors">
                  <Building2 className="w-4 h-4 text-indigo-500 shrink-0" />
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm font-medium truncate">{property.name}</span>
                    <span className="block text-xs text-muted-foreground truncate">
                      {[property.address, property.postcode].filter(Boolean).join(", ")}
                    </span>
                  </span>
                  <ExternalLink className="w-3.5 h-3.5 text-muted-foreground/50 shrink-0" />
                </Link>
              )}
              {tenant && (
                <div className="flex items-center gap-2.5 px-3 py-2.5">
                  <TenantAvatar tenant={tenant} size="sm" />
                  <span className="flex-1 min-w-0">
                    <Link to={`/tenants/${tenant.id}`} className="block text-sm font-medium truncate hover:underline">{tenant.name}</Link>
                    <span className="block text-xs text-muted-foreground truncate">{tenant.phone || tenant.email || "—"}</span>
                  </span>
                  {wa && (
                    <a href={wa} target="_blank" rel="noreferrer" aria-label={`WhatsApp ${tenant.name}`} className="p-1.5 rounded-lg hover:bg-muted text-emerald-600 dark:text-emerald-400">
                      <MessageSquare className="w-4 h-4" />
                    </a>
                  )}
                  {gmail && (
                    <a href={gmail} target="_blank" rel="noreferrer" aria-label={`Email ${tenant.name}`} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground">
                      <Mail className="w-4 h-4" />
                    </a>
                  )}
                </div>
              )}
              {contractor && (
                <div className="flex items-center gap-2.5 px-3 py-2.5">
                  <HardHat className="w-4 h-4 text-orange-500 shrink-0" />
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm font-medium truncate">{contractor.name}</span>
                    <span className="block text-xs text-muted-foreground truncate">{contractor.trade}{contractor.rating ? ` · ★ ${contractor.rating}` : ""}</span>
                  </span>
                  {contractor.phone && (
                    <a href={`tel:${contractor.phone}`} aria-label={`Call ${contractor.name}`} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground">
                      <Phone className="w-4 h-4" />
                    </a>
                  )}
                </div>
              )}
            </div>
          </Section>

          {/* Recent activity — the evidence trail for this task/property */}
          {events?.length > 0 && (
            <Section title="Recent activity">
              <div className="rounded-xl border divide-y divide-border">
                {events.map((e) => (
                  <div key={e.id} className="px-3 py-2">
                    <p className="text-xs leading-snug">{e.description}</p>
                    <p className="text-[11px] text-muted-foreground tabular-nums mt-0.5">{formatDateTime(e.timestamp)}</p>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* Actions */}
          <div className="flex flex-wrap gap-2 pt-1 pb-6">
            {task.status !== "Done" && (
              <ActionButton primary icon={HardHat} onClick={() => onBook(task)}>
                {task.contractor_id ? "Rebook contractor" : "Book contractor"}
              </ActionButton>
            )}
            {wa && <ActionButton icon={MessageSquare} href={wa}>WhatsApp tenant</ActionButton>}
            {gmail && <ActionButton icon={Mail} href={gmail}>Email tenant</ActionButton>}
            {sourceBlock && <ActionButton icon={sourceBlock.icon} to={sourceBlock.to}>{sourceBlock.linkLabel}</ActionButton>}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
