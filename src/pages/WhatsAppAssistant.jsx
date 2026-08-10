import React, { useState, useCallback, useEffect } from "react";
import { useKieData } from "@/lib/useKieData";
import { base44 } from "@/api/base44Client";
import { logActivity } from "@/lib/kieUtils";
import ConversationList from "@/components/whatsapp/ConversationList";
import ChatPanel from "@/components/whatsapp/ChatPanel";
import AIPanel from "@/components/whatsapp/AIPanel";
import PropertyIntelligence from "@/components/whatsapp/PropertyIntelligence";
import TestMessageModal from "@/components/whatsapp/TestMessageModal";
import ConnectionCard from "@/components/whatsapp/ConnectionCard";
import { TestTube, Plus, FileSpreadsheet } from "lucide-react";
import { toast } from "sonner";

export default function WhatsAppAssistant() {
  const {
    conversations, messages, tenants, properties, equipment, tickets, triages, reload, loading
  } = useKieData();

  const [selectedId, setSelectedId] = useState(null);
  const [triage, setTriage] = useState(null);
  const [triaging, setTriaging] = useState(false);
  const [testOpen, setTestOpen] = useState(false);
  const [commsSheetId, setCommsSheetId] = useState(null);

  useEffect(() => {
    base44.entities.AppSetting.filter({ key: "comms_log_sheet_id" })
      .then((rows) => rows[0]?.value && setCommsSheetId(rows[0].value))
      .catch(() => {});
  }, []);

  const selected = conversations.find((c) => c.id === selectedId);
  const tenant = selected ? tenants.find((t) => t.id === selected.tenant_id) : null;
  const property = selected ? properties.find((p) => p.id === selected.property_id) : null;

  const handleSendMessage = useCallback(async (content, sender) => {
    if (!selected) return;
    try {
      await base44.entities.Message.create({
        conversation_id: selected.id,
        sender,
        content,
        timestamp: new Date().toISOString(),
      });
      await base44.entities.Conversation.update(selected.id, {
        last_message: content,
        last_message_at: new Date().toISOString(),
        unread_count: sender === "landlord" ? 0 : selected.unread_count,
      });
      await logActivity(base44, {
        tenant_id: selected.tenant_id,
        property_id: selected.property_id,
        event_type: "WhatsApp message",
        description: `${sender === "landlord" ? "Landlord sent" : "Message sent"}: ${content.slice(0, 80)}`,
      });
      reload();
    } catch (e) {
      toast.error("Failed to send message");
    }
  }, [selected, reload]);

  const handleTriage = useCallback(async () => {
    if (!selected) return;
    const convMessages = messages.filter((m) => m.conversation_id === selected.id).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    const lastTenantMsg = convMessages.find((m) => m.sender === "tenant");
    if (!lastTenantMsg) {
      toast.error("No tenant message to triage");
      return;
    }
    setTriaging(true);
    setTriage(null);
    try {
      const propEquipment = equipment.filter((e) => e.property_id === selected.property_id);
      const propTickets = tickets.filter((t) => t.property_id === selected.property_id);
      const response = await base44.functions.invoke("ai_triage", {
        message: lastTenantMsg.content,
        propertyName: property?.name,
        propertyAddress: property?.address,
        equipment: propEquipment,
        tenantName: tenant?.name,
        recentIssues: propTickets.map((t) => t.description).slice(0, 3),
      });
      const triageResult = response.data?.triage || response.data;
      setTriage(triageResult);

      const triageRecord = await base44.entities.AITriage.create({
        message_id: lastTenantMsg.id,
        conversation_id: selected.id,
        property_id: selected.property_id,
        issue_type: triageResult.issue_type,
        urgency: triageResult.urgency,
        suggested_reply: triageResult.suggested_reply,
        troubleshooting: triageResult.troubleshooting,
        equipment_context: triageResult.equipment_context,
        recommended_action: triageResult.recommended_action,
        created_at: new Date().toISOString(),
      });

      await logActivity(base44, {
        tenant_id: selected.tenant_id,
        property_id: selected.property_id,
        event_type: "AI triage",
        description: `AI triaged message as ${triageResult.issue_type} (${triageResult.urgency} urgency)`,
        related_id: triageRecord.id,
        severity: triageResult.urgency === "emergency" ? "critical" : triageResult.urgency === "high" ? "warning" : "info",
      });
      reload();
    } catch (e) {
      toast.error("AI triage failed: " + (e.message || "Unknown error"));
    } finally {
      setTriaging(false);
    }
  }, [selected, messages, equipment, tickets, property, tenant, reload]);

  const handleCreateTicket = useCallback(async () => {
    if (!selected || !triage) return;
    try {
      const ticket = await base44.entities.MaintenanceTicket.create({
        property_id: selected.property_id,
        tenant_id: selected.tenant_id,
        conversation_id: selected.id,
        ai_triage_id: triages.find((t) => t.conversation_id === selected.id)?.id,
        issue_type: triage.issue_type === "rent query" ? "general" : triage.issue_type,
        urgency: triage.urgency,
        status: "AI triage",
        description: triage.suggested_reply ? `From WhatsApp: ${messages.filter(m => m.conversation_id === selected.id).find(m => m.sender === "tenant")?.content || ""}` : "New issue",
      });
      await logActivity(base44, {
        property_id: selected.property_id,
        tenant_id: selected.tenant_id,
        event_type: "Maintenance created",
        description: `Maintenance ticket created from WhatsApp: ${triage.issue_type}`,
        related_id: ticket.id,
        severity: triage.urgency === "emergency" ? "critical" : "info",
      });
      toast.success("Maintenance ticket created");
      reload();
    } catch (e) {
      toast.error("Failed to create ticket");
    }
  }, [selected, triage, triages, messages, reload]);

  const handleLogToSheet = useCallback(async () => {
    if (!selected) return;
    try {
      const res = await base44.functions.invoke("log_to_sheet", { conversation_id: selected.id });
      if (res.data?.error) throw new Error(res.data.error);
      if (res.data?.sheet_id) setCommsSheetId(res.data.sheet_id);
      toast.success("Logged to the communications sheet");
      reload();
    } catch (e) {
      const msg = e.response?.data?.error || e.message || "Failed to log";
      toast.error(msg.includes("403") || msg.toLowerCase().includes("write access") || msg.toLowerCase().includes("insufficient")
        ? "Google connector needs write access — re-authorise it in Base44 → Integrations"
        : msg);
    }
  }, [selected, reload]);

  const handleSendReply = useCallback(async () => {
    if (!triage?.suggested_reply) return;
    await handleSendMessage(triage.suggested_reply, "landlord");
    toast.success("Reply sent");
  }, [triage, handleSendMessage]);

  // Runs the full autonomous pipeline server-side: message → triage →
  // auto-reply → ticket (if urgent) → Google Sheet log row. Identical path
  // to what a real WhatsApp webhook will use.
  const handleTestMessage = useCallback(async (tenantId, message) => {
    setTriaging(true);
    setTriage(null);
    try {
      const res = await base44.functions.invoke("handle_inbound_message", { tenant_id: tenantId, content: message });
      const d = res.data || {};
      if (d.error) throw new Error(d.error);
      setSelectedId(d.conversation_id);
      setTriage(d.triage || null);
      if (d.sheet_id) setCommsSheetId(d.sheet_id);
      const bits = ["AI replied to the tenant"];
      if (d.ticket_id) bits.push("maintenance ticket created");
      bits.push(d.sheet_logged ? "logged to sheet" : "sheet log failed");
      (d.sheet_logged ? toast.success : toast.warning)(bits.join(" · "));
      if (!d.sheet_logged && d.sheet_error) {
        toast.error(d.sheet_error.toLowerCase().includes("insufficient") || d.sheet_error.includes("403") || d.sheet_error.toLowerCase().includes("write access")
          ? "Google connector needs write access — re-authorise it in Base44 → Integrations"
          : `Sheet: ${d.sheet_error}`);
      }
      reload();
    } catch (e) {
      toast.error(e.response?.data?.error || e.message || "Failed to process message");
    } finally {
      setTriaging(false);
    }
  }, [reload]);

  const handleAssignContractor = useCallback(async (contractor) => {
    if (!selected) return;
    try {
      const openTicket = tickets.find((t) => t.property_id === selected.property_id && t.status !== "Complete" && t.status !== "Cancelled");
      if (openTicket) {
        await base44.entities.MaintenanceTicket.update(openTicket.id, {
          contractor_id: contractor.id,
          status: "Contractor requested",
        });
        await logActivity(base44, {
          property_id: selected.property_id,
          event_type: "Contractor assigned",
          description: `Assigned ${contractor.name} (${contractor.trade}) to ticket`,
          related_id: openTicket.id,
        });
        toast.success(`${contractor.name} assigned to ticket`);
      } else {
        toast.info("No open ticket to assign to. Create a ticket first.");
      }
      reload();
    } catch (e) {
      toast.error("Failed to assign contractor");
    }
  }, [selected, tickets, reload]);

  if (loading) return <div className="flex items-center justify-center h-96"><div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">WhatsApp Assistant</h1>
          <p className="text-sm text-slate-500 mt-0.5">AI-powered tenant communications console</p>
        </div>
        <div className="flex items-center gap-2">
          {commsSheetId && (
            <a
              href={`https://docs.google.com/spreadsheets/d/${commsSheetId}`}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors"
            >
              <FileSpreadsheet className="w-4 h-4" />
              Comms log
            </a>
          )}
          <button
            onClick={() => setTestOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-[hsl(var(--sage))] text-white rounded-lg text-sm font-medium hover:bg-[hsl(var(--sage))]/90 transition-colors shadow-sm"
          >
            <TestTube className="w-4 h-4" />
            Test incoming message
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col" style={{ height: "calc(100vh - 220px)" }}>
        <div className="flex flex-1 overflow-hidden">
          <ConversationList
            conversations={conversations}
            tenants={tenants}
            properties={properties}
            selectedId={selectedId}
            onSelect={(id) => { setSelectedId(id); setTriage(null); }}
          />
          <div className="flex-1 flex flex-col">
            {selected ? (
              <>
                <ChatPanel
                  conversation={selected}
                  messages={messages}
                  tenant={tenant}
                  property={property}
                  onSend={handleSendMessage}
                  onTriage={handleTriage}
                  triaging={triaging}
                />
                <AIPanel
                  triage={triage}
                  triaging={triaging}
                  onCreateTicket={handleCreateTicket}
                  onLogToSheet={handleLogToSheet}
                  onSendReply={handleSendReply}
                />
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center bg-slate-50">
                <div className="text-center">
                  <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-3">
                    <Plus className="w-7 h-7 text-slate-400" />
                  </div>
                  <p className="text-sm font-medium text-slate-600">Select a conversation</p>
                  <p className="text-xs text-slate-400 mt-1">Or test an incoming message to get started</p>
                </div>
              </div>
            )}
          </div>
          <PropertyIntelligence
            property={property}
            tenant={tenant}
            triageIssueType={triage?.issue_type}
            onAssignContractor={handleAssignContractor}
          />
        </div>
      </div>

      <ConnectionCard />

      <TestMessageModal
        open={testOpen}
        onClose={() => setTestOpen(false)}
        tenants={tenants}
        onSubmit={handleTestMessage}
      />
    </div>
  );
}