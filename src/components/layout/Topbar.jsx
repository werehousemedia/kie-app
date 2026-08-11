import React from "react";
import { Search, Plus, Eye, EyeOff, Moon, Sun, Home } from "lucide-react";
import { useTheme } from "next-themes";
import { useDemoFilter } from "@/lib/DemoFilterContext";
import NotificationCenter from "./NotificationCenter";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

function IconButton({ label, onClick, children }) {
  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={onClick}
            aria-label={label}
            className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            {children}
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom">{label}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export default function Topbar({ onQuickAdd, onOpenPalette }) {
  const { hideDemo, setHideDemo } = useDemoFilter();
  const { resolvedTheme, setTheme } = useTheme();
  const today = new Date().toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });

  return (
    <header className="sticky top-0 z-30 h-14 bg-background/80 backdrop-blur-md border-b flex items-center gap-2 px-4 sm:px-6">
      {/* Mobile brand mark — sidebar is hidden below lg */}
      <div className="lg:hidden flex items-center gap-2 mr-1">
        <div className="w-8 h-8 rounded-lg bg-[hsl(var(--sage))] flex items-center justify-center">
          <Home className="w-[18px] h-[18px] text-white" />
        </div>
        <span className="font-semibold tracking-tight text-foreground">KIE</span>
      </div>

      {/* Desktop search trigger */}
      <button
        onClick={onOpenPalette}
        className="hidden md:flex items-center gap-2 w-72 pl-3 pr-2 py-2 bg-muted rounded-lg text-sm text-muted-foreground hover:bg-secondary border border-transparent hover:border-border transition-all"
      >
        <Search className="w-4 h-4" />
        <span className="flex-1 text-left">Search anything…</span>
        <kbd className="px-1.5 py-0.5 rounded bg-background border text-[10px] font-medium">
          ⌘K
        </kbd>
      </button>

      <div className="flex-1" />

      <span className="hidden xl:block text-sm text-muted-foreground font-medium mr-1">
        {today}
      </span>

      {/* Mobile search icon */}
      <button
        onClick={onOpenPalette}
        aria-label="Search"
        className="md:hidden p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
      >
        <Search className="w-5 h-5" />
      </button>

      <IconButton
        label={hideDemo ? "Demo data hidden — click to show" : "Demo data shown — click to hide"}
        onClick={() => setHideDemo(!hideDemo)}
      >
        {hideDemo ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
      </IconButton>

      <IconButton
        label={resolvedTheme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
        onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
      >
        {resolvedTheme === "dark" ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
      </IconButton>

      <NotificationCenter />

      <button
        onClick={onQuickAdd}
        className="flex items-center gap-1.5 pl-3 pr-3.5 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 transition-opacity shadow-sm shrink-0 active:scale-[0.98]"
      >
        <Plus className="w-4 h-4" />
        <span className="hidden sm:inline">Add</span>
      </button>
    </header>
  );
}