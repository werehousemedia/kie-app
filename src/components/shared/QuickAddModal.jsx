import React from "react";
import { useNavigate } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Building2, User, Wrench, FileText, Wallet, MessageSquare } from "lucide-react";

// Each tile deep-links straight into the create flow (?new=1 opens the page's
// add modal) — not just the list page.
const actions = [
  { label: "Add property", desc: "Create a property record", icon: Building2, to: "/properties?new=1" },
  { label: "Add tenant", desc: "Register a new tenant", icon: User, to: "/tenants?new=1" },
  { label: "Create job", desc: "Log a maintenance issue", icon: Wrench, to: "/maintenance?new=1" },
  { label: "Add document", desc: "Record a compliance cert", icon: FileText, to: "/compliance?new=1" },
  { label: "Add bill", desc: "Record a bill or expense", icon: Wallet, to: "/finance?new=1" },
  { label: "Open inbox", desc: "Tenant conversations", icon: MessageSquare, to: "/whatsapp" },
];

export default function QuickAddModal({ open, onClose }) {
  const navigate = useNavigate();
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Quick actions</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-2.5 mt-2">
          {actions.map((a) => {
            const Icon = a.icon;
            return (
              <button
                key={a.label}
                onClick={() => {
                  navigate(a.to);
                  onClose();
                }}
                className="flex items-start gap-3 p-3 rounded-xl border hover:border-[hsl(var(--sage))] hover:bg-muted/60 active:scale-[0.98] transition-all text-left"
              >
                <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
                  <Icon className="w-[18px] h-[18px] text-foreground" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">{a.label}</p>
                  <p className="text-xs text-muted-foreground truncate">{a.desc}</p>
                </div>
              </button>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}