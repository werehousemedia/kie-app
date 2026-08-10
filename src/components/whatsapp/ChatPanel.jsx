import React, { useState, useRef, useEffect } from "react";
import { Send, Sparkles, Phone, MapPin } from "lucide-react";
import { formatDateTime } from "@/lib/kieUtils";

export default function ChatPanel({ conversation, messages, tenant, property, onSend, onTriage, triaging }) {
  const [input, setInput] = useState("");
  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  const handleSend = () => {
    if (!input.trim()) return;
    onSend(input.trim(), "landlord");
    setInput("");
  };

  const convMessages = messages.filter((m) => m.conversation_id === conversation?.id).sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

  return (
    <div className="flex-1 flex flex-col bg-slate-50">
      {conversation && (
        <div className="px-5 py-3 bg-white border-b border-slate-200 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-[hsl(var(--navy))] flex items-center justify-center text-white text-sm font-semibold">
            {tenant?.name?.split(" ").map((n) => n[0]).join("").slice(0, 2) || "?"}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-slate-900">{tenant?.name || "Unknown"}</p>
            <p className="text-xs text-slate-500 flex items-center gap-1">
              <MapPin className="w-3 h-3" /> {property?.name || "No property"} · {property?.postcode || ""}
            </p>
          </div>
          <button className="p-2 rounded-lg hover:bg-slate-100">
            <Phone className="w-4 h-4 text-slate-500" />
          </button>
        </div>
      )}

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-5 space-y-3">
        {convMessages.map((m) => {
          const isTenant = m.sender === "tenant";
          const isAI = m.sender === "ai";
          return (
            <div key={m.id} className={`flex ${isTenant ? "justify-start" : "justify-end"}`}>
              <div className={`max-w-[70%] ${isAI ? "mx-auto" : ""}`}>
                {isAI && (
                  <div className="flex items-center gap-1 mb-1 justify-center">
                    <Sparkles className="w-3 h-3 text-[hsl(var(--sage))]" />
                    <span className="text-[10px] font-medium text-[hsl(var(--sage))]">AI Assistant</span>
                  </div>
                )}
                <div className={`px-4 py-2.5 rounded-2xl text-sm ${
                  isTenant ? "bg-white border border-slate-200 text-slate-800 rounded-bl-sm" :
                  isAI ? "bg-[hsl(var(--sage-light))] border border-[hsl(var(--sage))]/20 text-slate-800 rounded-xl text-center" :
                  "bg-[hsl(var(--navy))] text-white rounded-br-sm"
                }`}>
                  {m.content}
                </div>
                <p className={`text-[10px] text-slate-400 mt-1 ${isTenant ? "text-left" : "text-right"}`}>{formatDateTime(m.timestamp)}</p>
              </div>
            </div>
          );
        })}
        {triaging && (
          <div className="flex justify-center">
            <div className="flex items-center gap-2 px-4 py-2 bg-white rounded-full border border-slate-200">
              <Sparkles className="w-3.5 h-3.5 text-[hsl(var(--sage))] animate-pulse" />
              <span className="text-xs text-slate-500">AI is analysing the message...</span>
            </div>
          </div>
        )}
      </div>

      {conversation && (
        <div className="p-4 bg-white border-t border-slate-200">
          <div className="flex items-center gap-2">
            <button
              onClick={onTriage}
              disabled={triaging}
              className="flex items-center gap-1.5 px-3 py-2.5 rounded-lg bg-[hsl(var(--sage-light))] text-[hsl(var(--sage))] text-sm font-medium hover:bg-[hsl(var(--sage))]/20 transition-colors disabled:opacity-50"
            >
              <Sparkles className="w-4 h-4" />
              AI Triage
            </button>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSend()}
              placeholder="Type a reply..."
              className="flex-1 px-4 py-2.5 bg-slate-100 rounded-lg text-sm focus:outline-none focus:bg-white focus:ring-2 focus:ring-[hsl(var(--sage))]/30"
            />
            <button onClick={handleSend} className="p-2.5 rounded-lg bg-[hsl(var(--navy))] text-white hover:bg-[hsl(var(--navy-light))] transition-colors">
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}