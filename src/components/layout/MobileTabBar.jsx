import React, { useState } from "react";
import { NavLink, useLocation, Link } from "react-router-dom";
import {
  LayoutDashboard,
  Building2,
  MessageSquare,
  Wallet,
  Menu,
  Users,
  Wrench,
  FileCheck,
  HardHat,
  Activity,
  Settings,
  Upload,
  Moon,
  Eye,
  Palmtree,
  CalendarDays,
  ClipboardList,
} from "lucide-react";
import { useTheme } from "next-themes";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Switch } from "@/components/ui/switch";
import { useKieData } from "@/lib/useKieData";
import { useDemoFilter } from "@/lib/DemoFilterContext";
import { daysUntil } from "@/lib/kieUtils";

const TABS = [
  { to: "/", label: "Home", icon: LayoutDashboard, end: true },
  { to: "/properties", label: "Properties", icon: Building2 },
  { to: "/whatsapp", label: "Inbox", icon: MessageSquare, badgeKey: "unread" },
  { to: "/finance", label: "Money", icon: Wallet },
];

const MORE_LINKS = [
  { to: "/calendar", label: "Calendar", icon: CalendarDays },
  { to: "/tasks", label: "Open Tasks", icon: ClipboardList, badgeKey: "tasks" },
  { to: "/tenants", label: "Tenants", icon: Users },
  { to: "/shortlets", label: "Short lets", icon: Palmtree },
  { to: "/maintenance", label: "Maintenance", icon: Wrench, badgeKey: "tickets" },
  { to: "/compliance", label: "Compliance", icon: FileCheck, badgeKey: "compliance" },
  { to: "/contractors", label: "Contractors", icon: HardHat },
  { to: "/activity", label: "Activity", icon: Activity },
  { to: "/integrations", label: "Integrations", icon: Settings },
  { to: "/import", label: "Import data", icon: Upload },
];

function TabBadge({ count, critical }) {
  if (!count) return null;
  return (
    <span
      className={`absolute -top-0.5 right-1/2 translate-x-[14px] min-w-[16px] h-4 px-1 rounded-full text-[10px] font-bold flex items-center justify-center tabular-nums ${
        critical ? "bg-rose-500 text-white" : "bg-[hsl(var(--sage))] text-white"
      }`}
    >
      {count > 9 ? "9+" : count}
    </span>
  );
}

// Mobile-only bottom navigation: 4 destinations + "More" drawer holding the
// rest of the app plus quick settings. Floating capsule, safe-area aware.
export default function MobileTabBar() {
  const [moreOpen, setMoreOpen] = useState(false);
  const location = useLocation();
  const { conversations, tickets, compliance, tasks } = useKieData();
  const { hideDemo, setHideDemo } = useDemoFilter();
  const { resolvedTheme, setTheme } = useTheme();

  const badges = {
    tasks: tasks.filter((t) => t.status !== "Done").length,
    unread: conversations.reduce((n, c) => n + (c.unread_count || 0), 0),
    tickets: tickets.filter((t) => t.status !== "Complete" && t.status !== "Cancelled").length,
    compliance: compliance.filter((c) => {
      const d = daysUntil(c.expiry_date);
      return d != null && d <= 30;
    }).length,
  };
  const moreActive = MORE_LINKS.some((l) => location.pathname.startsWith(l.to));
  const moreAttention = badges.compliance > 0;

  return (
    <>
      <nav
        className="lg:hidden fixed bottom-0 inset-x-0 z-40 pb-safe pointer-events-none"
        aria-label="Primary"
      >
        <div className="pointer-events-auto mx-3 mb-2 h-16 rounded-2xl bg-card/90 backdrop-blur-xl border shadow-lg shadow-black/5 dark:shadow-black/30 flex items-stretch">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            return (
              <NavLink
                key={tab.to}
                to={tab.to}
                end={tab.end}
                className={({ isActive }) =>
                  `relative flex-1 flex flex-col items-center justify-center gap-0.5 rounded-xl transition-colors ${
                    isActive ? "text-[hsl(var(--sage))]" : "text-muted-foreground"
                  }`
                }
              >
                <div className="relative">
                  <Icon className="w-[22px] h-[22px]" />
                  <TabBadge
                    count={badges[tab.badgeKey]}
                    critical={tab.badgeKey === "unread"}
                  />
                </div>
                <span className="text-[10px] font-medium">{tab.label}</span>
              </NavLink>
            );
          })}
          <button
            onClick={() => setMoreOpen(true)}
            className={`relative flex-1 flex flex-col items-center justify-center gap-0.5 rounded-xl transition-colors ${
              moreActive ? "text-[hsl(var(--sage))]" : "text-muted-foreground"
            }`}
            aria-label="More"
          >
            <div className="relative">
              <Menu className="w-[22px] h-[22px]" />
              {moreAttention && (
                <span className="absolute -top-0.5 -right-1 w-2 h-2 rounded-full bg-amber-500" />
              )}
            </div>
            <span className="text-[10px] font-medium">More</span>
          </button>
        </div>
      </nav>

      <Drawer open={moreOpen} onOpenChange={setMoreOpen}>
        <DrawerContent>
          <DrawerHeader className="pb-2">
            <DrawerTitle>More</DrawerTitle>
          </DrawerHeader>
          <div className="px-4 pb-6 pb-safe space-y-4">
            <div className="grid grid-cols-4 gap-2">
              {MORE_LINKS.map((l) => {
                const Icon = l.icon;
                const badge = badges[l.badgeKey];
                return (
                  <Link
                    key={l.to}
                    to={l.to}
                    onClick={() => setMoreOpen(false)}
                    className="relative flex flex-col items-center gap-1.5 py-3 rounded-xl hover:bg-muted active:scale-[0.97] transition-all"
                  >
                    <div className="relative w-11 h-11 rounded-xl bg-muted flex items-center justify-center">
                      <Icon className="w-5 h-5 text-foreground" />
                      {badge > 0 && (
                        <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-[hsl(var(--sage))] text-white text-[10px] font-bold flex items-center justify-center tabular-nums">
                          {badge > 9 ? "9+" : badge}
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] font-medium text-center leading-tight">
                      {l.label}
                    </span>
                  </Link>
                );
              })}
            </div>
            <div className="rounded-xl border divide-y divide-border">
              <label className="flex items-center gap-3 px-4 py-3">
                <Moon className="w-[18px] h-[18px] text-muted-foreground" />
                <span className="flex-1 text-sm font-medium">Dark mode</span>
                <Switch
                  checked={resolvedTheme === "dark"}
                  onCheckedChange={(v) => setTheme(v ? "dark" : "light")}
                />
              </label>
              <label className="flex items-center gap-3 px-4 py-3">
                <Eye className="w-[18px] h-[18px] text-muted-foreground" />
                <span className="flex-1 text-sm font-medium">Show demo data</span>
                <Switch
                  checked={!hideDemo}
                  onCheckedChange={(v) => setHideDemo(!v)}
                />
              </label>
            </div>
          </div>
        </DrawerContent>
      </Drawer>
    </>
  );
}