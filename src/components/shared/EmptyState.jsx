import React from "react";

// Teaching empty state: icon, one-line explanation, and the action that fixes
// the emptiness. `compact` renders a slimmer inline variant for card bodies.
export default function EmptyState({ icon: Icon, title, description, action, compact = false }) {
  return (
    <div className={`flex flex-col items-center justify-center text-center ${compact ? "py-8 px-4" : "py-14 px-6"}`}>
      {Icon && (
        <div className="w-11 h-11 rounded-xl bg-muted flex items-center justify-center mb-3">
          <Icon className="w-5 h-5 text-muted-foreground" />
        </div>
      )}
      <p className="text-sm font-medium text-foreground">{title}</p>
      {description && <p className="text-sm text-muted-foreground mt-1 max-w-sm">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}