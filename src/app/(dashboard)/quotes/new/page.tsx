"use client";

import { useState, useRef, useMemo, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  FileUp, Loader2, Plus, Trash2, Search, CheckCircle2, XCircle,
  FlaskConical, Factory, Package, ChevronDown, ChevronRight,
  Save, FileDown, X, Bot,
} from "lucide-react";
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
  aiCategory?: string; aiUnit?: string; notes?: string;
}

let _ctr = 0;
const key = () => "fl-" + ++_ctr;
const emptyLine = (excipient = false): FormulaLine => ({
  key: key(), name: "", rmId: "", labelClaimMg: "", activeContentPct: "100",
  overagePct: excipient ? "0" : "10", wastagePct: "3", costPerKg: "",
  supplier: "", isEstimated: false, isExcipient: excipient, inDb: false, dbId: null,
});

const PKG_LABELS: Record<string, string> = {
  bottleCost: "Bottle", capCost: "Cap", desiccantCost: "Desiccant", sleeveCost: "Sleeve",
  labelCost: "Label", cartonCostPerUnit: "Carton", palletCostPerUnit: "Pallet", packagingLaborPerUnit: "Pkg Labor",
};

const fmtCost = (v: number) => v === 0 ? "$0.00" : v < 0.01 ? `$${v.toFixed(4)}` : `$${v.toFixed(2)}`;

// ─── Main Component ─────────────────────────────────────────────────────

export default function QuoteWorkspace() {
  const router = useRouter();

  // IDs
  const [rfqId] = useState(() => {
    const now = new Date();
    const seq = String(Math.floor(Math.random() * 999) + 1).padStart(3, "0");
    return `RFQ-${now.getFullYear()}-${seq}`;
  });
  const [dealId, setDealId] = useState<string | null>(null);

  // Product
  const [productName, setProductName] = useState("");
  const [customerCompany, setCustomerCompany] = useState("");
  const [dosageForm, setDosageForm] = useState("tablet");
  const [servingSize, setServingSize] = useState("1");
  const [countPerBottle, setCountPerBottle] = useState("60");
  const [moq, setMoq] = useState("2000");
  const [bulkOrPackaged, setBulkOrPackaged] = useState<"bulk" | "packaged">("packaged");
  const [flavor, setFlavor] = useState("");

  // Formula
  const [activeLines, setActiveLines] = useState<FormulaLine[]>([emptyLine(false)]);
  const [excipientLines, setExcipientLines] = useState<FormulaLine[]>([]);

  // Mfg & Pkg
  const [mfg, setMfg] = useState<MfgDefaults>(DOSAGE_FORM_MFG["tablet"]);
  const [pkgPreset, setPkgPreset] = useState("Standard 60ct Bottle");
  const [pkg, setPkg] = useState<PackagingCosts>(PKG_PRESETS[0].values);

  // UI
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showEva, setShowEva] = useState(false);
  const [mfgOpen, setMfgOpen] = useState(false);
  const [pkgOpen, setPkgOpen] = useState(false);
  const [searchIdx, setSearchIdx] = useState<{ section: "active" | "excipient"; idx: number } | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [addToDbModal, setAddToDbModal] = useState<{ line: FormulaLine; section: "active" | "excipient"; idx: number } | null>(null);
  const searchTimeout = useRef<NodeJS.Timeout | null>(null);
  const [extractionFileName, setExtractionFileName] = useState("");

  useEffect(() => { setMfg(DOSAGE_FORM_MFG[dosageForm] || DOSAGE_FORM_MFG["tablet"]); }, [dosageForm]);

  // Load pending extraction from landing page
  useEffect(() => {
    const pending = sessionStorage.getItem("pendingExtraction");
    if (!pending) return;
    sessionStorage.removeItem("pendingExtraction");
    try {
      const { extracted: ext, matchedIngredients, matchedExcipients, fileName } = JSON.parse(pending);
      const form = (ext.dosageForm || "tablet").toLowerCase();
      if (ext.productName) setProductName(ext.productName);
      if (form) setDosageForm(form);
      if (ext.servingSize) setServingSize(String(ext.servingSize));
      if (ext.servingsPerContainer) setCountPerBottle(String(ext.servingsPerContainer));
      if (ext.flavor) setFlavor(ext.flavor);
      if (fileName) setExtractionFileName(fileName);

      const newActives: FormulaLine[] = [];
      for (const mi of matchedIngredients || []) {
        const db = mi.dbMatch;
        const ov = db ? (form === "capsule" ? (db.overageCapsule ?? db.baseOveragePct) : (db.overageTablet ?? db.baseOveragePct)) : null;
        const wa = db ? (form === "capsule" ? (db.wastageCapsule ?? db.baseWastagePct) : (db.wastageTablet ?? db.baseWastagePct)) : null;
        newActives.push({
          key: key(), name: db?.name || mi.name, rmId: db?.rmId || "",
          labelClaimMg: String(mi.amount || ""), activeContentPct: String(db?.activeContentPct ?? "100"),
          overagePct: String(ov ?? "10"), wastagePct: String(wa ?? "3"),
          costPerKg: String(db?.costPerKg ?? ""), supplier: db?.supplierName || "",
          isEstimated: db?.isEstimatedPrice ?? true, isExcipient: false, inDb: !!db, dbId: db?.id || null,
          aiCategory: mi.notes ? "Probiotics" : "Specialty", aiUnit: mi.unit, notes: mi.notes || undefined,
        });
      }
      if (newActives.length > 0) setActiveLines(newActives);

      const newExcipients: FormulaLine[] = [];
      for (const me of matchedExcipients || []) {
        const db = me.dbMatch;
        newExcipients.push({
          key: key(), name: db?.name || me.name, rmId: db?.rmId || "",
          labelClaimMg: "", activeContentPct: String(db?.activeContentPct ?? "95"),
          overagePct: "0", wastagePct: String(db?.baseWastagePct ?? "3"),
          costPerKg: String(db?.costPerKg ?? ""), supplier: db?.supplierName || "",
          isEstimated: db?.isEstimatedPrice ?? true, isExcipient: true, inDb: !!db, dbId: db?.id || null,
        });
      }
      if (newExcipients.length > 0) setExcipientLines(newExcipients);
    } catch {}
  }, []);

  // ─── Ingredient Search ──────────────────────────────────────────────

  const doSearch = useCallback((q: string) => {
    setSearchQuery(q);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    if (q.length < 2) { setSearchResults([]); return; }
    searchTimeout.current = setTimeout(async () => {
      try { const res = await fetch(`/api/ingredients/search?q=${encodeURIComponent(q)}`); setSearchResults(await res.json()); } catch { setSearchResults([]); }
    }, 200);
  }, []);

  const selectIngredient = (section: "active" | "excipient", idx: number, ing: any) => {
    const ov = dosageForm === "capsule" ? ing.overageCapsule : ing.overageTablet;
    const wa = dosageForm === "capsule" ? ing.wastageCapsule : ing.wastageTablet;
    const updated: FormulaLine = {
      key: key(), name: ing.name, rmId: ing.rmId, labelClaimMg: "",
      activeContentPct: String(ing.activeContentPct ?? "100"), overagePct: String(ov || ing.baseOveragePct || "10"),
      wastagePct: String(wa || ing.baseWastagePct || "3"), costPerKg: String(ing.costPerKg ?? ""),
      supplier: ing.supplierName || "", isEstimated: ing.isEstimatedPrice,
      isExcipient: section === "excipient", inDb: true, dbId: ing.id,
    };
    const lines = section === "active" ? [...activeLines] : [...excipientLines];
    lines[idx] = updated;
    section === "active" ? setActiveLines(lines) : setExcipientLines(lines);
    setSearchIdx(null); setSearchResults([]); setSearchQuery("");
  };

  const updateLine = (s: "active" | "excipient", i: number, f: keyof FormulaLine, v: string | boolean) => {
    const lines = s === "active" ? [...activeLines] : [...excipientLines];
    lines[i] = { ...lines[i], [f]: v };
    s === "active" ? setActiveLines(lines) : setExcipientLines(lines);
  };

  const removeLine = (s: "active" | "excipient", i: number) => {
    if (s === "active") { if (activeLines.length <= 1) return; setActiveLines(activeLines.filter((_, j) => j !== i)); }
    else { setExcipientLines(excipientLines.filter((_, j) => j !== i)); }
  };

  // ─── Cost Calc ──────────────────────────────────────────────────────

  const allLines = useMemo(() => [...activeLines, ...excipientLines], [activeLines, excipientLines]);
  const ssNum = parseInt(servingSize) || 1;
  const ccNum = parseInt(countPerBottle) || 60;

  const costs = useMemo(() => {
    let rmPS = 0, fillMg = 0;
    for (const l of allLines) {
      if (!l.name.trim()) continue;
      const lc = parseFloat(l.labelClaimMg) || 0, ac = parseFloat(l.activeContentPct) || 100;
      const ov = parseFloat(l.overagePct) || 0, wa = parseFloat(l.wastagePct) || 0, c = parseFloat(l.costPerKg) || 0;
      if (lc > 0 && ac > 0 && c > 0) {
        const r = calculateIngredientCost({ name: l.name, labelClaimMg: lc, activeContentPct: ac, overagePct: ov, wastagePct: wa, costPerKg: c, isEstimatedPrice: l.isEstimated });
        rmPS += r.costPerUnit; fillMg += r.finalMg;
      }
    }
    const rm = rmPS * ccNum * ssNum;
    const mfgC = bulkOrPackaged === "bulk" ? 0 : (mfg.blending + mfg.processing) * ccNum * ssNum + rm * (mfg.wastePct / 100);
    const pkgC = bulkOrPackaged === "bulk" ? 0 : Object.values(pkg).reduce((s, v) => s + v, 0);
    const oh = (rm + mfgC) * 0.15;
    const cogs = rm + mfgC + pkgC + oh;
    const tiers = DEFAULT_TIERS.map(t => {
      const setup = mfg.setupPerBatch / t.quantity;
      const tc = cogs + setup;
      const price = tc / (1 - t.marginPct / 100);
      return { quantity: t.quantity, marginPct: t.marginPct, price, total: price * t.quantity };
    });
    return { rm, mfgC, pkgC, oh, cogs, tiers, fillMg };
  }, [allLines, mfg, pkg, ccNum, ssNum, bulkOrPackaged]);

  const hasEst = allLines.some(l => l.isEstimated);

  // ─── Save ──────────────────────────────────────────────────────────

  const save = async () => {
    setSaving(true);
    try {
      const body = { rfqNumber: rfqId, customerCompany, productName, dosageForm, servingSize, servingSizeUnit: dosageForm, servingsPerContainer: countPerBottle, countPerBottle, flavor, status: "Quoted", formulaJson: allLines.filter(l => l.name.trim()), otherIngredients: excipientLines.map(l => l.name).join(", ") };
      if (dealId) { await fetch(`/api/deals/${dealId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }); }
      else { const res = await fetch("/api/deals", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }); const d = await res.json(); if (d.success) setDealId(d.deal.id); }
      setSaved(true); setTimeout(() => setSaved(false), 3000);
    } finally { setSaving(false); }
  };

  const handleAddToDb = (ni: any) => {
    if (!addToDbModal) return;
    const { section: s, idx: i } = addToDbModal;
    const lines = s === "active" ? [...activeLines] : [...excipientLines];
    lines[i] = { ...lines[i], name: ni.name, rmId: ni.rmId, costPerKg: ni.costPerKg || "", activeContentPct: ni.activeContentPct || "100", supplier: ni.supplierName || "Unknown", isEstimated: true, inDb: true, dbId: ni.id };
    s === "active" ? setActiveLines(lines) : setExcipientLines(lines);
    setAddToDbModal(null);
  };

  // ─── Render ─────────────────────────────────────────────────────────

  return (
    <div className="flex gap-5 max-w-[1500px]">
      {/* ═══ LEFT: Workspace ═══ */}
      <div className="flex-1 min-w-0 space-y-3 pb-16">

        {/* Product Header */}
        <div className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <span className="font-mono text-xs font-bold text-gray-400">{rfqId}</span>
            {extractionFileName && <span className="text-[10px] text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">from {extractionFileName}</span>}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
            <div className="col-span-2"><label className="block text-[10px] font-medium text-gray-500 mb-1">Product Name</label><input value={productName} onChange={e => setProductName(e.target.value)} className="input-field text-sm font-semibold" placeholder="Bariatric Probiotic" /></div>
            <div><label className="block text-[10px] font-medium text-gray-500 mb-1">Customer</label><input value={customerCompany} onChange={e => setCustomerCompany(e.target.value)} className="input-field text-sm" placeholder="BioSchwartz LLC" /></div>
            <div><label className="block text-[10px] font-medium text-gray-500 mb-1">Flavor</label><input value={flavor} onChange={e => setFlavor(e.target.value)} className="input-field text-sm" placeholder="Cherry Strawberry" /></div>
          </div>
          <div className="grid grid-cols-5 gap-3">
            <div><label className="block text-[10px] font-medium text-gray-500 mb-1">Format</label><select value={dosageForm} onChange={e => setDosageForm(e.target.value)} className="input-field text-xs"><option value="tablet">Tablet</option><option value="capsule">Capsule</option><option value="powder">Powder</option><option value="softgel">Softgel</option></select></div>
            <div><label className="block text-[10px] font-medium text-gray-500 mb-1">Serving</label><input type="number" value={servingSize} onChange={e => setServingSize(e.target.value)} className="input-field text-xs" /></div>
            <div><label className="block text-[10px] font-medium text-gray-500 mb-1">Count</label><input type="number" value={countPerBottle} onChange={e => setCountPerBottle(e.target.value)} className="input-field text-xs" /></div>
            <div><label className="block text-[10px] font-medium text-gray-500 mb-1">MOQ</label><input type="number" value={moq} onChange={e => setMoq(e.target.value)} className="input-field text-xs" /></div>
            <div><label className="block text-[10px] font-medium text-gray-500 mb-1">Delivery</label><select value={bulkOrPackaged} onChange={e => setBulkOrPackaged(e.target.value as any)} className="input-field text-xs"><option value="packaged">Packaged</option><option value="bulk">Bulk</option></select></div>
          </div>
        </div>

        {/* Active Ingredients */}
        <div className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-xs font-semibold text-gray-900 flex items-center gap-1.5"><FlaskConical className="h-3.5 w-3.5 text-blue-500" /> Active Ingredients</h2>
            <button onClick={() => setActiveLines([...activeLines, emptyLine(false)])} className="text-[10px] text-[#d10a11] font-medium hover:underline flex items-center gap-0.5"><Plus className="h-3 w-3" /> Add</button>
          </div>
          <IngTable lines={activeLines} section="active" exc={false} si={searchIdx} sq={searchQuery} sr={searchResults}
            onS={(i: number) => { setSearchIdx({ section: "active", idx: i }); setSearchQuery(activeLines[i]?.name || ""); }}
            onDS={doSearch} onSel={selectIngredient} onUp={updateLine} onRm={removeLine}
            onAdd={(i: number) => setAddToDbModal({ line: activeLines[i], section: "active", idx: i })}
            onCS={() => { setSearchIdx(null); setSearchResults([]); }} />
        </div>

        {/* Excipients */}
        <div className="bg-gray-50/80 rounded-2xl border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-xs font-semibold text-gray-600 flex items-center gap-1.5"><FlaskConical className="h-3.5 w-3.5 text-gray-400" /> Excipients</h2>
            <button onClick={() => setExcipientLines([...excipientLines, emptyLine(true)])} className="text-[10px] text-gray-500 font-medium hover:underline flex items-center gap-0.5"><Plus className="h-3 w-3" /> Add</button>
          </div>
          {excipientLines.length === 0 ? <p className="text-[10px] text-gray-400 italic py-1">No excipients. Upload an SFP or add manually.</p> : (
            <IngTable lines={excipientLines} section="excipient" exc={true} si={searchIdx} sq={searchQuery} sr={searchResults}
              onS={(i: number) => { setSearchIdx({ section: "excipient", idx: i }); setSearchQuery(excipientLines[i]?.name || ""); }}
              onDS={doSearch} onSel={selectIngredient} onUp={updateLine} onRm={removeLine}
              onAdd={(i: number) => setAddToDbModal({ line: excipientLines[i], section: "excipient", idx: i })}
              onCS={() => { setSearchIdx(null); setSearchResults([]); }} />
          )}
        </div>

        {/* Manufacturing */}
        {bulkOrPackaged === "packaged" && (
          <Coll title="Manufacturing" icon={Factory} open={mfgOpen} toggle={() => setMfgOpen(!mfgOpen)} sub={fmtCost(costs.mfgC) + "/btl"}>
            <div className="grid grid-cols-4 gap-3 text-xs">
              <NF label="Blending/Unit" v={mfg.blending} set={v => setMfg({ ...mfg, blending: v })} />
              <NF label={mfg.processingLabel} v={mfg.processing} set={v => setMfg({ ...mfg, processing: v })} />
              <NF label="Waste %" v={mfg.wastePct} set={v => setMfg({ ...mfg, wastePct: v })} />
              <NF label="Setup/Batch" v={mfg.setupPerBatch} set={v => setMfg({ ...mfg, setupPerBatch: v })} />
            </div>
          </Coll>
        )}

        {/* Packaging */}
        {bulkOrPackaged === "packaged" && (
          <Coll title="Packaging" icon={Package} open={pkgOpen} toggle={() => setPkgOpen(!pkgOpen)} sub={fmtCost(costs.pkgC) + "/btl"}>
            <div className="mb-3">
              <select value={pkgPreset} onChange={e => { setPkgPreset(e.target.value); const p = PKG_PRESETS.find(p => p.name === e.target.value); if (p) setPkg(p.values); }} className="input-field text-xs w-56">
                {PKG_PRESETS.map(p => <option key={p.name} value={p.name}>{p.name}</option>)}
                <option value="Custom">Custom</option>
              </select>
            </div>
            <div className="grid grid-cols-4 gap-3 text-xs">
              {Object.entries(pkg).map(([k, v]) => <NF key={k} label={PKG_LABELS[k] || k} v={v} set={val => { setPkg({ ...pkg, [k]: val }); setPkgPreset("Custom"); }} />)}
            </div>
          </Coll>
        )}
      </div>

      {/* ═══ RIGHT: Cost Panel ═══ */}
      <div className="w-72 shrink-0 hidden lg:block">
        <div className="sticky top-5 space-y-3">
          <div className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm">
            <h3 className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-3">Cost / {bulkOrPackaged === "bulk" ? "Kg" : "Bottle"}</h3>
            <div className="space-y-1.5 text-xs">
              <CR l="Raw Materials" v={costs.rm} />
              {bulkOrPackaged === "packaged" && <CR l="Manufacturing" v={costs.mfgC} />}
              {bulkOrPackaged === "packaged" && <CR l="Packaging" v={costs.pkgC} />}
              <CR l="Overhead (15%)" v={costs.oh} m />
              <div className="border-t pt-1.5 mt-1.5"><CR l="COGS" v={costs.cogs} b /></div>
            </div>
            <div className="mt-2 text-[10px] text-gray-400">{allLines.filter(l => l.name.trim()).length} ingredients &middot; {costs.fillMg > 0 ? `${costs.fillMg.toFixed(0)}mg fill` : "—"}</div>
          </div>

          {costs.cogs > 0 && (
            <div className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm">
              <h3 className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-3">Tiered Pricing</h3>
              <div className="space-y-2">
                {costs.tiers.map((t, i) => (
                  <div key={t.quantity} className={`p-2.5 rounded-xl border ${i === 1 ? "border-[#d10a11] bg-red-50/30" : "border-gray-100"}`}>
                    <div className="flex justify-between items-center mb-0.5">
                      <span className="text-xs font-bold text-gray-900">{t.quantity.toLocaleString()}</span>
                      {i === 1 && <span className="text-[8px] font-bold text-[#d10a11] uppercase">Best</span>}
                    </div>
                    <div className="flex justify-between text-[10px]"><span className="text-gray-500">{t.marginPct}%</span><span className="font-mono font-bold">{fmtCost(t.price)}/btl</span></div>
                    <div className="text-right text-[9px] text-gray-400">${t.total.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {hasEst && <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2"><p className="text-[10px] font-semibold text-amber-700">Estimated prices — verify with suppliers</p></div>}

          <div className="space-y-2">
            <button onClick={save} disabled={saving} className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-[#d10a11] text-white font-semibold rounded-xl hover:bg-[#a30a0f] disabled:opacity-50 text-sm">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : saved ? <CheckCircle2 className="h-4 w-4" /> : <Save className="h-4 w-4" />}
              {saving ? "Saving..." : saved ? "Saved!" : "Save Quote"}
            </button>
            {dealId && <a href={`/api/quotes/${dealId}/pdf`} target="_blank" className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-gray-900 text-white font-medium rounded-xl hover:bg-gray-800 text-sm"><FileDown className="h-4 w-4" /> PDF</a>}
          </div>
        </div>
      </div>

      {/* ═══ Eva FAB ═══ */}
      <button onClick={() => setShowEva(!showEva)} className={`fixed bottom-6 right-6 z-50 p-3.5 rounded-full shadow-lg ${showEva ? "bg-gray-800 text-white" : "bg-[#d10a11] text-white hover:bg-[#a30a0f]"}`}>
        {showEva ? <X className="h-5 w-5" /> : <Bot className="h-5 w-5" />}
      </button>
      {showEva && (
        <div className="fixed bottom-20 right-6 z-50 w-[400px]">
          <EvaChat context={{ productName, dosageForm, servingSize, servingsPerContainer: countPerBottle, moq, bulkOrPackaged,
            ingredientNames: allLines.filter(l => l.name.trim()).map(l => l.name),
            activeIngredients: activeLines.filter(l => l.name.trim()).map(l => ({ name: l.name, amount: parseFloat(l.labelClaimMg) || 0, unit: "mg", notes: l.notes, inDb: l.inDb })),
            excipients: excipientLines.filter(l => l.name.trim()).map(l => l.name) }} />
        </div>
      )}

      {addToDbModal && <AddToDbModal ingredientName={addToDbModal.line.name} suggestedCategory={addToDbModal.line.aiCategory} onSave={handleAddToDb} onClose={() => setAddToDbModal(null)} />}
    </div>
  );
}

// ─── Sub-Components ─────────────────────────────────────────────────────

function IngTable({ lines, section, exc, si, sq, sr, onS, onDS, onSel, onUp, onRm, onAdd, onCS }: any) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[11px]">
        <thead><tr className="text-gray-600 font-medium border-b text-[10px]">
          <th className="text-left px-1 py-1.5 w-5">#</th><th className="text-left px-1 py-1.5 min-w-[180px]">Ingredient</th>
          {!exc && <th className="text-right px-1 py-1.5 w-16">Label mg</th>}{!exc && <th className="text-right px-1 py-1.5 w-14">Active%</th>}
          <th className="text-right px-1 py-1.5 w-12">Ov%</th><th className="text-right px-1 py-1.5 w-12">Wa%</th>
          <th className="text-right px-1 py-1.5 w-16">$/Kg</th><th className="text-left px-1 py-1.5 w-20">Supplier</th><th className="w-5"></th>
        </tr></thead>
        <tbody>{lines.map((l: FormulaLine, i: number) => {
          const isSrch = si?.section === section && si?.idx === i;
          const noDb = !l.inDb && l.name.trim().length > 0;
          return (
            <tr key={l.key} className={`border-b border-gray-50 ${noDb ? "bg-red-50 border-l-2 border-l-red-400" : ""}`}>
              <td className="px-1 py-1 text-gray-500 text-center">{i + 1}</td>
              <td className="px-1 py-1 relative">{isSrch ? (
                <div className="relative">
                  <input autoFocus value={sq} onChange={e => onDS(e.target.value)} onBlur={() => setTimeout(onCS, 200)} className="input-field text-[11px] py-1 pl-6 w-full" placeholder="Search..." />
                  <Search className="absolute left-2 top-1.5 h-3 w-3 text-gray-400" />
                  {sr.length > 0 && <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border rounded-lg shadow-xl max-h-48 overflow-y-auto">
                    {sr.map((r: any) => <button key={r.id} onMouseDown={() => onSel(section, i, r)} className="w-full text-left px-3 py-2 hover:bg-blue-50 text-[11px] border-b border-gray-50">
                      <div className="flex justify-between"><span className="font-medium">{r.name}</span><span className="font-mono text-gray-400">${r.costPerKg}/kg</span></div>
                      <div className="text-[9px] text-gray-400 mt-0.5">{r.rmId} &middot; Active {r.activeContentPct}%</div>
                    </button>)}
                  </div>}
                </div>
              ) : (
                <div className="flex items-center gap-1">
                  {l.inDb && l.name.trim() && <CheckCircle2 className="h-3 w-3 text-green-500 shrink-0" />}
                  {noDb && <XCircle className="h-3 w-3 text-red-500 shrink-0" />}
                  <button onClick={() => onS(i)} className="text-left text-[11px] text-gray-900 font-medium hover:bg-gray-50 rounded px-1 py-0.5 flex-1 truncate">{l.name || <span className="text-gray-400 italic font-normal">Search...</span>}</button>
                  {l.rmId && <span className="text-[8px] text-gray-500 font-mono">{l.rmId}</span>}
                  {noDb && <button onClick={() => onAdd(i)} className="shrink-0 px-1.5 py-0.5 bg-red-600 text-white text-[8px] font-bold rounded hover:bg-red-700">+DB</button>}
                </div>
              )}</td>
              {!exc && <td className="px-1 py-1"><input type="number" value={l.labelClaimMg} onChange={e => onUp(section, i, "labelClaimMg", e.target.value)} className="input-field text-[11px] py-0.5 text-right w-full" placeholder="0" /></td>}
              {!exc && <td className="px-1 py-1"><input type="number" value={l.activeContentPct} onChange={e => onUp(section, i, "activeContentPct", e.target.value)} className="input-field text-[11px] py-0.5 text-right w-full bg-blue-50/30" placeholder="100" /></td>}
              <td className="px-1 py-1"><input type="number" value={l.overagePct} onChange={e => onUp(section, i, "overagePct", e.target.value)} className="input-field text-[11px] py-0.5 text-right w-full" placeholder="0" /></td>
              <td className="px-1 py-1"><input type="number" value={l.wastagePct} onChange={e => onUp(section, i, "wastagePct", e.target.value)} className="input-field text-[11px] py-0.5 text-right w-full" placeholder="3" /></td>
              <td className="px-1 py-1"><input type="number" value={l.costPerKg} onChange={e => onUp(section, i, "costPerKg", e.target.value)} className="input-field text-[11px] py-0.5 text-right w-full font-mono" placeholder="0" /></td>
              <td className="px-1 py-1 text-[10px] text-gray-600 truncate max-w-[80px]" title={l.supplier}>{l.supplier || "—"}</td>
              <td className="px-1 py-1"><button onClick={() => onRm(section, i)} className="p-0.5 text-gray-200 hover:text-red-500"><Trash2 className="h-3 w-3" /></button></td>
            </tr>
          );
        })}</tbody>
      </table>
    </div>
  );
}

function Coll({ title, icon: Icon, open, toggle, sub, children }: any) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      <button onClick={toggle} className="w-full flex items-center justify-between p-3 hover:bg-gray-50">
        <div className="flex items-center gap-1.5"><Icon className="h-3.5 w-3.5 text-gray-400" /><span className="text-xs font-semibold text-gray-900">{title}</span>{sub && !open && <span className="text-[10px] text-gray-400 ml-1">{sub}</span>}</div>
        {open ? <ChevronDown className="h-3.5 w-3.5 text-gray-400" /> : <ChevronRight className="h-3.5 w-3.5 text-gray-400" />}
      </button>
      {open && <div className="px-3 pb-3">{children}</div>}
    </div>
  );
}

function NF({ label, v, set }: { label: string; v: number; set: (v: number) => void }) {
  return <div><label className="block text-[10px] font-medium text-gray-500 mb-1">{label}</label><input type="number" value={v} onChange={e => set(parseFloat(e.target.value) || 0)} className="input-field text-xs py-1" /></div>;
}

function CR({ l, v, b, m }: { l: string; v: number; b?: boolean; m?: boolean }) {
  const f = v === 0 ? "$0.00" : v < 0.01 ? `$${v.toFixed(4)}` : `$${v.toFixed(2)}`;
  return <div className="flex justify-between items-center"><span className={`${m ? "text-gray-400" : "text-gray-600"} ${b ? "font-semibold" : ""}`}>{l}</span><span className={`font-mono whitespace-nowrap ${b ? "font-bold text-[#d10a11] text-sm" : ""} ${m ? "text-gray-400" : ""}`}>{f}</span></div>;
}
