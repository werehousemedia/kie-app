import React from "react";
import { Search, MessageSquare } from "lucide-react";
import { urgencyColor, timeAgo } from "@/lib/kieUtils";

export default function ConversationList({ conversations, tenants, properties, selectedId, onSelect }) {
  const sorted = [...conversations].sort((a, b) => new Date(b.last_message_at || 0) - new Date(a.last_message_at || 0));

  return (
    <div className="w-80 border-r border-slate-200 bg-white flex flex-col">
      <div className="p-4 border-b border-slate-200">
        <div className="flex items-center gap-2 mb-3">
          <MessageSquare className="w-5 h-5 text-[hsl(var(--sage))]" />
          <h2 className="text-base font-semibold text-slate-900">Conversations</h2>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search..."
            className="w-full pl-9 pr-3 py-2 bg-slate-100 rounded-lg text-sm focus:outline-none focus:bg-white focus:ring-2 focus:ring-[hsl(var(--sage))]/30"
          />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        {sorted.length === 0 && (
          <div className="p-8 text-center text-sm text-slate-400">No conversations yet</div>
        )}
        {sorted.map((c) => {
          const tenant = tenants.find((t) => t.id === c.tenant_id);
          const prop = properties.find((p) => p.id === c.property_id);
          const isSelected = c.id === selectedId;
          return (
            <button
              key={c.id}
              onClick={() => onSelect(c.id)}
              className={`w-full text-left p-3.5 border-b border-slate-100 hover:bg-slate-50 transition-colors ${isSelected ? "bg-slate-50 border-l-2 border-l-[hsl(var(--sage))]" : ""}`}
            >
              <div className="flex items-start justify-between gap-2 mb-1">
                <p className="text-sm font-semibold text-slate-900 truncate">{tenant?.name || "Unknown"}</p>
                <span className="text-[11px] text-slate-400 shrink-0">{timeAgo(c.last_message_at)}</span>
              </div>
              <p className="text-xs text-slate-500 mb-1.5 truncate">{prop?.name || "No property"}</p>
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs text-slate-500 truncate flex-1">{c.last_message}</p>
                <div className="flex items-center gap-1.5 shrink-0">
                  {c.unread_count > 0 && (
                    <span className="bg-[hsl(var(--sage))] text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">{c.unread_count}</span>
                  )}
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${urgencyColor(c.urgency)}`}>{c.urgency}</span>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}