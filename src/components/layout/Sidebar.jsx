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
} from "lucide-react";

const navItems = [
  { to: "/", label: "Overview", icon: LayoutDashboard, end: true },
  { to: "/whatsapp", label: "WhatsApp Assistant", icon: MessageSquare },
  { to: "/properties", label: "Properties", icon: Building2 },
  { to: "/tenants", label: "Tenants", icon: Users },
  { to: "/finance", label: "Finance & Bills", icon: Wallet },
  { to: "/maintenance", label: "Maintenance", icon: Wrench },
  { to: "/contractors", label: "Contractors", icon: HardHat },
  { to: "/compliance", label: "Compliance & Documents", icon: FileCheck },
  { to: "/activity", label: "Activity Timeline", icon: Activity },
  { to: "/integrations", label: "Integrations & Settings", icon: Settings },
];

export default function Sidebar() {
  return (
    <aside className="fixed left-0 top-0 h-screen w-64 bg-[hsl(var(--navy))] text-white flex flex-col z-40">
      <div className="px-6 py-5 border-b border-white/10">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-lg bg-[hsl(var(--sage))] flex items-center justify-center">
            <Home className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight">KIE Property</h1>
            <p className="text-[11px] text-white/50 font-medium">Landlord Operations</p>
          </div>
        </div>
      </div>
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  isActive
                    ? "bg-[hsl(var(--sage))] text-white shadow-sm"
                    : "text-white/60 hover:text-white hover:bg-white/5"
                }`
              }
            >
              <Icon className="w-[18px] h-[18px] shrink-0" />
              <span>{item.label}</span>
            </NavLink>
          );
        })}
      </nav>
      <div className="px-4 py-3 border-t border-white/10">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-[hsl(var(--sage))] flex items-center justify-center text-xs font-bold text-white">
            KP
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">KIE Property</p>
            <p className="text-[11px] text-white/40">Admin workspace</p>
          </div>
        </div>
      </div>
    </aside>
  );
}