import React, { useState } from "react";
import { Link } from "react-router-dom";

const SIZES = {
  xs: { avatar: "w-5 h-5 text-[9px]", text: "text-xs" },
  sm: { avatar: "w-6 h-6 text-[10px]", text: "text-sm" },
  md: { avatar: "w-8 h-8 text-xs", text: "text-sm" },
  lg: { avatar: "w-16 h-16 text-xl", text: "text-lg font-semibold" },
};

export function tenantInitials(name) {
  return String(name || "?")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("");
}

export function TenantAvatar({ tenant, size = "sm" }) {
  const s = SIZES[size] || SIZES.sm;
  const [broken, setBroken] = useState(false);
  if (tenant?.photo_url && !broken) {
    return (
      <img
        src={tenant.photo_url}
        alt={tenant.name}
        onError={() => setBroken(true)}
        className={`${s.avatar} rounded-full object-cover shrink-0`}
      />
    );
  }
  return (
    <span
      className={`${s.avatar} rounded-full bg-[hsl(var(--navy))] dark:bg-[hsl(var(--sage))] text-white flex items-center justify-center font-semibold shrink-0`}
    >
      {tenantInitials(tenant?.name)}
    </span>
  );
}

// Uniform clickable reference to a tenant: avatar + name linking to the
// tenant profile. Null-safe.
export default function TenantChip({ tenant, size = "sm", className = "" }) {
  if (!tenant) return <span className="text-muted-foreground">—</span>;
  const s = SIZES[size] || SIZES.sm;
  return (
    <Link
      to={`/tenants/${tenant.id}`}
      onClick={(e) => e.stopPropagation()}
      className={`inline-flex items-center gap-1.5 max-w-full hover:underline decoration-[hsl(var(--sage))] decoration-2 underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] rounded ${className}`}
    >
      <TenantAvatar tenant={tenant} size={size} />
      <span className={`${s.text} font-medium text-foreground truncate`}>{tenant.name}</span>
    </Link>
  );
}