import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { CANONICAL_FIELDS, suggestColumn, buildAutoMapping } from "@/lib/importTemplate";
import { ArrowRight, ArrowLeft, Save } from "lucide-react";

const ENTITIES = ["Property", "Unit", "Tenant", "Equipment", "ComplianceRecord"];

export default function MapColumns({ tabs, mapping, setMapping, onValidate, onBack, sheetUrl }) {
  const [local, setLocal] = useState(mapping || buildAutoMapping(tabs));
  const [saveTpl, setSaveTpl] = useState(true);

  useEffect(() => { setMapping(local); }, [local, setMapping]);

  const updateField = (i, field, col) => {
    setLocal((prev) => prev.map((m, idx) => idx === i ? { ...m, columnMap: { ...m.columnMap, [field]: col } } : m));
  };

  const updateEntity = (i, entity) => {
    setLocal((prev) => prev.map((m, idx) => {
      if (idx !== i) return m;
      const columnMap = {};
      if (entity && CANONICAL_FIELDS[entity]) {
        const tab = tabs.find((t) => t.name === m.tabName);
        for (const [field, keywords] of Object.entries(CANONICAL_FIELDS[entity])) {
          const col = suggestColumn(tab.headers, keywords);
          if (col) columnMap[field] = col;
        }
      }
      return { ...m, entity, columnMap };
    }));
  };

  const handleNext = async () => {
    setMapping(local);
    if (saveTpl) {
      // Upsert the single default template (never create duplicates). This is
      // also the config the Sync Now / nightly sync path reads.
      try {
        const existing = await base44.entities.ImportTemplate.filter({ is_default: true });
        const data = { name: "KIE template", source_type: "sheet_url", tab_mappings: local, is_default: true };
        if (sheetUrl) data.sheet_url = sheetUrl;
        if (existing.length > 0) {
          await base44.entities.ImportTemplate.update(existing[0].id, data);
        } else {
          await base44.entities.ImportTemplate.create({ ...data, sync_secret: crypto.randomUUID() });
        }
      } catch (e) { /* non-fatal */ }
    }
    onValidate();
  };

  return (
    <div className="space-y-4">
      {tabs.map((tab, i) => {
        const m = local[i] || { tabName: tab.name, entity: "", columnMap: {} };
        const previewRows = tab.rows.slice(0, 5);
        return (
          <div key={tab.name} className="bg-white rounded-xl border border-slate-200 p-4 sm:p-5">
            <div className="flex items-center justify-between mb-3 gap-2">
              <div><h3 className="text-sm font-semibold text-slate-900">{tab.name}</h3><p className="text-xs text-slate-500">{tab.rows.length} rows · {tab.headers.length} columns</p></div>
              <select value={m.entity} onChange={(e) => updateEntity(i, e.target.value)} className="text-sm px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg shrink-0">
                <option value="">Skip tab</option>
                {ENTITIES.map((e) => <option key={e} value={e}>→ {e}</option>)}
              </select>
            </div>
            {tab.empty ? (
              <p className="text-xs text-amber-600">This tab is empty — nothing to import.</p>
            ) : m.entity ? (
              <div className="space-y-3">
                <div className="grid grid-cols-1 gap-2">
                  {Object.keys(CANONICAL_FIELDS[m.entity]).map((field) => (
                    <div key={field} className="flex items-center gap-2">
                      <span className="text-xs font-medium text-slate-600 w-32 shrink-0">{field}</span>
                      <select value={m.columnMap[field] || ""} onChange={(e) => updateField(i, field, e.target.value)} className="flex-1 text-xs px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg">
                        <option value="">— none —</option>
                        {tab.headers.map((h) => <option key={h} value={h}>{h}</option>)}
                      </select>
                    </div>
                  ))}
                </div>
                <div className="overflow-x-auto -mx-1">
                  <table className="w-full text-xs min-w-max">
                    <thead className="bg-slate-50 text-slate-500"><tr>{tab.headers.map((h) => <th key={h} className="text-left px-2 py-1.5 font-medium whitespace-nowrap">{h}</th>)}</tr></thead>
                    <tbody className="divide-y divide-slate-100">
                      {previewRows.map((r, ri) => <tr key={ri}>{tab.headers.map((h) => <td key={h} className="px-2 py-1.5 text-slate-700 max-w-[180px] truncate">{r[h]}</td>)}</tr>)}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-400">Choose an entity for this tab, or skip it.</p>
            )}
          </div>
        );
      })}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input type="checkbox" checked={saveTpl} onChange={(e) => setSaveTpl(e.target.checked)} />
          <Save className="w-3.5 h-3.5" /> Save mapping &amp; sheet for future imports and auto-sync
        </label>
        <div className="flex items-center gap-2">
          <button onClick={onBack} className="flex items-center gap-1 px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg"><ArrowLeft className="w-4 h-4" /> Back</button>
          <button onClick={handleNext} className="flex items-center gap-2 px-4 py-2 bg-[hsl(var(--navy))] text-white rounded-lg text-sm font-medium hover:bg-[hsl(var(--navy-light))]">Validate <ArrowRight className="w-4 h-4" /></button>
        </div>
      </div>
    </div>
  );
}