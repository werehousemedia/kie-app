import React, { useState, useEffect } from "react";
import { RefreshCw } from "lucide-react";
import { subscribeKieData, getKieDataFailures, reloadKieData } from "@/lib/useKieData";

// Amber strip shown by AppLayout whenever a data refresh partially failed
// (e.g. rate limiting). Data on screen stays usable — last good values —
// and one click retries. Replaces the old behaviour of silently blanking
// every list when a single query failed.
export default function DataHealthBanner() {
  const [, setTick] = useState(0);
  const [retrying, setRetrying] = useState(false);
  useEffect(() => subscribeKieData(() => setTick((t) => t + 1)), []);
  const failures = getKieDataFailures();
  if (failures.length === 0) return null;

  const retry = async () => {
    setRetrying(true);
    try {
      await reloadKieData();
    } finally {
      setRetrying(false);
    }
  };

  return (
    <div className="flex items-center justify-between gap-3 px-4 py-2 bg-amber-50 border-b border-amber-200 text-amber-800 dark:bg-amber-500/10 dark:border-amber-500/25 dark:text-amber-300 text-sm">
      <span className="min-w-0 truncate">
        Couldn't refresh {failures.length === 1 ? failures[0] : `${failures.length} data sets`} — showing the last loaded values.
      </span>
      <button
        onClick={retry}
        disabled={retrying}
        className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1 rounded-lg border border-amber-300 hover:bg-amber-100 dark:border-amber-500/40 dark:hover:bg-amber-500/15 font-medium disabled:opacity-60"
      >
        <RefreshCw className={`w-3.5 h-3.5 ${retrying ? "animate-spin" : ""}`} />
        {retrying ? "Retrying…" : "Retry"}
      </button>
    </div>
  );
}