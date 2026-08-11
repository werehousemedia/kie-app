import React from "react";
import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  MessageSquare,
  Building2,
  Users,
  Wallet,
  Wrench,
  HardHat,
  FileCheck,
  Activity,
  Settings,
  Home,
  Upload,
  Palmtree,
} from "lucide-react";
import { useKieData } from "@/lib/useKieData";
import { daysUntil } from "@/lib/kieUtils";

function NavBadge({ count, tone = "default" }) {
  if (!count) return null;
  return (
    <span
      className={`ml-auto min-w-[20px] h-5 px-1.5 rounded-full text-[11px] font-semibold flex items-center justify-center tabular-nums ${
        tone === "critical"
          ? "bg-rose-500 text-white"
          : "bg-white/10 text-white/80"
      }`}
    >
      {count > 9 ? "9+" : count}
    </span>
  );
}

function Item({ to, label, icon: Icon, end, badge, badgeTone }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
          isActive
            ? "bg-[hsl(var(--sidebar-primary))] text-white shadow-sm"
            : "text-white/60 hover:text-white hover:bg-white/5"
        }`
      }
    >
      <Icon className="w-[18px] h-[18px] shrink-0" />
      <span className="truncate">{label}</span>
      <NavBadge count={badge} tone={badgeTone} />
    </NavLink>
  );
}

function Group({ label, children }) {
  return (
    <div>
      {label && (
        <p className="px-3 pt-4 pb-1.5 text-[11px] font-semibold text-white/35 tracking-wide">
          {label}
        </p>
      )}
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}

// Desktop-only navigation (hidden below lg — MobileTabBar takes over).
// Brand navy in both themes: the app's anchor surface.
export default function Sidebar() {
  const { conversations, tickets, compliance } = useKieData();

  const unread = conversations.reduce((n, c) => n + (c.unread_count || 0), 0);
  const openTickets = tickets.filter(
    (t) => t.status !== "Complete" && t.status !== "Cancelled"
  ).length;
  const expired = compliance.filter((c) => {
    const d = daysUntil(c.expiry_date);
    return d != null && d < 0;
  }).length;
  const expiring = compliance.filter((c) => {
    const d = daysUntil(c.expiry_date);
    return d != null && d >= 0 && d <= 30;
  }).length;

  return (
    <aside className="hidden lg:flex fixed left-0 top-0 h-screen w-64 bg-[hsl(var(--sidebar-background))] flex-col z-40 border-r border-[hsl(var(--sidebar-border))]">
      <div className="px-5 py-5">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-[hsl(var(--sidebar-primary))] flex items-center justify-center shadow-sm">
            <Home className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-[15px] font-semibold tracking-tight text-white leading-tight">
              KIE Property
            </h1>
            <p className="text-[11px] text-white/45 font-medium">
              Landlord operations
            </p>
          </div>
        </div>
      </div>
      <nav className="flex-1 px-3 pb-4 overflow-y-auto">
        <div className="space-y-0.5">
          <Item to="/" label="Overview" icon={LayoutDashboard} end />
        </div>
        <Group label="PORTFOLIO">
          <Item to="/properties" label="Properties" icon={Building2} />
          <Item to="/tenants" label="Tenants" icon={Users} />
          <Item to="/shortlets" label="Short lets" icon={Palmtree} />
        </Group>
        <Group label="OPERATIONS">
          <Item
            to="/whatsapp"
            label="Inbox"
            icon={MessageSquare}
            badge={unread}
            badgeTone="critical"
          />
          <Item
            to="/maintenance"
            label="Maintenance"
            icon={Wrench}
            badge={openTickets}
          />
          <Item
            to="/compliance"
            label="Compliance"
            icon={FileCheck}
            badge={expired + expiring}
            badgeTone={expired > 0 ? "critical" : "default"}
          />
          <Item to="/contractors" label="Contractors" icon={HardHat} />
        </Group>
        <Group label="MONEY">
          <Item to="/finance" label="Finance & Bills" icon={Wallet} />
        </Group>
        <Group label="SYSTEM">
          <Item to="/activity" label="Activity" icon={Activity} />
          <Item to="/integrations" label="Integrations" icon={Settings} />
          <Item to="/import" label="Import data" icon={Upload} />
        </Group>
      </nav>
      <div className="px-4 py-3 border-t border-[hsl(var(--sidebar-border))]">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-[hsl(var(--sidebar-primary))] flex items-center justify-center text-xs font-bold text-white">
            KP
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate">KIE Property</p>
            <p className="text-[11px] text-white/40">Admin workspace</p>
          </div>
        </div>
      </div>
    </aside>
  );
}