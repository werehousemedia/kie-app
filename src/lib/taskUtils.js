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

// ---------------------------------------------------------------------------
// Contractor ranking — the booking order the spec demands:
// 1. trade / accreditation match (Gas Safe for gas, NICEIC for electrical,
//    DEA for EPC), 2. postcode / area proximity, 3. preferred, 4. rating.
// ---------------------------------------------------------------------------

// What does this task need? Derived from category + title/description text.
export function taskRequirement(task) {
  const text = `${task?.title || ""} ${task?.description || ""}`.toLowerCase();
  if (/epc|energy performance/.test(text)) return { trades: ["General"], accreditation: "DEA", label: "EPC assessor (DEA)" };
  if (/gas|boiler|cp12|carbon monoxide|flue/.test(text)) return { trades: ["Heating/Gas"], accreditation: "Gas Safe", label: "Gas Safe engineer" };
  if (/eicr|electric|socket|fuse|light|pat test|wiring/.test(text)) return { trades: ["Electrical"], accreditation: "NICEIC", label: "NICEIC electrician" };
  if (/heating|radiator|hot water|thermostat/.test(text)) return { trades: ["Heating/Gas", "Plumbing"], accreditation: "Gas Safe", label: "Heating engineer" };
  if (/leak|tap|toilet|drain|pipe|plumb|shower/.test(text)) return { trades: ["Plumbing", "Heating/Gas"], accreditation: null, label: "Plumber" };
  if (/clean|turnaround|linen/.test(text)) return { trades: ["Cleaning"], accreditation: null, label: "Cleaner" };
  if (/lock|key(s| )|door jam/.test(text)) return { trades: ["Locksmith", "General"], accreditation: null, label: "Locksmith" };
  if (/appliance|washing machine|oven|fridge|dishwasher|dryer/.test(text)) return { trades: ["Appliance repair", "General"], accreditation: null, label: "Appliance engineer" };
  if (/roof|gutter|chimney/.test(text)) return { trades: ["Roofing", "General"], accreditation: null, label: "Roofer" };
  if (/pest|mice|rats|wasp/.test(text)) return { trades: ["Pest control"], accreditation: null, label: "Pest control" };
  return { trades: null, accreditation: null, label: null };
}

// Top-N contractors for a task at a property, with human-readable reasons.
export function rankContractors(contractors, task, property, topN = 3) {
  const req = taskRequirement(task);
  const pcLetters = (property?.postcode || "").trim().split(" ")[0].replace(/[0-9].*$/, "").toLowerCase(); // "TN4 8BG" → "tn"
  const addressWords = (property?.address || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter((s) => s.length > 3);
  const town = addressWords[addressWords.length - 1] || "";

  return contractors
    .map((c) => {
      let score = 0;
      const reasons = [];
      const accs = (c.accreditations || []).map((a) => a.toLowerCase());
      if (req.trades?.includes(c.trade)) {
        score += 40;
        reasons.push(`${c.trade} trade match`);
      }
      if (req.accreditation && accs.includes(req.accreditation.toLowerCase())) {
        score += 25;
        reasons.push(`${req.accreditation} accredited`);
      }
      const cov = (c.coverage_area || "").toLowerCase();
      if ((pcLetters && cov.includes(pcLetters)) || (town && cov.includes(town))) {
        score += 15;
        reasons.push("covers the area");
      }
      if (c.preferred) {
        score += 10;
        reasons.push("preferred");
      }
      score += Math.min(10, (c.rating || 0) * 2);
      if (c.availability === "Available") score += 5;
      else if (c.availability === "On holiday" || c.availability === "Booked") score -= 10;
      return { contractor: c, score, reasons, requirement: req.label };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, topN);
}
