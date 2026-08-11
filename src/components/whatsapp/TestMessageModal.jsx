import React, { useState } from "react";
import { toast } from "sonner";
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

// Injects a fake inbound tenant message through handle_inbound_message —
// the SAME autonomous pipeline a real WhatsApp webhook will use.
export default function TestMessageModal({ open, onClose, tenants, onResult }) {
  const [tenantId, setTenantId] = useState("");
  const [content, setContent] = useState("");
  const [sending, setSending] = useState(false);

  const send = async () => {
    if (!tenantId || !content.trim()) {
      toast.error("Pick a tenant and write a message");
      return;
    }
    setSending(true);
    try {
      const res = await base44.functions.invoke("handle_inbound_message", {
        tenant_id: tenantId,
        content: content.trim(),
      });
      const d = res?.data || {};
      const bits = ["AI replied"];
      if (d.ticket_id) bits.push("ticket created");
      if (d.sheet_logged) bits.push("logged to sheet");
      else if (d.sheet_error) bits.push("sheet log failed");
      toast.success(`Pipeline ran — ${bits.join(", ")}`);
      onResult?.(d);
      setContent("");
      onClose();
    } catch (e) {
      toast.error(`Pipeline failed: ${e?.response?.data?.error || e.message}`);
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !sending && !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Test incoming message</DialogTitle>
          <DialogDescription>
            Runs the full autonomous pipeline: triage → auto-reply → ticket if urgent → comms log.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 mt-1">
          <div>
            <label className="text-xs font-medium text-muted-foreground">From tenant</label>
            <Select value={tenantId} onValueChange={setTenantId}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Choose a tenant" />
              </SelectTrigger>
              <SelectContent>
                {tenants.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                    {t.is_demo ? " (demo)" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Message</label>
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="e.g. The boiler is making a loud banging noise and there's no hot water"
              rows={3}
              className="mt-1"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button
              onClick={onClose}
              disabled={sending}
              className="px-3.5 py-2 border bg-card hover:bg-muted rounded-lg text-sm font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={send}
              disabled={sending}
              className="px-3.5 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-60"
            >
              {sending ? "Running pipeline…" : "Send & triage"}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}