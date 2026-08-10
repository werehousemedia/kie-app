import { createClientFromRequest } from "npm:@base44/sdk@0.8.40";
import {
  normalizeAddress, normalizePhone, normalizeName, parseDate, parseCurrency,
  parseVacant, computeComplianceStatus, addYear, mapPropertyType, mapHmoStatus,
} from "../../shared/importUtils.ts";

const ENTITY_FIELDS: Record<string, string[]> = {
  Property: ["name", "address", "postcode", "vacant", "property_type", "units_count"],
  Tenant: ["name", "phone", "email", "property", "tenancy_start", "tenancy_end", "rent_amount"],
  Equipment: ["property", "make", "model", "install_date", "last_service_date"],
  ComplianceRecord: ["property", "category", "issue_date", "expiry_date"],
  Unit: ["property", "unit_label", "vacant"],
};

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { tabs, mapping, preview = false } = body;
    if (!tabs || !mapping?.tabMappings) {
      return Response.json({ error: "Missing tabs or mapping." }, { status: 400 });
    }

    const results: any = {
      created: { Property: 0, Unit: 0, Tenant: 0, Equipment: 0, ComplianceRecord: 0 },
      updated: { Property: 0, Unit: 0, Tenant: 0, Equipment: 0, ComplianceRecord: 0 },
      skipped: [],
      perProperty: [],
      preview,
    };

    // Load existing NON-DEMO records for matching
    const [existingProps, existingTenants, existingUnits] = await Promise.all([
      base44.asServiceRole.entities.Property.filter({ is_demo: { $ne: true } }),
      base44.asServiceRole.entities.Tenant.filter({ is_demo: { $ne: true } }),
      base44.asServiceRole.entities.Unit.filter({ is_demo: { $ne: true } }),
    ]);

    const propertyByAddr = new Map<string, any>();
    const propertyByName = new Map<string, any>();
    for (const p of existingProps) {
      const k = normalizeAddress(p.address, p.postcode);
      if (k) propertyByAddr.set(k, p);
      if (p.name) propertyByName.set(normalizeName(p.name), p);
    }
    const tenantByKey = new Map<string, any>();
    for (const t of existingTenants) {
      tenantByKey.set(normalizeName(t.name) + "|" + normalizePhone(t.phone), t);
    }

    const tabMap = new Map<string, { tab: any; columnMap: any }>();
    for (const tm of mapping.tabMappings) {
      if (!tm.entity || !tm.columnMap) continue;
      const tab = tabs.find((t: any) => t.name === tm.tabName);
      if (tab) tabMap.set(tm.entity, { tab, columnMap: tm.columnMap });
    }

    const findProperty = (ref: string): any | null => {
      if (!ref) return null;
      const n = normalizeName(ref);
      if (propertyByName.has(n)) return propertyByName.get(n);
      // Try address match against each property (ref might be "7 Willow Court, KT12 3AB")
      for (const p of propertyByAddr.values()) {
        if (normalizeAddress(ref, "").includes(normalizeAddress(p.name, "").split("|")[0])) return p;
      }
      // Substring fallback on name
      for (const p of propertyByName.values()) {
        if (p.name && p.name.toLowerCase().includes(ref.toLowerCase())) return p;
      }
      return null;
    };

    // --- Phase 1: Properties ---
    const propMapped = tabMap.get("Property");
    if (propMapped) {
      const { tab, columnMap: cm } = propMapped;
      for (const row of tab.rows) {
        const name = cm.name ? row[cm.name] : "";
        const address = cm.address ? row[cm.address] : "";
        const postcode = cm.postcode ? row[cm.postcode] : "";
        if (!address || !postcode) {
          results.skipped.push({ tab: tab.name, row: row._rowNumber, reason: "Missing address or postcode" });
          continue;
        }
        if (!name) {
          results.skipped.push({ tab: tab.name, row: row._rowNumber, reason: "Missing property name" });
          continue;
        }
        const key = normalizeAddress(address, postcode);
        const existing = propertyByAddr.get(key);
        const classType = cm.property_type ? row[cm.property_type] : "";
        const beds = cm.units_count ? parseInt(row[cm.units_count]) || 1 : 1;
        const isHmo = mapPropertyType(classType) === "HMO";

        // Vacancy rule
        let occupancyRule = "property_checkbox";
        let occupancyStatus = "Fully occupied";
        const vacantBool = cm.vacant ? parseVacant(row[cm.vacant]) : null;

        // Check for a Units tab with rows for this property
        const unitMapped = tabMap.get("Unit");
        let unitRows: any[] = [];
        if (unitMapped && isHmo) {
          const { tab: uTab, columnMap: ucm } = unitMapped;
          unitRows = uTab.rows.filter((r: any) => {
            const ref = ucm.property ? r[ucm.property] : "";
            return findProperty(ref) === (existing || propertyByName.get(normalizeName(name)));
          });
        }

        if (unitRows.length > 0) {
          occupancyRule = "unit_level_derived";
          const vacantUnits = unitRows.filter((r: any) => parseVacant(ucm(unitMapped).vacant ? r[ucm(unitMapped).vacant] : "") === true).length;
          if (vacantUnits === unitRows.length) occupancyStatus = "Vacant";
          else if (vacantUnits > 0) occupancyStatus = "Partially occupied";
          else occupancyStatus = "Fully occupied";
        } else {
          occupancyRule = isHmo ? "property_checkbox_fallback" : "property_checkbox";
          if (vacantBool === true) occupancyStatus = "Vacant";
          else if (vacantBool === false) occupancyStatus = isHmo ? "Fully occupied" : "Fully occupied";
          else occupancyStatus = "Fully occupied";
        }

        const record: any = {
          name, address, postcode,
          property_type: mapPropertyType(classType),
          hmo_status: mapHmoStatus(classType),
          units_count: beds,
          occupancy_status: occupancyStatus,
          source: "sheet_import",
          is_demo: false,
        };

        let propId: string;
        if (existing) {
          if (!preview) await base44.asServiceRole.entities.Property.update(existing.id, record);
          results.updated.Property++;
          propId = existing.id;
        } else {
          if (!preview) {
            const created = await base44.asServiceRole.entities.Property.create(record);
            propertyByAddr.set(key, created);
            propertyByName.set(normalizeName(created.name), created);
            propId = created.id;
          } else {
            propId = "preview";
          }
          results.created.Property++;
        }

        // Create placeholder units for HMOs if no Units tab
        if (isHmo && !preview && propId !== "preview" && unitRows.length === 0) {
          const existingPropUnits = existingUnits.filter((u: any) => u.property_id === propId);
          for (let i = existingPropUnits.length; i < beds; i++) {
            await base44.asServiceRole.entities.Unit.create({
              property_id: propId,
              unit_label: `Room ${i + 1}`,
              occupancy_status: vacantBool === true ? "Vacant" : "Occupied",
              source: "sheet_import",
              is_demo: false,
            });
            results.created.Unit++;
          }
        }

        results.perProperty.push({ name, occupancyRule, occupancyStatus, units: beds });
      }
    }

    // --- Phase 2: Tenants ---
    const tenantMapped = tabMap.get("Tenant");
    if (tenantMapped) {
      const { tab, columnMap: cm } = tenantMapped;
      for (const row of tab.rows) {
        const name = cm.name ? row[cm.name] : "";
        const phone = cm.phone ? row[cm.phone] : "";
        if (!name || !phone) {
          results.skipped.push({ tab: tab.name, row: row._rowNumber, reason: "Missing name or phone" });
          continue;
        }
        const propRef = cm.property ? row[cm.property] : "";
        const property = findProperty(propRef);
        if (!property) {
          results.skipped.push({ tab: tab.name, row: row._rowNumber, reason: `Could not match property "${propRef}"` });
          continue;
        }
        const key = normalizeName(name) + "|" + normalizePhone(phone);
        const existing = tenantByKey.get(key);
        const record: any = {
          name, phone,
          email: cm.email ? row[cm.email] || "" : "",
          property_id: property.id,
          tenancy_start: cm.tenancy_start ? parseDate(row[cm.tenancy_start]) : null,
          tenancy_end: cm.tenancy_end ? parseDate(row[cm.tenancy_end]) : null,
          rent_amount: cm.rent_amount ? parseCurrency(row[cm.rent_amount]) : 0,
          payment_status: "Due",
          consent_status: "Pending",
          source: "sheet_import",
          is_demo: false,
        };
        if (existing) {
          if (!preview) await base44.asServiceRole.entities.Tenant.update(existing.id, record);
          results.updated.Tenant++;
        } else {
          if (!preview) {
            const created = await base44.asServiceRole.entities.Tenant.create(record);
            tenantByKey.set(key, created);
          }
          results.created.Tenant++;
        }
      }
    }

    // --- Phase 3: Equipment ---
    const equipMapped = tabMap.get("Equipment");
    if (equipMapped) {
      const { tab, columnMap: cm } = equipMapped;
      for (const row of tab.rows) {
        const make = cm.make ? row[cm.make] : "";
        const model = cm.model ? row[cm.model] : "";
        const propRef = cm.property ? row[cm.property] : "";
        if (!propRef) {
          results.skipped.push({ tab: tab.name, row: row._rowNumber, reason: "Missing property reference" });
          continue;
        }
        const property = findProperty(propRef);
        if (!property) {
          results.skipped.push({ tab: tab.name, row: row._rowNumber, reason: `Could not match property "${propRef}"` });
          continue;
        }
        const install_date = cm.install_date ? parseDate(row[cm.install_date]) : null;
        const last_service_date = cm.last_service_date ? parseDate(row[cm.last_service_date]) : null;
        const next_service_due = last_service_date ? addYear(last_service_date) : null;
        const existing = await base44.asServiceRole.entities.Equipment.filter({
          property_id: property.id, make, model, is_demo: { $ne: true },
        });
        const record: any = {
          property_id: property.id,
          type: "Boiler",
          make, model, install_date, last_service_date, next_service_due,
          source: "sheet_import",
          is_demo: false,
        };
        if (existing.length > 0) {
          if (!preview) await base44.asServiceRole.entities.Equipment.update(existing[0].id, record);
          results.updated.Equipment++;
        } else {
          if (!preview) await base44.asServiceRole.entities.Equipment.create(record);
          results.created.Equipment++;
        }
      }
    }

    // --- Phase 4: ComplianceRecord ---
    const compMapped = tabMap.get("ComplianceRecord");
    if (compMapped) {
      const { tab, columnMap: cm } = compMapped;
      for (const row of tab.rows) {
        const category = cm.category ? row[cm.category] : "";
        const propRef = cm.property ? row[cm.property] : "";
        if (!propRef) {
          results.skipped.push({ tab: tab.name, row: row._rowNumber, reason: "Missing property reference" });
          continue;
        }
        const property = findProperty(propRef);
        if (!property) {
          results.skipped.push({ tab: tab.name, row: row._rowNumber, reason: `Could not match property "${propRef}"` });
          continue;
        }
        const expiry_date = cm.expiry_date ? parseDate(row[cm.expiry_date]) : null;
        if (!expiry_date) {
          results.skipped.push({ tab: tab.name, row: row._rowNumber, reason: "Missing or unparseable expiry date (expected DD/MM/YYYY)" });
          continue;
        }
        const issue_date = cm.issue_date ? parseDate(row[cm.issue_date]) : null;
        const status = computeComplianceStatus(expiry_date);
        const existing = await base44.asServiceRole.entities.ComplianceRecord.filter({
          property_id: property.id, category, is_demo: { $ne: true },
        });
        const record: any = {
          property_id: property.id, category, issue_date, expiry_date, status,
          source: "sheet_import",
          is_demo: false,
        };
        if (existing.length > 0) {
          if (!preview) await base44.asServiceRole.entities.ComplianceRecord.update(existing[0].id, record);
          results.updated.ComplianceRecord++;
        } else {
          if (!preview) await base44.asServiceRole.entities.ComplianceRecord.create(record);
          results.created.ComplianceRecord++;
        }
      }
    }

    // --- Logging (real records, not demo) ---
    if (!preview) {
      const totalCreated = Object.values(results.created).reduce((a: number, b: any) => a + b, 0);
      const totalUpdated = Object.values(results.updated).reduce((a: number, b: any) => a + b, 0);
      await base44.asServiceRole.entities.ActivityEvent.create({
        event_type: "Integration sync",
        description: `Sheet import: ${totalCreated} created, ${totalUpdated} updated, ${results.skipped.length} skipped`,
        timestamp: new Date().toISOString(),
        severity: results.skipped.length > 0 ? "warning" : "info",
        is_demo: false,
        source: "sheet_import",
      });
      await base44.asServiceRole.entities.IntegrationLog.create({
        service: "Google Sheets",
        event: "Import",
        status: "success",
        details: `${totalCreated} created, ${totalUpdated} updated, ${results.skipped.length} skipped`,
        timestamp: new Date().toISOString(),
      });
    }

    return Response.json(results);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

// helper for unit vacancy counting
function ucm(m: any) { return m.columnMap; }