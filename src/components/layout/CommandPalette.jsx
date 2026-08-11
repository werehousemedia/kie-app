import React, { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useTheme } from "next-themes";
import {
  LayoutDashboard,
  Building2,
  Users,
  Wallet,
  Wrench,
  HardHat,
  FileCheck,
  Activity,
  Settings,
  Upload,
  MessageSquare,
  Plus,
  Moon,
  Sun,
  Eye,
  Palmtree,
  CalendarDays,
  ClipboardList,
} from "lucide-react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { useKieData } from "@/lib/useKieData";
import { useDemoFilter } from "@/lib/DemoFilterContext";
import { daysUntil } from "@/lib/kieUtils";
import { kindMeta } from "@/lib/kindTaxonomy";

const PAGES = [
  { label: "Overview", to: "/", icon: LayoutDashboard },
  { label: "Calendar", to: "/calendar", icon: CalendarDays },
  { label: "Open Tasks", to: "/tasks", icon: ClipboardList },
  { label: "Properties", to: "/properties", icon: Building2 },
  { label: "Tenants", to: "/tenants", icon: Users },
  { label: "Short lets", to: "/shortlets", icon: Palmtree },
  { label: "Inbox / WhatsApp", to: "/whatsapp", icon: MessageSquare },
  { label: "Finance & Bills", to: "/finance", icon: Wallet },
  { label: "Maintenance", to: "/maintenance", icon: Wrench },
  { label: "Contractors", to: "/contractors", icon: HardHat },
  { label: "Compliance", to: "/compliance", icon: FileCheck },
  { label: "Activity", to: "/activity", icon: Activity },
  { label: "Integrations", to: "/integrations", icon: Settings },
  { label: "Import data", to: "/import", icon: Upload },
];

const ACTIONS = [
  { label: "Add property", to: "/properties?new=1" },
  { label: "Add tenant", to: "/tenants?new=1" },
  { label: "Create maintenance job", to: "/maintenance?new=1" },
  { label: "Add bill", to: "/finance?new=1" },
  { label: "Add compliance record", to: "/compliance?new=1" },
  { label: "Add short-let booking", to: "/shortlets?new=1" },
];

// Global search + actions. ⌘K / Ctrl+K everywhere, search icon on mobile.
export default function CommandPalette({ open, onOpenChange }) {
  const navigate = useNavigate();
  const { properties, tenants, contractors, tickets, conversations, compliance, bills } = useKieData();
  const { resolvedTheme, setTheme } = useTheme();
  const { hideDemo, setHideDemo } = useDemoFilter();

  const go = (to) => {
    onOpenChange(false);
    navigate(to);
  };

  const openTickets = tickets
    .filter((t) => t.status !== "Complete" && t.status !== "Cancelled")
    .slice(0, 25);

  const propName = (id) => properties.find((p) => p.id === id)?.name || "";

  // Unified status search: typing "overdue" surfaces ONE ungrouped list across
  // properties, tenants, compliance and maintenance, longest-overdue first.
  // Each row carries its kind-of-thing colour tag.
  const overdueResults = useMemo(() => {
    const out = [];
    for (const c of compliance) {
      const d = daysUntil(c.expiry_date);
      if (d != null && d < 0) {
        out.push({ kind: "compliance", days: Math.abs(d), label: `${c.category} — ${propName(c.property_id)}`, to: "/compliance?status=overdue" });
      }
    }
    for (const b of bills) {
      if (b.status !== "Overdue") continue;
      const d = daysUntil(b.due_date);
      out.push({
        kind: "finance",
        days: d != null && d < 0 ? Math.abs(d) : 0,
        label: `${b.category} £${Math.round(b.amount || 0)} — ${propName(b.property_id)}`,
        to: b.category === "Rent" ? "/finance?tab=rent&status=Overdue" : "/finance?tab=bills",
      });
    }
    for (const t of tenants) {
      if (t.payment_status !== "Overdue") continue;
      const bill = bills
        .filter((b) => b.category === "Rent" && b.status === "Overdue" && b.property_id === t.property_id)
        .sort((a, b) => String(a.due_date).localeCompare(String(b.due_date)))[0];
      const d = bill ? daysUntil(bill.due_date) : null;
      out.push({ kind: "tenant", days: d != null && d < 0 ? Math.abs(d) : 0, label: `${t.name} — rent overdue`, to: `/tenants/${t.id}` });
    }
    for (const tk of tickets) {
      if (tk.status === "Complete" || tk.status === "Cancelled") continue;
      const appt = tk.appointment_date ? daysUntil(tk.appointment_date) : null;
      if (appt != null && appt < 0) {
        out.push({ kind: "maintenance", days: Math.abs(appt), label: `${(tk.description || "Job").slice(0, 60)} — missed visit`, to: `/maintenance?ticket=${tk.id}` });
      }
    }
    // Property roll-ups: one row per property with overdue items.
    for (const p of properties) {
      const worst = Math.max(
        0,
        ...compliance.filter((c) => c.property_id === p.id).map((c) => -1 * (daysUntil(c.expiry_date) ?? 0)),
        ...bills.filter((b) => b.property_id === p.id && b.status === "Overdue").map((b) => -1 * (daysUntil(b.due_date) ?? 0)),
      );
      const count =
        compliance.filter((c) => c.property_id === p.id && (daysUntil(c.expiry_date) ?? 1) < 0).length +
        bills.filter((b) => b.property_id === p.id && b.status === "Overdue").length;
      if (count > 0) {
        out.push({ kind: "property", days: worst, label: `${p.name} — ${count} overdue item${count === 1 ? "" : "s"}`, to: `/properties/${p.id}` });
      }
    }
    return out.sort((a, b) => b.days - a.days).slice(0, 30);
  }, [compliance, bills, tenants, tickets, properties]);

  const expiringResults = useMemo(() => {
    const out = [];
    for (const c of compliance) {
      const d = daysUntil(c.expiry_date);
      if (d != null && d >= 0 && d <= 60) {
        out.push({ kind: "compliance", days: d, label: `${c.category} — ${propName(c.property_id)}`, to: "/compliance?status=expiring" });
      }
    }
    return out.sort((a, b) => a.days - b.days).slice(0, 15);
  }, [compliance, properties]);

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Search properties, tenants, jobs — or type an action…" />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        <CommandGroup heading="Quick actions">
          {ACTIONS.map((a) => (
            <CommandItem key={a.label} onSelect={() => go(a.to)}>
              <Plus className="w-4 h-4 mr-2 text-muted-foreground" />
              {a.label}
            </CommandItem>
          ))}
          <CommandItem
            onSelect={() => {
              setTheme(resolvedTheme === "dark" ? "light" : "dark");
              onOpenChange(false);
            }}
          >
            {resolvedTheme === "dark" ? (
              <Sun className="w-4 h-4 mr-2 text-muted-foreground" />
            ) : (
              <Moon className="w-4 h-4 mr-2 text-muted-foreground" />
            )}
            Switch to {resolvedTheme === "dark" ? "light" : "dark"} mode
          </CommandItem>
          <CommandItem
            onSelect={() => {
              setHideDemo(!hideDemo);
              onOpenChange(false);
            }}
          >
            <Eye className="w-4 h-4 mr-2 text-muted-foreground" />
            {hideDemo ? "Show demo data" : "Hide demo data"}
          </CommandItem>
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Go to">
          {PAGES.map((p) => {
            const Icon = p.icon;
            return (
              <CommandItem key={p.to} onSelect={() => go(p.to)}>
                <Icon className="w-4 h-4 mr-2 text-muted-foreground" />
                {p.label}
              </CommandItem>
            );
          })}
        </CommandGroup>
        {overdueResults.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Overdue — longest first">
              {overdueResults.map((r, i) => {
                const meta = kindMeta(r.kind);
                return (
                  <CommandItem
                    key={`ov_${i}`}
                    value={`overdue ${meta.label} ${r.label}`}
                    onSelect={() => go(r.to)}
                  >
                    <span className={`w-2 h-2 rounded-full mr-2 shrink-0 ${meta.dot}`} />
                    <span className="truncate flex-1">{r.label}</span>
                    <span className="ml-2 text-xs font-semibold text-rose-600 dark:text-rose-400 tabular-nums shrink-0">{r.days}d</span>
                    <span className={`ml-2 hidden sm:inline-flex items-center rounded-full border px-1.5 py-0 text-[10px] font-medium shrink-0 ${meta.chip}`}>{meta.label}</span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </>
        )}
        {expiringResults.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Expiring soon — soonest first">
              {expiringResults.map((r, i) => {
                const meta = kindMeta(r.kind);
                return (
                  <CommandItem
                    key={`ex_${i}`}
                    value={`expiring soon ${meta.label} ${r.label}`}
                    onSelect={() => go(r.to)}
                  >
                    <span className={`w-2 h-2 rounded-full mr-2 shrink-0 ${meta.dot}`} />
                    <span className="truncate flex-1">{r.label}</span>
                    <span className="ml-2 text-xs font-semibold text-amber-600 dark:text-amber-400 tabular-nums shrink-0">{r.days}d</span>
                    <span className={`ml-2 hidden sm:inline-flex items-center rounded-full border px-1.5 py-0 text-[10px] font-medium shrink-0 ${meta.chip}`}>{meta.label}</span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </>
        )}
        {properties.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Properties">
              {properties.map((p) => (
                <CommandItem
                  key={p.id}
                  value={`property ${p.name} ${p.address || ""} ${p.postcode || ""}`}
                  onSelect={() => go(`/properties/${p.id}`)}
                >
                  <Building2 className="w-4 h-4 mr-2 text-indigo-500" />
                  <span className="truncate">{p.name}</span>
                  <span className="ml-2 text-xs text-muted-foreground truncate">
                    {p.address}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}
        {tenants.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Tenants">
              {tenants.map((t) => (
                <CommandItem
                  key={t.id}
                  value={`tenant ${t.name} ${t.phone || ""} ${t.email || ""}`}
                  onSelect={() => go(`/tenants/${t.id}`)}
                >
                  <Users className="w-4 h-4 mr-2 text-cyan-500" />
                  {t.name}
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}
        {openTickets.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Open maintenance">
              {openTickets.map((t) => (
                <CommandItem
                  key={t.id}
                  value={`ticket ${t.description || ""} ${t.issue_type || ""}`}
                  onSelect={() => go(`/maintenance?ticket=${t.id}`)}
                >
                  <Wrench className="w-4 h-4 mr-2 text-blue-500" />
                  <span className="truncate">
                    {(t.description || "Maintenance job").slice(0, 60)}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}
        {contractors.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Contractors">
              {contractors.map((c) => (
                <CommandItem
                  key={c.id}
                  value={`contractor ${c.name} ${c.trade || ""}`}
                  onSelect={() => go(`/contractors?contractor=${c.id}`)}
                >
                  <HardHat className="w-4 h-4 mr-2 text-orange-500" />
                  {c.name}
                  <span className="ml-2 text-xs text-muted-foreground">{c.trade}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}
        {conversations.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Conversations">
              {conversations.slice(0, 15).map((c) => {
                const tenant = tenants.find((t) => t.id === c.tenant_id);
                if (!tenant) return null;
                return (
                  <CommandItem
                    key={c.id}
                    value={`conversation ${tenant.name}`}
                    onSelect={() => go(`/whatsapp?conversation=${c.id}`)}
                  >
                    <MessageSquare className="w-4 h-4 mr-2 text-lime-500" />
                    {tenant.name}
                    {(c.unread_count || 0) > 0 && (
                      <span className="ml-2 text-xs font-semibold text-[hsl(var(--sage))]">
                        {c.unread_count} unread
                      </span>
                    )}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </>
        )}
      </CommandList>
    </CommandDialog>
  );
}