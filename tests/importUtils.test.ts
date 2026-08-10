import { strict as assert } from "node:assert";
import {
  normalizeName, normalizePhone, formatUkPhone, parseIntSafe, parseYesNo,
  isExampleRow, isValidEmail, normalizeComplianceCategory, mapFuelType,
  deriveOccupancy, parseDate, CANONICAL_TEMPLATE, suggestColumn, suggestEntityForTab,
} from "../base44/shared/importUtils.ts";

// name normalization is punctuation-insensitive
assert.equal(normalizeName("Mt. Ephraim"), normalizeName("Mt Ephraim"));
assert.equal(normalizeName("Mt. Ephraim"), "mt ephraim");
assert.equal(normalizeName("  O'Brien-House  "), "obrien house");

// phones from numeric cells
assert.equal(normalizePhone("7966039970.0"), "7966039970");
assert.equal(normalizePhone(7966039970.0 as any), "7966039970");
assert.equal(normalizePhone("07700 900123"), "7700900123");
assert.equal(formatUkPhone("7966039970.0"), "07966 039970");
assert.equal(formatUkPhone("07700 900123"), "07700 900123");
assert.equal(formatUkPhone("+44 7700 900123"), "07700 900123");
assert.equal(formatUkPhone("12345"), "12345"); // not UK-shaped: passthrough trimmed

// ints from float-y cells
assert.equal(parseIntSafe("3.0"), 3);
assert.equal(parseIntSafe("13.0"), 13);
assert.equal(parseIntSafe(""), null);
assert.equal(parseIntSafe("abc"), null);

// yes/no
assert.equal(parseYesNo("Yes"), true);
assert.equal(parseYesNo("no"), false);
assert.equal(parseYesNo(""), null);

// example-row detection
assert.equal(isExampleRow({ Notes: "EXAMPLE ROW - replace", Name: "x" }), true);
assert.equal(isExampleRow({ Notes: "example row - HMO rooms only" }), true);
assert.equal(isExampleRow({ Notes: "real note" }), false);

// email
assert.equal(isValidEmail("a@b.co"), true);
assert.equal(isValidEmail("Hawo"), false);

// compliance category normalization
assert.deepEqual(normalizeComplianceCategory("Gas Safety Certificate"), { category: "Gas Safety Certificate", known: true });
assert.deepEqual(normalizeComplianceCategory("Boiler Service"), { category: "Boiler service", known: true });
assert.deepEqual(normalizeComplianceCategory("Smoke/CO Alarm Check"), { category: "Smoke/CO alarm", known: true });
assert.deepEqual(normalizeComplianceCategory("Landlord Insurance"), { category: "Insurance", known: true });
assert.deepEqual(normalizeComplianceCategory("HMO License"), { category: "HMO licence", known: true });
assert.deepEqual(normalizeComplianceCategory("Legionella Risk Assessment"), { category: "Legionella Risk Assessment", known: true });
assert.deepEqual(normalizeComplianceCategory("PAT Test"), { category: "PAT Test", known: true });
assert.deepEqual(normalizeComplianceCategory("Deposit Protection Certificate"), { category: "Deposit Protection Certificate", known: true });
assert.deepEqual(normalizeComplianceCategory("Weird Thing"), { category: "Weird Thing", known: false });

// fuel
assert.equal(mapFuelType("Gas"), "Gas");
assert.equal(mapFuelType("electric"), "Electric");
assert.equal(mapFuelType("heat pump"), "Heat pump");
assert.equal(mapFuelType(""), null);
assert.equal(mapFuelType("unknown fuel"), "Other");

// occupancy derivation
assert.equal(deriveOccupancy(["Occupied", "Occupied"]), "Fully occupied");
assert.equal(deriveOccupancy(["Vacant", "Occupied"]), "Partially occupied");
assert.equal(deriveOccupancy(["Vacant", "Void"]), "Vacant");

// date already handles "2026-10-08 00:00:00" and DD/MM/YYYY — regression-pin it
assert.equal(parseDate("2026-10-08 00:00:00"), "2026-10-08");
assert.equal(parseDate("08/10/2026"), "2026-10-08");

// canonical template v2: Units tab present, exact headers win
assert.ok(CANONICAL_TEMPLATE.Unit, "Unit tab config exists");
assert.equal(suggestEntityForTab("Units"), "Unit");
assert.equal(suggestEntityForTab("Boilers"), "Equipment");
const propHeaders = ["Property Name","Address","Postcode","Property Type","HMO (Yes/No)","Beds","Vacant (Yes/No)","Council Tax Band","Notes"];
assert.equal(suggestColumn(propHeaders, CANONICAL_TEMPLATE.Property.fields.name), "Property Name");
assert.equal(suggestColumn(propHeaders, CANONICAL_TEMPLATE.Property.fields.hmo), "HMO (Yes/No)");
assert.equal(suggestColumn(propHeaders, CANONICAL_TEMPLATE.Property.fields.vacant), "Vacant (Yes/No)");
assert.equal(suggestColumn(propHeaders, CANONICAL_TEMPLATE.Property.fields.council_tax_band), "Council Tax Band");
const unitHeaders = ["Property Name","Room/Unit Name","Vacant (Yes/No)","Tenant Name","Rent (GBP/month)","Notes"];
assert.equal(suggestColumn(unitHeaders, CANONICAL_TEMPLATE.Unit.fields.unit_label), "Room/Unit Name");
assert.equal(suggestColumn(unitHeaders, CANONICAL_TEMPLATE.Unit.fields.tenant_name), "Tenant Name");
const tenantHeaders = ["Tenant Name","Phone","Email","Property Name","Room/Unit","Tenancy Start","Tenancy End","Rent (GBP/month)","Deposit Scheme","Notes"];
assert.equal(suggestColumn(tenantHeaders, CANONICAL_TEMPLATE.Tenant.fields.unit), "Room/Unit");
assert.equal(suggestColumn(tenantHeaders, CANONICAL_TEMPLATE.Tenant.fields.deposit_scheme), "Deposit Scheme");
assert.equal(suggestColumn(tenantHeaders, CANONICAL_TEMPLATE.Tenant.fields.name), "Tenant Name");
const boilerHeaders = ["Property Name","Make","Model","Fuel Type","Install Date","Last Service Date","Warranty Expiry","Location in Property","Notes"];
assert.equal(suggestColumn(boilerHeaders, CANONICAL_TEMPLATE.Equipment.fields.fuel_type), "Fuel Type");
assert.equal(suggestColumn(boilerHeaders, CANONICAL_TEMPLATE.Equipment.fields.warranty_expiry), "Warranty Expiry");
assert.equal(suggestColumn(boilerHeaders, CANONICAL_TEMPLATE.Equipment.fields.location), "Location in Property");
const compHeaders = ["Property Name","Document Type","Issue Date","Expiry Date","Provider/Engineer","Notes"];
assert.equal(suggestColumn(compHeaders, CANONICAL_TEMPLATE.ComplianceRecord.fields.provider), "Provider/Engineer");

console.log("importUtils v2: all tests passed");
