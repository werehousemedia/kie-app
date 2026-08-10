// Canonical KIE template: which sheet tab maps to which entity, and which
// column-header keywords suggest each entity field. Mirrors the backend
// CANONICAL_TEMPLATE in base44/shared/importUtils.ts.

export const CANONICAL_FIELDS = {
  Property: {
    name: ["name", "property", "title"],
    address: ["address", "addr", "line1"],
    postcode: ["postcode", "post code", "zip"],
    vacant: ["vacant", "empty", "void"],
    property_type: ["class", "type", "property type"],
    units_count: ["beds", "bedrooms", "rooms", "units"],
  },
  Tenant: {
    name: ["name", "tenant", "tenant name"],
    phone: ["phone", "mobile", "tel", "contact"],
    email: ["email", "e-mail"],
    property: ["property", "property name", "address"],
    tenancy_start: ["start", "contract start", "tenancy start", "from"],
    tenancy_end: ["end", "contract end", "tenancy end", "to", "expiry"],
    rent_amount: ["rent", "monthly rent", "amount"],
  },
  Equipment: {
    property: ["property", "property name", "address"],
    make: ["make", "brand", "manufacturer"],
    model: ["model"],
    install_date: ["install", "installed", "fitted"],
    last_service_date: ["last service", "serviced", "service date"],
  },
  ComplianceRecord: {
    property: ["property", "property name", "address"],
    category: ["document type", "type", "category", "document"],
    issue_date: ["issue", "issued", "start"],
    expiry_date: ["expiry", "expires", "end", "valid until"],
  },
};

export const TAB_MATCH = {
  Property: ["properties", "property"],
  Tenant: ["tenants", "tenant"],
  Equipment: ["boilers", "equipment", "boiler"],
  ComplianceRecord: ["contracts", "compliance", "documents", "certificates"],
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