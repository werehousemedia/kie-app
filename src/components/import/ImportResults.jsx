import React from "react";
import { CheckCircle2, AlertTriangle, Repeat, Check } from "lucide-react";

export default function ImportResults({ results, onDone, onAgain }) {
  const totalCreate = Object.values(results.created).reduce((a, b) => a + b, 0);
  const totalUpdate = Object.values(results.updated).reduce((a, b) => a + b, 0);
  const warnings = results.warnings || [];
  const orphans = results.orphans || [];

  return (
    <div className="space-y-4">
      <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-6 text-center">
        <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
        <h2 className="text-lg font-bold text-emerald-800">Import complete</h2>
        <p className="text-sm text-emerald-700">{totalCreate} created · {totalUpdate} updated · {results.skipped.length} skipped</p>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <p className="text-sm font-semibold text-slate-900 mb-2">Per entity (created / updated)</p>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          {Object.keys(results.created).map((e) => (
            <div key={e} className="p-2 bg-slate-50 rounded-lg text-center">
              <p className="text-xs text-slate-500">{e}</p>
              <p className="text-sm font-bold text-slate-800">{results.created[e]}<span className="text-slate-400 font-normal"> / {results.updated[e]}</span></p>
            </div>
          ))}
        </div>
      </div>

      {results.skipped.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-sm font-semibold text-slate-900 mb-2 flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-amber-500" /> Skipped rows ({results.skipped.length})</p>
          <div className="max-h-48 overflow-y-auto space-y-1">
            {results.skipped.map((s, i) => (
              <div key={i} className="flex items-start gap-2 text-xs p-2 bg-slate-50 rounded-lg">
                <span className="font-medium text-slate-700 shrink-0">Row {s.row}</span>
                <span className="text-slate-500 shrink-0">{s.tab}</span>
                <span className="text-rose-600">{s.reason}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {warnings.length > 0 && (
        <div className="bg-white rounded-xl border border-amber-200 p-4">
          <p className="text-sm font-semibold text-slate-900 mb-2 flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-amber-500" /> Warnings ({warnings.length})</p>
          <div className="max-h-48 overflow-y-auto space-y-1">
            {warnings.map((w, i) => (
              <div key={i} className="flex items-start gap-2 text-xs p-2 bg-amber-50/60 rounded-lg">
                <span className="font-medium text-slate-700 shrink-0">{w.tab}{w.row ? ` row ${w.row}` : ""}</span>
                <span className="text-amber-800">{w.message}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {orphans.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-sm font-semibold text-slate-900 mb-1">In the app but not in your sheet ({orphans.length})</p>
          <p className="text-xs text-slate-500 mb-2">Left untouched — remove manually if they shouldn't exist.</p>
          <div className="space-y-1">
            {orphans.map((o) => (
              <div key={o.id} className="flex items-center gap-2 text-xs p-2 bg-slate-50 rounded-lg">
                <span className="font-medium text-slate-700">{o.name}</span>
                <span className="text-slate-500 truncate">{o.address}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {results.perProperty?.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-sm font-semibold text-slate-900 mb-2">Occupancy rule applied</p>
          <div className="space-y-1">
            {results.perProperty.map((p, i) => (
              <div key={i} className="flex items-center justify-between text-xs py-1 gap-2">
                <span className="text-slate-700 font-medium truncate">{p.name}</span>
                <span className="text-slate-500 text-right shrink-0">{p.occupancyRule.replace(/_/g, " ")} → <span className="text-slate-700">{p.occupancyStatus}</span></span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-center gap-2">
        <button onClick={onAgain} className="flex items-center gap-2 px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg"><Repeat className="w-4 h-4" /> Import another</button>
        <button onClick={onDone} className="flex items-center gap-2 px-4 py-2 bg-[hsl(var(--navy))] text-white rounded-lg text-sm font-medium hover:bg-[hsl(var(--navy-light))]"><Check className="w-4 h-4" /> Done — view properties</button>
      </div>
    </div>
  );
}