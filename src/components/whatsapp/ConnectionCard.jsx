import React from "react";
import { Link } from "react-router-dom";
import { MessageSquare, CheckCircle2, ArrowRight } from "lucide-react";

// Honest connection status — no fake config forms, no simulated "tests".
// What works today is real (inbound pipeline + AI triage + comms log); live
// WhatsApp delivery arrives when the Business API connector is configured.
export default function ConnectionCard() {
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-lg bg-emerald-100 dark:bg-emerald-500/15 flex items-center justify-center shrink-0">
          <MessageSquare className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold">WhatsApp channel</p>
            <span className="inline-flex items-center rounded-full bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300 px-2 py-0.5 text-[11px] font-medium">
              Sandbox mode
            </span>
          </div>
          <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
            <li className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
              Inbound pipeline live: message → AI triage → auto-reply → ticket → comms log
            </li>
            <li className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
              Test messages run the exact same path a real webhook will use
            </li>
            <li>
              Outbound replies are stored in-app and logged; live WhatsApp delivery
              switches on with the Business API connector.
            </li>
          </ul>
        </div>
        <Link
          to="/integrations"
          className="shrink-0 inline-flex items-center gap-1 text-xs font-medium text-[hsl(var(--sage))] hover:underline"
        >
          Integrations <ArrowRight className="w-3 h-3" />
        </Link>
      </div>
    </div>
  );
}