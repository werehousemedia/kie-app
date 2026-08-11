import { base44 } from "@/api/base44Client";
import { reloadKieData } from "@/lib/useKieData";

// Fire-and-forget sweep of the task engine — called right after events that
// should surface a Task immediately (ticket created, job booked) instead of
// waiting for the daily cron. force bypasses the engine's self rate-limit.
// Never throws: task generation failing must not break the user's action.
export function runTaskEngine({ refresh = true } = {}) {
  return base44.functions
    .invoke("task_engine", { force: 1 })
    .then(() => {
      if (refresh) reloadKieData();
    })
    .catch(() => {});
}

export const TASK_STATUSES = ["Open", "In progress", "Done"];
export const TASK_CATEGORIES = ["Maintenance", "Compliance", "Rent", "Contractor", "General"];

export function isOpenTask(t) {
  return t.status !== "Done";
}
