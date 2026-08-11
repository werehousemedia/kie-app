import React, { useState, useEffect } from "react";
import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";
import MobileTabBar from "./MobileTabBar";
import CommandPalette from "./CommandPalette";
import QuickAddModal from "@/components/shared/QuickAddModal";
import { DemoFilterProvider } from "@/lib/DemoFilterContext";
import { DateRangeProvider } from "@/lib/DateRangeContext";
import DataHealthBanner from "@/components/shared/DataHealthBanner";

export default function AppLayout() {
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);

  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <DemoFilterProvider>
      <DateRangeProvider>
      <div className="min-h-screen bg-background">
        <Sidebar />
        <div className="lg:pl-64 flex flex-col min-h-screen">
          <Topbar
            onQuickAdd={() => setQuickAddOpen(true)}
            onOpenPalette={() => setPaletteOpen(true)}
          />
          <DataHealthBanner />
          {/* pb-28 clears the floating mobile tab bar */}
          <main className="flex-1 w-full max-w-[1440px] mx-auto px-4 sm:px-6 py-5 pb-28 lg:pb-8">
            <Outlet />
          </main>
        </div>
        <MobileTabBar />
        <QuickAddModal open={quickAddOpen} onClose={() => setQuickAddOpen(false)} />
        <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
      </div>
      </DateRangeProvider>
    </DemoFilterProvider>
  );
}