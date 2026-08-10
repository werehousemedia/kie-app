import React from "react";
import { Sparkles, Wrench, FileText, AlertCircle, Lightbulb, ArrowRight, Loader2 } from "lucide-react";
import { urgencyColor } from "@/lib/kieUtils";

export default function AIPanel({ triage, triaging, onCreateTicket, onLogToSheet, onSendReply }) {
  if (triaging) {
    return (
      <div className="border-t border-slate-200 bg-white p-4">
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Loader2 className="w-4 h-4 animate-spin text-[hsl(var(--sage))]" />
          Analysing message...
        </div>
      </div>
    );
  }

  if (!triage) {
    return (
      <div className="border-t border-slate-200 bg-gradient-to-br from-slate-50 to-white p-4">
        <div className="flex items-start gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-[hsl(var(--sage-light))] flex items-center justify-center shrink-0">
            <Sparkles className="w-4 h-4 text-[hsl(var(--sage))]" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-slate-800 mb-0.5">AI Assistant</p>
            <p className="text-xs text-slate-500 mb-2">Click "AI Triage" to analyse the latest tenant message and get suggested actions.</p>
            <p className="text-[11px] text-slate-400 italic">AI guidance is operational support only. Urgent safety issues should be escalated to a qualified professional or emergency service.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="border-t border-slate-200 bg-white p-4 space-y-3 animate-fade-in">
      <div className="flex items-center gap-2">
        <div className="w-7 h-7 rounded-lg bg-[hsl(var(--sage))] flex items-center justify-center">
          <Sparkles className="w-3.5 h-3.5 text-white" />
        </div>
        <p className="text-sm font-semibold text-slate-900">AI Triage Result</p>
        <div className="ml-auto flex items-center gap-1.5">
          <span className={`text-xs px-2 py-0.5 rounded-full border ${urgencyColor(triage.urgency)}`}>{triage.urgency}</span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 capitalize">{triage.issue_type}</span>
        </div>
      </div>

      <div className="p-3 bg-slate-50 rounded-lg">
        <p className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-1">Suggested Reply</p>
        <p className="text-sm text-slate-700">{triage.suggested_reply}</p>
        {onSendReply && (
          <button onClick={onSendReply} className="mt-2 text-xs font-medium text-[hsl(var(--sage))] hover:underline flex items-center gap-1">
            Send as reply <ArrowRight className="w-3 h-3" />
          </button>
        )}
      </div>

      {triage.troubleshooting && (
        <div className="p-3 bg-amber-50 rounded-lg border border-amber-100">
          <div className="flex items-center gap-1.5 mb-1.5">
            <Lightbulb className="w-3.5 h-3.5 text-amber-600" />
            <p className="text-xs font-medium text-amber-700 uppercase tracking-wide">Troubleshooting</p>
          </div>
          <p className="text-xs text-amber-800 whitespace-pre-line">{triage.troubleshooting}</p>
        </div>
      )}

      {triage.equipment_context && triage.equipment_context !== "No relevant equipment" && (
        <div className="p-3 bg-blue-50 rounded-lg">
          <p className="text-xs font-medium text-blue-400 uppercase tracking-wide mb-1">Equipment Context</p>
          <p className="text-xs text-blue-700">{triage.equipment_context}</p>
        </div>
      )}

      {triage.recommended_action && (
        <div className="p-3 bg-[hsl(var(--sage-light))] rounded-lg">
          <p className="text-xs font-medium text-[hsl(var(--sage))] uppercase tracking-wide mb-1">Recommended Action</p>
          <p className="text-xs text-slate-700">{triage.recommended_action}</p>
        </div>
      )}

      <div className="flex items-center gap-2 pt-1">
        {triage.create_ticket && (
          <button
            onClick={onCreateTicket}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[hsl(var(--navy))] text-white text-xs font-medium hover:bg-[hsl(var(--navy-light))] transition-colors"
          >
            <Wrench className="w-3.5 h-3.5" />
            Create Ticket
          </button>
        )}
        <button
          onClick={onLogToSheet}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 text-slate-600 text-xs font-medium hover:bg-slate-50 transition-colors"
        >
          <FileText className="w-3.5 h-3.5" />
          Log to Sheet
        </button>
      </div>

      <p className="text-[11px] text-slate-400 italic pt-1">AI guidance is operational support only. Urgent safety issues should be escalated to a qualified professional or emergency service.</p>
    </div>
  );
}