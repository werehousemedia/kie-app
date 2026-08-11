import React, { useMemo, useState } from "react";
import { Search, MessageSquare, X, TestTube } from "lucide-react";
import { urgencyColor, timeAgo } from "@/lib/kieUtils";
import { TenantAvatar } from "@/components/shared/TenantChip";
import EmptyState from "@/components/shared/EmptyState";

// Left rail: searchable conversation list, sorted by recency. Rendered inside
// a width/border wrapper owned by the page (full-width pane on mobile, w-80 on lg+).
export default function ConversationList({ conversations, tenants, properties, selectedId, onSelect, onTest }) {
  const [query, setQuery] = useState("");

  const rows = useMemo(() => {
    const withMeta = [...conversations]
      .sort((a, b) => new Date(b.last_message_at || 0) - new Date(a.last_message_at || 0))
      .map((c) => ({
        conv: c,
        tenant: tenants.find((t) => t.id === c.tenant_id),
        property: properties.find((p) => p.id === c.property_id),
      }));
    const q = query.trim().toLowerCase();
    if (!q) return withMeta;
    return withMeta.filter(({ conv, tenant, property }) =>
      [tenant?.name, property?.name, conv.last_message].some((s) => s && s.toLowerCase().includes(q))
    );
  }, [conversations, tenants, properties, query]);

  return (
    <div className="h-full flex flex-col bg-card">
      <div className="p-4 border-b shrink-0">
        <div className="flex items-center gap-2 mb-3">
          <MessageSquare className="w-4 h-4 text-[hsl(var(--sage))]" />
          <h2 className="text-sm font-semibold text-foreground">Conversations</h2>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search tenant, property, message…"
            aria-label="Search conversations"
            className="w-full pl-9 pr-8 py-2 bg-muted rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[hsl(var(--sage))]/40"
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              aria-label="Clear search"
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-secondary transition-colors"
            >
              <X className="w-3.5 h-3.5 text-muted-foreground" />
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto divide-y divide-border">
        {conversations.length === 0 ? (
          <EmptyState
            icon={MessageSquare}
            title="No conversations yet"
            description="Send a test message to watch the AI pipeline handle it end to end."
            compact
            action={
              onTest && (
                <button
                  onClick={onTest}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 active:scale-[0.98] transition-all shadow-sm"
                >
                  <TestTube className="w-4 h-4" /> Test a message
                </button>
              )
            }
          />
        ) : rows.length === 0 ? (
          <EmptyState
            icon={Search}
            title="Nothing matches"
            description={`No conversations match "${query}".`}
            compact
            action={
              <button
                onClick={() => setQuery("")}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 border bg-card hover:bg-muted text-foreground rounded-lg text-sm font-medium active:scale-[0.98] transition-all"
              >
                Clear search
              </button>
            }
          />
        ) : (
          rows.map(({ conv: c, tenant, property }) => {
            const isSelected = c.id === selectedId;
            return (
              <button
                key={c.id}
                onClick={() => onSelect(c.id)}
                aria-current={isSelected ? "true" : undefined}
                className={`w-full text-left flex items-start gap-3 px-4 py-3 min-h-[56px] transition-colors ${
                  isSelected ? "bg-muted" : "hover:bg-muted"
                }`}
              >
                <TenantAvatar tenant={tenant} size="md" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="text-sm font-medium text-foreground truncate">{tenant?.name || "Unknown tenant"}</p>
                    <span className="text-[11px] text-muted-foreground shrink-0">{timeAgo(c.last_message_at)}</span>
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{property?.name || "No property"}</p>
                  <div className="flex items-center justify-between gap-2 mt-0.5">
                    <p className="text-xs text-muted-foreground truncate flex-1">{c.last_message || "No messages yet"}</p>
                    <span className="flex items-center gap-1.5 shrink-0">
                      {c.unread_count > 0 && (
                        <span className="bg-[hsl(var(--sage))] text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                          {c.unread_count}
                        </span>
                      )}
                      {(c.urgency === "high" || c.urgency === "emergency") && (
                        <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${urgencyColor(c.urgency)}`}>
                          {c.urgency}
                        </span>
                      )}
                    </span>
                  </div>
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
