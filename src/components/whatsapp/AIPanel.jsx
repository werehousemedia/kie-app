import React from "react";
import { Link } from "react-router-dom";
import {
  Sparkles,
  Send,
  Wrench,
  FileSpreadsheet,
  MessageCirclePlus,
  Star,
  HardHat,
  ChevronRight,
} from "lucide-react";
import { urgencyColor, statusColor } from "@/lib/kieUtils";

// Follow-up questions the AI/landlord still needs answered, per issue type.
// These fill the composer on tap — the landlord stays in control of sending.
const INFO_CHECKLIST = {
  plumbing: [
    "Where exactly is the leak, and is the water contained?",
    "Can you turn off the isolation valve / stopcock for now?",
    "What times are you home this week for a plumber visit?",
  ],
  heating: [
    "Is the boiler showing an error code on its display?",
    "Is it just heating affected, or hot water too?",
    "What times suit you for an engineer visit?",
  ],
  electricity: [
    "Is it one socket/room or the whole property?",
    "Has the fuse board tripped — are any switches down?",
    "Please don't touch exposed wiring — is anything sparking or warm?",
  ],
  appliance: [
    "Which appliance is it, and what's the make/model?",
    "What exactly happens when you try to use it?",
    "When are you around for a repair visit?",
  ],
  security: [
    "Are you able to lock the property securely right now?",
    "Was anything damaged or taken?",
  ],
  noise: [
    "What times does it usually happen?",
    "Have you spoken to the neighbour directly?",
  ],
  "rent query": [
    "Which month's payment is this about?",
    "Would a payment plan help — what date works for you?",
  ],
  compliance: ["Which certificate or document do you need?"],
  general: [
    "Could you send a bit more detail (or a photo when the app supports it)?",
    "What times are you available this week?",
  ],
};

function Row({ label, children }) {
  return (
    <div className="flex items-start gap-2 text-sm">
      <span className="text-xs font-medium text-muted-foreground w-24 shrink-0 pt-0.5">{label}</span>
      <span className="flex-1 min-w-0">{children}</span>
    </div>
  );
}

// The organised triage action card: what the AI knows, what's still missing
// (one tap adds the question to the composer), best contractor with one-tap
// hire, and the follow-through actions.
export default function AIPanel({
  triage,
  ticket,
  matchedContractors,
  onAsk,
  onSendReply,
  sendingReply,
  onCreateTicket,
  creatingTicket,
  onHire,
  hiringId,
  onLogToSheet,
  loggingSheet,
}) {
  if (!triage) return null;

  const questions = INFO_CHECKLIST[triage.issue_type] || INFO_CHECKLIST.general;
  const top = matchedContractors?.[0];
  const others = (matchedContractors || []).slice(1, 3);

  return (
    <div className="border-t bg-[hsl(var(--sage-light))]/40 dark:bg-[hsl(var(--sage-light))]/60 shrink-0 max-h-[45%] overflow-y-auto">
      <div className="px-3 py-2.5 space-y-3">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-[hsl(var(--sage))]" />
          <p className="text-xs font-semibold">AI triage</p>
          <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${urgencyColor(triage.urgency)}`}>
            {triage.urgency || "low"}
          </span>
          <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium capitalize">
            {triage.issue_type || "general"}
          </span>
          {ticket && (
            <Link
              to={`/maintenance?ticket=${ticket.id}`}
              className="ml-auto inline-flex items-center gap-1 text-[11px] font-medium text-[hsl(var(--sage))] hover:underline"
            >
              Ticket: {ticket.status} <ChevronRight className="w-3 h-3" />
            </Link>
          )}
        </div>

        <div className="space-y-1.5">
          {triage.recommended_action && (
            <Row label="Next step">{triage.recommended_action}</Row>
          )}
          {triage.equipment_context && (
            <Row label="Equipment">{triage.equipment_context}</Row>
          )}
          {triage.troubleshooting && (
            <Row label="Tenant can try">{triage.troubleshooting}</Row>
          )}
        </div>

        {/* Info still to collect — taps fill the composer */}
        <div>
          <p className="text-[11px] font-semibold text-muted-foreground mb-1.5">
            Collect from tenant — tap to add to your reply
          </p>
          <div className="flex flex-wrap gap-1.5">
            {questions.map((q) => (
              <button
                key={q}
                onClick={() => onAsk(q)}
                className="inline-flex items-center gap-1 rounded-full border bg-card px-2.5 py-1 text-[11px] font-medium hover:border-[hsl(var(--sage))] hover:text-[hsl(var(--sage))] active:scale-[0.97] transition-all text-left"
              >
                <MessageCirclePlus className="w-3 h-3 shrink-0" />
                {q}
              </button>
            ))}
          </div>
        </div>

        {/* Contractor match + one-tap hire */}
        {top && (
          <div className="rounded-xl border bg-card p-2.5 space-y-2">
            <p className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1">
              <HardHat className="w-3.5 h-3.5" /> Best contractor for this job
            </p>
            <div className="flex items-center gap-2.5">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate flex items-center gap-1.5">
                  {top.name}
                  {top.preferred && <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-400" />}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {top.trade}
                  {top.coverage_area ? ` · ${top.coverage_area}` : ""}
                  {top.rating ? ` · ${top.rating}★` : ""}
                </p>
                <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium mt-1 ${statusColor(top.availability)}`}>
                  {top.availability || "Availability unknown"}
                </span>
              </div>
              <button
                onClick={() => onHire(top)}
                disabled={!!hiringId}
                className="shrink-0 inline-flex items-center gap-1.5 px-3 py-2 bg-primary text-primary-foreground rounded-lg text-xs font-semibold hover:opacity-90 active:scale-[0.97] transition-all disabled:opacity-60"
              >
                <Wrench className="w-3.5 h-3.5" />
                {hiringId === top.id ? "Hiring…" : "Hire"}
              </button>
            </div>
            {others.length > 0 && (
              <div className="border-t pt-2 space-y-1.5">
                {others.map((c) => (
                  <div key={c.id} className="flex items-center gap-2">
                    <p className="flex-1 min-w-0 text-xs truncate">
                      {c.name} <span className="text-muted-foreground">· {c.availability || "—"}</span>
                    </p>
                    <button
                      onClick={() => onHire(c)}
                      disabled={!!hiringId}
                      className="text-[11px] font-medium text-[hsl(var(--sage))] hover:underline disabled:opacity-60"
                    >
                      {hiringId === c.id ? "Hiring…" : "Hire instead"}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Follow-through actions */}
        <div className="flex flex-wrap gap-2">
          {triage.suggested_reply && (
            <button
              onClick={onSendReply}
              disabled={sendingReply}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[hsl(var(--sage))] text-white rounded-lg text-xs font-medium hover:opacity-90 active:scale-[0.97] transition-all disabled:opacity-60"
            >
              <Send className="w-3.5 h-3.5" />
              {sendingReply ? "Sending…" : "Send AI reply"}
            </button>
          )}
          {!ticket && (
            <button
              onClick={onCreateTicket}
              disabled={creatingTicket}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 border bg-card rounded-lg text-xs font-medium hover:bg-muted active:scale-[0.97] transition-all disabled:opacity-60"
            >
              <Wrench className="w-3.5 h-3.5" />
              {creatingTicket ? "Creating…" : "Create ticket"}
            </button>
          )}
          <button
            onClick={onLogToSheet}
            disabled={loggingSheet}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 border bg-card rounded-lg text-xs font-medium hover:bg-muted active:scale-[0.97] transition-all disabled:opacity-60"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            {loggingSheet ? "Logging…" : "Log to sheet"}
          </button>
        </div>
      </div>
    </div>
  );
}