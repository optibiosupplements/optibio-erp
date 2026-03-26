"use client";

import { useState, useRef, useMemo, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, Trash2, Search, CheckCircle2, XCircle, Save, FileDown, X, Bot } from "lucide-react";
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

const fmt = (n: number, d = 2) => n === 0 ? "0.00" : n.toFixed(d);
const fmtUsd = (n: number) => "$" + n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// ─── Main Component ─────────────────────────────────────────────────────

export default function QuoteWorkspace() {
  const router = useRouter();

  // IDs
  const [rfqId] = useState(() => {
    const seq = String(Math.floor(Math.random() * 999) + 1).padStart(3, "0");
    return `RFQ-${new Date().getFullYear()}-${seq}`;
  });
  const [npefCode, setNpefCode] = useState("");
  const [dealId, setDealId] = useState<string | null>(null);

  // Header
  const [projectName, setProjectName] = useState("");
  const [salesRep, setSalesRep] = useState("");
  const [dosageForm, setDosageForm] = useState("tablet");
  const [servingSize, setServingSize] = useState("1");
  const [count, setCount] = useState("60");
  const [bottles, setBottles] = useState("5000");
  const [customerCompany, setCustomerCompany] = useState("");

  // Derived
  const countNum = parseInt(count) || 60;
  const bottlesNum = parseInt(bottles) || 5000;
  const totalQty = countNum * bottlesNum;
  const servingSizeNum = parseInt(servingSize) || 1;

  // Lines (all ingredients in one table, like the spreadsheet)
  const [lines, setLines] = useState<FormulaLine[]>([emptyLine(false)]);

  // Cost settings
  const [processFee, setProcessFee] = useState("9.00");
  const [packagingCost, setPackagingCost] = useState("1.00");
  const [wastageCost, setWastageCost] = useState("0.00");
  const [labCost, setLabCost] = useState("500");
  const [overheadPct, setOverheadPct] = useState("25");
  const [freightPerBottle, setFreightPerBottle] = useState("0");

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

  // Load pending extraction
  useEffect(() => {
    const pending = sessionStorage.getItem("pendingExtraction");
    if (!pending) return;
    sessionStorage.removeItem("pendingExtraction");
    try {
      const { extracted: ext, matchedIngredients, matchedExcipients, fileName } = JSON.parse(pending);
      const form = (ext.dosageForm || "tablet").toLowerCase();
      if (ext.productName) setProjectName(ext.productName);
      if (form) setDosageForm(form);
      if (ext.servingSize) setServingSize(String(ext.servingSize));
      if (ext.servingsPerContainer) setCount(String(ext.servingsPerContainer));
      if (fileName) setExtractionFileName(fileName);
      if (ext.customerName) setCustomerCompany(ext.customerName);

      const newLines: FormulaLine[] = [];
      for (const mi of matchedIngredients || []) {
        const db = mi.dbMatch;
        const ov = db ? (form === "capsule" ? (db.overageCapsule ?? db.baseOveragePct) : (db.overageTablet ?? db.baseOveragePct)) : null;
        newLines.push({
          key: key(), name: db?.name || mi.name, rmId: db?.rmId || "",
          labelClaimMg: String(mi.amount || ""), activeContentPct: String(db?.activeContentPct ?? "100"),
          overagePct: String(ov ?? "5"), wastagePct: "3",
          costPerKg: String(db?.costPerKg ?? ""), supplier: db?.supplierName || "",
          isEstimated: db?.isEstimatedPrice ?? true, isExcipient: false, inDb: !!db, dbId: db?.id || null,
          qtyToSource: "", freight: "",
          aiCategory: mi.notes ? "Probiotics" : "Specialty", aiUnit: mi.unit, notes: mi.notes || undefined,
        });
      }
      for (const me of matchedExcipients || []) {
        const db = me.dbMatch;
        newLines.push({
          key: key(), name: db?.name || me.name, rmId: db?.rmId || "",
          labelClaimMg: "", activeContentPct: String(db?.activeContentPct ?? "100"),
          overagePct: "0", wastagePct: "3",
          costPerKg: String(db?.costPerKg ?? ""), supplier: db?.supplierName || "",
          isEstimated: db?.isEstimatedPrice ?? true, isExcipient: true, inDb: !!db, dbId: db?.id || null,
          qtyToSource: "", freight: "",
        });
      }
      if (newLines.length > 0) setLines(newLines);
    } catch {}
  }, []);

  // ─── Search ──────────────────────────────────────────────────────────

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
    const updated: FormulaLine = {
      ...lines[idx], name: ing.name, rmId: ing.rmId,
      activeContentPct: String(ing.activeContentPct ?? "100"),
      overagePct: String(ov || ing.baseOveragePct || "5"),
      wastagePct: String(ing.baseWastagePct || "3"),
      costPerKg: String(ing.costPerKg ?? ""), supplier: ing.supplierName || "",
      isEstimated: ing.isEstimatedPrice, inDb: true, dbId: ing.id,
    };
    const nl = [...lines]; nl[idx] = updated; setLines(nl);
    setSearchIdx(null); setSearchResults([]); setSearchQuery("");
  };

  const updateLine = (idx: number, field: keyof FormulaLine, value: string) => {
    const nl = [...lines]; nl[idx] = { ...nl[idx], [field]: value }; setLines(nl);
  };

  const removeLine = (idx: number) => { if (lines.length <= 1) return; setLines(lines.filter((_, i) => i !== idx)); };

  // ─── Calculations (per-line) ──────────────────────────────────────────

  const lineCalcs = useMemo(() => {
    return lines.map((l) => {
      const mgDosage = parseFloat(l.labelClaimMg) || 0;
      const assay = parseFloat(l.activeContentPct) || 100;
      const ovPct = parseFloat(l.overagePct) || 0;
      const costKg = parseFloat(l.costPerKg) || 0;

      // Total mg per dosage = (mg / (assay/100)) * (1 + overage/100)
      const totalMgPerDosage = assay > 0 ? (mgDosage / (assay / 100)) * (1 + ovPct / 100) : mgDosage;
      // Total qty for batch (Kg) = totalMgPerDosage * totalQty / 1,000,000
      const batchKg = totalMgPerDosage * totalQty / 1_000_000;
      // MOQ Cost = batchKg * costPerKg
      const moqCost = batchKg * costKg;

      return { totalMgPerDosage, batchKg, moqCost };
    });
  }, [lines, totalQty]);

  // Totals
  const totals = useMemo(() => {
    let sumMgDosage = 0, sumTotalMg = 0, sumBatchKg = 0, sumMoqCost = 0;
    lines.forEach((l, i) => {
      sumMgDosage += parseFloat(l.labelClaimMg) || 0;
      sumTotalMg += lineCalcs[i].totalMgPerDosage;
      sumBatchKg += lineCalcs[i].batchKg;
      sumMoqCost += lineCalcs[i].moqCost;
    });
    return { sumMgDosage, sumTotalMg, sumBatchKg, sumMoqCost };
  }, [lines, lineCalcs]);

  // Cost summary
  const costSummary = useMemo(() => {
    const rmPerBatch = totals.sumMoqCost;
    const rmPerBottle = bottlesNum > 0 ? rmPerBatch / bottlesNum : 0;
    const pFee = parseFloat(processFee) || 0;
    const totalCostPerBatch = rmPerBatch + (pFee * bottlesNum);
    const perUnit = bottlesNum > 0 ? totalCostPerBatch / bottlesNum : 0;
    const pkg = parseFloat(packagingCost) || 0;
    const waste = parseFloat(wastageCost) || 0;
    const lab = parseFloat(labCost) || 0;
    const labPerUnit = bottlesNum > 0 ? lab / bottlesNum : 0;
    const price = perUnit + pkg + waste + labPerUnit;
    const ohPct = parseFloat(overheadPct) || 0;
    const overhead = price * (ohPct / 100);
    const finalPrice = price + overhead;
    const freightPB = parseFloat(freightPerBottle) || 0;

    return { rmPerBatch, rmPerBottle, pFee, totalCostPerBatch, perUnit, pkg, waste, lab, labPerUnit, price, ohPct, overhead, finalPrice, freightPB };
  }, [totals, bottles, processFee, packagingCost, wastageCost, labCost, overheadPct, freightPerBottle, bottlesNum]);

  // Save
  const save = async () => {
    setSaving(true);
    try {
      const body = { rfqNumber: rfqId, customerCompany, productName: projectName, dosageForm, servingSize, servingSizeUnit: dosageForm, servingsPerContainer: count, countPerBottle: count, status: "Quoted", formulaJson: lines.filter((l) => l.name.trim()) };
      if (dealId) { await fetch(`/api/deals/${dealId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }); }
      else { const res = await fetch("/api/deals", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }); const d = await res.json(); if (d.success) setDealId(d.deal.id); }
      setSaved(true); setTimeout(() => setSaved(false), 3000);
    } finally { setSaving(false); }
  };

  const handleAddToDb = (ni: any) => {
    if (!addToDbModal) return;
    const { idx } = addToDbModal;
    const nl = [...lines];
    nl[idx] = { ...nl[idx], name: ni.name, rmId: ni.rmId, costPerKg: ni.costPerKg || "", activeContentPct: ni.activeContentPct || "100", supplier: ni.supplierName || "Unknown", isEstimated: true, inDb: true, dbId: ni.id };
    setLines(nl);
    setAddToDbModal(null);
  };

  // ─── Render ─────────────────────────────────────────────────────────

  const formLabel = dosageForm === "capsule" ? "Capsules" : dosageForm === "tablet" ? "Tablets" : "Units";

  return (
    <div className="max-w-[1500px] mx-auto pb-16">
      {/* ═══ HEADER ═══ */}
      <div className="bg-white border border-gray-300 rounded-lg mb-4 overflow-hidden">
        <div className="grid grid-cols-12 text-sm">
          {/* Row 1 */}
          <div className="col-span-2 bg-gray-100 px-3 py-2 font-semibold text-gray-700 border-b border-r border-gray-300">Project Name / Strength:</div>
          <div className="col-span-4 px-2 py-1 border-b border-r border-gray-300">
            <input value={projectName} onChange={(e) => setProjectName(e.target.value)} className="w-full bg-transparent font-semibold text-gray-900 focus:outline-none" placeholder="Bariatric Probiotic" />
          </div>
          <div className="col-span-1 bg-gray-100 px-3 py-2 font-semibold text-gray-700 border-b border-r border-gray-300">Sales:</div>
          <div className="col-span-2 px-2 py-1 border-b border-r border-gray-300">
            <input value={salesRep} onChange={(e) => setSalesRep(e.target.value)} className="w-full bg-transparent text-gray-900 focus:outline-none" placeholder="" />
          </div>
          <div className="col-span-1 bg-gray-100 px-3 py-2 font-semibold text-gray-700 border-b border-r border-gray-300">Customer:</div>
          <div className="col-span-2 px-2 py-1 border-b border-gray-300">
            <input value={customerCompany} onChange={(e) => setCustomerCompany(e.target.value)} className="w-full bg-transparent text-gray-900 focus:outline-none" placeholder="BioSchwartz LLC" />
          </div>

          {/* Row 2 */}
          <div className="col-span-2 bg-gray-100 px-3 py-2 font-semibold text-gray-700 border-b border-r border-gray-300">NPEF Code #:</div>
          <div className="col-span-2 px-2 py-1 border-b border-r border-gray-300">
            <input value={npefCode} onChange={(e) => setNpefCode(e.target.value)} className="w-full bg-transparent text-gray-900 focus:outline-none" placeholder={rfqId} />
          </div>
          <div className="col-span-1 bg-gray-100 px-2 py-2 text-xs font-semibold text-gray-700 border-b border-r border-gray-300">Format:</div>
          <div className="col-span-1 px-1 py-1 border-b border-r border-gray-300">
            <select value={dosageForm} onChange={(e) => setDosageForm(e.target.value)} className="w-full bg-transparent text-sm text-gray-900 focus:outline-none">
              <option value="tablet">Tablets</option><option value="capsule">Capsules</option><option value="powder">Powder</option><option value="softgel">Softgels</option>
            </select>
          </div>
          <div className="col-span-1 bg-gray-100 px-2 py-2 text-xs font-semibold text-gray-700 border-b border-r border-gray-300">Count:</div>
          <div className="col-span-1 px-2 py-1 border-b border-r border-gray-300">
            <input type="number" value={count} onChange={(e) => setCount(e.target.value)} className="w-full bg-transparent text-center font-bold text-red-600 focus:outline-none" />
          </div>
          <div className="col-span-1 bg-gray-100 px-2 py-2 text-xs font-semibold text-gray-700 border-b border-r border-gray-300">Bottles:</div>
          <div className="col-span-1 px-2 py-1 border-b border-r border-gray-300">
            <input type="number" value={bottles} onChange={(e) => setBottles(e.target.value)} className="w-full bg-transparent text-center font-bold text-gray-900 focus:outline-none" />
          </div>
          <div className="col-span-1 bg-gray-100 px-2 py-2 text-xs font-semibold text-gray-700 border-b border-r border-gray-300">Total Qty:</div>
          <div className="col-span-1 px-2 py-2 text-center font-bold text-gray-900 border-b border-gray-300">{totalQty.toLocaleString()}</div>
        </div>
        {/* Serving size row */}
        <div className="flex items-center gap-2 px-3 py-1 bg-gray-50 border-t-0 text-xs text-gray-600">
          <span className="font-semibold">{servingSize} {formLabel}</span>
          {extractionFileName && <span className="text-gray-400 ml-2">from: {extractionFileName}</span>}
        </div>
      </div>

      {/* ═══ INGREDIENT TABLE ═══ */}
      <div className="bg-white border border-gray-300 rounded-lg overflow-x-auto mb-4">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-[#1a1a2e] text-white text-xs">
              <th className="px-2 py-2 text-left border-r border-gray-600 min-w-[250px]">Ingredient [Raw Material / Component]</th>
              <th className="px-2 py-2 text-center border-r border-gray-600 w-20">Mg/Dosage</th>
              <th className="px-2 py-2 text-center border-r border-gray-600 w-16">Assay</th>
              <th className="px-2 py-2 text-center border-r border-gray-600 w-16">% Overage</th>
              <th className="px-2 py-2 text-center border-r border-gray-600 w-24">Total Mg per Dosage</th>
              <th className="px-2 py-2 text-center border-r border-gray-600 w-24">Total Qty for Batch ({formLabel})</th>
              <th className="px-2 py-2 text-center border-r border-gray-600 w-16">Qty to Source</th>
              <th className="px-2 py-2 text-center border-r border-gray-600 w-20">Price/Kg ($)</th>
              <th className="px-2 py-2 text-center border-r border-gray-600 w-16">Freight</th>
              <th className="px-2 py-2 text-left border-r border-gray-600 w-28">Vendor / Remarks</th>
              <th className="px-2 py-2 text-right border-r border-gray-600 w-24">MOQ Cost ($)</th>
              <th className="px-1 py-2 w-8"></th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l, i) => {
              const calc = lineCalcs[i];
              const isSearching = searchIdx === i;
              const notInDb = !l.inDb && l.name.trim().length > 0;
              const rowBg = l.isExcipient ? "bg-gray-50" : notInDb ? "bg-red-50" : "bg-white";

              return (
                <tr key={l.key} className={`${rowBg} border-b border-gray-200 hover:bg-blue-50/30`}>
                  {/* Ingredient */}
                  <td className="px-2 py-1.5 border-r border-gray-200 relative">
                    {isSearching ? (
                      <div className="relative">
                        <input autoFocus value={searchQuery} onChange={(e) => doSearch(e.target.value)}
                          onBlur={() => setTimeout(() => { setSearchIdx(null); setSearchResults([]); }, 200)}
                          className="w-full border border-blue-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400" placeholder="Search ingredients..." />
                        <Search className="absolute right-2 top-2 h-3 w-3 text-gray-400" />
                        {searchResults.length > 0 && (
                          <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-gray-300 rounded-lg shadow-xl max-h-48 overflow-y-auto">
                            {searchResults.map((r: any) => (
                              <button key={r.id} onMouseDown={() => selectIngredient(i, r)}
                                className="w-full text-left px-3 py-2 hover:bg-blue-50 text-sm border-b border-gray-100">
                                <div className="flex justify-between"><span className="font-medium text-gray-900">{r.name}</span><span className="font-mono text-gray-500">${r.costPerKg}/kg</span></div>
                                <div className="text-xs text-gray-500 mt-0.5">{r.rmId} &middot; Active {r.activeContentPct}% &middot; {r.supplierName || "Unknown"}</div>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5">
                        {l.inDb && l.name.trim() && <CheckCircle2 className="h-3 w-3 text-green-500 shrink-0" />}
                        {notInDb && <XCircle className="h-3 w-3 text-red-500 shrink-0" />}
                        <button onClick={() => { setSearchIdx(i); setSearchQuery(l.name); if (l.name.length >= 2) doSearch(l.name); }}
                          className="text-left text-sm text-gray-900 font-medium hover:text-blue-600 truncate flex-1">
                          {l.name || <span className="text-gray-400 italic font-normal">Click to search...</span>}
                        </button>
                        {notInDb && <button onClick={() => setAddToDbModal({ line: l, idx: i })} className="px-1.5 py-0.5 bg-red-600 text-white text-[9px] font-bold rounded hover:bg-red-700 shrink-0">+DB</button>}
                      </div>
                    )}
                  </td>
                  {/* Mg/Dosage */}
                  <td className="px-1 py-1 border-r border-gray-200">
                    <input type="number" value={l.labelClaimMg} onChange={(e) => updateLine(i, "labelClaimMg", e.target.value)}
                      className="w-full text-center text-sm bg-transparent border border-transparent hover:border-gray-300 focus:border-blue-400 rounded px-1 py-0.5 focus:outline-none" placeholder="0" />
                  </td>
                  {/* Assay */}
                  <td className="px-1 py-1 border-r border-gray-200">
                    <input type="number" value={l.activeContentPct} onChange={(e) => updateLine(i, "activeContentPct", e.target.value)}
                      className="w-full text-center text-sm bg-transparent border border-transparent hover:border-gray-300 focus:border-blue-400 rounded px-1 py-0.5 focus:outline-none" placeholder="100" />
                  </td>
                  {/* % Overage */}
                  <td className="px-1 py-1 border-r border-gray-200">
                    <input type="number" value={l.overagePct} onChange={(e) => updateLine(i, "overagePct", e.target.value)}
                      className="w-full text-center text-sm bg-transparent border border-transparent hover:border-gray-300 focus:border-blue-400 rounded px-1 py-0.5 focus:outline-none" placeholder="0" />
                  </td>
                  {/* Total Mg per Dosage (calculated) */}
                  <td className="px-2 py-1.5 text-center text-sm text-gray-700 border-r border-gray-200 font-mono bg-gray-50">
                    {calc.totalMgPerDosage > 0 ? fmt(calc.totalMgPerDosage, 2) + "mg" : "—"}
                  </td>
                  {/* Total Qty for Batch (calculated) */}
                  <td className="px-2 py-1.5 text-center text-sm text-gray-700 border-r border-gray-200 font-mono bg-gray-50">
                    {calc.batchKg > 0 ? fmt(calc.batchKg, 3) + "Kg" : "—"}
                  </td>
                  {/* Qty to Source */}
                  <td className="px-1 py-1 border-r border-gray-200">
                    <input type="number" value={l.qtyToSource} onChange={(e) => updateLine(i, "qtyToSource", e.target.value)}
                      className="w-full text-center text-sm bg-transparent border border-transparent hover:border-gray-300 focus:border-blue-400 rounded px-1 py-0.5 focus:outline-none" placeholder="" />
                  </td>
                  {/* Price/Kg */}
                  <td className="px-1 py-1 border-r border-gray-200">
                    <input type="number" value={l.costPerKg} onChange={(e) => updateLine(i, "costPerKg", e.target.value)}
                      className="w-full text-center text-sm bg-transparent border border-transparent hover:border-gray-300 focus:border-blue-400 rounded px-1 py-0.5 focus:outline-none font-mono" placeholder="0" />
                  </td>
                  {/* Freight */}
                  <td className="px-1 py-1 border-r border-gray-200">
                    <input type="number" value={l.freight} onChange={(e) => updateLine(i, "freight", e.target.value)}
                      className="w-full text-center text-sm bg-transparent border border-transparent hover:border-gray-300 focus:border-blue-400 rounded px-1 py-0.5 focus:outline-none" placeholder="" />
                  </td>
                  {/* Vendor */}
                  <td className="px-2 py-1.5 text-xs text-gray-600 border-r border-gray-200 truncate max-w-[112px]" title={l.supplier}>
                    {l.supplier || "—"}
                  </td>
                  {/* MOQ Cost (calculated) */}
                  <td className="px-2 py-1.5 text-right text-sm font-mono font-semibold text-gray-900 border-r border-gray-200 bg-gray-50">
                    {calc.moqCost > 0 ? fmtUsd(calc.moqCost) : "—"}
                  </td>
                  {/* Delete */}
                  <td className="px-1 py-1.5 text-center">
                    <button onClick={() => removeLine(i)} className="text-gray-300 hover:text-red-500"><Trash2 className="h-3.5 w-3.5" /></button>
                  </td>
                </tr>
              );
            })}

            {/* Sum Row */}
            <tr className="bg-[#1a1a2e] text-white font-semibold text-sm">
              <td className="px-3 py-2 text-right border-r border-gray-600">Sum:</td>
              <td className="px-2 py-2 text-center border-r border-gray-600 font-mono">{fmt(totals.sumMgDosage, 1)}mg</td>
              <td colSpan={2} className="border-r border-gray-600"></td>
              <td className="px-2 py-2 text-center border-r border-gray-600 font-mono">{fmt(totals.sumTotalMg, 0)}mg</td>
              <td className="px-2 py-2 text-center border-r border-gray-600 font-mono">{fmt(totals.sumBatchKg, 3)}Kg</td>
              <td colSpan={4} className="border-r border-gray-600"></td>
              <td className="px-2 py-2 text-right font-mono text-yellow-300 border-r border-gray-600">Total: {fmtUsd(totals.sumMoqCost)}</td>
              <td></td>
            </tr>
          </tbody>
        </table>

        {/* Add row button */}
        <div className="flex gap-2 px-3 py-2 bg-gray-50 border-t border-gray-200">
          <button onClick={() => setLines([...lines, emptyLine(false)])} className="text-xs text-blue-600 font-medium hover:underline flex items-center gap-1"><Plus className="h-3 w-3" /> Add Active</button>
          <button onClick={() => setLines([...lines, emptyLine(true)])} className="text-xs text-gray-500 font-medium hover:underline flex items-center gap-1"><Plus className="h-3 w-3" /> Add Excipient</button>
        </div>
      </div>

      {/* ═══ COST SUMMARY ═══ */}
      <div className="flex gap-4">
        <div className="flex-1"></div>
        <div className="w-[400px] bg-white border border-gray-300 rounded-lg overflow-hidden">
          <table className="w-full text-sm border-collapse">
            <tbody>
              <CostRow label="RM Cost / Batch" value={costSummary.rmPerBatch} />
              <CostRow label={`${formLabel} — Process Fee / Unit`} value={costSummary.pFee} editable editValue={processFee} onEdit={setProcessFee} />
              <CostRow label="Total Cost / Batch" value={costSummary.totalCostPerBatch} bold />
              <CostRow label={`Per Unit (${count} count)`} value={costSummary.perUnit} bold />
              <CostRow label="Packaging / Unit" value={parseFloat(packagingCost)} editable editValue={packagingCost} onEdit={setPackagingCost} />
              <CostRow label="Wastage" value={parseFloat(wastageCost)} editable editValue={wastageCost} onEdit={setWastageCost} />
              <CostRow label="Lab Cost" value={costSummary.labPerUnit} extra={<input type="number" value={labCost} onChange={(e) => setLabCost(e.target.value)} className="w-16 text-right text-xs bg-transparent border-b border-gray-300 focus:outline-none" />} />
              <CostRow label="Price" value={costSummary.price} bold />
              <CostRow label={`Overhead (${overheadPct}%)`} value={costSummary.overhead}
                extra={<input type="number" value={overheadPct} onChange={(e) => setOverheadPct(e.target.value)} className="w-12 text-right text-xs bg-transparent border-b border-gray-300 focus:outline-none" />} />
              <tr className="bg-[#d10a11] text-white font-bold text-base">
                <td className="px-3 py-2.5 border-r border-red-400">Final Price / Unit</td>
                <td className="px-3 py-2.5 text-right font-mono">{fmtUsd(costSummary.finalPrice)}</td>
              </tr>
            </tbody>
          </table>
          {/* Batch summary */}
          <div className="px-3 py-2 bg-gray-50 border-t border-gray-300 text-xs text-gray-600 flex justify-between">
            <span>Batch: {bottlesNum.toLocaleString()} units</span>
            <span className="font-semibold text-gray-900">Batch Total: {fmtUsd(costSummary.finalPrice * bottlesNum)}</span>
          </div>
        </div>
      </div>

      {/* ═══ ACTIONS ═══ */}
      <div className="flex items-center justify-end gap-3 mt-4">
        <button onClick={save} disabled={saving} className="inline-flex items-center gap-2 px-6 py-2.5 bg-[#d10a11] text-white font-semibold rounded-lg hover:bg-[#a30a0f] disabled:opacity-50 text-sm">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : saved ? <CheckCircle2 className="h-4 w-4" /> : <Save className="h-4 w-4" />}
          {saving ? "Saving..." : saved ? "Saved!" : "Save Quote"}
        </button>
        {dealId && <a href={`/api/quotes/${dealId}/pdf`} target="_blank" className="inline-flex items-center gap-2 px-5 py-2.5 bg-gray-900 text-white font-medium rounded-lg hover:bg-gray-800 text-sm"><FileDown className="h-4 w-4" /> PDF</a>}
      </div>

      {/* ═══ Eva FAB ═══ */}
      <button onClick={() => setShowEva(!showEva)} className={`fixed bottom-6 right-6 z-50 p-3.5 rounded-full shadow-lg ${showEva ? "bg-gray-800 text-white" : "bg-[#d10a11] text-white hover:bg-[#a30a0f]"}`}>
        {showEva ? <X className="h-5 w-5" /> : <Bot className="h-5 w-5" />}
      </button>
      {showEva && (
        <div className="fixed bottom-20 right-6 z-50 w-[400px]">
          <EvaChat context={{ productName: projectName, dosageForm, servingSize, servingsPerContainer: count, moq: bottles, bulkOrPackaged: "packaged",
            ingredientNames: lines.filter((l) => l.name.trim()).map((l) => l.name),
            activeIngredients: lines.filter((l) => l.name.trim() && !l.isExcipient).map((l) => ({ name: l.name, amount: parseFloat(l.labelClaimMg) || 0, unit: "mg", notes: l.notes, inDb: l.inDb })),
            excipients: lines.filter((l) => l.name.trim() && l.isExcipient).map((l) => l.name) }} />
        </div>
      )}

      {addToDbModal && <AddToDbModal ingredientName={addToDbModal.line.name} suggestedCategory={addToDbModal.line.aiCategory} onSave={handleAddToDb} onClose={() => setAddToDbModal(null)} />}
    </div>
  );
}

// ─── Cost Summary Row ───────────────────────────────────────────────────

function CostRow({ label, value, bold, editable, editValue, onEdit, extra }: {
  label: string; value: number; bold?: boolean; editable?: boolean; editValue?: string; onEdit?: (v: string) => void; extra?: React.ReactNode;
}) {
  return (
    <tr className={`border-b border-gray-200 ${bold ? "bg-gray-100 font-semibold" : ""}`}>
      <td className="px-3 py-2 text-gray-700 border-r border-gray-200">
        <div className="flex items-center gap-2">{label}{extra}</div>
      </td>
      <td className="px-3 py-2 text-right font-mono text-gray-900 w-32">
        {editable && onEdit ? (
          <input type="number" value={editValue} onChange={(e) => onEdit(e.target.value)}
            className="w-full text-right bg-transparent border-b border-gray-300 focus:outline-none focus:border-blue-400 py-0.5" />
        ) : (
          fmtUsd(value)
        )}
      </td>
    </tr>
  );
}
