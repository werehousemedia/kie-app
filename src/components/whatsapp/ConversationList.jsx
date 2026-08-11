import React from "react";
import { Search, MessageSquare } from "lucide-react";
import { TenantAvatar } from "@/components/shared/TenantChip";
import EmptyState from "@/components/shared/EmptyState";
import { timeAgo } from "@/lib/kieUtils";

const URGENCY_DOT = {
  emergency: "bg-rose-500",
  high: "bg-amber-500",
  medium: "bg-blue-500",
  low: "bg-muted-foreground/40",
};

// Left rail: searchable conversation list, sorted by the page (most recent
// first). Whole surface is keyboard/touch friendly.
export default function ConversationList({
  conversations,
  tenants,
  properties,
  selectedId,
  onSelect,
  search,
  onSearch,
}) {
  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="p-3 border-b">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => onSearch(e.target.value)}
            placeholder="Search conversations…"
            className="w-full pl-9 pr-3 py-2 bg-muted rounded-lg text-sm border border-transparent focus:outline-none focus:bg-card focus:border-border transition-all"
          />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto min-h-0">
        {conversations.length === 0 ? (
          <EmptyState
            compact
            icon={MessageSquare}
            title={search ? "No matches" : "No conversations yet"}
            description={
              search
                ? "Try a different name or property."
                : "Tenant WhatsApp messages arrive here. Use “Test message” to try the AI pipeline."
            }
          />
        ) : (
          conversations.map((c) => {
            const tenant = tenants.find((t) => t.id === c.tenant_id);
            const property = properties.find((p) => p.id === c.property_id);
            const active = c.id === selectedId;
            return (
              <button
                key={c.id}
                onClick={() => onSelect(c.id)}
                className={`w-full flex items-start gap-3 px-3 py-3 text-left transition-colors border-b border-border/60 ${
                  active ? "bg-[hsl(var(--sage-light))]" : "hover:bg-muted"
                }`}
              >
                <div className="relative shrink-0 mt-0.5">
                  <TenantAvatar tenant={tenant} size="md" />
                  {c.urgency && (
                    <span
                      className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full ring-2 ring-card ${URGENCY_DOT[c.urgency] || URGENCY_DOT.low}`}
                    />
                  )}
                </div>
                <span className="flex-1 min-w-0">
                  <span className="flex items-center gap-2">
                    <span className="text-sm font-medium truncate">
                      {tenant?.name || "Unknown tenant"}
                    </span>
                    <span className="ml-auto text-[11px] text-muted-foreground shrink-0">
                      {timeAgo(c.last_message_at)}
                    </span>
                  </span>
                  <span className="block text-xs text-muted-foreground truncate mt-0.5">
                    {c.last_message || "—"}
                  </span>
                  <span className="flex items-center gap-1.5 mt-1">
                    <span className="text-[11px] text-muted-foreground truncate">
                      {property?.name || ""}
                    </span>
                    {(c.unread_count || 0) > 0 && (
                      <span className="ml-auto min-w-[18px] h-[18px] px-1 rounded-full bg-[hsl(var(--sage))] text-white text-[10px] font-bold flex items-center justify-center tabular-nums">
                        {c.unread_count}
                      </span>
                    )}
                  </span>
                </span>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}