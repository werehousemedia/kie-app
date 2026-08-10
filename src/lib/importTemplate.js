// Canonical KIE template: which sheet tab maps to which entity, and which
// column-header keywords suggest each entity field. Mirrors the backend
// CANONICAL_TEMPLATE in base44/shared/importUtils.ts — keep the two in lockstep.
// Exact template headers (lowercased) come FIRST per field so the shipped
// template always auto-maps cleanly.

export const CANONICAL_FIELDS = {
  Property: {
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
  Unit: {
    property: ["property name", "property", "address"],
    unit_label: ["room/unit name", "room", "unit", "room name", "unit name"],
    vacant: ["vacant (yes/no)", "vacant", "empty"],
    tenant_name: ["tenant name", "tenant"],
    rent_amount: ["rent (gbp/month)", "rent", "monthly rent"],
    notes: ["notes", "note", "comments"],
  },
  Tenant: {
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
  Equipment: {
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
  ComplianceRecord: {
    property: ["property name", "property", "address"],
    category: ["document type", "type", "category", "document"],
    issue_date: ["issue date", "issue", "issued"],
    expiry_date: ["expiry date", "expiry", "expires", "valid until"],
    provider: ["provider/engineer", "provider", "engineer", "contractor"],
    notes: ["notes", "note", "comments"],
  },
};

export const TAB_MATCH = {
  Property: ["properties", "property"],
  Unit: ["units", "unit", "rooms"],
  Tenant: ["tenants", "tenant"],
  Equipment: ["boilers", "equipment", "boiler"],
  ComplianceRecord: ["compliance", "contracts", "documents", "certificates"],
};

export function suggestColumn(headers, keywords) {
  const norm = (s) => s.toLowerCase().trim();
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

export function suggestEntityForTab(tabName) {
  const n = tabName.toLowerCase().trim();
  for (const [entity, matches] of Object.entries(TAB_MATCH)) {
    if (matches.some((m) => n.includes(m))) return entity;
  }
  return "";
}

export function buildAutoMapping(tabs) {
  const tabMappings = [];
  for (const tab of tabs) {
    const entity = suggestEntityForTab(tab.name);
    if (!entity) {
      tabMappings.push({ tabName: tab.name, entity: "", columnMap: {} });
      continue;
    }
    const columnMap = {};
    for (const [field, keywords] of Object.entries(CANONICAL_FIELDS[entity])) {
      const col = suggestColumn(tab.headers, keywords);
      if (col) columnMap[field] = col;
    }
    tabMappings.push({ tabName: tab.name, entity, columnMap });
  }
  return tabMappings;
}
