"use client";

import { useState, useRef, useMemo, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, Trash2, Search, CheckCircle2, XCircle, Save, FileDown, X, Bot, AlertTriangle } from "lucide-react";
import AddToDbModal from "@/components/deal/AddToDbModal";
import EvaChat from "@/components/deal/EvaChat";
import { calculateIngredientCost } from "@/domains/pricing/pricing.engine";
import { DOSAGE_FORM_MFG, PKG_PRESETS, DEFAULT_TIERS, type MfgDefaults, type PackagingCosts } from "@/domains/pricing/pricing.types";

// ─── Types ──────────────────────────────────────────────────────────────

interface FormulaLine {
  key: string; name: string; rmId: string; labelClaimMg: string;
  activeContentPct: string; overagePct: string; wastagePct: string;
  costPerKg: string; supplier: string; isEstimated: boolean;
  isExcipient: boolean; inDb: boolean; dbId: string | null;
  qtyToSource: string; freight: string;
  aiCategory?: string; aiUnit?: string; notes?: string;
}

let _ctr = 0;
const key = () => "fl-" + ++_ctr;
const emptyLine = (excipient = false): FormulaLine => ({
  key: key(), name: "", rmId: "", labelClaimMg: "", activeContentPct: excipient ? "100" : "100",
  overagePct: excipient ? "0" : "5", wastagePct: "3", costPerKg: "",
  supplier: "", isEstimated: false, isExcipient: excipient, inDb: false, dbId: null,
  qtyToSource: "", freight: "",
});

const fmtUsd = (n: number) => "$" + n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// ─── Main ───────────────────────────────────────────────────────────────

export default function QuoteWorkspace() {
  const router = useRouter();

  const [rfqId] = useState(() => `RFQ-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 999) + 1).padStart(3, "0")}`);
  const [dealId, setDealId] = useState<string | null>(null);

  // Header
  const [projectName, setProjectName] = useState("");
  const [customerCompany, setCustomerCompany] = useState("");
  const [dosageForm, setDosageForm] = useState("tablet");
  const [count, setCount] = useState("60");
  const [bottles, setBottles] = useState("5000");

  const countNum = parseInt(count) || 60;
  const bottlesNum = parseInt(bottles) || 5000;
  const totalQty = countNum * bottlesNum;
  const formLabel = dosageForm === "capsule" ? "Capsules" : dosageForm === "tablet" ? "Tablets" : "Units";

  // Lines
  const [lines, setLines] = useState<FormulaLine[]>([emptyLine(false)]);

  // Cost settings
  const [processFee, setProcessFee] = useState("9.00");
  const [packagingCost, setPackagingCost] = useState("1.00");
  const [wastageCost, setWastageCost] = useState("0.00");
  const [labCost, setLabCost] = useState("500");
  const [overheadPct, setOverheadPct] = useState("25");

  // UI
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showEva, setShowEva] = useState(false);
  const [searchIdx, setSearchIdx] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [addToDbModal, setAddToDbModal] = useState<{ line: FormulaLine; idx: number } | null>(null);
  const searchTimeout = useRef<NodeJS.Timeout | null>(null);
  const [extractionFileName, setExtractionFileName] = useState("");

  // Load extraction
  useEffect(() => {
    const pending = sessionStorage.getItem("pendingExtraction");
    if (!pending) return;
    sessionStorage.removeItem("pendingExtraction");
    try {
      const { extracted: ext, matchedIngredients, matchedExcipients, fileName } = JSON.parse(pending);
      const form = (ext.dosageForm || "tablet").toLowerCase();
      if (ext.productName) setProjectName(ext.productName);
      if (form) setDosageForm(form);
      if (ext.servingsPerContainer) setCount(String(ext.servingsPerContainer));
      if (fileName) setExtractionFileName(fileName);

      const newLines: FormulaLine[] = [];
      for (const mi of matchedIngredients || []) {
        const db = mi.dbMatch;
        const ov = db ? (form === "capsule" ? (db.overageCapsule ?? db.baseOveragePct) : (db.overageTablet ?? db.baseOveragePct)) : null;
        newLines.push({ key: key(), name: db?.name || mi.name, rmId: db?.rmId || "", labelClaimMg: String(mi.amount || ""), activeContentPct: String(db?.activeContentPct ?? "100"), overagePct: String(ov ?? "5"), wastagePct: "3", costPerKg: String(db?.costPerKg ?? ""), supplier: db?.supplierName || "", isEstimated: db?.isEstimatedPrice ?? true, isExcipient: false, inDb: !!db, dbId: db?.id || null, qtyToSource: "", freight: "", aiCategory: mi.notes ? "Probiotics" : "Specialty", aiUnit: mi.unit, notes: mi.notes || undefined });
      }
      for (const me of matchedExcipients || []) {
        const db = me.dbMatch;
        newLines.push({ key: key(), name: db?.name || me.name, rmId: db?.rmId || "", labelClaimMg: "", activeContentPct: String(db?.activeContentPct ?? "100"), overagePct: "0", wastagePct: "3", costPerKg: String(db?.costPerKg ?? ""), supplier: db?.supplierName || "", isEstimated: db?.isEstimatedPrice ?? true, isExcipient: true, inDb: !!db, dbId: db?.id || null, qtyToSource: "", freight: "" });
      }
      if (newLines.length > 0) setLines(newLines);
    } catch {}
  }, []);

  // Search
  const doSearch = useCallback((q: string) => {
    setSearchQuery(q);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    if (q.length < 2) { setSearchResults([]); return; }
    searchTimeout.current = setTimeout(async () => {
      try { const r = await fetch(`/api/ingredients/search?q=${encodeURIComponent(q)}`); setSearchResults(await r.json()); } catch { setSearchResults([]); }
    }, 200);
  }, []);

  const selectIngredient = (idx: number, ing: any) => {
    const ov = dosageForm === "capsule" ? ing.overageCapsule : ing.overageTablet;
    const nl = [...lines];
    nl[idx] = { ...nl[idx], name: ing.name, rmId: ing.rmId, activeContentPct: String(ing.activeContentPct ?? "100"), overagePct: String(ov || ing.baseOveragePct || "5"), wastagePct: String(ing.baseWastagePct || "3"), costPerKg: String(ing.costPerKg ?? ""), supplier: ing.supplierName || "", isEstimated: ing.isEstimatedPrice, inDb: true, dbId: ing.id };
    setLines(nl); setSearchIdx(null); setSearchResults([]); setSearchQuery("");
  };

  const updateLine = (idx: number, field: keyof FormulaLine, value: string) => {
    const nl = [...lines]; nl[idx] = { ...nl[idx], [field]: value }; setLines(nl);
  };
  const removeLine = (idx: number) => { if (lines.length <= 1) return; setLines(lines.filter((_, i) => i !== idx)); };

  // Calculations
  const lineCalcs = useMemo(() => lines.map((l) => {
    const mg = parseFloat(l.labelClaimMg) || 0;
    const assay = parseFloat(l.activeContentPct) || 100;
    const ov = parseFloat(l.overagePct) || 0;
    const cost = parseFloat(l.costPerKg) || 0;
    const totalMg = assay > 0 ? (mg / (assay / 100)) * (1 + ov / 100) : mg;
    const batchKg = totalMg * totalQty / 1_000_000;
    const moqCost = batchKg * cost;
    return { totalMg, batchKg, moqCost };
  }), [lines, totalQty]);

  const totals = useMemo(() => {
    let mg = 0, totalMg = 0, batchKg = 0, moqCost = 0;
    lines.forEach((l, i) => { mg += parseFloat(l.labelClaimMg) || 0; totalMg += lineCalcs[i].totalMg; batchKg += lineCalcs[i].batchKg; moqCost += lineCalcs[i].moqCost; });
    return { mg, totalMg, batchKg, moqCost };
  }, [lines, lineCalcs]);

  const cost = useMemo(() => {
    const rm = totals.moqCost;
    const pf = parseFloat(processFee) || 0;
    const total = rm + pf * bottlesNum;
    const perUnit = bottlesNum > 0 ? total / bottlesNum : 0;
    const pkg = parseFloat(packagingCost) || 0;
    const waste = parseFloat(wastageCost) || 0;
    const lab = bottlesNum > 0 ? (parseFloat(labCost) || 0) / bottlesNum : 0;
    const price = perUnit + pkg + waste + lab;
    const oh = price * ((parseFloat(overheadPct) || 0) / 100);
    const final_ = price + oh;
    return { rm, pf, total, perUnit, pkg, waste, lab, price, oh, final: final_ };
  }, [totals, processFee, packagingCost, wastageCost, labCost, overheadPct, bottlesNum]);

  const hasEstimated = lines.some((l) => l.isEstimated && l.name.trim());
  const unmatchedCount = lines.filter((l) => !l.inDb && l.name.trim()).length;

  // Save
  const save = async () => {
    setSaving(true);
    try {
      const body = { rfqNumber: rfqId, customerCompany, productName: projectName, dosageForm, servingSize: "1", servingSizeUnit: dosageForm, servingsPerContainer: count, countPerBottle: count, status: "Quoted", formulaJson: lines.filter((l) => l.name.trim()) };
      if (dealId) { await fetch(`/api/deals/${dealId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }); }
      else { const res = await fetch("/api/deals", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }); const d = await res.json(); if (d.success) setDealId(d.deal.id); }
      setSaved(true); setTimeout(() => setSaved(false), 3000);
    } finally { setSaving(false); }
  };

  const handleAddToDb = (ni: any) => {
    if (!addToDbModal) return;
    const nl = [...lines];
    nl[addToDbModal.idx] = { ...nl[addToDbModal.idx], name: ni.name, rmId: ni.rmId, costPerKg: ni.costPerKg || "", activeContentPct: ni.activeContentPct || "100", supplier: ni.supplierName || "Unknown", isEstimated: true, inDb: true, dbId: ni.id };
    setLines(nl); setAddToDbModal(null);
  };

  // ─── Render ─────────────────────────────────────────────────────────

  return (
    <div className="flex gap-5 max-w-[1600px] mx-auto pb-16">
      {/* ═══ LEFT — Costing Sheet ═══ */}
      <div className="flex-1 min-w-0">

        {/* Header Bar */}
        <div className="bg-[#1a1a2e] text-white rounded-t-xl px-5 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <span className="font-mono text-xs font-bold text-white/60">{rfqId}</span>
            {extractionFileName && <span className="text-[10px] text-white/40 bg-white/10 px-2 py-0.5 rounded">from {extractionFileName}</span>}
          </div>
          <div className="flex items-center gap-3">
            {unmatchedCount > 0 && <span className="text-[10px] bg-red-500/20 text-red-300 px-2 py-0.5 rounded-full font-medium flex items-center gap-1"><AlertTriangle className="h-3 w-3" /> {unmatchedCount} unmatched</span>}
            {hasEstimated && <span className="text-[10px] bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded-full font-medium">Estimated prices</span>}
          </div>
        </div>

        {/* Product Info */}
        <div className="bg-white border-x border-gray-200 px-5 py-3">
          <div className="grid grid-cols-6 gap-x-4 gap-y-2">
            <div className="col-span-2">
              <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Product</label>
              <input value={projectName} onChange={(e) => setProjectName(e.target.value)} className="w-full text-base font-bold text-gray-900 bg-transparent border-b border-transparent hover:border-gray-300 focus:border-[#d10a11] focus:outline-none py-0.5 transition-colors" placeholder="Bariatric Probiotic" />
            </div>
            <div>
              <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Customer</label>
              <input value={customerCompany} onChange={(e) => setCustomerCompany(e.target.value)} className="w-full text-sm text-gray-900 bg-transparent border-b border-transparent hover:border-gray-300 focus:border-[#d10a11] focus:outline-none py-0.5 transition-colors" placeholder="BioSchwartz LLC" />
            </div>
            <div>
              <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Format</label>
              <select value={dosageForm} onChange={(e) => setDosageForm(e.target.value)} className="w-full text-sm text-gray-900 bg-transparent border-b border-transparent hover:border-gray-300 focus:border-[#d10a11] focus:outline-none py-0.5">
                <option value="tablet">Tablet</option><option value="capsule">Capsule</option><option value="powder">Powder</option><option value="softgel">Softgel</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Count</label>
              <input type="number" value={count} onChange={(e) => setCount(e.target.value)} className="w-full text-sm font-semibold text-[#d10a11] bg-transparent border-b border-transparent hover:border-gray-300 focus:border-[#d10a11] focus:outline-none py-0.5 transition-colors" />
            </div>
            <div>
              <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Bottles</label>
              <div className="flex items-baseline gap-2">
                <input type="number" value={bottles} onChange={(e) => setBottles(e.target.value)} className="w-20 text-sm font-semibold text-gray-900 bg-transparent border-b border-transparent hover:border-gray-300 focus:border-[#d10a11] focus:outline-none py-0.5 transition-colors" />
                <span className="text-[10px] text-gray-400">= {totalQty.toLocaleString()} {formLabel.toLowerCase()}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Ingredient Table */}
        <div className="bg-white border border-gray-200 rounded-b-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse min-w-[900px]">
              <thead>
                <tr className="bg-gray-50 text-[10px] text-gray-500 font-semibold uppercase tracking-wider border-b border-gray-200">
                  <th className="text-left pl-4 pr-2 py-2.5 min-w-[240px]">Ingredient</th>
                  <th className="text-right px-2 py-2.5 w-20">Mg / Dose</th>
                  <th className="text-right px-2 py-2.5 w-16">Assay %</th>
                  <th className="text-right px-2 py-2.5 w-16">Overage %</th>
                  <th className="text-right px-2 py-2.5 w-24 bg-blue-50/50">Total Mg</th>
                  <th className="text-right px-2 py-2.5 w-24 bg-blue-50/50">Batch (Kg)</th>
                  <th className="text-right px-2 py-2.5 w-20">$/Kg</th>
                  <th className="text-left px-2 py-2.5 w-28">Vendor</th>
                  <th className="text-right px-2 py-2.5 w-24 bg-green-50/50">Cost ($)</th>
                  <th className="w-8 px-1"></th>
                </tr>
              </thead>
              <tbody>
                {lines.map((l, i) => {
                  const c = lineCalcs[i];
                  const isSearching = searchIdx === i;
                  const notInDb = !l.inDb && l.name.trim().length > 0;

                  return (
                    <tr key={l.key} className={`border-b border-gray-100 group ${
                      notInDb ? "bg-red-50/60" : l.isExcipient ? "bg-gray-50/40" : "bg-white"
                    } hover:bg-blue-50/20 transition-colors`}>
                      {/* Ingredient */}
                      <td className="pl-4 pr-2 py-1.5 relative">
                        {isSearching ? (
                          <div className="relative">
                            <input autoFocus value={searchQuery} onChange={(e) => doSearch(e.target.value)}
                              onBlur={() => setTimeout(() => { setSearchIdx(null); setSearchResults([]); }, 200)}
                              className="w-full border border-blue-400 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200" placeholder="Search ingredients..." />
                            {searchResults.length > 0 && (
                              <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-2xl max-h-56 overflow-y-auto">
                                {searchResults.map((r: any) => (
                                  <button key={r.id} onMouseDown={() => selectIngredient(i, r)}
                                    className="w-full text-left px-4 py-2.5 hover:bg-blue-50 text-sm border-b border-gray-50 transition-colors">
                                    <div className="flex justify-between items-center">
                                      <span className="font-semibold text-gray-900">{r.name}</span>
                                      <span className="font-mono text-xs text-gray-400">${r.costPerKg}/kg</span>
                                    </div>
                                    <div className="text-xs text-gray-400 mt-0.5">{r.rmId} &middot; Active {r.activeContentPct}% &middot; {r.supplierName || "—"}</div>
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            {l.inDb && l.name.trim() ? <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0" /> : notInDb ? <XCircle className="h-3.5 w-3.5 text-red-400 shrink-0" /> : null}
                            <button onClick={() => { setSearchIdx(i); setSearchQuery(l.name); if (l.name.length >= 2) doSearch(l.name); }}
                              className="text-left text-sm text-gray-900 font-medium hover:text-[#d10a11] truncate flex-1 transition-colors">
                              {l.name || <span className="text-gray-400 font-normal">Click to search...</span>}
                            </button>
                            {l.isExcipient && l.name.trim() && <span className="text-[8px] bg-gray-200 text-gray-500 px-1.5 py-0.5 rounded font-semibold shrink-0">EXC</span>}
                            {notInDb && <button onClick={() => setAddToDbModal({ line: l, idx: i })} className="px-2 py-0.5 bg-red-500 text-white text-[9px] font-bold rounded-md hover:bg-red-600 shrink-0 transition-colors">+ Add to DB</button>}
                          </div>
                        )}
                      </td>
                      {/* Mg/Dose */}
                      <td className="px-1 py-1"><CellInput value={l.labelClaimMg} onChange={(v) => updateLine(i, "labelClaimMg", v)} placeholder="0" align="right" /></td>
                      {/* Assay */}
                      <td className="px-1 py-1"><CellInput value={l.activeContentPct} onChange={(v) => updateLine(i, "activeContentPct", v)} placeholder="100" align="right" /></td>
                      {/* Overage */}
                      <td className="px-1 py-1"><CellInput value={l.overagePct} onChange={(v) => updateLine(i, "overagePct", v)} placeholder="0" align="right" /></td>
                      {/* Total Mg (calc) */}
                      <td className="px-2 py-1.5 text-right font-mono text-sm text-gray-700 bg-blue-50/30">
                        {c.totalMg > 0 ? c.totalMg.toFixed(2) : <span className="text-gray-300">—</span>}
                      </td>
                      {/* Batch Kg (calc) */}
                      <td className="px-2 py-1.5 text-right font-mono text-sm text-gray-700 bg-blue-50/30">
                        {c.batchKg > 0 ? c.batchKg.toFixed(3) : <span className="text-gray-300">—</span>}
                      </td>
                      {/* $/Kg */}
                      <td className="px-1 py-1"><CellInput value={l.costPerKg} onChange={(v) => updateLine(i, "costPerKg", v)} placeholder="0" align="right" mono /></td>
                      {/* Vendor */}
                      <td className="px-2 py-1.5 text-xs text-gray-600 truncate max-w-[112px]" title={l.supplier}>{l.supplier || <span className="text-gray-300">—</span>}</td>
                      {/* Cost (calc) */}
                      <td className="px-2 py-1.5 text-right font-mono text-sm font-semibold text-gray-900 bg-green-50/30">
                        {c.moqCost > 0 ? fmtUsd(c.moqCost) : <span className="text-gray-300">—</span>}
                      </td>
                      {/* Delete */}
                      <td className="px-1 py-1.5 text-center">
                        <button onClick={() => removeLine(i)} className="text-gray-200 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 className="h-3.5 w-3.5" /></button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              {/* Totals */}
              <tfoot>
                <tr className="bg-[#1a1a2e] text-white text-sm font-semibold">
                  <td className="pl-4 pr-2 py-2.5 text-right">Totals</td>
                  <td className="px-2 py-2.5 text-right font-mono">{totals.mg.toFixed(1)}</td>
                  <td colSpan={2}></td>
                  <td className="px-2 py-2.5 text-right font-mono">{totals.totalMg.toFixed(0)}mg</td>
                  <td className="px-2 py-2.5 text-right font-mono">{totals.batchKg.toFixed(3)}Kg</td>
                  <td colSpan={2}></td>
                  <td className="px-2 py-2.5 text-right font-mono text-yellow-300">{fmtUsd(totals.moqCost)}</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
          {/* Add buttons */}
          <div className="flex gap-3 px-4 py-2.5 bg-gray-50/80 border-t border-gray-100">
            <button onClick={() => setLines([...lines, emptyLine(false)])} className="text-xs text-[#d10a11] font-semibold hover:underline flex items-center gap-1"><Plus className="h-3.5 w-3.5" /> Add Ingredient</button>
            <button onClick={() => setLines([...lines, emptyLine(true)])} className="text-xs text-gray-500 font-medium hover:underline flex items-center gap-1"><Plus className="h-3.5 w-3.5" /> Add Excipient</button>
          </div>
        </div>
      </div>

      {/* ═══ RIGHT — Sticky Cost Panel ═══ */}
      <div className="w-80 shrink-0 hidden xl:block">
        <div className="sticky top-5 space-y-4">
          {/* Cost Breakdown */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
            <div className="bg-[#1a1a2e] text-white px-4 py-2.5">
              <h3 className="text-[10px] font-semibold uppercase tracking-wider text-white/60">Cost Breakdown</h3>
            </div>
            <div className="divide-y divide-gray-100">
              <SummaryRow label="RM Cost / Batch" value={cost.rm} />
              <SummaryRow label="Process Fee / Unit" value={cost.pf} editable editValue={processFee} onEdit={setProcessFee} />
              <SummaryRow label="Total / Batch" value={cost.total} bold />
              <SummaryRow label={`Per Unit (${count}ct)`} value={cost.perUnit} bold highlight />
              <SummaryRow label="Packaging" value={cost.pkg} editable editValue={packagingCost} onEdit={setPackagingCost} />
              <SummaryRow label="Wastage" value={cost.waste} editable editValue={wastageCost} onEdit={setWastageCost} />
              <SummaryRow label="Lab Cost" value={cost.lab} sub={`${fmtUsd(parseFloat(labCost) || 0)} / batch`} editable editValue={labCost} onEdit={setLabCost} />
              <SummaryRow label="Subtotal" value={cost.price} bold />
              <SummaryRow label={`Overhead (${overheadPct}%)`} value={cost.oh} editable editValue={overheadPct} onEdit={setOverheadPct} suffix="%" />
            </div>
            {/* Final Price */}
            <div className="bg-[#d10a11] text-white px-4 py-3 flex items-center justify-between">
              <span className="font-semibold text-sm">Final Price / Unit</span>
              <span className="font-mono font-bold text-xl">{fmtUsd(cost.final)}</span>
            </div>
            <div className="px-4 py-2 bg-gray-50 text-xs text-gray-500 flex justify-between">
              <span>{bottlesNum.toLocaleString()} units</span>
              <span className="font-semibold text-gray-800">Batch: {fmtUsd(cost.final * bottlesNum)}</span>
            </div>
          </div>

          {/* Tiered Pricing */}
          {cost.final > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
              <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-100">
                <h3 className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">Quick Tiers</h3>
              </div>
              <div className="divide-y divide-gray-100">
                {[{ qty: 2000, margin: 40 }, { qty: 5000, margin: 35 }, { qty: 10000, margin: 30 }].map((t, i) => {
                  const tierPrice = cost.final / (1 - t.margin / 100);
                  return (
                    <div key={t.qty} className={`px-4 py-2.5 flex items-center justify-between ${i === 1 ? "bg-red-50/30 border-l-2 border-l-[#d10a11]" : ""}`}>
                      <div>
                        <span className="text-sm font-bold text-gray-900">{t.qty.toLocaleString()}</span>
                        <span className="text-[10px] text-gray-400 ml-1.5">{t.margin}%</span>
                        {i === 1 && <span className="text-[8px] bg-[#d10a11] text-white px-1.5 py-0.5 rounded font-bold ml-2">BEST</span>}
                      </div>
                      <span className="font-mono font-bold text-sm">{fmtUsd(tierPrice)}<span className="text-gray-400 font-normal">/unit</span></span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="space-y-2">
            <button onClick={save} disabled={saving} className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-[#d10a11] text-white font-semibold rounded-xl hover:bg-[#a30a0f] disabled:opacity-50 text-sm shadow-sm transition-colors">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : saved ? <CheckCircle2 className="h-4 w-4" /> : <Save className="h-4 w-4" />}
              {saving ? "Saving..." : saved ? "Saved!" : "Save Quote"}
            </button>
            {dealId && <a href={`/api/quotes/${dealId}/pdf`} target="_blank" className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-gray-900 text-white font-medium rounded-xl hover:bg-gray-800 text-sm transition-colors"><FileDown className="h-4 w-4" /> Download PDF</a>}
          </div>
        </div>
      </div>

      {/* Eva FAB */}
      <button onClick={() => setShowEva(!showEva)} className={`fixed bottom-6 right-6 z-50 p-3.5 rounded-full shadow-lg transition-colors ${showEva ? "bg-gray-800 text-white" : "bg-[#d10a11] text-white hover:bg-[#a30a0f]"}`}>
        {showEva ? <X className="h-5 w-5" /> : <Bot className="h-5 w-5" />}
      </button>
      {showEva && (
        <div className="fixed bottom-20 right-6 z-50 w-[400px]">
          <EvaChat context={{ productName: projectName, dosageForm, servingSize: "1", servingsPerContainer: count, moq: bottles, bulkOrPackaged: "packaged",
            ingredientNames: lines.filter((l) => l.name.trim()).map((l) => l.name),
            activeIngredients: lines.filter((l) => l.name.trim() && !l.isExcipient).map((l) => ({ name: l.name, amount: parseFloat(l.labelClaimMg) || 0, unit: "mg", notes: l.notes, inDb: l.inDb })),
            excipients: lines.filter((l) => l.name.trim() && l.isExcipient).map((l) => l.name) }} />
        </div>
      )}

      {addToDbModal && <AddToDbModal ingredientName={addToDbModal.line.name} suggestedCategory={addToDbModal.line.aiCategory} onSave={handleAddToDb} onClose={() => setAddToDbModal(null)} />}
    </div>
  );
}

// ─── Reusable Components ────────────────────────────────────────────────

function CellInput({ value, onChange, placeholder, align, mono }: { value: string; onChange: (v: string) => void; placeholder?: string; align?: "right" | "left"; mono?: boolean }) {
  return (
    <input type="number" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
      className={`w-full text-sm bg-transparent border border-transparent rounded px-2 py-1 hover:border-gray-300 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-200 transition-all ${align === "right" ? "text-right" : ""} ${mono ? "font-mono" : ""}`} />
  );
}

function SummaryRow({ label, value, bold, highlight, editable, editValue, onEdit, sub, suffix }: {
  label: string; value: number; bold?: boolean; highlight?: boolean; editable?: boolean; editValue?: string; onEdit?: (v: string) => void; sub?: string; suffix?: string;
}) {
  return (
    <div className={`px-4 py-2 flex items-center justify-between ${bold ? "bg-gray-50 font-semibold" : ""} ${highlight ? "bg-blue-50/50" : ""}`}>
      <div>
        <span className={`text-sm ${bold ? "text-gray-900" : "text-gray-600"}`}>{label}</span>
        {sub && <span className="block text-[10px] text-gray-400">{sub}</span>}
      </div>
      {editable && onEdit ? (
        <div className="flex items-center gap-0.5">
          <input type="number" value={editValue} onChange={(e) => onEdit(e.target.value)}
            className="w-20 text-right text-sm font-mono bg-transparent border-b border-gray-300 focus:border-[#d10a11] focus:outline-none py-0.5" />
          {suffix && <span className="text-xs text-gray-400">{suffix}</span>}
        </div>
      ) : (
        <span className={`font-mono text-sm ${bold ? "font-bold text-gray-900" : "text-gray-700"}`}>{fmtUsd(value)}</span>
      )}
    </div>
  );
}
