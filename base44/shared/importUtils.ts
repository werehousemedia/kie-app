// Shared helpers for sheet/file import. Pure functions, no SDK — usable by any backend function.

export function normalizeAddress(address: string, postcode: string): string {
  const a = (address || "").toLowerCase().trim().replace(/[.,'"]/g, "").replace(/\s+/g, " ");
  const p = (postcode || "").toLowerCase().replace(/\s+/g, " ").trim();
  return `${a}|${p}`;
}

function digitsOf(phone: any): string {
  let s = String(phone ?? "").trim();
  if (/^\d+\.0$/.test(s)) s = s.slice(0, -2); // numeric cell artefact "1234.0"
  return s.replace(/\D/g, "");
}

export function normalizePhone(phone: any): string {
  let p = digitsOf(phone);
  if (p.startsWith("44")) p = p.slice(2);
  if (p.startsWith("0")) p = p.slice(1);
  return p;
}

export function formatUkPhone(phone: any): string {
  const core = normalizePhone(phone);
  if (core.length === 10) return `0${core.slice(0, 4)} ${core.slice(4)}`;
  return String(phone ?? "").trim();
}

export function normalizeName(name: any): string {
  return String(name ?? "").toLowerCase().replace(/[.,'"()&-]/g, " ").replace(/\s+/g, " ").trim();
}

export function parseIntSafe(v: any): number | null {
  const n = parseFloat(String(v ?? "").replace(/[^0-9.]/g, ""));
  return isNaN(n) ? null : Math.round(n);
}

export function isExampleRow(row: Record<string, any>): boolean {
  return Object.values(row).some((v) => String(v ?? "").toUpperCase().includes("EXAMPLE ROW"));
}

export function isValidEmail(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(s ?? "").trim());
}

const COMPLIANCE_ALIASES: Record<string, string> = {
  "gas safety certificate": "Gas Safety Certificate",
  "gas safety certificate cp12": "Gas Safety Certificate",
  "cp12": "Gas Safety Certificate",
  "epc": "EPC",
  "eicr": "EICR",
  "electrical installation condition report": "EICR",
  "boiler service": "Boiler service",
  "smoke co alarm": "Smoke/CO alarm",
  "smoke co alarm check": "Smoke/CO alarm",
  "smoke alarm": "Smoke/CO alarm",
  "co alarm": "Smoke/CO alarm",
  "hmo licence": "HMO licence",
  "hmo license": "HMO licence",
  "insurance": "Insurance",
  "landlord insurance": "Insurance",
  "tenancy agreement": "Tenancy agreement",
  "inventory": "Inventory",
  "legionella risk assessment": "Legionella Risk Assessment",
  "pat test": "PAT Test",
  "portable appliance test": "PAT Test",
  "deposit protection certificate": "Deposit Protection Certificate",
};

export function normalizeComplianceCategory(raw: string): { category: string; known: boolean } {
  const key = normalizeName(String(raw ?? "").replace(/\//g, " "));
  const hit = COMPLIANCE_ALIASES[key];
  return hit ? { category: hit, known: true } : { category: String(raw ?? "").trim(), known: false };
}

export function mapFuelType(raw: string): string | null {
  const s = String(raw ?? "").toLowerCase().trim();
  if (!s) return null;
  if (s.includes("gas") && !s.includes("lpg")) return "Gas";
  if (s.includes("electric")) return "Electric";
  if (s.includes("oil")) return "Oil";
  if (s.includes("lpg")) return "LPG";
  if (s.includes("heat pump") || s.includes("ashp") || s.includes("gshp")) return "Heat pump";
  return "Other";
}

export function deriveOccupancy(unitStatuses: string[]): string {
  const vacant = unitStatuses.filter((s) => s === "Vacant" || s === "Void").length;
  if (unitStatuses.length > 0 && vacant === unitStatuses.length) return "Vacant";
  if (vacant > 0) return "Partially occupied";
  return "Fully occupied";
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

export function parseYesNo(v: any): boolean | null {
  return parseVacant(v);
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

// Canonical KIE template — tab name → entity + field → suggested header keywords.
// Exact template headers (lowercased) are listed FIRST per field: suggestColumn
// scores exact matches highest so the shipped template always auto-maps cleanly.
export const CANONICAL_TEMPLATE = {
  Property: {
    matchTab: ["properties", "property"],
    fields: {
      name: ["property name", "name", "property", "title"],
      address: ["address", "addr", "line1"],
      postcode: ["postcode", "post code", "zip"],
      property_type: ["property type", "class", "type"],
      hmo: ["hmo (yes/no)", "hmo"],
      units_count: ["beds", "bedrooms", "rooms", "units"],
      vacant: ["vacant (yes/no)", "vacant", "empty", "void"],
      council_tax_band: ["council tax band", "council tax"],
      notes: ["notes", "note", "comments"],
    },
  },
  Unit: {
    matchTab: ["units", "unit", "rooms"],
    fields: {
      property: ["property name", "property", "address"],
      unit_label: ["room/unit name", "room", "unit", "room name", "unit name"],
      vacant: ["vacant (yes/no)", "vacant", "empty"],
      tenant_name: ["tenant name", "tenant"],
      rent_amount: ["rent (gbp/month)", "rent", "monthly rent"],
      notes: ["notes", "note", "comments"],
    },
  },
  Tenant: {
    matchTab: ["tenants", "tenant"],
    fields: {
      name: ["tenant name", "name", "tenant"],
      phone: ["phone", "mobile", "tel", "contact"],
      email: ["email", "e-mail"],
      property: ["property name", "property", "address"],
      unit: ["room/unit", "room", "unit"],
      tenancy_start: ["tenancy start", "start", "contract start", "from"],
      tenancy_end: ["tenancy end", "end", "contract end", "to"],
      rent_amount: ["rent (gbp/month)", "rent", "monthly rent", "amount"],
      deposit_scheme: ["deposit scheme", "deposit"],
      notes: ["notes", "note", "comments"],
    },
  },
  Equipment: {
    matchTab: ["boilers", "equipment", "boiler"],
    fields: {
      property: ["property name", "property", "address"],
      make: ["make", "brand", "manufacturer"],
      model: ["model"],
      fuel_type: ["fuel type", "fuel"],
      install_date: ["install date", "install", "installed", "fitted"],
      last_service_date: ["last service date", "last service", "serviced", "service date"],
      warranty_expiry: ["warranty expiry", "warranty"],
      location: ["location in property", "location"],
      notes: ["notes", "note", "comments"],
    },
  },
  ComplianceRecord: {
    matchTab: ["compliance", "contracts", "documents", "certificates"],
    fields: {
      property: ["property name", "property", "address"],
      category: ["document type", "type", "category", "document"],
      issue_date: ["issue date", "issue", "issued"],
      expiry_date: ["expiry date", "expiry", "expires", "valid until"],
      provider: ["provider/engineer", "provider", "engineer", "contractor"],
      notes: ["notes", "note", "comments"],
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