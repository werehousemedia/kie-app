import { strict as assert } from "node:assert";
import { runImport } from "../base44/shared/importCore.ts";
import { CANONICAL_TEMPLATE, suggestColumn, suggestEntityForTab } from "../base44/shared/importUtils.ts";

// ---------- mock db ----------
function matches(record: any, query: any): boolean {
  for (const [k, v] of Object.entries(query)) {
    if (v && typeof v === "object" && "$ne" in (v as any)) {
      if (record[k] === (v as any).$ne) return false;
    } else if (record[k] !== v) return false;
  }
  return true;
}

function makeDb(seed: Record<string, any[]>) {
  const store: Record<string, any[]> = {};
  const calls: { creates: any[]; updates: any[] } = { creates: [], updates: [] };
  let nextId = 1;
  const entity = (name: string) => {
    store[name] = (seed[name] || []).map((r) => ({ ...r }));
    return {
      filter: async (q: any) => store[name].filter((r) => matches(r, q)),
      list: async () => [...store[name]],
      create: async (data: any) => {
        const rec = { id: `${name.toLowerCase()}_${nextId++}`, ...data };
        store[name].push(rec);
        calls.creates.push({ entity: name, data: rec });
        return rec;
      },
      update: async (id: string, data: any) => {
        const rec = store[name].find((r) => r.id === id);
        if (!rec) throw new Error(`update: no ${name} ${id}`);
        Object.assign(rec, data);
        calls.updates.push({ entity: name, id, data });
        return rec;
      },
    };
  };
  const db: any = {};
  for (const name of ["Property", "Unit", "Tenant", "Equipment", "ComplianceRecord", "Tenancy", "ActivityEvent", "IntegrationLog"]) {
    db[name] = entity(name);
  }
  return { db, store, calls };
}

// ---------- fixtures: Ed's REAL sheet ----------
const tabs = [
  {
    name: "Properties",
    headers: ["Property Name", "Address", "Postcode", "Property Type", "HMO (Yes/No)", "Beds", "Vacant (Yes/No)", "Council Tax Band", "Notes"],
    rows: [
      { _rowNumber: 3, "Property Name": "Belt", "Address": "2 Clanricade Gardens, Tunbridge Wells", "Postcode": "", "Property Type": "HMO", "HMO (Yes/No)": "Yes", "Beds": "3.0", "Vacant (Yes/No)": "No", "Council Tax Band": "", "Notes": "" },
      { _rowNumber: 4, "Property Name": "Mt Ephraim", "Address": "Flat 6, Mount Ephraim, Tunbridge Wells", "Postcode": "", "Property Type": "Single let flat", "HMO (Yes/No)": "No", "Beds": "1.0", "Vacant (Yes/No)": "No", "Council Tax Band": "C", "Notes": "" },
      { _rowNumber: 5, "Property Name": "51 LHR", "Address": "51 Lime Hill Road, Tunbridge Wells", "Postcode": "", "Property Type": "HMO", "HMO (Yes/No)": "Yes", "Beds": "13.0", "Vacant (Yes/No)": "Yes", "Council Tax Band": "", "Notes": "" },
    ],
  },
  {
    name: "Units",
    headers: ["Property Name", "Room/Unit Name", "Vacant (Yes/No)", "Tenant Name", "Rent (GBP/month)", "Notes"],
    rows: [
      { _rowNumber: 2, "Property Name": "7 Willow Court", "Room/Unit Name": "Room 3", "Vacant (Yes/No)": "No", "Tenant Name": "James Whitfield", "Rent (GBP/month)": "520.0", "Notes": "EXAMPLE ROW - HMO rooms only" },
      { _rowNumber: 3, "Property Name": "Belt", "Room/Unit Name": "Room 2", "Vacant (Yes/No)": "No", "Tenant Name": "Edward McHaywood", "Rent (GBP/month)": "950.0", "Notes": "" },
      { _rowNumber: 4, "Property Name": "Belt", "Room/Unit Name": "Room 6", "Vacant (Yes/No)": "No", "Tenant Name": "Eliza Pemberton", "Rent (GBP/month)": "1150.0", "Notes": "Cleaner Incl. every 2 Week" },
    ],
  },
  {
    name: "Tenants",
    headers: ["Tenant Name", "Phone", "Email", "Property Name", "Room/Unit", "Tenancy Start", "Tenancy End", "Rent (GBP/month)", "Deposit Scheme", "Notes"],
    rows: [
      { _rowNumber: 2, "Tenant Name": "James Whitfield", "Phone": "07700 900123", "Email": "j.whitfield@example.com", "Property Name": "7 Willow Court", "Room/Unit": "Room 3", "Tenancy Start": "2025-03-01 00:00:00", "Tenancy End": "2026-02-28 00:00:00", "Rent (GBP/month)": "520.0", "Deposit Scheme": "DPS", "Notes": "EXAMPLE ROW - replace" },
      { _rowNumber: 3, "Tenant Name": "Eliza Pemberton", "Phone": "7966039970.0", "Email": "kie.nundinae@aol.com", "Property Name": "Belt", "Room/Unit": "Room 6", "Tenancy Start": "2026-10-08 00:00:00", "Tenancy End": "2027-08-10 00:00:00", "Rent (GBP/month)": "1150.0", "Deposit Scheme": "", "Notes": "" },
      { _rowNumber: 4, "Tenant Name": "Edward McHayward", "Phone": "7902058891.0", "Email": "eh@gmail.com", "Property Name": "Belt", "Room/Unit": "Room 2", "Tenancy Start": "2026-03-06 00:00:00", "Tenancy End": "2027-11-07 00:00:00", "Rent (GBP/month)": "950.0", "Deposit Scheme": "", "Notes": "" },
      { _rowNumber: 5, "Tenant Name": "Zhong Lee", "Phone": "7945998402.0", "Email": "Hawo", "Property Name": "Mt Ephraim", "Room/Unit": "Room 1", "Tenancy Start": "2026-03-07 00:00:00", "Tenancy End": "2027-11-08 00:00:00", "Rent (GBP/month)": "750.0", "Deposit Scheme": "", "Notes": "" },
    ],
  },
  {
    name: "Boilers",
    headers: ["Property Name", "Make", "Model", "Fuel Type", "Install Date", "Last Service Date", "Warranty Expiry", "Location in Property", "Notes"],
    rows: [
      { _rowNumber: 2, "Property Name": "7 Willow Court", "Make": "Worcester Bosch", "Model": "Greenstar 30i", "Fuel Type": "Gas", "Install Date": "2021-06-14 00:00:00", "Last Service Date": "2025-06-10 00:00:00", "Warranty Expiry": "2031-06-14 00:00:00", "Location in Property": "Kitchen cupboard", "Notes": "EXAMPLE ROW - replace" },
      { _rowNumber: 4, "Property Name": "Mt Ephraim", "Make": "Worcester Bosch", "Model": "Greenstar 30i", "Fuel Type": "Gas", "Install Date": "2026-06-14 00:00:00", "Last Service Date": "2025-06-10 00:00:00", "Warranty Expiry": "2031-06-14 00:00:00", "Location in Property": "Kitchen cupboard", "Notes": "" },
    ],
  },
  {
    name: "Compliance",
    headers: ["Property Name", "Document Type", "Issue Date", "Expiry Date", "Provider/Engineer", "Notes"],
    rows: [
      { _rowNumber: 2, "Property Name": "7 Willow Court", "Document Type": "Gas Safety Certificate", "Issue Date": "2025-09-02 00:00:00", "Expiry Date": "2026-09-01 00:00:00", "Provider/Engineer": "SafeGas Ltd (Gas Safe 512345)", "Notes": "EXAMPLE ROW - replace" },
      { _rowNumber: 5, "Property Name": "Mt Ephraim", "Document Type": "Gas Safety Certificate", "Issue Date": "2026-10-06 00:00:00", "Expiry Date": "2026-09-06 00:00:00", "Provider/Engineer": "Oliver Steen", "Notes": "" },
    ],
  },
];

// auto-mapping exactly as the frontend builds it
const tabMappings = tabs.map((tab) => {
  const entity = suggestEntityForTab(tab.name);
  const columnMap: Record<string, string> = {};
  if (entity) {
    for (const [field, keywords] of Object.entries((CANONICAL_TEMPLATE as any)[entity].fields)) {
      const col = suggestColumn(tab.headers, keywords as string[]);
      if (col) columnMap[field] = col;
    }
  }
  return { tabName: tab.name, entity, columnMap };
});

const existingSeed = {
  Property: [
    { id: "p1", name: "Belt", address: "3 Lonsdale Gardens, Tunbridge Wells", postcode: "TN1 1NU", hmo_status: "Licensed HMO", property_type: "HMO", units_count: 11, occupancy_status: "Fully occupied", is_demo: false },
    { id: "p2", name: "Mt. Ephraim", address: "Flat 6a, 65 Mount Ephraim", postcode: "TN4 8BG", hmo_status: "Not HMO", property_type: "Flat", units_count: 1, occupancy_status: "Fully occupied", is_demo: false },
    { id: "p3", name: "UnderBelt", address: "1 Anywhere St", postcode: "TN1 1AA", hmo_status: "Not HMO", property_type: "House", units_count: 1, occupancy_status: "Vacant", is_demo: false },
    { id: "pdemo", name: "7 Willow Court", address: "7 Willow Court", postcode: "KT12 3AB", hmo_status: "Licensed HMO", property_type: "HMO", units_count: 4, occupancy_status: "Fully occupied", is_demo: true },
  ],
  Tenant: [],
  Unit: [],
};

async function run(preview: boolean) {
  const { db, store, calls } = makeDb(JSON.parse(JSON.stringify(existingSeed)));
  const results = await runImport(db, tabs, { tabMappings }, { preview });
  return { results, store, calls };
}

const { results: r, store, calls } = await run(false);

// 1. Belt (no postcode): not skipped, warned, matched to p1 by name, address updated, licensed HMO preserved
assert.equal(r.skipped.filter((s: any) => s.reason.includes("postcode")).length, 0, "no postcode-based skips");
assert.ok(r.warnings.some((w: any) => w.message.includes("No postcode")), "postcode warning present");
const belt = store.Property.find((p: any) => p.id === "p1");
assert.equal(belt.address, "2 Clanricade Gardens, Tunbridge Wells", "Belt address updated in place");
assert.equal(belt.hmo_status, "Licensed HMO", "licensed status preserved on Yes");
assert.equal(belt.units_count, 3, "Belt beds parsed from 3.0");

// 2. Mt Ephraim matches punctuated existing record
const mtE = store.Property.find((p: any) => p.id === "p2");
assert.equal(mtE.address, "Flat 6, Mount Ephraim, Tunbridge Wells", "Mt Ephraim updated, not duplicated");
assert.equal(mtE.council_tax_band, "C");
assert.equal(r.created.Property, 1, "only 51 LHR created");
assert.equal(r.updated.Property, 2, "Belt + Mt Ephraim updated");

// 3. 51 LHR created with 13 vacant rooms, occupancy Vacant
const lhr = store.Property.find((p: any) => p.name === "51 LHR");
assert.ok(lhr, "51 LHR created");
const lhrUnits = store.Unit.filter((u: any) => u.property_id === lhr.id);
assert.equal(lhrUnits.length, 13, "13 placeholder rooms");
assert.ok(lhrUnits.every((u: any) => u.occupancy_status === "Vacant"));
assert.equal(lhr.occupancy_status, "Vacant");

// 4. Belt: 2 explicit rooms + 1 top-up; partially occupied
const beltUnits = store.Unit.filter((u: any) => u.property_id === "p1");
assert.equal(beltUnits.length, 3, "2 explicit + 1 top-up");
assert.ok(r.warnings.some((w: any) => w.message.includes("not listed in Units tab")), "top-up warning");
assert.equal(belt.occupancy_status, "Partially occupied");

// 5. Example rows auto-skipped, and never cause unmatched-property noise
const exampleSkips = r.skipped.filter((s: any) => s.reason === "Example row (auto-skipped)");
assert.equal(exampleSkips.length, 4, "one example row per Units/Tenants/Boilers/Compliance");
assert.ok(!r.skipped.some((s: any) => String(s.reason).includes("7 Willow Court")), "no unmatched-property skips for example rows");

// 6. Tenant-unit link + name mismatch warning
const edward = store.Tenant.find((t: any) => t.name === "Edward McHayward");
const beltRoom2 = beltUnits.find((u: any) => u.unit_label === "Room 2");
assert.ok(edward && beltRoom2);
assert.equal(edward.unit_id, beltRoom2.id, "tenant linked to unit");
assert.equal(beltRoom2.tenant_id, edward.id, "unit linked to tenant");
assert.ok(r.warnings.some((w: any) => w.message.includes("McHaywood") && w.message.includes("McHayward")), "name mismatch warning");

// 7. Phone formatting + invalid email warning
const zhong = store.Tenant.find((t: any) => t.name === "Zhong Lee");
assert.equal(zhong.phone, "07945 998402");
assert.ok(r.warnings.some((w: any) => w.message.toLowerCase().includes("email")), "invalid email warned");
const eliza = store.Tenant.find((t: any) => t.name === "Eliza Pemberton");
assert.equal(eliza.phone, "07966 039970");

// 8. Compliance: expiry before issue warned but imported; provider captured
const gasCert = store.ComplianceRecord.find((c: any) => c.property_id === "p2");
assert.ok(gasCert, "compliance imported");
assert.equal(gasCert.provider, "Oliver Steen");
assert.ok(r.warnings.some((w: any) => w.message.includes("before issue date")), "expiry<issue warning");

// 9. Orphans: exactly UnderBelt (demo property NOT an orphan)
assert.equal(r.orphans.length, 1);
assert.equal(r.orphans[0].name, "UnderBelt");

// 10. Equipment extras
const boiler = store.Equipment.find((e: any) => e.property_id === "p2");
assert.equal(boiler.fuel_type, "Gas");
assert.equal(boiler.warranty_expiry, "2031-06-14");
assert.equal(boiler.location, "Kitchen cupboard");

// 11. payment_status only defaulted on create, preserved on update
const rerun = makeDb(JSON.parse(JSON.stringify(existingSeed)));
await runImport(rerun.db, tabs, { tabMappings }, { preview: false });
// simulate user marking Eliza paid in-app, then re-sync
rerun.store.Tenant.find((t: any) => t.name === "Eliza Pemberton").payment_status = "Paid";
const r2 = await runImport(rerun.db, tabs, { tabMappings }, { preview: false });
const store2 = rerun.store;
const elizaAfter = store2.Tenant.find((t: any) => t.name === "Eliza Pemberton");
assert.equal(elizaAfter.payment_status, "Paid", "re-import must not clobber payment_status");
assert.equal(r2.created.Tenant, 0, "re-import creates no tenants (idempotent)");
assert.equal(store2.Unit.filter((u: any) => u.property_id === "p1").length, 3, "re-import creates no extra units");

// 12. Tenancy maintenance: one Active tenancy per imported tenant, linked and seeded
const tenancies = store.Tenancy;
assert.equal(tenancies.length, 3, "one tenancy per imported tenant");
const elizaT = tenancies.find((ty: any) => ty.tenant_id === eliza.id);
assert.ok(elizaT, "Eliza has a tenancy");
assert.equal(elizaT.property_id, "p1");
assert.equal(elizaT.unit_id, beltUnits.find((u: any) => u.unit_label === "Room 6").id);
assert.equal(elizaT.rent_amount, 1150);
assert.equal(elizaT.rent_history.length, 1);
assert.equal(elizaT.deposit_scheme ?? "", "");
const edwardT = tenancies.find((ty: any) => ty.tenant_id === edward.id);
assert.equal(edwardT.rent_amount, 950);

// 12b. Rent change appends rent_history; unchanged rent appends nothing
const rentChangeTabs = JSON.parse(JSON.stringify(tabs));
const elizaRow = rentChangeTabs.find((t: any) => t.name === "Tenants").rows.find((r: any) => r["Tenant Name"] === "Eliza Pemberton");
elizaRow["Rent (GBP/month)"] = "1200.0";
await runImport(rerun.db, rentChangeTabs, { tabMappings }, { preview: false });
const elizaT2 = rerun.store.Tenancy.find((ty: any) => ty.tenant_id === rerun.store.Tenant.find((t: any) => t.name === "Eliza Pemberton").id);
assert.equal(elizaT2.rent_amount, 1200, "tenancy rent updated");
assert.equal(elizaT2.rent_history.length, 2, "rent change appended to history");
const edwardT2 = rerun.store.Tenancy.find((ty: any) => ty.tenant_id === rerun.store.Tenant.find((t: any) => t.name === "Edward McHayward").id);
assert.equal(edwardT2.rent_history.length, 1, "unchanged rent appends nothing after re-imports");
assert.equal(rerun.store.Tenancy.length, 3, "re-imports never duplicate tenancies");

// 13. Preview mode: identical counts, ZERO writes
const { results: pv, calls: pvCalls } = await run(true);
assert.equal(pvCalls.creates.length, 0, "preview: no creates");
assert.equal(pvCalls.updates.length, 0, "preview: no updates");
assert.equal(pv.created.Property, r.created.Property);
assert.equal(pv.created.Unit, r.created.Unit);
assert.equal(pv.created.Tenant, r.created.Tenant);
assert.equal(pv.orphans.length, 1);
assert.ok(pv.warnings.length >= 5, "preview surfaces the same warnings");

console.log("importCore v2: all tests passed");
