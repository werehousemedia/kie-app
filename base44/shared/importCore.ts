// Shared import engine — used by run_import (wizard) and sync_from_sheet (auto-sync).
// Pure orchestration over a Base44 entities object (`base44.asServiceRole.entities`),
// injectable for tests. Sheet-owned fields are upserted; user-managed fields
// (payment_status, consent_status, photo_url, purchase_value, monthly_rent_expected)
// are only defaulted on create, never clobbered on update.

import {
  normalizeAddress, normalizePhone, normalizeName, parseDate, parseCurrency,
  parseVacant, parseYesNo, parseIntSafe, computeComplianceStatus, addYear,
  mapPropertyType, mapHmoStatus, mapFuelType, formatUkPhone, isExampleRow,
  isValidEmail, normalizeComplianceCategory, deriveOccupancy,
} from "./importUtils.ts";

type Row = Record<string, any>;
type Tab = { name: string; headers: string[]; rows: Row[] };
type TabMapping = { tabName: string; entity: string; columnMap: Record<string, string> };
type Mapping = { tabMappings: TabMapping[] };

export interface ImportResults {
  created: Record<string, number>;
  updated: Record<string, number>;
  skipped: { tab: string; row: number; reason: string }[];
  warnings: { tab: string; row: number | null; message: string }[];
  orphans: { id: string; name: string; address: string }[];
  perProperty: { name: string; occupancyRule: string; occupancyStatus: string; units: number }[];
  preview: boolean;
}

export async function runImport(db: any, tabs: Tab[], mapping: Mapping, opts: { preview: boolean }): Promise<ImportResults> {
  const preview = !!opts.preview;
  const results: ImportResults = {
    created: { Property: 0, Unit: 0, Tenant: 0, Equipment: 0, ComplianceRecord: 0 },
    updated: { Property: 0, Unit: 0, Tenant: 0, Equipment: 0, ComplianceRecord: 0 },
    skipped: [],
    warnings: [],
    orphans: [],
    perProperty: [],
    preview,
  };
  const warn = (tab: string, row: number | null, message: string) =>
    results.warnings.push({ tab, row, message });

  // ---- load existing non-demo state ----
  const [existingProps, existingTenants, existingUnits] = await Promise.all([
    db.Property.filter({ is_demo: { $ne: true } }),
    db.Tenant.filter({ is_demo: { $ne: true } }),
    db.Unit.filter({ is_demo: { $ne: true } }),
  ]);

  // In-memory registries (kept current through the run; preview uses placeholders)
  let previewSeq = 0;
  const props = new Map<string, any>(); // id -> record
  const propertyByName = new Map<string, any>();
  const propertyByAddr = new Map<string, any>();
  for (const p of existingProps) {
    props.set(p.id, { ...p });
    if (p.name) propertyByName.set(normalizeName(p.name), props.get(p.id));
    const k = normalizeAddress(p.address, p.postcode);
    if (k) propertyByAddr.set(k, props.get(p.id));
  }
  const units = new Map<string, any>();
  const unitByPropLabel = new Map<string, any>(); // `${property_id}|${normalized label}` -> unit
  for (const u of existingUnits) {
    units.set(u.id, { ...u });
    unitByPropLabel.set(`${u.property_id}|${normalizeName(u.unit_label)}`, units.get(u.id));
  }
  const tenants = new Map<string, any>();
  const tenantByKey = new Map<string, any>();
  for (const t of existingTenants) {
    tenants.set(t.id, { ...t });
    tenantByKey.set(`${normalizeName(t.name)}|${normalizePhone(t.phone)}`, tenants.get(t.id));
  }

  const matchedPropIds = new Set<string>(); // sheet-matched existing properties (for orphans)
  const touchedPropIds = new Set<string>(); // properties processed this run (for occupancy)
  const propVacantFlag = new Map<string, boolean | null>(); // sheet-level vacant flag per property

  const tabMap = new Map<string, { tab: Tab; columnMap: Record<string, string> }>();
  for (const tm of mapping.tabMappings || []) {
    if (!tm.entity || !tm.columnMap) continue;
    const tab = tabs.find((t) => t.name === tm.tabName);
    if (tab) tabMap.set(tm.entity, { tab, columnMap: tm.columnMap });
  }

  const findProperty = (ref: string): any | null => {
    if (!ref) return null;
    const n = normalizeName(ref);
    if (propertyByName.has(n)) return propertyByName.get(n);
    for (const p of propertyByName.values()) {
      if (p.name && normalizeName(p.name).includes(n)) return p;
      if (n.includes(normalizeName(p.name)) && normalizeName(p.name).length > 2) return p;
    }
    return null;
  };

  const registerProp = (rec: any) => {
    props.set(rec.id, rec);
    if (rec.name) propertyByName.set(normalizeName(rec.name), rec);
    const k = normalizeAddress(rec.address, rec.postcode);
    if (k) propertyByAddr.set(k, rec);
  };
  const registerUnit = (rec: any) => {
    units.set(rec.id, rec);
    unitByPropLabel.set(`${rec.property_id}|${normalizeName(rec.unit_label)}`, rec);
  };

  const createUnit = async (data: any): Promise<any> => {
    let rec;
    if (preview) {
      rec = { id: `preview_unit_${++previewSeq}`, ...data };
    } else {
      rec = await db.Unit.create(data);
    }
    registerUnit(rec);
    results.created.Unit++;
    return rec;
  };

  // Rows to process for a tab: example rows are logged once and filtered out.
  const liveRows = (tab: Tab): Row[] =>
    tab.rows.filter((row) => {
      if (isExampleRow(row)) {
        if (!results.skipped.some((s) => s.tab === tab.name && s.row === row._rowNumber)) {
          results.skipped.push({ tab: tab.name, row: row._rowNumber, reason: "Example row (auto-skipped)" });
        }
        return false;
      }
      return true;
    });

  // ---------- Phase 1: Properties ----------
  const propMapped = tabMap.get("Property");
  if (propMapped) {
    const { tab, columnMap: cm } = propMapped;
    for (const row of liveRows(tab)) {
      const name = cm.name ? String(row[cm.name] || "").trim() : "";
      const address = cm.address ? String(row[cm.address] || "").trim() : "";
      const postcode = cm.postcode ? String(row[cm.postcode] || "").trim() : "";
      if (!name) {
        results.skipped.push({ tab: tab.name, row: row._rowNumber, reason: "Missing property name" });
        continue;
      }
      if (!address) {
        results.skipped.push({ tab: tab.name, row: row._rowNumber, reason: "Missing address" });
        continue;
      }
      if (!postcode) warn(tab.name, row._rowNumber, `No postcode for "${name}" — matched by name instead`);

      // Match: name first, then address+postcode
      let existing = propertyByName.get(normalizeName(name)) || null;
      if (!existing && postcode) existing = propertyByAddr.get(normalizeAddress(address, postcode)) || null;

      const classType = cm.property_type ? String(row[cm.property_type] || "") : "";
      const beds = (cm.units_count ? parseIntSafe(row[cm.units_count]) : null) ?? 1;
      const hmoFlag = cm.hmo ? parseYesNo(row[cm.hmo]) : null;
      const vacantBool = cm.vacant ? parseVacant(row[cm.vacant]) : null;
      const councilTax = cm.council_tax_band ? String(row[cm.council_tax_band] || "").trim() : "";
      const notes = cm.notes ? String(row[cm.notes] || "").trim() : "";

      // HMO status: "Yes" keeps an existing licensed/unlicensed value, else unlicensed.
      let hmo_status: string;
      const existingHmo = existing?.hmo_status;
      if (hmoFlag === true) {
        hmo_status = existingHmo === "Licensed HMO" || existingHmo === "HMO (unlicensed)" ? existingHmo : "HMO (unlicensed)";
      } else if (hmoFlag === false) {
        hmo_status = "Not HMO";
      } else {
        const derived = mapHmoStatus(classType);
        hmo_status = derived !== "Not HMO" && (existingHmo === "Licensed HMO") ? existingHmo : derived;
      }

      const record: any = {
        name,
        address,
        property_type: mapPropertyType(classType),
        hmo_status,
        units_count: beds,
        source: "sheet_import",
        is_demo: false,
      };
      if (postcode) record.postcode = postcode;
      if (councilTax) record.council_tax_band = councilTax;
      if (notes) record.notes = notes;

      let propId: string;
      if (existing) {
        matchedPropIds.add(existing.id);
        if (!preview) await db.Property.update(existing.id, record);
        Object.assign(existing, record);
        results.updated.Property++;
        propId = existing.id;
      } else {
        let created;
        if (preview) {
          created = { id: `preview_prop_${++previewSeq}`, ...record };
        } else {
          created = await db.Property.create(record);
        }
        registerProp(created);
        results.created.Property++;
        propId = created.id;
      }
      touchedPropIds.add(propId);
      propVacantFlag.set(propId, vacantBool);
    }
  }

  // ---------- Phase 2: Units (explicit rows) ----------
  const unitTenantNames = new Map<string, string>(); // `${propId}|${label}` -> declared tenant name
  const unitMapped = tabMap.get("Unit");
  if (unitMapped) {
    const { tab, columnMap: cm } = unitMapped;
    for (const row of liveRows(tab)) {
      const propRef = cm.property ? String(row[cm.property] || "").trim() : "";
      const label = cm.unit_label ? String(row[cm.unit_label] || "").trim() : "";
      const property = findProperty(propRef);
      if (!property) {
        results.skipped.push({ tab: tab.name, row: row._rowNumber, reason: `Could not match property "${propRef}"` });
        continue;
      }
      if (!label) {
        results.skipped.push({ tab: tab.name, row: row._rowNumber, reason: "Missing room/unit name" });
        continue;
      }
      const vacant = cm.vacant ? parseVacant(row[cm.vacant]) : null;
      const rent = cm.rent_amount ? parseCurrency(row[cm.rent_amount]) : 0;
      const declaredTenant = cm.tenant_name ? String(row[cm.tenant_name] || "").trim() : "";
      if (declaredTenant) unitTenantNames.set(`${property.id}|${normalizeName(label)}`, declaredTenant);

      const key = `${property.id}|${normalizeName(label)}`;
      const existing = unitByPropLabel.get(key);
      const record: any = {
        property_id: property.id,
        unit_label: label,
        occupancy_status: vacant === true ? "Vacant" : "Occupied",
        source: "sheet_import",
        is_demo: false,
      };
      if (rent > 0) record.rent_amount = rent;

      if (existing) {
        if (!preview) await db.Unit.update(existing.id, record);
        Object.assign(existing, record);
        results.updated.Unit++;
      } else {
        await createUnit(record);
      }
    }
  }

  // Top-up placeholder rooms so HMO unit counts match Beds.
  for (const propId of touchedPropIds) {
    const prop = props.get(propId);
    if (!prop || prop.hmo_status === "Not HMO") continue;
    const beds = prop.units_count || 1;
    const propUnits = [...units.values()].filter((u) => u.property_id === propId);
    if (propUnits.length >= beds) continue;
    const takenLabels = new Set(propUnits.map((u) => normalizeName(u.unit_label)));
    const vacantFlag = propVacantFlag.get(propId);
    let created = 0;
    let n = 1;
    while (propUnits.length + created < beds && n <= beds + 50) {
      const label = `Room ${n++}`;
      if (takenLabels.has(normalizeName(label))) continue;
      await createUnit({
        property_id: propId,
        unit_label: label,
        occupancy_status: "Vacant",
        source: "sheet_import",
        is_demo: false,
      });
      created++;
    }
    if (created > 0 && vacantFlag !== true) {
      warn("Units", null, `${prop.name}: ${created} room(s) not listed in Units tab — created as vacant`);
    }
  }

  // ---------- Phase 3: Tenants ----------
  const tenantMapped = tabMap.get("Tenant");
  if (tenantMapped) {
    const { tab, columnMap: cm } = tenantMapped;
    for (const row of liveRows(tab)) {
      const name = cm.name ? String(row[cm.name] || "").trim() : "";
      const phoneRaw = cm.phone ? row[cm.phone] : "";
      if (!name || !phoneRaw) {
        results.skipped.push({ tab: tab.name, row: row._rowNumber, reason: "Missing name or phone" });
        continue;
      }
      const propRef = cm.property ? String(row[cm.property] || "").trim() : "";
      const property = findProperty(propRef);
      if (!property) {
        results.skipped.push({ tab: tab.name, row: row._rowNumber, reason: `Could not match property "${propRef}"` });
        continue;
      }

      const email = cm.email ? String(row[cm.email] || "").trim() : "";
      if (email && !isValidEmail(email)) {
        warn(tab.name, row._rowNumber, `"${name}": email "${email}" doesn't look valid`);
      }

      // Unit link via Room/Unit column
      let unit: any = null;
      const unitLabel = cm.unit ? String(row[cm.unit] || "").trim() : "";
      if (unitLabel) {
        unit = unitByPropLabel.get(`${property.id}|${normalizeName(unitLabel)}`) || null;
        const declared = unitTenantNames.get(`${property.id}|${normalizeName(unitLabel)}`);
        if (declared && normalizeName(declared) !== normalizeName(name)) {
          warn(tab.name, row._rowNumber, `Units tab says "${declared}" for ${property.name} ${unitLabel}, Tenants tab says "${name}" — linked to "${name}"`);
        }
      }

      const key = `${normalizeName(name)}|${normalizePhone(phoneRaw)}`;
      const existing = tenantByKey.get(key);
      const record: any = {
        name,
        phone: formatUkPhone(phoneRaw),
        email,
        property_id: property.id,
        tenancy_start: cm.tenancy_start ? parseDate(row[cm.tenancy_start]) : null,
        tenancy_end: cm.tenancy_end ? parseDate(row[cm.tenancy_end]) : null,
        rent_amount: cm.rent_amount ? parseCurrency(row[cm.rent_amount]) : 0,
        source: "sheet_import",
        is_demo: false,
      };
      const deposit = cm.deposit_scheme ? String(row[cm.deposit_scheme] || "").trim() : "";
      if (deposit) record.deposit_scheme = deposit;
      if (unit) record.unit_id = unit.id;

      let tenantRec: any;
      if (existing) {
        if (!preview) await db.Tenant.update(existing.id, record);
        Object.assign(existing, record);
        results.updated.Tenant++;
        tenantRec = existing;
      } else {
        const createData = { ...record, payment_status: "Due", consent_status: "Pending" };
        if (preview) {
          tenantRec = { id: `preview_tenant_${++previewSeq}`, ...createData };
        } else {
          tenantRec = await db.Tenant.create(createData);
        }
        tenants.set(tenantRec.id, tenantRec);
        tenantByKey.set(key, tenantRec);
        results.created.Tenant++;
      }

      // Reflect the link on the unit
      if (unit && unit.tenant_id !== tenantRec.id) {
        const unitPatch = { tenant_id: tenantRec.id, occupancy_status: "Occupied" };
        if (!preview && !String(unit.id).startsWith("preview_")) await db.Unit.update(unit.id, unitPatch);
        Object.assign(unit, unitPatch);
      }

      // Maintain the Tenancy record (the temporal edge of the graph).
      // Skipped in preview: tenancies aren't part of the wizard's counts.
      if (!preview && !String(tenantRec.id).startsWith("preview_") && !String(property.id).startsWith("preview_")) {
        const today = new Date().toISOString().slice(0, 10);
        const openTenancies = (await db.Tenancy.filter({ tenant_id: tenantRec.id, is_demo: { $ne: true } }))
          .filter((ty: any) => ty.status !== "Ended");
        const rent = record.rent_amount || 0;
        if (openTenancies.length === 0) {
          const start = record.tenancy_start || today;
          await db.Tenancy.create({
            tenant_id: tenantRec.id,
            property_id: property.id,
            unit_id: unit && !String(unit.id).startsWith("preview_") ? unit.id : "",
            start_date: record.tenancy_start,
            end_date: record.tenancy_end,
            rent_amount: rent,
            deposit_scheme: record.deposit_scheme || "",
            status: start > today ? "Upcoming" : "Active",
            rent_history: [{ date: start, amount: rent }],
            source: "sheet_import",
            is_demo: false,
          });
        } else {
          const ty = openTenancies[0];
          const patch: any = {
            property_id: property.id,
            start_date: record.tenancy_start,
            end_date: record.tenancy_end,
            rent_amount: rent,
          };
          if (unit && !String(unit.id).startsWith("preview_")) patch.unit_id = unit.id;
          if (record.deposit_scheme) patch.deposit_scheme = record.deposit_scheme;
          if ((ty.rent_amount || 0) !== rent) {
            patch.rent_history = [...(ty.rent_history || []), { date: today, amount: rent }];
          }
          await db.Tenancy.update(ty.id, patch);
        }
      }
    }
  }

  // ---------- Phase 4: Occupancy recompute ----------
  for (const propId of touchedPropIds) {
    const prop = props.get(propId);
    if (!prop) continue;
    const propUnits = [...units.values()].filter((u) => u.property_id === propId);
    let occupancyRule: string;
    let occupancyStatus: string;
    if (propUnits.length > 0) {
      occupancyRule = "unit_level_derived";
      occupancyStatus = deriveOccupancy(propUnits.map((u) => u.occupancy_status));
    } else {
      const hasTenant = [...tenants.values()].some((t) => t.property_id === propId);
      if (hasTenant) {
        occupancyRule = "single_let_tenant";
        occupancyStatus = "Fully occupied";
      } else {
        occupancyRule = "sheet_vacant_flag";
        occupancyStatus = propVacantFlag.get(propId) === true ? "Vacant" : "Fully occupied";
      }
    }
    if (prop.occupancy_status !== occupancyStatus) {
      if (!preview && !String(propId).startsWith("preview_")) {
        await db.Property.update(propId, { occupancy_status: occupancyStatus });
      }
      prop.occupancy_status = occupancyStatus;
    }
    results.perProperty.push({ name: prop.name, occupancyRule, occupancyStatus, units: propUnits.length || prop.units_count || 1 });
  }

  // ---------- Phase 5: Equipment ----------
  const equipMapped = tabMap.get("Equipment");
  if (equipMapped) {
    const { tab, columnMap: cm } = equipMapped;
    for (const row of liveRows(tab)) {
      const propRef = cm.property ? String(row[cm.property] || "").trim() : "";
      if (!propRef) {
        results.skipped.push({ tab: tab.name, row: row._rowNumber, reason: "Missing property reference" });
        continue;
      }
      const property = findProperty(propRef);
      if (!property) {
        results.skipped.push({ tab: tab.name, row: row._rowNumber, reason: `Could not match property "${propRef}"` });
        continue;
      }
      const make = cm.make ? String(row[cm.make] || "").trim() : "";
      const model = cm.model ? String(row[cm.model] || "").trim() : "";
      const install_date = cm.install_date ? parseDate(row[cm.install_date]) : null;
      const last_service_date = cm.last_service_date ? parseDate(row[cm.last_service_date]) : null;
      const record: any = {
        property_id: property.id,
        type: "Boiler",
        make,
        model,
        install_date,
        last_service_date,
        next_service_due: last_service_date ? addYear(last_service_date) : null,
        source: "sheet_import",
        is_demo: false,
      };
      const fuel = cm.fuel_type ? mapFuelType(row[cm.fuel_type]) : null;
      if (fuel) record.fuel_type = fuel;
      const warranty = cm.warranty_expiry ? parseDate(row[cm.warranty_expiry]) : null;
      if (warranty) record.warranty_expiry = warranty;
      const location = cm.location ? String(row[cm.location] || "").trim() : "";
      if (location) record.location = location;
      const eqNotes = cm.notes ? String(row[cm.notes] || "").trim() : "";
      if (eqNotes) record.notes = eqNotes;

      if (String(property.id).startsWith("preview_")) {
        results.created.Equipment++;
        continue;
      }
      const existing = await db.Equipment.filter({ property_id: property.id, make, model, is_demo: { $ne: true } });
      if (existing.length > 0) {
        if (!preview) await db.Equipment.update(existing[0].id, record);
        results.updated.Equipment++;
      } else {
        if (!preview) await db.Equipment.create(record);
        results.created.Equipment++;
      }
    }
  }

  // ---------- Phase 6: Compliance ----------
  const compMapped = tabMap.get("ComplianceRecord");
  if (compMapped) {
    const { tab, columnMap: cm } = compMapped;
    for (const row of liveRows(tab)) {
      const propRef = cm.property ? String(row[cm.property] || "").trim() : "";
      if (!propRef) {
        results.skipped.push({ tab: tab.name, row: row._rowNumber, reason: "Missing property reference" });
        continue;
      }
      const property = findProperty(propRef);
      if (!property) {
        results.skipped.push({ tab: tab.name, row: row._rowNumber, reason: `Could not match property "${propRef}"` });
        continue;
      }
      const rawCategory = cm.category ? String(row[cm.category] || "").trim() : "";
      const { category, known } = normalizeComplianceCategory(rawCategory);
      if (!known) {
        results.skipped.push({ tab: tab.name, row: row._rowNumber, reason: `Unrecognised document type "${rawCategory}"` });
        continue;
      }
      const expiry_date = cm.expiry_date ? parseDate(row[cm.expiry_date]) : null;
      if (!expiry_date) {
        results.skipped.push({ tab: tab.name, row: row._rowNumber, reason: "Missing or unparseable expiry date" });
        continue;
      }
      const issue_date = cm.issue_date ? parseDate(row[cm.issue_date]) : null;
      if (issue_date && expiry_date < issue_date) {
        warn(tab.name, row._rowNumber, `${property.name} ${category}: expiry ${expiry_date} is before issue date ${issue_date} — check the sheet`);
      }
      const record: any = {
        property_id: property.id,
        category,
        issue_date,
        expiry_date,
        status: computeComplianceStatus(expiry_date),
        source: "sheet_import",
        is_demo: false,
      };
      const provider = cm.provider ? String(row[cm.provider] || "").trim() : "";
      if (provider) record.provider = provider;
      const cNotes = cm.notes ? String(row[cm.notes] || "").trim() : "";
      if (cNotes) record.notes = cNotes;

      if (String(property.id).startsWith("preview_")) {
        results.created.ComplianceRecord++;
        continue;
      }
      const existing = await db.ComplianceRecord.filter({ property_id: property.id, category, is_demo: { $ne: true } });
      if (existing.length > 0) {
        if (!preview) await db.ComplianceRecord.update(existing[0].id, record);
        results.updated.ComplianceRecord++;
      } else {
        if (!preview) await db.ComplianceRecord.create(record);
        results.created.ComplianceRecord++;
      }
    }
  }

  // ---------- Orphans ----------
  for (const p of existingProps) {
    if (!matchedPropIds.has(p.id)) {
      results.orphans.push({ id: p.id, name: p.name, address: p.address || "" });
    }
  }

  // ---------- Logging ----------
  if (!preview) {
    const totalCreated = Object.values(results.created).reduce((a, b) => a + b, 0);
    const totalUpdated = Object.values(results.updated).reduce((a, b) => a + b, 0);
    await db.ActivityEvent.create({
      event_type: "Integration sync",
      description: `Sheet import: ${totalCreated} created, ${totalUpdated} updated, ${results.skipped.length} skipped, ${results.warnings.length} warnings`,
      timestamp: new Date().toISOString(),
      severity: results.warnings.length > 0 || results.skipped.length > 0 ? "warning" : "info",
      is_demo: false,
      source: "sheet_import",
    });
    await db.IntegrationLog.create({
      service: "Google Sheets",
      event: "Import",
      status: "success",
      details: `${totalCreated} created, ${totalUpdated} updated, ${results.skipped.length} skipped, ${results.warnings.length} warnings`,
      timestamp: new Date().toISOString(),
    });
  }

  return results;
}
