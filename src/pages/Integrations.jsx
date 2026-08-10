import React, { useState } from "react";
import { useKieData } from "@/lib/useKieData";
import { base44 } from "@/api/base44Client";
import { formatDateTime, statusColor, logActivity } from "@/lib/kieUtils";
import {
  Sheet, HardDrive, MessageSquare, Building, Banknote, Plus, CheckCircle2, XCircle, Loader2, Settings,
} from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";

export default function Integrations() {
  const { integrationLogs, reload } = useKieData();
  const [testing, setTesting] = useState(null);

  const integrations = [
    { id: "sheets", name: "Google Sheets", icon: Sheet, desc: "Sync property, tenant, compliance and boiler data; log WhatsApp interactions", status: "ready", color: "bg-emerald-50 text-emerald-600" },
    { id: "drive", name: "Google Drive", icon: HardDrive, desc: "Store compliance documents and property files by folder mapping", status: "ready", color: "bg-blue-50 text-blue-600" },
    { id: "whatsapp", name: "WhatsApp Business", icon: MessageSquare, desc: "Live WhatsApp messaging via Business API or Twilio", status: "sandbox", color: "bg-amber-50 text-amber-600" },
    { id: "lettings", name: "KIE Lettings", icon: Building, desc: "Sync lettings data — API URL and key required", status: "coming", color: "bg-slate-100 text-slate-500" },
    { id: "sales", name: "KIE Sales", icon: Building, desc: "Sync sales pipeline data — API URL and key required", status: "coming", color: "bg-slate-100 text-slate-500" },
    { id: "bank", name: "Bank / Payment Provider", icon: Banknote, desc: "Open Banking integration for live rent collection and bill payments", status: "coming", color: "bg-slate-100 text-slate-500" },
  ];

  const handleTest = async (id) => {
    setTesting(id);
    try {
      await base44.entities.IntegrationLog.create({
        service: integrations.find((i) => i.id === id).name,
        event: "Test connection",
        status: id === "lettings" || id === "sales" || id === "bank" ? "failed" : "success",
        details: id === "lettings" || id === "sales" || id === "bank" ? "Not yet configured" : "Connection test successful (simulated)",
        timestamp: new Date().toISOString(),
      });
      await logActivity(base44, { event_type: "Integration sync", description: `Test connection: ${integrations.find((i) => i.id === id).name}` });
      toast.success("Test completed");
      reload();
    } catch (e) { toast.error("Test failed"); }
    finally { setTesting(null); }
  };

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div><h1 className="text-2xl font-bold text-slate-900">Integrations & Settings</h1><p className="text-sm text-slate-500 mt-0.5">Connect external services and configure AI operational rules</p></div>
        <Link to="/import" className="flex items-center gap-2 px-4 py-2 bg-[hsl(var(--sage))] text-white rounded-lg text-sm font-medium hover:bg-[hsl(var(--sage))]/90 shrink-0"><Sheet className="w-4 h-4" /> Import from Google Sheets</Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {integrations.map((i) => {
          const Icon = i.icon;
          return (
            <div key={i.id} className="bg-white rounded-xl border border-slate-200 p-5">
              <div className="flex items-start justify-between mb-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${i.color}`}><Icon className="w-5 h-5" /></div>
                <span className={`text-xs px-2 py-0.5 rounded-full ${i.status === "ready" ? "bg-emerald-100 text-emerald-700" : i.status === "sandbox" ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-500"}`}>
                  {i.status === "ready" ? "Ready" : i.status === "sandbox" ? "Sandbox" : "Coming later"}
                </span>
              </div>
              <h3 className="text-sm font-semibold text-slate-900">{i.name}</h3>
              <p className="text-xs text-slate-500 mt-1 mb-3">{i.desc}</p>
              {i.id === "sheets" && (
                <div className="space-y-2 mb-3">
                  <input placeholder="Spreadsheet ID" className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg" />
                  <div className="text-xs text-slate-400">Sheet mapping: Properties → Tab 1, Tenants → Tab 2, Compliance → Tab 3, Boilers → Tab 4</div>
                  <label className="flex items-center gap-2 text-xs text-slate-600"><input type="checkbox" defaultChecked /> Log WhatsApp interactions</label>
                </div>
              )}
              {i.id === "drive" && (
                <div className="space-y-2 mb-3">
                  <input placeholder="Root folder ID" className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg" />
                  <div className="text-xs text-slate-400">Folder mapping: One folder per property, subfolders for compliance/photos</div>
                </div>
              )}
              {i.id === "whatsapp" && (
                <div className="space-y-2 mb-3">
                  <input placeholder="+44 7xxx xxx xxx" className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg" />
                  <input placeholder="Webhook URL" className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg" />
                </div>
              )}
              {(i.id === "lettings" || i.id === "sales") && (
                <div className="space-y-2 mb-3">
                  <input placeholder="API URL" className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg" />
                  <input placeholder="API Key" type="password" className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg" />
                </div>
              )}
              <button
                onClick={() => handleTest(i.id)}
                disabled={testing === i.id}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium bg-[hsl(var(--navy))] text-white rounded-lg hover:bg-[hsl(var(--navy-light))] disabled:opacity-50"
              >
                {testing === i.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                {i.status === "coming" ? "Configure" : "Test connection"}
              </button>
            </div>
          );
        })}
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <div className="flex items-center gap-2 mb-4"><Settings className="w-4 h-4 text-slate-500" /><h2 className="text-base font-semibold text-slate-900">AI Operational Rules</h2></div>
        <div className="space-y-4">
          <div><label className="text-sm font-medium text-slate-700">Emergency wording</label><textarea defaultValue="If you smell gas or suspect a gas leak, call the National Gas Emergency Service on 0800 111 999 immediately. Do not use electrical switches." className="w-full mt-1 px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg" rows={2} /></div>
          <div><label className="text-sm font-medium text-slate-700">Preferred contractor selection logic</label><select className="w-full mt-1 px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg"><option>Preferred first, then highest rated, then nearest</option><option>Highest rated only</option><option>Nearest only</option><option>Lowest average quote</option></select></div>
          <div><label className="text-sm font-medium text-slate-700">Landlord approval threshold</label><select className="w-full mt-1 px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg"><option>Require approval for all jobs</option><option>Auto-approve jobs under £150</option><option>Auto-approve jobs under £300</option><option>Auto-approve emergency jobs</option></select></div>
          <div><label className="text-sm font-medium text-slate-700">Message tone</label><select className="w-full mt-1 px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg"><option>Professional and warm</option><option>Formal</option><option>Friendly and casual</option></select></div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <h2 className="text-base font-semibold text-slate-900 mb-3">Integration Event Log</h2>
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {integrationLogs.length === 0 ? <p className="text-sm text-slate-400 text-center py-4">No sync events yet</p> :
            integrationLogs.map((l) => (
              <div key={l.id} className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-slate-50">
                {l.status === "success" ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : l.status === "failed" ? <XCircle className="w-4 h-4 text-rose-500" /> : <Loader2 className="w-4 h-4 text-amber-500" />}
                <div className="flex-1 min-w-0"><p className="text-sm font-medium text-slate-800">{l.service} · {l.event}</p><p className="text-xs text-slate-500 truncate">{l.details}</p></div>
                <span className="text-xs text-slate-400">{formatDateTime(l.timestamp)}</span>
              </div>
            ))
          }
        </div>
      </div>
    </div>
  );
}