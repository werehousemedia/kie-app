import React, { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Star, MessageSquare, ArrowLeft, Send, Copy, Phone } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { logActivity } from "@/lib/kieUtils";
import { rankContractors } from "@/lib/taskUtils";
import { composeJobMessage, waDispatchLink } from "@/lib/jobMessage";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

// Two steps:
//   1. PICK   — top three contractors (trade/accreditation, then area,
//               preferred, rating), booked on click.
//   2. DISPATCH — the app has already written the job message; the landlord
//               edits if they like, then sends it from the app or opens
//               WhatsApp with it pre-typed. This is the "first steps towards
//               booking without human intervention" the workflow needs.
export default function BookContractorDialog({ task, properties, contractors, tenants = [], onClose, onBooked }) {
  const [bookingId, setBookingId] = useState(null);
  const [booked, setBooked] = useState(null); // contractor we just assigned
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);

  const property = properties.find((p) => p.id === task?.property_id);
  const tenant = useMemo(
    () => tenants.find((t) => t.id === task?.tenant_id) || tenants.find((t) => t.property_id === task?.property_id) || null,
    [tenants, task],
  );
  const ranked = useMemo(
    () => (task ? rankContractors(contractors, task, property) : []),
    [task, contractors, property],
  );

  // Reset when the dialog opens for a different task.
  useEffect(() => {
    if (task) { setBooked(null); setDraft(""); }
  }, [task?.id]);

  const book = async (contractor) => {
    setBookingId(contractor.id);
    try {
      await base44.entities.Task.update(task.id, {
        contractor_id: contractor.id,
        status: task.status === "Open" ? "In progress" : task.status,
      });
      if (task.source_type === "MaintenanceTicket" && task.source_id) {
        try {
          await base44.entities.MaintenanceTicket.update(task.source_id, {
            contractor_id: contractor.id,
            status: "Contractor requested",
          });
        } catch { /* ticket linkage is best-effort */ }
      }
      await logActivity(base44, {
        property_id: task.property_id,
        event_type: "Contractor assigned",
        description: `${contractor.name} booked for: ${task.title}`,
        related_id: task.id,
      });
      toast.success(`${contractor.name} booked`);
      setBooked(contractor);
      setDraft(composeJobMessage({ task, property, contractor, tenant }));
    } catch (e) {
      toast.error(`Couldn't book: ${e?.message || "unknown error"}`);
    } finally {
      setBookingId(null);
    }
  };

  const link = booked ? waDispatchLink(booked.phone, draft) : null;

  const sendFromApp = async () => {
    if (!booked || !draft.trim()) return;
    setSending(true);
    try {
      const res = await base44.functions.invoke("send_whatsapp", {
        contractor_id: booked.id,
        content: draft,
        task_id: task.id,
      });
      const d = res?.data || {};
      if (d.error) throw new Error(d.error);
      if (d.delivered) {
        toast.success(`Job sent to ${booked.name} on WhatsApp`);
        finish();
      } else {
        toast.warning(
          d.not_configured
            ? "WhatsApp isn't connected — open WhatsApp to send it"
            : `Couldn't send: ${d.detail}`,
          { duration: 8000 },
        );
      }
    } catch (e) {
      toast.error(`Couldn't send: ${e?.message || "unknown error"}`);
    } finally {
      setSending(false);
    }
  };

  const openWhatsApp = async () => {
    if (!link) return;
    window.open(link, "_blank", "noopener");
    await logActivity(base44, {
      property_id: task.property_id,
      event_type: "Contractor assigned",
      description: `Job details sent to ${booked.name} on WhatsApp: ${task.title}`,
      related_id: task.id,
    }).catch(() => {});
    finish();
  };

  const finish = () => { onBooked(); };

  const copyDraft = async () => {
    try {
      await navigator.clipboard.writeText(draft);
      toast.success("Message copied");
    } catch {
      toast.error("Couldn't access the clipboard");
    }
  };

  return (
    <Dialog open={!!task} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{booked ? "Send the job details" : "Book a contractor"}</DialogTitle>
        </DialogHeader>

        {task && !booked && (
          <div className="space-y-3">
            <div className="rounded-lg bg-muted/60 px-3 py-2">
              <p className="text-sm font-medium">{task.title}</p>
              <p className="text-xs text-muted-foreground">
                {property?.name}{ranked[0]?.requirement ? ` · needs: ${ranked[0].requirement}` : ""}
              </p>
            </div>
            {ranked.length === 0 && (
              <p className="text-sm text-muted-foreground py-4 text-center">
                No contractors on file yet — add your regulars from the Contractors page.
              </p>
            )}
            <div className="space-y-2">
              {ranked.map(({ contractor: c, reasons }, i) => (
                <div key={c.id} className="flex items-center gap-3 rounded-xl border p-3">
                  <span className={cn(
                    "w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0",
                    i === 0 ? "bg-[hsl(var(--sage-light))] text-[hsl(var(--sage))]" : "bg-muted text-muted-foreground",
                  )}>
                    {i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium flex items-center gap-1.5">
                      {c.name}
                      {c.preferred && <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {c.trade}
                      {(c.accreditations || []).length > 0 && ` · ${c.accreditations.join(", ")}`}
                      {c.rating ? ` · ★ ${c.rating}` : ""}
                    </p>
                    {reasons.length > 0 && (
                      <p className="text-[11px] text-[hsl(var(--sage))] mt-0.5">{reasons.join(" · ")}</p>
                    )}
                  </div>
                  <Button size="sm" disabled={!!bookingId} onClick={() => book(c)} className="shrink-0">
                    {bookingId === c.id ? "Booking…" : "Book"}
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        {task && booked && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 rounded-lg bg-muted/60 px-3 py-2">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{booked.name}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {booked.trade}{booked.phone ? ` · ${booked.phone}` : " · no phone on file"}
                </p>
              </div>
              {booked.phone && (
                <a href={`tel:${booked.phone}`} aria-label={`Call ${booked.name}`} className="p-2 rounded-lg hover:bg-muted text-muted-foreground">
                  <Phone className="w-4 h-4" />
                </a>
              )}
            </div>

            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">
                Message — edit if you need to
              </p>
              <Textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                rows={9}
                className="text-sm font-mono leading-relaxed"
              />
            </div>

            {!booked.phone && (
              <p className="text-xs text-amber-600 dark:text-amber-400">
                No phone number saved for this contractor — add one to send on WhatsApp.
              </p>
            )}

            <div className="flex flex-wrap gap-2">
              <Button onClick={openWhatsApp} disabled={!link} className="gap-1.5">
                <MessageSquare className="w-4 h-4" /> Open in WhatsApp
              </Button>
              <Button variant="outline" onClick={sendFromApp} disabled={sending || !booked.phone} className="gap-1.5">
                <Send className="w-4 h-4" /> {sending ? "Sending…" : "Send from app"}
              </Button>
              <Button variant="outline" onClick={copyDraft} className="gap-1.5">
                <Copy className="w-4 h-4" /> Copy
              </Button>
              <Button variant="ghost" onClick={() => setBooked(null)} className="gap-1.5 ml-auto">
                <ArrowLeft className="w-4 h-4" /> Pick someone else
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground">
              “Send from app” only works if the contractor messaged the KIE number in the last 24 hours —
              WhatsApp's rule, not ours. Otherwise use Open in WhatsApp, which sends it from your own phone.
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
