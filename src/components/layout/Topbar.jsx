import React, { useState } from "react";
import { Search, Bell, Plus, Calendar, Eye, EyeOff } from "lucide-react";
import { useDemoFilter } from "@/lib/DemoFilterContext";

export default function Topbar({ onQuickAdd }) {
  const [today] = useState(new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" }));
  const { hideDemo, setHideDemo } = useDemoFilter();

  return (
    <header className="sticky top-0 z-30 h-16 bg-white/80 backdrop-blur-md border-b border-slate-200 flex items-center gap-4 px-4 sm:px-6">
      <div className="relative flex-1 max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="text"
          placeholder="Search properties, tenants, tickets..."
          className="w-full pl-10 pr-4 py-2 bg-slate-100 border border-transparent rounded-lg text-sm focus:outline-none focus:bg-white focus:border-slate-300 transition-all"
        />
      </div>
      <button
        onClick={() => setHideDemo(!hideDemo)}
        title={hideDemo ? "Showing real data only — click to reveal demo data" : "Showing all data — click to hide demo records"}
        className={`flex items-center gap-2 text-sm px-3 py-2 rounded-lg transition-colors shrink-0 ${hideDemo ? "bg-[hsl(var(--sage-light))] text-[hsl(var(--sage))]" : "text-slate-500 hover:bg-slate-50"}`}
      >
        {hideDemo ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        <span className="font-medium hidden sm:inline">{hideDemo ? "Demo hidden" : "Demo shown"}</span>
      </button>
      <div className="hidden md:flex items-center gap-2 text-sm text-slate-500 px-3 py-2 rounded-lg hover:bg-slate-50 cursor-pointer">
        <Calendar className="w-4 h-4" />
        <span className="font-medium">{today}</span>
      </div>
      <button className="relative p-2 rounded-lg hover:bg-slate-100 transition-colors">
        <Bell className="w-5 h-5 text-slate-600" />
        <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-rose-500 rounded-full ring-2 ring-white"></span>
      </button>
      <button
        onClick={onQuickAdd}
        className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-[hsl(var(--navy))] text-white rounded-lg text-sm font-medium hover:bg-[hsl(var(--navy-light))] transition-colors shadow-sm shrink-0"
      >
        <Plus className="w-4 h-4" />
        <span className="hidden sm:inline">Add new</span>
      </button>
    </header>
  );
}