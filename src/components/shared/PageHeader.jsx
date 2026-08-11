import React from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

// Standard page header: optional back link, title + subtitle on the left,
// actions on the right. Stacks cleanly at 375px.
export default function PageHeader({ title, subtitle, backTo, actions, children }) {
  const navigate = useNavigate();
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {backTo && (
          <button
            onClick={() => navigate(backTo)}
            className="mb-1 inline-flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Back
          </button>
        )}
        <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-foreground truncate">{title}</h1>
        {subtitle && <p className="text-sm text-muted-foreground mt-0.5">{subtitle}</p>}
        {children}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2 shrink-0">{actions}</div>}
    </div>
  );
}