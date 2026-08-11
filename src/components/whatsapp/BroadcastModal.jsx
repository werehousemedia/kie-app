import React, { useMemo, useState } from "react";
import { toast } from "sonner";
import { Megaphone } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { base44 } from "@/api/base44Client";
import { logActivity } from "@/lib/kieUtils";

const TEMPLATES = {
  "Rent reminder": "Hi {{name}}, a friendly reminder that rent for {{property}} is due shortly. Let me know if anything's changed on your side — happy to help. Thanks!",
  "Inspection notice": "Hi {{name}}, we'd like to arrange a routine inspection at {{property}} in the next couple of weeks. Could you share a few times that suit you?",
  "Cold-weather advice": "Hi {{name}}, with cold weather coming: please keep the heating on low even when out, and let some air circulate to prevent condensation and frozen pipes at {{property}}. Report any issues straight away — thanks!",
  "Emergency notice": "Hi {{name}}, important notice regarding {{property}}: [describe the issue]. Please reply to confirm you've seen this.",
  Custom: "",
};

const personalise = (tpl, tenant, property) =>
  tpl
    .replaceAll("{{name}}", (tenant?.name || "there").split(" ")[0])
    .replaceAll("{{property}}", property?.name || "your home");

// Templated bulk message to all tenants or one property's tenants. Creates
// real Message rows in each tenant's conversation (creating conversations
// where missing) — delivered in-app today, WhatsApp delivery with the live
// integration.
export default function BroadcastModal({ open, onClose, tenants, properties, conversations, reload }) {
  const [audience, setAudience] = useState("all");
  const [template, setTemplate] = useState("Rent reminder");
  const [body, setBody] = useState(TEMPLATES["Rent reminder"]);
  const [sending, setSending] = useState(false);

  const recipients = useMemo(
    () => (audience === "all" ? tenants : tenants.filter((t) => t.property_id === audience)),
    [audience, tenants]
  );
  const first = recipients[0];
  const firstProperty = properties.find((p) => p.id === first?.property_id);

  const pickTemplate = (name) => {
    setTemplate(name);
    setBody(TEMPLATES[name] ?? "");
  };

  const send = async () => {
    if (!body.trim() || recipients.length === 0) {
      toast.error("Write a message and pick at least one recipient");
      return;
    }
    setSending(true);
    let sent = 0;
    const failed = [];
    const now = new Date().toISOString();
    for (const tenant of recipients) {
      try {
        const property = properties.find((p) => p.id === tenant.property_id);
        const content = personalise(body, tenant, property);
        let convo = conversations.find((c) => c.tenant_id === tenant.id);
        if (!convo) {
          convo = await base44.entities.Conversation.create({
            tenant_id: tenant.id,
            property_id: tenant.property_id,
            status: "Active",
            channel: "WhatsApp",
            unread_count: 0,
            is_demo: tenant.is_demo || false,
            source: "manual",
          });
        }
        await base44.entities.Message.create({
          conversation_id: convo.id,
          sender: "landlord",
          content,
          timestamp: now,
        });
        await base44.entities.Conversation.update(convo.id, {
          last_message: content,
          last_message_at: now,
        });
        sent++;
      } catch {
        failed.push(tenant.name);
      }
    }
    try {
      await logActivity(base44, {
        event_type: "WhatsApp message",
        description: `Broadcast "${template}" to ${sent} tenant${sent === 1 ? "" : "s"}${failed.length ? ` (${failed.length} failed)` : ""}`,
      });
    } catch {
      /* activity log is best-effort */
    }
    setSending(false);
    if (failed.length) {
      toast.warning(`Sent to ${sent}, failed for ${failed.join(", ")}`);
    } else {
      toast.success(`Broadcast sent to ${sent} tenant${sent === 1 ? "" : "s"}`);
    }
    reload();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !sending && !v && onClose()}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Megaphone className="w-4 h-4" /> Broadcast to tenants
          </DialogTitle>
          <DialogDescription>
            Delivered in-app and logged; WhatsApp delivery arrives with the live integration.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 mt-1">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Audience</label>
              <Select value={audience} onValueChange={setAudience}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All tenants ({tenants.length})</SelectItem>
                  {properties.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name} ({tenants.filter((t) => t.property_id === p.id).length})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Template</label>
              <Select value={template} onValueChange={pickTemplate}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.keys(TEMPLATES).map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">
              Message — {"{{name}}"} and {"{{property}}"} personalise per tenant
            </label>
            <Textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={4}
              className="mt-1"
              placeholder="Write your message…"
            />
          </div>
          {first && body.trim() && (
            <div className="rounded-xl border bg-muted/50 p-3">
              <p className="text-[11px] font-semibold text-muted-foreground mb-1">
                Preview for {first.name}
              </p>
              <p className="text-sm whitespace-pre-wrap">{personalise(body, first, firstProperty)}</p>
            </div>
          )}
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground tabular-nums">
              {recipients.length} recipient{recipients.length === 1 ? "" : "s"}
            </p>
            <div className="flex gap-2">
              <button
                onClick={onClose}
                disabled={sending}
                className="px-3.5 py-2 border bg-card hover:bg-muted rounded-lg text-sm font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={send}
                disabled={sending || recipients.length === 0}
                className="px-3.5 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-60"
              >
                {sending ? `Sending ${recipients.length}…` : "Send broadcast"}
              </button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}