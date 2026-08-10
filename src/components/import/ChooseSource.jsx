import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Sheet, Upload, Loader2, Link2, FileSpreadsheet } from "lucide-react";

export default function ChooseSource({ onParsed }) {
  const [mode, setMode] = useState("sheet");
  const [url, setUrl] = useState("");
  const [file, setFile] = useState(null);
  const [fileUrl, setFileUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleRead = async () => {
    setLoading(true);
    setError(null);
    try {
      let payload;
      if (mode === "sheet") {
        if (!url) { setError("Paste a Google Sheet URL"); setLoading(false); return; }
        payload = { sheetUrl: url };
      } else {
        let fUrl = fileUrl;
        if (file && !fUrl) {
          const { file_url } = await base44.integrations.Core.UploadFile({ file });
          fUrl = file_url;
          setFileUrl(fUrl);
        }
        if (!fUrl) { setError("Choose a file to upload"); setLoading(false); return; }
        payload = { fileUrl: fUrl };
      }
      const res = await base44.functions.invoke("parse_source", payload);
      const tabs = res.data?.tabs || [];
      if (tabs.length === 0) { setError("No tabs or rows found in that source."); setLoading(false); return; }
      onParsed(tabs, mode === "sheet" ? { sheetUrl: url } : {});
    } catch (e) {
      setError(e.response?.data?.error || e.message || "Could not read the source");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 sm:p-6 space-y-5">
      <div className="grid grid-cols-2 gap-3">
        <button onClick={() => setMode("sheet")} className={`p-4 rounded-lg border text-left transition-all ${mode === "sheet" ? "border-[hsl(var(--sage))] bg-[hsl(var(--sage-light))]" : "border-slate-200 hover:border-slate-300"}`}>
          <Sheet className="w-5 h-5 mb-2 text-[hsl(var(--sage))]" />
          <p className="text-sm font-semibold text-slate-900">Google Sheet URL</p>
          <p className="text-xs text-slate-500">Paste a link to your workbook</p>
        </button>
        <button onClick={() => setMode("file")} className={`p-4 rounded-lg border text-left transition-all ${mode === "file" ? "border-[hsl(var(--sage))] bg-[hsl(var(--sage-light))]" : "border-slate-200 hover:border-slate-300"}`}>
          <Upload className="w-5 h-5 mb-2 text-slate-500" />
          <p className="text-sm font-semibold text-slate-900">Upload file</p>
          <p className="text-xs text-slate-500">CSV or XLSX export</p>
        </button>
      </div>

      {mode === "sheet" ? (
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-slate-700">Sheet URL</label>
          <div className="relative">
            <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://docs.google.com/spreadsheets/d/..." className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--sage))]/30" />
          </div>
        </div>
      ) : (
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-slate-700">File (CSV or XLSX)</label>
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-2 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm cursor-pointer hover:bg-slate-100">
              <FileSpreadsheet className="w-4 h-4 text-slate-500" />
              <span>{file ? file.name : "Choose file"}</span>
              <input type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={(e) => { setFile(e.target.files[0]); setFileUrl(""); }} />
            </label>
          </div>
        </div>
      )}

      {error && <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-sm text-rose-700">{error}</div>}

      <button onClick={handleRead} disabled={loading} className="flex items-center gap-2 px-4 py-2.5 bg-[hsl(var(--navy))] text-white rounded-lg text-sm font-medium hover:bg-[hsl(var(--navy-light))] disabled:opacity-50">
        {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Reading source…</> : <>Read source →</>}
      </button>
    </div>
  );
}