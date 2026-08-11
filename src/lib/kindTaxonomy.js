import {
  Building2,
  Users,
  HardHat,
  Wrench,
  FileCheck,
  Wallet,
  Palmtree,
  MessageSquare,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Kind-of-thing colour taxonomy — a SECOND colour channel, separate from the
// status channel (green compliant / amber due soon / red overdue / grey
// inactive). Status says "what state is it in"; kind says "what sort of thing
// is it". Kind renders as left-border accents, icon tints, chips and calendar
// event colours — never as status pills, so the two channels can't collide.
//
// Hues deliberately avoid the status palette (emerald / amber / rose / slate):
//   property indigo · tenant cyan · contractor orange · maintenance blue ·
//   compliance violet · finance teal · booking pink · message lime
// ---------------------------------------------------------------------------

export const KINDS = {
  property: {
    id: "property",
    label: "Property",
    icon: Building2,
    hex: "#6366f1", // indigo-500
    border: "border-l-indigo-500",
    dot: "bg-indigo-500",
    text: "text-indigo-600 dark:text-indigo-400",
    chip: "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-500/15 dark:text-indigo-300 dark:border-indigo-500/30",
    softBg: "bg-indigo-50 dark:bg-indigo-500/15",
  },
  tenant: {
    id: "tenant",
    label: "Tenant",
    icon: Users,
    hex: "#06b6d4", // cyan-500
    border: "border-l-cyan-500",
    dot: "bg-cyan-500",
    text: "text-cyan-600 dark:text-cyan-400",
    chip: "bg-cyan-50 text-cyan-700 border-cyan-200 dark:bg-cyan-500/15 dark:text-cyan-300 dark:border-cyan-500/30",
    softBg: "bg-cyan-50 dark:bg-cyan-500/15",
  },
  contractor: {
    id: "contractor",
    label: "Contractor",
    icon: HardHat,
    hex: "#f97316", // orange-500
    border: "border-l-orange-500",
    dot: "bg-orange-500",
    text: "text-orange-600 dark:text-orange-400",
    chip: "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-500/15 dark:text-orange-300 dark:border-orange-500/30",
    softBg: "bg-orange-50 dark:bg-orange-500/15",
  },
  maintenance: {
    id: "maintenance",
    label: "Maintenance",
    icon: Wrench,
    hex: "#3b82f6", // blue-500
    border: "border-l-blue-500",
    dot: "bg-blue-500",
    text: "text-blue-600 dark:text-blue-400",
    chip: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-500/15 dark:text-blue-300 dark:border-blue-500/30",
    softBg: "bg-blue-50 dark:bg-blue-500/15",
  },
  compliance: {
    id: "compliance",
    label: "Compliance",
    icon: FileCheck,
    hex: "#8b5cf6", // violet-500
    border: "border-l-violet-500",
    dot: "bg-violet-500",
    text: "text-violet-600 dark:text-violet-400",
    chip: "bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-500/15 dark:text-violet-300 dark:border-violet-500/30",
    softBg: "bg-violet-50 dark:bg-violet-500/15",
  },
  finance: {
    id: "finance",
    label: "Finance",
    icon: Wallet,
    hex: "#14b8a6", // teal-500
    border: "border-l-teal-500",
    dot: "bg-teal-500",
    text: "text-teal-600 dark:text-teal-400",
    chip: "bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-500/15 dark:text-teal-300 dark:border-teal-500/30",
    softBg: "bg-teal-50 dark:bg-teal-500/15",
  },
  booking: {
    id: "booking",
    label: "Booking",
    icon: Palmtree,
    hex: "#ec4899", // pink-500
    border: "border-l-pink-500",
    dot: "bg-pink-500",
    text: "text-pink-600 dark:text-pink-400",
    chip: "bg-pink-50 text-pink-700 border-pink-200 dark:bg-pink-500/15 dark:text-pink-300 dark:border-pink-500/30",
    softBg: "bg-pink-50 dark:bg-pink-500/15",
  },
  message: {
    id: "message",
    label: "Message",
    icon: MessageSquare,
    hex: "#84cc16", // lime-500
    border: "border-l-lime-500",
    dot: "bg-lime-500",
    text: "text-lime-600 dark:text-lime-400",
    chip: "bg-lime-50 text-lime-700 border-lime-200 dark:bg-lime-500/15 dark:text-lime-300 dark:border-lime-500/30",
    softBg: "bg-lime-50 dark:bg-lime-500/15",
  },
};

export function kindMeta(kindId) {
  return KINDS[kindId] || KINDS.property;
}

// Task.category → kind. General tasks linked to a conversation are message
// work; otherwise they belong to the property.
export function taskKind(task) {
  const map = {
    Maintenance: "maintenance",
    Compliance: "compliance",
    Rent: "finance",
    Contractor: "contractor",
  };
  if (map[task?.category]) return map[task.category];
  return task?.source_type === "Conversation" ? "message" : "property";
}

// Calendar event kind (calendarEvents.js kinds) → taxonomy kind.
export const EVENT_KIND_TO_TAXONOMY = {
  rent: "finance",
  bill: "finance",
  maintenance: "maintenance",
  service: "maintenance",
  warranty: "maintenance",
  compliance: "compliance",
  tenancy: "tenant",
  booking: "booking",
  task: "property", // overridden per-task via taskKind()
};
