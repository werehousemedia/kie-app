import React, { useState } from "react";
import { toast } from "sonner";
import { Play, Sparkles } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { base44 } from "@/api/base44Client";
import { useDemoFilter } from "@/lib/DemoFilterContext";

// Client-demo scenarios: realistic tenant messages fired through the REAL
// autonomous pipeline (triage → auto-reply → ticket if urgent → comms log).
// Nothing is faked — which is the whole pitch.
const SCENARIOS = [
  {
    name: "Emergency — boiler leaking",
    message:
      "Hi, water is pouring out of the bottom of the boiler and I can't find the stopcock. The kitchen floor is already soaked!",
    show: "AI flags it as an emergency, replies with immediate advice, raises a ticket on its own — then you one-tap hire the plumber.",
  },
  {
    name: "Urgent — no heating, error code",
    message:
      "The heating hasn't worked since last night and it's freezing in here. The boiler display is showing error F28.",
    show: "AI reads the error code against the property's boiler record and suggests next steps before a contractor is even called.",
  },
  {
    name: "Routine — washing machine fault",
    message:
      "The washing machine keeps stopping mid-cycle and beeping three times. No rush, but could someone take a look?",
    show: "Low urgency: AI replies and queues it politely — no panic, no ticket spam.",
  },
  {
    name: "Rent query — payment date",
    message:
      "Hi, my salary date has moved to the 15th — would it be OK to pay rent on the 16th from next month?",
    show: "AI recognises a rent conversation, drafts a considerate reply, and doesn't raise a maintenance ticket.",
  },
  {
    name: "Noise complaint",
    message:
      "The flat upstairs plays loud music most nights until about 2am and it's really affecting my sleep. Can anything be done?",
    show: "AI classifies a neighbour issue and suggests the right escalation path.",
  },
];

export default function DemoScenarioModal({ open, onClose, tenants, onResult }) {
  const { setHideDemo } = useDemoFilter();
  const demoTenants = tenants.filter((t) => t.is_demo);
  const pool = demoTenants.length > 0 ? demoTenants : tenants;
  const [tenantId, setTenantId] = useState("");
  const [scenario, setScenario] = useState(SCENARIOS[0].name);
  const [running, setRunning] = useState(false);

  const chosen = SCENARIOS.find((s) => s.name === scenario) || SCENARIOS[0];
  const effectiveTenantId = tenantId || pool[0]?.id || "";

  const run = async () => {
    if (!effectiveTenantId) {
      toast.error("No tenants available — import or add one first");
      return;
    }
    setRunning(true);
    // Demo records must be visible or the resulting conversation is invisible.
    setHideDemo(false);
    try {
      const res = await base44.functions.invoke("handle_inbound_message", {
        tenant_id: effectiveTenantId,
        content: chosen.message,
      });
      const d = res?.data || {};
      const bits = ["AI replied"];
      if (d.ticket_id) bits.push("ticket raised automatically");
      if (d.sheet_logged) bits.push("logged to comms sheet");
      toast.success(`Scenario ran — ${bits.join(", ")}`);
      onResult?.(d);
      onClose();
    } catch (e) {
      toast.error(`Scenario failed: ${e?.response?.data?.error || e.message}`);
    } finally {
      setRunning(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !running && !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Play className="w-4 h-4" /> Run a demo scenario
          </DialogTitle>
          <DialogDescription>
            Fires a realistic tenant message through the live AI pipeline — nothing staged.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 mt-1">
          <div>
            <label className="text-xs font-medium text-muted-foreground">Scenario</label>
            <Select value={scenario} onValueChange={setScenario}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SCENARIOS.map((s) => (
                  <SelectItem key={s.name} value={s.name}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">From tenant</label>
            <Select value={effectiveTenantId} onValueChange={setTenantId}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Choose tenant" />
              </SelectTrigger>
              <SelectContent>
                {pool.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                    {t.is_demo ? " (demo)" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="rounded-xl bg-muted/60 p-3">
            <p className="text-xs text-muted-foreground italic">"{chosen.message}"</p>
          </div>
          <div className="rounded-xl bg-[hsl(var(--sage-light))]/50 p-3">
            <p className="text-[11px] font-semibold flex items-center gap-1 mb-0.5">
              <Sparkles className="w-3 h-3 text-[hsl(var(--sage))]" /> What to show the client
            </p>
            <p className="text-xs text-muted-foreground">{chosen.show}</p>
          </div>
          <div className="flex justify-end gap-2">
            <button
              onClick={onClose}
              disabled={running}
              className="px-3.5 py-2 border bg-card hover:bg-muted rounded-lg text-sm font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={run}
              disabled={running}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-60"
            >
              <Play className="w-4 h-4" />
              {running ? "Running pipeline…" : "Run scenario"}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}