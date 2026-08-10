import React from "react";
import { Link } from "react-router-dom";

// Uniform clickable reference to a property. Renders children (or the
// property name) as a link to the property detail page. Null-safe.
export default function PropertyLink({ property, className = "", children }) {
  if (!property) return <span className="text-slate-400">—</span>;
  return (
    <Link
      to={`/properties/${property.id}`}
      onClick={(e) => e.stopPropagation()}
      className={`hover:underline decoration-[hsl(var(--sage))] decoration-2 underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--sage))] rounded ${className}`}
    >
      {children || property.name}
    </Link>
  );
}
