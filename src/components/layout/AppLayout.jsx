import React, { useState } from "react";
import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";
import QuickAddModal from "@/components/shared/QuickAddModal";
import { DemoFilterProvider } from "@/lib/DemoFilterContext";

export default function AppLayout() {
  const [quickAddOpen, setQuickAddOpen] = useState(false);

  return (
    <DemoFilterProvider>
      <div className="min-h-screen bg-[hsl(var(--background))]">
        <Sidebar />
        <div className="ml-64">
          <Topbar onQuickAdd={() => setQuickAddOpen(true)} />
          <main className="p-4 sm:p-6">
            <Outlet />
          </main>
        </div>
        <QuickAddModal open={quickAddOpen} onClose={() => setQuickAddOpen(false)} />
      </div>
    </DemoFilterProvider>
  );
}