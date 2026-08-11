import React, { createContext, useContext, useMemo, useState } from "react";
import {
  resolvePreset, comparisonRange, PRESET_BY_ID, formatRangeLabel,
} from "@/lib/dateRangePresets";

const DateRangeContext = createContext(null);

// Default to "Last 30 days" — the most useful default for a portfolio overview.
const DEFAULT_PRESET = "last30";
const DEFAULT_COMPARE = "none";

export function DateRangeProvider({ children }) {
  const [presetId, setPresetId] = useState(DEFAULT_PRESET);
  const [customRange, setCustomRange] = useState(null); // { start, end } when presetId === "custom"
  const [compareMode, setCompareMode] = useState(DEFAULT_COMPARE);

  const range = useMemo(() => {
    if (presetId === "custom") return customRange;
    return resolvePreset(presetId);
  }, [presetId, customRange]);

  const compare = useMemo(
    () => (compareMode !== "none" ? comparisonRange(range, compareMode) : null),
    [range, compareMode]
  );

  const value = useMemo(() => ({
    presetId,
    setPresetId,
    customRange,
    setCustomRange,
    compareMode,
    setCompareMode,
    range,
    compare,
    label: formatRangeLabel(range),
  }), [presetId, customRange, compareMode, range, compare]);

  return (
    <DateRangeContext.Provider value={value}>
      {children}
    </DateRangeContext.Provider>
  );
}

export function useDateRange() {
  const ctx = useContext(DateRangeContext);
  if (!ctx) throw new Error("useDateRange must be used within DateRangeProvider");
  return ctx;
}