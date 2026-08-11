import React from "react";
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
  const { properties, tenants, contractors, tickets, conversations } = useKieData();
  const { resolvedTheme, setTheme } = useTheme();
  const { hideDemo, setHideDemo } = useDemoFilter();

  const go = (to) => {
    onOpenChange(false);
    navigate(to);
  };

  const openTickets = tickets
    .filter((t) => t.status !== "Complete" && t.status !== "Cancelled")
    .slice(0, 25);

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
                  <Building2 className="w-4 h-4 mr-2 text-muted-foreground" />
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
                  <Users className="w-4 h-4 mr-2 text-muted-foreground" />
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
                  <Wrench className="w-4 h-4 mr-2 text-muted-foreground" />
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
                  <HardHat className="w-4 h-4 mr-2 text-muted-foreground" />
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
                    <MessageSquare className="w-4 h-4 mr-2 text-muted-foreground" />
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