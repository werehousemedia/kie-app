import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Check } from "lucide-react";
import ChooseSource from "@/components/import/ChooseSource";
import MapColumns from "@/components/import/MapColumns";
import ValidationSummary from "@/components/import/ValidationSummary";
import ImportResults from "@/components/import/ImportResults";

const STEPS = ["Source", "Map", "Validation", "Results"];

export default function ImportWizard() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [tabs, setTabs] = useState(null);
  const [sourceUrl, setSourceUrl] = useState("");
  const [mapping, setMapping] = useState(null);
  const [validation, setValidation] = useState(null);
  const [results, setResults] = useState(null);

  return (
    <div className="max-w-4xl mx-auto space-y-5 animate-fade-in">
      <div>
        <button onClick={() => navigate(-1)} className="text-sm text-slate-500 hover:text-slate-800 flex items-center gap-1 mb-1"><ArrowLeft className="w-3.5 h-3.5" /> Back</button>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Import from Google Sheets</h1>
      </div>

      <div className="flex items-center gap-1 sm:gap-2 overflow-x-auto pb-1">
        {STEPS.map((s, i) => (
          <div key={s} className="flex items-center gap-1 sm:gap-2 shrink-0">
            <div className={`flex items-center gap-2 px-2.5 sm:px-3 py-1.5 rounded-full text-sm ${i === step ? "bg-[hsl(var(--navy))] text-white" : i < step ? "bg-[hsl(var(--sage-light))] text-[hsl(var(--sage))]" : "bg-slate-100 text-slate-500"}`}>
              {i < step ? <Check className="w-3.5 h-3.5" /> : <span className="w-5 h-5 rounded-full bg-white/30 flex items-center justify-center text-xs">{i + 1}</span>}
              <span className="hidden sm:inline">{s}</span>
            </div>
            {i < STEPS.length - 1 && <div className="w-4 sm:w-6 h-px bg-slate-200" />}
          </div>
        ))}
      </div>

      {step === 0 && <ChooseSource onParsed={(t, info) => { setTabs(t); setSourceUrl(info?.sheetUrl || ""); setMapping(null); setValidation(null); setStep(1); }} />}
      {step === 1 && tabs && <MapColumns tabs={tabs} sheetUrl={sourceUrl} mapping={mapping} setMapping={setMapping} onValidate={() => { setValidation(null); setStep(2); }} onBack={() => setStep(0)} />}
      {step === 2 && <ValidationSummary tabs={tabs} mapping={mapping} validation={validation} setValidation={setValidation} onConfirm={(res) => { setResults(res); setStep(3); }} onBack={() => setStep(1)} />}
      {step === 3 && results && <ImportResults results={results} onDone={() => navigate("/properties")} onAgain={() => { setStep(0); setTabs(null); setResults(null); setMapping(null); }} />}
    </div>
  );
}