export const formatGBP = (amount) => {
  if (amount == null || isNaN(amount)) return "£0";
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

export const formatDate = (dateStr) => {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
};

export const formatDateTime = (dateStr) => {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
};

export const timeAgo = (dateStr) => {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "";
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return formatDate(dateStr);
};

// wa.me deep link — UK numbers normalised to international format.
export const waMeLink = (phone) => {
  if (!phone) return null;
  let digits = String(phone).replace(/[^0-9]/g, "");
  if (digits.startsWith("0")) digits = "44" + digits.slice(1);
  else if (digits.length === 10 && digits.startsWith("7")) digits = "44" + digits;
  return `https://wa.me/${digits}`;
};

export const gmailComposeLink = (email) =>
  email ? `https://mail.google.com/mail/?view=cm&to=${encodeURIComponent(email)}` : null;

export const daysUntil = (dateStr) => {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  return Math.ceil((d.getTime() - Date.now()) / 86400000);
};

export const urgencyColor = (urgency) => {
  const map = {
    emergency: "bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-500/15 dark:text-rose-300 dark:border-rose-500/30",
    high: "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/30",
    medium: "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-500/15 dark:text-blue-300 dark:border-blue-500/30",
    low: "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-500/15 dark:text-slate-300 dark:border-slate-500/30",
  };
  return map[urgency] || map.low;
};

export const statusColor = (status) => {
  if (!status) return "bg-slate-100 text-slate-600 dark:bg-slate-500/15 dark:text-slate-300";
  const s = status.toLowerCase();
  if (["complete", "compliant", "paid", "resolved", "available", "occupied"].some((k) => s.includes(k)))
    return "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300";
  if (["overdue", "failed", "escalated", "void", "missing"].some((k) => s.includes(k)))
    return "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300";
  if (["expiring", "due", "awaiting", "pending", "booked", "limited"].some((k) => s.includes(k)))
    return "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300";
  if (["progress", "active", "triage", "scheduled"].some((k) => s.includes(k)))
    return "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300";
  return "bg-slate-100 text-slate-600 dark:bg-slate-500/15 dark:text-slate-300";
};

export const logActivity = async (base44, data) => {
  try {
    await base44.entities.ActivityEvent.create({
      ...data,
      timestamp: new Date().toISOString(),
    });
  } catch (e) {
    console.error("Activity log failed:", e);
  }
};

export const tradeToIssueMap = {
  plumbing: ["Plumbing", "General"],
  heating: ["Heating/Gas", "General"],
  electricity: ["Electrical", "General"],
  appliance: ["Appliance repair", "General"],
  structural: ["General", "Carpentry", "Roofing"],
  general: ["General"],
  security: ["Locksmith", "General"],
  "pest control": ["Pest control"],
};

export const matchContractors = (contractors, issueType, postcode = "") => {
  const trades = tradeToIssueMap[issueType] || ["General"];
  return contractors
    .filter((c) => trades.includes(c.trade))
    .map((c) => {
      let score = 0;
      if (c.preferred) score += 30;
      if (c.availability === "Available") score += 20;
      if (c.availability === "Limited") score += 10;
      score += (c.rating || 0) * 5;
      if (postcode && c.coverage_area && c.coverage_area.toLowerCase().includes(postcode.split(" ")[0].toLowerCase().slice(0, 2)))
        score += 15;
      return { ...c, matchScore: score };
    })
    .sort((a, b) => b.matchScore - a.matchScore);
};