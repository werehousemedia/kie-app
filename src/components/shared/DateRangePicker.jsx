import React, { useState } from "react";
import { Calendar, ChevronDown, GitCompareArrows } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as DatePicker } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  PRESETS, COMPARE_MODES, PRESET_BY_ID, formatRangeLabel,
} from "@/lib/dateRangePresets";
import { useDateRange } from "@/lib/DateRangeContext";

// Single month shown at a time; custom range uses two clicks (start, then end).
export default function DateRangePicker() {
  const {
    presetId, setPresetId, customRange, setCustomRange,
    compareMode, setCompareMode, range, compare, label,
  } = useDateRange();
  const [open, setOpen] = useState(false);

  const selectPreset = (id) => {
    if (id === "custom") {
      setPresetId("custom");
      if (!customRange) setCustomRange({ start: range?.start, end: range?.end });
      return;
    }
    setPresetId(id);
  };

  const compareLabel = COMPARE_MODES.find((m) => m.id === compareMode)?.label;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className="h-9 gap-2 px-3 text-sm font-medium bg-card"
        >
          <Calendar className="w-4 h-4 text-muted-foreground" />
          <span className="truncate max-w-[180px]">{label}</span>
          {compareMode !== "none" && (
            <span className="inline-flex items-center gap-1 rounded-full bg-[hsl(var(--sage-light))] px-1.5 py-0.5 text-[10px] font-semibold text-[hsl(var(--sage))]">
              <GitCompareArrows className="w-3 h-3" />
              {compareLabel}
            </span>
          )}
          <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-auto p-0"
        sideOffset={8}
      >
        <div className="flex">
          {/* Presets rail */}
          <div className="w-44 border-r bg-muted/30 py-1.5">
            {PRESETS.map((p) => (
              <button
                key={p.id}
                onClick={() => selectPreset(p.id)}
                className={cn(
                  "w-full text-left px-3 py-2 text-sm transition-colors",
                  presetId === p.id
                    ? "bg-[hsl(var(--sage-light))] text-[hsl(var(--sage))] font-semibold"
                    : "hover:bg-muted text-foreground"
                )}
              >
                {p.label}
              </button>
            ))}
            <button
              onClick={() => selectPreset("custom")}
              className={cn(
                "w-full text-left px-3 py-2 text-sm transition-colors",
                presetId === "custom"
                  ? "bg-[hsl(var(--sage-light))] text-[hsl(var(--sage))] font-semibold"
                  : "hover:bg-muted text-foreground"
              )}
            >
              Custom range
            </button>
          </div>

          {/* Custom range calendar + compare toggle */}
          <div className="p-3 space-y-3">
            {presetId === "custom" ? (
              <DatePicker
                mode="range"
                numberOfMonths={2}
                selected={customRange}
                onSelect={(r) => {
                  if (r?.from && r?.to) {
                    setCustomRange({ start: r.from, end: r.to });
                  }
                }}
              />
            ) : (
              <div className="w-[340px] text-sm">
                <p className="font-medium mb-1">{PRESET_BY_ID[presetId]?.label}</p>
                <p className="text-muted-foreground">
                  {formatRangeLabel(range)}
                </p>
                <p className="text-xs text-muted-foreground mt-3">
                  Pick “Custom range” for a dual-calendar picker.
                </p>
              </div>
            )}

            {/* Compare toggle */}
            <div className="border-t pt-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                Compare to
              </p>
              <div className="flex gap-1.5">
                {COMPARE_MODES.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => setCompareMode(m.id)}
                    className={cn(
                      "px-2.5 py-1.5 rounded-md text-xs font-medium border transition-colors",
                      compareMode === m.id
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-card hover:bg-muted border-border"
                    )}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
              {compare && (
                <p className="text-xs text-muted-foreground mt-2">
                  vs {formatRangeLabel(compare)}
                </p>
              )}
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}