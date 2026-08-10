// Shared helpers for sheet/file import. Pure functions, no SDK — usable by any backend function.

export function normalizeAddress(address: string, postcode: string): string {
  const a = (address || "").toLowerCase().trim().replace(/[.,'"]/g, "").replace(/\s+/g, " ");
  const p = (postcode || "").toLowerCase().replace(/\s+/g, " ").trim();
  return `${a}|${p}`;
}

export function normalizePhone(phone: string): string {
  let p = (phone || "").replace(/\D/g, "");
  if (p.startsWith("44")) p = p.slice(2);
  if (p.startsWith("0")) p = p.slice(1);
  return p;
}

export function normalizeName(name: string): string {
  return (name || "").toLowerCase().trim().replace(/\s+/g, " ");
}

export function parseDate(str: string): string | null {
  if (!str) return null;
  const s = String(str).trim();
  // DD/MM/YYYY
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) {
    const dd = m[1].padStart(2, "0"), mm = m[2].padStart(2, "0"), yyyy = m[3];
    return `${yyyy}-${mm}-${dd}`;
  }
  // ISO YYYY-MM-DD
  const m2 = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m2) return s.slice(0, 10);
  // Fallback: Date.parse
  const d = new Date(s);
  if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  return null;
}

export function parseCurrency(str: any): number {
  if (typeof str === "number") return str;
  const n = parseFloat(String(str || "").replace(/[^0-9.]/g, ""));
  return isNaN(n) ? 0 : n;
}

export function parseVacant(str: any): boolean | null {
  if (str === true) return true;
  if (str === false) return false;
  const s = String(str || "").toLowerCase().trim();
  if (["yes", "y", "true", "1", "vacant", "v"].includes(s)) return true;
  if (["no", "n", "false", "0", "occupied", "o"].includes(s)) return false;
  return null;
}

export function computeComplianceStatus(expiryDate: string): string {
  if (!expiryDate) return "Missing";
  const days = Math.floor((new Date(expiryDate).getTime() - Date.now()) / 86400000);
  if (days < 0) return "Overdue";
  if (days <= 60) return "Expiring soon";
  return "Compliant";
}

export function addYear(dateStr: string): string {
  const d = new Date(dateStr);
  d.setFullYear(d.getFullYear() + 1);
  return d.toISOString().slice(0, 10);
}

export function mapPropertyType(classType: string): string {
  const s = (classType || "").toLowerCase();
  if (s.includes("hmo")) return "HMO";
  if (s.includes("flat") || s.includes("apartment")) return "Flat";
  if (s.includes("bungalow")) return "Bungalow";
  if (s.includes("studio")) return "Studio";
  return "House";
}

export function mapHmoStatus(classType: string): string {
  const s = (classType || "").toLowerCase();
  if (s.includes("licensed") && s.includes("hmo")) return "Licensed HMO";
  if (s.includes("hmo")) return "HMO (unlicensed)";
  return "Not HMO";
}

// Canonical KIE template — tab name → entity + field → suggested header keywords
export const CANONICAL_TEMPLATE = {
  Property: {
    matchTab: ["properties", "property"],
    fields: {
      name: ["name", "property", "title"],
      address: ["address", "addr", "line1"],
      postcode: ["postcode", "post code", "zip"],
      vacant: ["vacant", "empty", "void"],
      property_type: ["class", "type", "property type"],
      units_count: ["beds", "bedrooms", "rooms", "units"],
    },
  },
  Tenant: {
    matchTab: ["tenants", "tenant"],
    fields: {
      name: ["name", "tenant", "tenant name"],
      phone: ["phone", "mobile", "tel", "contact"],
      email: ["email", "e-mail"],
      property: ["property", "property name", "address"],
      tenancy_start: ["start", "contract start", "tenancy start", "from"],
      tenancy_end: ["end", "contract end", "tenancy end", "to", "expiry"],
      rent_amount: ["rent", "monthly rent", "amount"],
    },
  },
  Equipment: {
    matchTab: ["boilers", "equipment", "boiler"],
    fields: {
      property: ["property", "property name", "address"],
      make: ["make", "brand", "manufacturer"],
      model: ["model", "type"],
      install_date: ["install", "installed", "install date", "fitted"],
      last_service_date: ["last service", "serviced", "service date", "last service date"],
    },
  },
  ComplianceRecord: {
    matchTab: ["contracts", "compliance", "documents", "certificates"],
    fields: {
      property: ["property", "property name", "address"],
      category: ["document type", "type", "category", "document"],
      issue_date: ["issue", "issue date", "issued", "start"],
      expiry_date: ["expiry", "expiry date", "expires", "end", "valid until"],
    },
  },
};

// Fuzzy match: returns best column header for a field given its keywords
export function suggestColumn(headers: string[], keywords: string[]): string {
  const norm = (s: string) => s.toLowerCase().trim();
  let best = "";
  let bestScore = 0;
  for (const h of headers) {
    const hn = norm(h);
    let score = 0;
    for (const kw of keywords) {
      if (hn === kw) score += 10;
      else if (hn.includes(kw)) score += 5;
      else if (kw.includes(hn) && hn.length > 2) score += 2;
    }
    if (score > bestScore) { bestScore = score; best = h; }
  }
  return best;
}

export function suggestEntityForTab(tabName: string): string {
  const n = tabName.toLowerCase().trim();
  for (const [entity, cfg] of Object.entries(CANONICAL_TEMPLATE)) {
    if (cfg.matchTab.some((m) => n.includes(m))) return entity;
  }
  return "";
}