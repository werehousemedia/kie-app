import React, { useEffect, useRef } from "react";
import { ArrowLeft, Info, Send, Sparkles, MessageSquare, Check, CheckCheck, AlertCircle } from "lucide-react";
import { TenantAvatar } from "@/components/shared/TenantChip";
import EmptyState from "@/components/shared/EmptyState";
import { formatDateTime } from "@/lib/kieUtils";

function Bubble({ msg }) {
  if (msg.sender === "ai" || msg.sender === "system") {
    return (
      <div className="flex flex-col items-center my-2 px-6">
        <span className="text-[10px] font-medium text-muted-foreground mb-1 flex items-center gap-1">
          {msg.sender === "ai" ? (
            <>
              <Sparkles className="w-3 h-3 text-[hsl(var(--sage))]" /> AI assistant
            </>
          ) : (
            "Automatic update"
          )}
        </span>
        <div className="max-w-[85%] rounded-xl bg-[hsl(var(--sage-light))] text-foreground px-3.5 py-2 text-sm">
          {msg.content}
        </div>
      </div>
    );
  }
  const mine = msg.sender === "landlord";
  return (
    <div className={`flex flex-col ${mine ? "items-end" : "items-start"} my-1 px-1`}>
      <div
        className={`max-w-[80%] rounded-2xl px-3.5 py-2 text-sm whitespace-pre-wrap break-words ${
          mine
            ? "bg-[hsl(var(--navy))] text-white rounded-br-md dark:bg-[hsl(var(--sage))]"
            : "bg-muted text-foreground rounded-bl-md"
        }`}
        title={formatDateTime(msg.timestamp)}
      >
        {msg.content}
      </div>
      {mine && <DeliveryTag delivery={msg.delivery} />}
    </div>
  );
}

// Honest delivery state — a reply saved without a connected channel must not
// look like one that reached the tenant's phone.
function DeliveryTag({ delivery }) {
  if (!delivery || delivery === "received") return null;
  const map = {
    delivered: { Icon: CheckCheck, text: "Delivered on WhatsApp", cls: "text-emerald-600 dark:text-emerald-400" },
    logged: { Icon: Check, text: "Saved to thread — not sent", cls: "text-muted-foreground" },
    failed: { Icon: AlertCircle, text: "Delivery failed", cls: "text-rose-600 dark:text-rose-400" },
  };
  const m = map[delivery];
  if (!m) return null;
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] mt-0.5 mr-1 ${m.cls}`}>
      <m.Icon className="w-3 h-3" /> {m.text}
    </span>
  );
}

// Centre pane: thread + composer. Mobile gets back + info buttons.
export default function ChatPanel({
  conversation,
  tenant,
  property,
  messages,
  onBack,
  onOpenInfo,
  draft,
  onDraftChange,
  onSend,
  sending,
  onTriage,
  triaging,
}) {
  const endRef = useRef(null);
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length, conversation?.id]);

  if (!conversation) {
    return (
      <div className="h-full flex items-center justify-center">
        <EmptyState
          icon={MessageSquare}
          title="Select a conversation"
          description="Pick a tenant on the left to read the thread, run AI triage and take action."
        />
      </div>
    );
  }

  const send = () => {
    const text = draft.trim();
    if (!text || sending) return;
    onSend(text);
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex items-center gap-2.5 px-3 py-2.5 border-b shrink-0">
        {onBack && (
          <button
            onClick={onBack}
            aria-label="Back to conversations"
            className="lg:hidden p-1.5 -ml-1 rounded-lg hover:bg-muted text-muted-foreground"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
        )}
        <TenantAvatar tenant={tenant} size="md" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold truncate">{tenant?.name || "Unknown tenant"}</p>
          <p className="text-xs text-muted-foreground truncate">
            {property?.name}
            {tenant?.phone ? ` · ${tenant.phone}` : ""}
          </p>
        </div>
        <button
          onClick={onTriage}
          disabled={triaging}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[hsl(var(--sage))] text-white text-xs font-medium hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-60"
        >
          <Sparkles className={`w-3.5 h-3.5 ${triaging ? "animate-pulse" : ""}`} />
          {triaging ? "Triaging…" : "AI triage"}
        </button>
        {onOpenInfo && (
          <button
            onClick={onOpenInfo}
            aria-label="Property intelligence"
            className="lg:hidden p-1.5 rounded-lg hover:bg-muted text-muted-foreground"
          >
            <Info className="w-5 h-5" />
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto min-h-0 p-3">
        {messages.length === 0 ? (
          <EmptyState
            compact
            icon={MessageSquare}
            title="No messages yet"
            description="Say hello, or wait for the tenant's first message."
          />
        ) : (
          messages.map((m) => <Bubble key={m.id} msg={m} />)
        )}
        <div ref={endRef} />
      </div>

      <div className="p-3 border-t shrink-0">
        <div className="flex items-end gap-2">
          <textarea
            value={draft}
            onChange={(e) => onDraftChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            rows={1}
            placeholder="Reply to tenant… (Enter to send)"
            className="flex-1 resize-none max-h-28 px-3.5 py-2.5 bg-muted rounded-xl text-sm border border-transparent focus:outline-none focus:bg-card focus:border-border transition-all"
          />
          <button
            onClick={send}
            disabled={sending || !draft.trim()}
            aria-label="Send reply"
            className="p-2.5 rounded-xl bg-primary text-primary-foreground disabled:opacity-40 hover:opacity-90 active:scale-[0.96] transition-all shrink-0"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}