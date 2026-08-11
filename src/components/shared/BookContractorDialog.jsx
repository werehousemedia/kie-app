import React, { useMemo, useState } from "react";
import { toast } from "sonner";
import { Star } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { logActivity } from "@/lib/kieUtils";
import { rankContractors } from "@/lib/taskUtils";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// Ranks the top three contractors for a task (trade/accreditation first, then
// postcode proximity, preferred status and rating) and books one on click:
// assigns the contractor to the Task (and its source MaintenanceTicket, if
// any) and writes an Activity Timeline event. Shared by Open Tasks and the
// Compliance "Create job" flow.
export default function BookContractorDialog({ task, properties, contractors, onClose, onBooked }) {
  const [bookingId, setBookingId] = useState(null);
  const property = properties.find((p) => p.id === task?.property_id);
  const ranked = useMemo(
    () => (task ? rankContractors(contractors, task, property) : []),
    [task, contractors, property],
  );

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
      onBooked();
    } catch (e) {
      toast.error(`Couldn't book: ${e?.message || "unknown error"}`);
    } finally {
      setBookingId(null);
    }
  };

  return (
    <Dialog open={!!task} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Book a contractor</DialogTitle>
        </DialogHeader>
        {task && (
          <div className="space-y-3">
            <div className="rounded-lg bg-muted/60 px-3 py-2">
              <p className="text-sm font-medium">{task.title}</p>
              <p className="text-xs text-muted-foreground">
                {property?.name}{ranked[0]?.requirement ? ` · needs: ${ranked[0].requirement}` : ""}
              </p>
            </div>
            {ranked.length === 0 && (
              <p className="text-sm text-muted-foreground py-4 text-center">No contractors on file yet.</p>
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
                  <Button
                    size="sm"
                    disabled={!!bookingId}
                    onClick={() => book(c)}
                    className="shrink-0"
                  >
                    {bookingId === c.id ? "Booking…" : "Book"}
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
