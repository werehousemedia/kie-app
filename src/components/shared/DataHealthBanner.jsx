import React, { useState, useEffect } from "react";
import { subscribeKieData, getKieDataFailures, reloadKieData } from "@/lib/useKieData";

// Amber strip shown by AppLayout whenever a data refresh partially failed
// (e.g. rate limiting). Data on screen stays usable — last good values —
// and one click retries. Replaces the old behaviour of silently blanking
// every list when a single query failed.
export default function DataHealthBanner() {
  const [, setTick] = useState(0);
  useEffect(() => subscribeKieData(() => setTick((t) => t + 1)), []);
  if (getKieDataFailures().length === 0) return null;
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-2 bg-amber-50 border-b border-amber-200 text-amber-800 text-sm">
      <span>Some data couldn't refresh just now — showing the last loaded values.</span>
      <button
        onClick={() => reloadKieData()}
        className="shrink-0 px-3 py-1 rounded-lg border border-amber-300 hover:bg-amber-100 font-medium"
      >
        Retry
      </button>
    </div>
  );
}
