import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Loader2, CheckCircle2, AlertTriangle, ArrowLeft } from "lucide-react";

export default function ValidationSummary({ tabs, mapping, validation, setValidation, onConfirm, onBack }) {
  const [loading, setLoading] = useState(!validation);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState(null);

  const runPreview = async () => {
    setLoading(true); setError(null);
    try {
      const res = await base44.functions.invoke("run_import", { tabs, mapping: { tabMappings: mapping }, preview: true });
      setValidation(res.data);
    } catch (e) { setError(e.response?.data?.error || e.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { if (!validation) runPreview(); }, []);

  const handleConfirm = async () => {
    setConfirming(true); setError(null);
    try {
      const res = await base44.functions.invoke("run_import", { tabs, mapping: { tabMappings: mapping }, preview: false });
      onConfirm(res.data);
    } catch (e) { setError(e.response?.data?.error || e.message); }
    finally { setConfirming(false); }
  };

  if (loading) return <div className="bg-white rounded-xl border border-slate-200 p-12 flex flex-col items-center"><Loader2 className="w-6 h-6 animate-spin text-slate-400 mb-2" /><p className="text-sm text-slate-500">Validating all rows…</p></div>;
  if (error) return <div className="bg-rose-50 border border-rose-200 rounded-lg p-4 text-sm text-rose-700">{error}<div className="mt-3"><button onClick={onBack} className="text-xs underline">Back to mapping</button></div></div>;

  const v = validation;
  const totalCreate = Object.values(v.created).reduce((a, b) => a + b, 0);
  const totalUpdate = Object.values(v.updated).reduce((a, b) => a + b, 0);
  const warnings = v.warnings || [];
  const orphans = v.orphans || [];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 sm:p-4"><p className="text-xs text-emerald-600">Will create</p><p className="text-xl sm:text-2xl font-bold text-emerald-700">{totalCreate}</p></div>
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 sm:p-4"><p className="text-xs text-blue-600">Will update</p><p className="text-xl sm:text-2xl font-bold text-blue-700">{totalUpdate}</p></div>
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 sm:p-4"><p className="text-xs text-amber-600">Will skip</p><p className="text-xl sm:text-2xl font-bold text-amber-700">{v.skipped.length}</p></div>
      </div>

      {v.skipped.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-sm font-semibold text-slate-900 mb-2 flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-amber-500" /> Rows that won't import ({v.skipped.length})</p>
          <div className="max-h-60 overflow-y-auto space-y-1">
            {v.skipped.map((s, i) => (
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
          <p className="text-sm font-semibold text-slate-900 mb-2 flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-amber-500" /> Warnings ({warnings.length}) — rows still import</p>
          <div className="max-h-60 overflow-y-auto space-y-1">
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
          <p className="text-xs text-slate-500 mb-2">These properties exist in the app but weren't found in the sheet. They were left untouched — remove them manually if they shouldn't exist.</p>
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

      {v.perProperty?.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-sm font-semibold text-slate-900 mb-2">Occupancy rule per property</p>
          <div className="space-y-1">
            {v.perProperty.map((p, i) => (
              <div key={i} className="flex items-center justify-between text-xs py-1 gap-2">
                <span className="text-slate-700 font-medium truncate">{p.name}</span>
                <span className="text-slate-500 text-right shrink-0">{p.occupancyRule.replace(/_/g, " ")} → <span className="text-slate-700">{p.occupancyStatus}</span></span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <button onClick={onBack} className="flex items-center gap-1 px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg"><ArrowLeft className="w-4 h-4" /> Back</button>
        <button onClick={handleConfirm} disabled={confirming} className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-50">
          {confirming ? <><Loader2 className="w-4 h-4 animate-spin" /> Importing…</> : <><CheckCircle2 className="w-4 h-4" /> Confirm import</>}
        </button>
      </div>
    </div>
  );
}