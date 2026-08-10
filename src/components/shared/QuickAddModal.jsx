import React from "react";
import { useNavigate } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Building2, User, Wrench, FileText, Wallet, MessageSquare } from "lucide-react";

const actions = [
  { label: "Add property", desc: "Create a new property record", icon: Building2, to: "/properties" },
  { label: "Add tenant", desc: "Register a new tenant", icon: User, to: "/tenants" },
  { label: "Log maintenance issue", desc: "Create a maintenance ticket", icon: Wrench, to: "/maintenance" },
  { label: "Upload document", desc: "Add a compliance document", icon: FileText, to: "/compliance" },
  { label: "Add bill", desc: "Record a new bill or expense", icon: Wallet, to: "/finance" },
  { label: "Open WhatsApp", desc: "Go to WhatsApp assistant", icon: MessageSquare, to: "/whatsapp" },
];

export default function QuickAddModal({ open, onClose }) {
  const navigate = useNavigate();
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Quick actions</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3 mt-2">
          {actions.map((a) => {
            const Icon = a.icon;
            return (
              <button
                key={a.label}
                onClick={() => {
                  navigate(a.to);
                  onClose();
                }}
                className="flex items-start gap-3 p-3 rounded-lg border border-slate-200 hover:border-[hsl(var(--sage))] hover:bg-slate-50 transition-all text-left"
              >
                <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                  <Icon className="w-4.5 h-4.5 text-slate-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-800">{a.label}</p>
                  <p className="text-xs text-slate-500">{a.desc}</p>
                </div>
              </button>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}