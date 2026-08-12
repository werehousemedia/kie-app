import React, { useMemo, useState } from "react";
import { toast } from "sonner";
import { HardHat, Check, AlertTriangle } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

const TRADES = [
  "Plumbing", "Heating/Gas", "Electrical", "General", "Carpentry",
  "Roofing", "Pest control", "Cleaning", "Locksmith", "Appliance repair",
];

const ACCREDITATIONS = ["Gas Safe", "NICEIC", "DEA", "TrustMark", "NAPIT", "OFTEC"];

// Landlords keep their regulars in a phone, a spreadsheet, or their head.
// Accept whatever they paste — comma, tab or semicolon separated — and be
// forgiving about column order: a UK phone number and a known trade word are
// recognisable wherever they land.
function parseLine(line) {
  const parts = line.split(/[\t;,]/).map((s) => s.trim()).filter(Boolean);
  if (parts.length === 0) return null;

  const row = { name: "", trade: "", phone: "", email: "", coverage_area: "", accreditations: [] };
  const leftovers = [];

  for (const part of parts) {
    const digits = part.replace(/[^0-9]/g, "");
    if (!row.email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(part)) { row.email = part; continue; }
    if (!row.phone && digits.length >= 10 && digits.length <= 13 && /^[0-9+()\s-]+$/.test(part)) {
      row.phone = part;
      continue;
    }
    const tradeHit = TRADES.find((t) => t.toLowerCase() === part.toLowerCase())
      || TRADES.find((t) => part.toLowerCase().includes(t.toLowerCase().split("/")[0]));
    if (!row.trade && tradeHit) { row.trade = tradeHit; continue; }
    const accHit = ACCREDITATIONS.filter((a) => part.toLowerCase().includes(a.toLowerCase()));
    if (accHit.length) { row.accreditations.push(...accHit); continue; }
    leftovers.push(part);
  }

  row.name = leftovers.shift() || "";
  row.coverage_area = leftovers.join(", ");

  // Infer the trade from the business name when it wasn't its own column —
  // "Kent Gas & Heat" is obviously a heating firm.
  if (!row.trade) {
    const hay = `${row.name} ${row.coverage_area}`.toLowerCase();
    if (/gas|boiler|heat/.test(hay)) row.trade = "Heating/Gas";
    else if (/electric|spark/.test(hay)) row.trade = "Electrical";
    else if (/plumb|drain/.test(hay)) row.trade = "Plumbing";
    else if (/clean/.test(hay)) row.trade = "Cleaning";
    else if (/roof/.test(hay)) row.trade = "Roofing";
    else if (/lock/.test(hay)) row.trade = "Locksmith";
    else if (/pest/.test(hay)) row.trade = "Pest control";
    else row.trade = "General";
  }
  // Gas and electrical work legally needs the accreditation — assume it for
  // an existing regular, and let the landlord correct it on the card.
  if (!row.accreditations.length) {
    if (row.trade === "Heating/Gas") row.accreditations = ["Gas Safe"];
    else if (row.trade === "Electrical") row.accreditations = ["NICEIC"];
  }
  row.accreditations = [...new Set(row.accreditations)];
  return row.name ? row : null;
}

const SAMPLE = `Kent Gas & Heat, Heating/Gas, 07700 900111, info@kentgas.co.uk, Tunbridge Wells TN
Bright Spark Electrical, Electrical, 07700 900222, NICEIC, TN + TN4
Sparkle Cleaning, Cleaning, 07700 900333, Tunbridge Wells`;

export default function ImportContractorsModal({ open, onClose, onImported }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [preferred, setPreferred] = useState(true);

  const rows = useMemo(
    () => text.split("\n").map((l) => l.trim()).filter(Boolean).map(parseLine).filter(Boolean),
    [text],
  );
  const noPhone = rows.filter((r) => !r.phone).length;

  const importAll = async () => {
    if (rows.length === 0) return;
    setBusy(true);
    try {
      let created = 0;
      for (const r of rows) {
        await base44.entities.Contractor.create({
          name: r.name,
          trade: r.trade,
          phone: r.phone || undefined,
          email: r.email || undefined,
          coverage_area: r.coverage_area || undefined,
          accreditations: r.accreditations,
          availability: "Available",
          preferred,
        });
        created++;
      }
      toast.success(`${created} contractor${created === 1 ? "" : "s"} added`);
      setText("");
      onImported?.();
      onClose();
    } catch (e) {
      toast.error(`Import failed: ${e?.message || "unknown error"}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Import your contractors</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Paste one contractor per line — from a spreadsheet, your notes app, anywhere.
            Name, trade, phone, email and area in any order; we work out the rest.
          </p>
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={7}
            placeholder={SAMPLE}
            className="text-sm font-mono"
          />
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={preferred}
              onChange={(e) => setPreferred(e.target.checked)}
              className="rounded border-border"
            />
            Mark these as preferred — they'll be ranked first when a job comes in
          </label>

          {rows.length > 0 && (
            <div className="rounded-xl border divide-y divide-border max-h-56 overflow-y-auto">
              {rows.map((r, i) => (
                <div key={i} className="flex items-center gap-2.5 px-3 py-2">
                  <HardHat className="w-4 h-4 text-orange-500 shrink-0" />
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm font-medium truncate">{r.name}</span>
                    <span className="block text-xs text-muted-foreground truncate">
                      {r.trade}
                      {r.accreditations.length ? ` · ${r.accreditations.join(", ")}` : ""}
                      {r.phone ? ` · ${r.phone}` : ""}
                      {r.coverage_area ? ` · ${r.coverage_area}` : ""}
                    </span>
                  </span>
                  <Check className={cn("w-4 h-4 shrink-0", r.phone ? "text-emerald-500" : "text-muted-foreground/40")} />
                </div>
              ))}
            </div>
          )}

          {noPhone > 0 && (
            <p className="text-xs text-amber-600 dark:text-amber-400 flex items-start gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              {noPhone} without a phone number — they'll import, but the app can't send them jobs on
              WhatsApp until you add one.
            </p>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button onClick={importAll} disabled={busy || rows.length === 0}>
              {busy ? "Importing…" : `Import ${rows.length || ""}`.trim()}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
