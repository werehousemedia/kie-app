import React, { useState } from "react";
import { Wifi, CheckCircle2, AlertCircle, Loader2, Info } from "lucide-react";

export default function ConnectionCard() {
  const [state, setState] = useState("sandbox");
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);

  const handleTest = () => {
    setTesting(true);
    setTestResult(null);
    setTimeout(() => {
      setTesting(false);
      setTestResult("sandbox");
    }, 1500);
  };

  const stateConfig = {
    connected: { icon: CheckCircle2, color: "text-emerald-600", bg: "bg-emerald-50", label: "Connected" },
    sandbox: { icon: AlertCircle, color: "text-amber-600", bg: "bg-amber-50", label: "Sandbox (simulated)" },
    not_configured: { icon: AlertCircle, color: "text-slate-500", bg: "bg-slate-100", label: "Not configured" },
  };
  const cfg = stateConfig[state];
  const Icon = cfg.icon;

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-[hsl(var(--sage-light))] flex items-center justify-center">
            <Wifi className="w-4 h-4 text-[hsl(var(--sage))]" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-900">WhatsApp Connection</p>
            <p className="text-xs text-slate-500">Business API / Twilio ready</p>
          </div>
        </div>
        <span className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${cfg.bg} ${cfg.color}`}>
          <Icon className="w-3.5 h-3.5" />
          {cfg.label}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-3 mb-3">
        <div>
          <label className="text-xs text-slate-400 font-medium">UK WhatsApp number</label>
          <input
            type="text"
            placeholder="+44 7xxx xxx xxx"
            className="w-full mt-1 px-3 py-1.5 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[hsl(var(--sage))]/30"
          />
        </div>
        <div>
          <label className="text-xs text-slate-400 font-medium">Webhook URL</label>
          <input
            type="text"
            placeholder="https://api.kie.app/whatsapp/webhook"
            className="w-full mt-1 px-3 py-1.5 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[hsl(var(--sage))]/30"
          />
        </div>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={handleTest}
          disabled={testing}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-[hsl(var(--navy))] text-white rounded-lg hover:bg-[hsl(var(--navy-light))] transition-colors disabled:opacity-50"
        >
          {testing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wifi className="w-3.5 h-3.5" />}
          Test connection
        </button>
        {testResult && (
          <span className="text-xs text-amber-600 flex items-center gap-1">
            <Info className="w-3.5 h-3.5" /> Sandbox mode — messages are simulated
          </span>
        )}
      </div>
      <p className="text-[11px] text-slate-400 mt-2.5 leading-relaxed">
        How this data is logged: All WhatsApp messages and AI triage results are stored in the app database and logged to the Activity Timeline. When connected, they can also sync to Google Sheets.
      </p>
    </div>
  );
}