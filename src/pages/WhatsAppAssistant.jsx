import React, { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { FileSpreadsheet, Megaphone, FlaskConical } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useKieData } from "@/lib/useKieData";
import { logActivity, matchContractors } from "@/lib/kieUtils";
import PageHeader from "@/components/shared/PageHeader";
import { PageSkeleton } from "@/components/shared/Skeletons";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import ConversationList from "@/components/whatsapp/ConversationList";
import ChatPanel from "@/components/whatsapp/ChatPanel";
import AIPanel from "@/components/whatsapp/AIPanel";
import PropertyIntelligence from "@/components/whatsapp/PropertyIntelligence";
import ConnectionCard from "@/components/whatsapp/ConnectionCard";
import TestMessageModal from "@/components/whatsapp/TestMessageModal";
import BroadcastModal from "@/components/whatsapp/BroadcastModal";

const sevFromUrgency = (u) => (u === "emergency" || u === "high" ? "critical" : u === "medium" ? "warning" : "info");

export default function WhatsAppAssistant() {
  const {
    conversations, messages, tenants, properties, equipment, tickets, triages,
    contractors, reload, loading,
  } = useKieData();
  const [searchParams, setSearchParams] = useSearchParams();

  const [selectedId, setSelectedId] = useState(null);
  const [mobileView, setMobileView] = useState("list"); // list | chat
  const [infoOpen, setInfoOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [draft, setDraft] = useState("");
  const [freshTriage, setFreshTriage] = useState(null);
  const [triaging, setTriaging] = useState(false);
  const [sending, setSending] = useState(false);
  const [creatingTicket, setCreatingTicket] = useState(false);
  const [hiringId, setHiringId] = useState(null);
  const [loggingSheet, setLoggingSheet] = useState(false);
  const [testOpen, setTestOpen] = useState(false);
  const [broadcastOpen, setBroadcastOpen] = useState(false);
  const [commsSheetId, setCommsSheetId] = useState(null);

  useEffect(() => {
    base44.entities.AppSetting.filter({ key: "comms_log_sheet_id" })
      .then((rows) => rows?.[0]?.value && setCommsSheetId(rows[0].value))
      .catch(() => {});
  }, []);

  const selectConversation = async (id) => {
    setSelectedId(id);
    setMobileView("chat");
    setDraft("");
    const convo = conversations.find((c) => c.id === id);
    if (convo && (convo.unread_count || 0) > 0) {
      try {
        await base44.entities.Conversation.update(id, { unread_count: 0 });
        reload();
      } catch {
        /* non-fatal */
      }
    }
  };

  // Deep links: ?conversation=<id> | ?tenant=<id> (find-or-create).
  useEffect(() => {
    if (loading) return;
    const convoId = searchParams.get("conversation");
    const tenantId = searchParams.get("tenant");
    if (!convoId && !tenantId) return;
    const clear = () =>
      setSearchParams((p) => { p.delete("conversation"); p.delete("tenant"); return p; }, { replace: true });
    if (convoId && conversations.some((c) => c.id === convoId)) {
      selectConversation(convoId);
      clear();
      return;
    }
    if (tenantId) {
      const tenant = tenants.find((t) => t.id === tenantId);
      if (!tenant) { clear(); return; }
      const existing = conversations.find((c) => c.tenant_id === tenantId);
      if (existing) {
        selectConversation(existing.id);
        clear();
      } else {
        base44.entities.Conversation.create({
          tenant_id: tenant.id,
          property_id: tenant.property_id,
          status: "Active",
          channel: "WhatsApp",
          unread_count: 0,
          is_demo: tenant.is_demo || false,
          source: "manual",
        })
          .then((c) => { setSelectedId(c.id); setMobileView("chat"); reload(); })
          .catch(() => toast.error("Couldn't open a conversation for that tenant"))
          .finally(clear);
      }
    } else {
      clear();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, searchParams, conversations.length, tenants.length]);

  const sortedConversations = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = [...conversations].sort((a, b) =>
      String(b.last_message_at || "").localeCompare(String(a.last_message_at || ""))
    );
    if (q) {
      list = list.filter((c) => {
        const tenant = tenants.find((t) => t.id === c.tenant_id);
        const property = properties.find((p) => p.id === c.property_id);
        return [tenant?.name, property?.name, c.last_message]
          .some((s) => (s || "").toLowerCase().includes(q));
      });
    }
    return list;
  }, [conversations, tenants, properties, search]);

  const conversation = conversations.find((c) => c.id === selectedId) || null;
  const tenant = conversation ? tenants.find((t) => t.id === conversation.tenant_id) : null;
  const property = conversation ? properties.find((p) => p.id === conversation.property_id) : null;

  const thread = useMemo(
    () =>
      messages
        .filter((m) => m.conversation_id === selectedId)
        .sort((a, b) => String(a.timestamp || "").localeCompare(String(b.timestamp || ""))),
    [messages, selectedId]
  );
  const latestTenantMsg = useMemo(
    () => [...thread].reverse().find((m) => m.sender === "tenant") || null,
    [thread]
  );

  // Triage shown = the one just run, else the latest persisted for the thread.
  const triage = useMemo(() => {
    if (freshTriage && freshTriage.conversation_id === selectedId) return freshTriage;
    return (
      [...triages]
        .filter((t) => t.conversation_id === selectedId)
        .sort((a, b) => String(b.created_at || b.created_date || "").localeCompare(String(a.created_at || a.created_date || "")))[0] || null
    );
  }, [freshTriage, triages, selectedId]);

  const triageTicket = useMemo(() => {
    if (!triage) return null;
    return (
      tickets.find((t) => t.id === triage.maintenance_ticket_id) ||
      tickets.find((t) => t.ai_triage_id === triage.id) ||
      null
    );
  }, [triage, tickets]);

  const matched = useMemo(() => {
    if (!triage?.issue_type) return [];
    return matchContractors(contractors, triage.issue_type, property?.postcode || "");
  }, [triage, contractors, property]);

  const sendMessage = async (content, sender = "landlord") => {
    const now = new Date().toISOString();
    await base44.entities.Message.create({
      conversation_id: conversation.id,
      sender,
      content,
      timestamp: now,
    });
    await base44.entities.Conversation.update(conversation.id, {
      last_message: content,
      last_message_at: now,
      ...(sender === "landlord" ? { unread_count: 0 } : {}),
    });
  };

  const handleSend = async (text) => {
    if (!conversation) return;
    setSending(true);
    try {
      await sendMessage(text);
      await logActivity(base44, {
        property_id: conversation.property_id,
        tenant_id: conversation.tenant_id,
        event_type: "WhatsApp message",
        description: `Reply to ${tenant?.name || "tenant"}: ${text.slice(0, 60)}`,
      });
      setDraft("");
      reload();
    } catch (e) {
      toast.error(`Couldn't send: ${e?.message || "unknown error"}`);
    } finally {
      setSending(false);
    }
  };

  const runTriage = async () => {
    if (!conversation) return;
    if (!latestTenantMsg) {
      toast.info("No tenant message to triage yet");
      return;
    }
    setTriaging(true);
    try {
      const propEquipment = equipment.filter((e) => e.property_id === conversation.property_id);
      const recentIssues = tickets
        .filter((t) => t.property_id === conversation.property_id)
        .slice(0, 3)
        .map((t) => t.description);
      const res = await base44.functions.invoke("ai_triage", {
        message: latestTenantMsg.content,
        propertyName: property?.name,
        propertyAddress: property?.address,
        equipment: propEquipment,
        tenantName: tenant?.name,
        recentIssues,
      });
      const t = res?.data?.triage || res?.data || {};
      const record = await base44.entities.AITriage.create({
        message_id: latestTenantMsg.id,
        conversation_id: conversation.id,
        property_id: conversation.property_id,
        issue_type: t.issue_type,
        urgency: t.urgency,
        suggested_reply: t.suggested_reply,
        troubleshooting: t.troubleshooting,
        equipment_context: t.equipment_context,
        recommended_action: t.recommended_action,
        created_at: new Date().toISOString(),
      });
      setFreshTriage({ ...record, create_ticket: t.create_ticket });
      await logActivity(base44, {
        property_id: conversation.property_id,
        tenant_id: conversation.tenant_id,
        event_type: "AI triage",
        description: `Triage: ${t.issue_type || "general"} / ${t.urgency || "low"}`,
        severity: sevFromUrgency(t.urgency),
        related_id: record.id,
      });
      reload();
    } catch (e) {
      toast.error(`Triage failed: ${e?.response?.data?.error || e.message}`);
    } finally {
      setTriaging(false);
    }
  };

  const createTicket = async () => {
    if (!triage || !conversation) return null;
    setCreatingTicket(true);
    try {
      const ticket = await base44.entities.MaintenanceTicket.create({
        property_id: conversation.property_id,
        tenant_id: conversation.tenant_id,
        conversation_id: conversation.id,
        ai_triage_id: triage.id,
        issue_type: triage.issue_type === "rent query" ? "general" : (triage.issue_type || "general"),
        urgency: triage.urgency,
        status: "AI triage",
        description: latestTenantMsg?.content || triage.recommended_action || "Tenant-reported issue",
      });
      try {
        await base44.entities.AITriage.update(triage.id, { maintenance_ticket_id: ticket.id });
      } catch { /* linkage is best-effort */ }
      await logActivity(base44, {
        property_id: conversation.property_id,
        tenant_id: conversation.tenant_id,
        event_type: "Maintenance created",
        description: `Ticket from triage: ${(ticket.description || "").slice(0, 60)}`,
        related_id: ticket.id,
        severity: sevFromUrgency(triage.urgency),
      });
      toast.success("Maintenance ticket created");
      reload();
      return ticket;
    } catch (e) {
      toast.error(`Couldn't create ticket: ${e?.message || "unknown error"}`);
      return null;
    } finally {
      setCreatingTicket(false);
    }
  };

  // One-tap hire: guarantee a ticket, assign the contractor, tell the tenant.
  const hireContractor = async (contractor) => {
    if (!conversation || !triage) return;
    setHiringId(contractor.id);
    try {
      let ticket = triageTicket;
      if (!ticket) ticket = await createTicket();
      if (!ticket) return;
      await base44.entities.MaintenanceTicket.update(ticket.id, {
        contractor_id: contractor.id,
        status: "Contractor requested",
      });
      await sendMessage(
        `We've asked ${contractor.name} (${contractor.trade}) to arrange a visit — they'll be in touch to confirm a time.`,
        "system"
      );
      await logActivity(base44, {
        property_id: conversation.property_id,
        tenant_id: conversation.tenant_id,
        event_type: "Contractor assigned",
        description: `${contractor.name} assigned to: ${(ticket.description || "").slice(0, 50)}`,
        related_id: ticket.id,
      });
      toast.success(`${contractor.name} requested — tenant notified`);
      reload();
    } catch (e) {
      toast.error(`Hire failed: ${e?.message || "unknown error"}`);
    } finally {
      setHiringId(null);
    }
  };

  const sendAiReply = async () => {
    if (!triage?.suggested_reply || !conversation) return;
    setSending(true);
    try {
      await sendMessage(triage.suggested_reply);
      await logActivity(base44, {
        property_id: conversation.property_id,
        tenant_id: conversation.tenant_id,
        event_type: "WhatsApp message",
        description: "AI-suggested reply sent",
      });
      reload();
    } catch (e) {
      toast.error(`Couldn't send: ${e?.message || "unknown error"}`);
    } finally {
      setSending(false);
    }
  };

  const logToSheet = async () => {
    if (!conversation) return;
    setLoggingSheet(true);
    try {
      const res = await base44.functions.invoke("log_to_sheet", {
        conversation_id: conversation.id,
      });
      if (res?.data?.sheet_id) setCommsSheetId(res.data.sheet_id);
      toast.success("Conversation logged to the comms sheet");
    } catch (e) {
      const msg = e?.response?.data?.error || e.message || "";
      if (e?.response?.status === 403 || msg.toLowerCase().includes("write access") || msg.toLowerCase().includes("scope")) {
        toast.error("Google Sheets needs write access — re-authorise the connector in Base44, then try again.");
      } else {
        toast.error(`Sheet log failed: ${msg}`);
      }
    } finally {
      setLoggingSheet(false);
    }
  };

  const onTestResult = (d) => {
    reload();
    if (d?.conversation_id) {
      setSelectedId(d.conversation_id);
      setMobileView("chat");
      if (d.triage) setFreshTriage({ ...d.triage, conversation_id: d.conversation_id });
    }
  };

  if (loading) return <PageSkeleton />;

  const chatPane = (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex-1 min-h-0 flex flex-col">
        <ChatPanel
          conversation={conversation}
          tenant={tenant}
          property={property}
          messages={thread}
          onBack={() => setMobileView("list")}
          onOpenInfo={() => setInfoOpen(true)}
          draft={draft}
          onDraftChange={setDraft}
          onSend={handleSend}
          sending={sending}
          onTriage={runTriage}
          triaging={triaging}
        />
      </div>
      {conversation && (
        <AIPanel
          triage={triage}
          ticket={triageTicket}
          matchedContractors={matched}
          onAsk={(q) => setDraft((d) => (d ? `${d.trimEnd()} ${q}` : q))}
          onSendReply={sendAiReply}
          sendingReply={sending}
          onCreateTicket={createTicket}
          creatingTicket={creatingTicket}
          onHire={hireContractor}
          hiringId={hiringId}
          onLogToSheet={logToSheet}
          loggingSheet={loggingSheet}
        />
      )}
    </div>
  );

  return (
    <div className="space-y-4 animate-fade-in">
      <PageHeader
        title="Inbox"
        subtitle="Tenant WhatsApp with AI triage — collect, organise, act"
        actions={
          <>
            {commsSheetId && (
              <a
                href={`https://docs.google.com/spreadsheets/d/${commsSheetId}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-2 border bg-card hover:bg-muted rounded-lg text-sm font-medium transition-colors"
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span className="hidden sm:inline">Comms log</span>
              </a>
            )}
            <button
              onClick={() => setBroadcastOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 border bg-card hover:bg-muted rounded-lg text-sm font-medium transition-colors"
            >
              <Megaphone className="w-4 h-4" />
              <span className="hidden sm:inline">Broadcast</span>
            </button>
            <button
              onClick={() => setTestOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
            >
              <FlaskConical className="w-4 h-4" />
              <span className="hidden sm:inline">Test message</span>
            </button>
          </>
        }
      />

      <div className="rounded-xl border bg-card overflow-hidden h-[calc(100dvh-240px)] lg:h-[calc(100dvh-180px)] min-h-[420px]">
        {/* Desktop: three panes */}
        <div className="hidden lg:grid lg:grid-cols-[20rem_1fr_20rem] h-full">
          <div className="border-r h-full min-h-0">
            <ConversationList
              conversations={sortedConversations}
              tenants={tenants}
              properties={properties}
              selectedId={selectedId}
              onSelect={selectConversation}
              search={search}
              onSearch={setSearch}
            />
          </div>
          <div className="h-full min-h-0">{chatPane}</div>
          <div className="border-l h-full min-h-0">
            <PropertyIntelligence property={property} tenant={tenant} />
          </div>
        </div>

        {/* Mobile: drill-in */}
        <div className="lg:hidden h-full">
          {mobileView === "list" || !conversation ? (
            <ConversationList
              conversations={sortedConversations}
              tenants={tenants}
              properties={properties}
              selectedId={selectedId}
              onSelect={selectConversation}
              search={search}
              onSearch={setSearch}
            />
          ) : (
            chatPane
          )}
        </div>
      </div>

      <ConnectionCard />

      <Sheet open={infoOpen} onOpenChange={setInfoOpen}>
        <SheetContent side="right" className="w-full sm:max-w-md p-0">
          <SheetHeader className="px-4 pt-4 pb-2">
            <SheetTitle>Property intelligence</SheetTitle>
          </SheetHeader>
          <PropertyIntelligence property={property} tenant={tenant} />
        </SheetContent>
      </Sheet>

      <TestMessageModal
        open={testOpen}
        onClose={() => setTestOpen(false)}
        tenants={tenants}
        onResult={onTestResult}
      />
      <BroadcastModal
        open={broadcastOpen}
        onClose={() => setBroadcastOpen(false)}
        tenants={tenants}
        properties={properties}
        conversations={conversations}
        reload={reload}
      />
    </div>
  );
}