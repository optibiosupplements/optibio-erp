"use client";

import { useState, useRef, useCallback, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  FileUp, Upload, Loader2, Sparkles, Plus, Trash2, Search,
  ChevronDown, ChevronRight, FlaskConical, Factory, Package,
  Shield, MessageSquare, Calculator, AlertTriangle, CheckCircle2, XCircle,
} from "lucide-react";
import CostSummaryPanel from "@/components/deal/CostSummaryPanel";
import AddToDbModal from "@/components/deal/AddToDbModal";
import { calculateIngredientCost } from "@/domains/pricing/pricing.engine";
import { DOSAGE_FORM_MFG, PKG_PRESETS, DEFAULT_TIERS, type MfgDefaults, type PackagingCosts } from "@/domains/pricing/pricing.types";
import { sizeCapsule } from "@/domains/formulation/capsule-sizer";

// ─── Types ──────────────────────────────────────────────────────────────

interface FormulaLine {
  key: string;
  name: string;
  rmId: string;
  labelClaimMg: string;
  activeContentPct: string;
  overagePct: string;
  wastagePct: string;
  costPerKg: string;
  supplier: string;
  isEstimated: boolean;
  isExcipient: boolean;
  inDb: boolean;
  dbId: string | null;
  // AI extraction data (for Add to DB)
  aiCategory?: string;
  aiUnit?: string;
}

let _ctr = 0;
const key = () => "fl-" + ++_ctr;

const emptyLine = (excipient = false): FormulaLine => ({
  key: key(), name: "", rmId: "", labelClaimMg: "", activeContentPct: "100",
  overagePct: excipient ? "0" : "10", wastagePct: "3", costPerKg: "",
  supplier: "", isEstimated: false, isExcipient: excipient, inDb: false, dbId: null,
});

// ─── Component ──────────────────────────────────────────────────────────

export default function DealWorkbench() {
  const router = useRouter();

  // Deal meta
  const [dealId, setDealId] = useState<string | null>(null);
  const [dealNumber, setDealNumber] = useState("");
  const [status, setStatus] = useState("New");

  // Customer & Product
  const [customerCompany, setCustomerCompany] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [productName, setProductName] = useState("");
  const [dosageForm, setDosageForm] = useState("tablet");
  const [servingSize, setServingSize] = useState("1");
  const [containerCount, setContainerCount] = useState("60");
  const [flavor, setFlavor] = useState("");

  // Formula
  const [activeLines, setActiveLines] = useState<FormulaLine[]>([emptyLine(false)]);
  const [excipientLines, setExcipientLines] = useState<FormulaLine[]>([]);

  // Manufacturing & Packaging
  const [mfg, setMfg] = useState<MfgDefaults>(DOSAGE_FORM_MFG["tablet"]);
  const [pkgPreset, setPkgPreset] = useState("Standard 60ct Bottle");
  const [pkg, setPkg] = useState<PackagingCosts>(PKG_PRESETS[0].values);

  // Regulatory & Notes (collapsible)
  const [certifications, setCertifications] = useState<string[]>([]);
  const [allergenStatement, setAllergenStatement] = useState("");
  const [internalNotes, setInternalNotes] = useState("");
  const [customerNotes, setCustomerNotes] = useState("");

  // Extraction summary
  const [extractionSummary, setExtractionSummary] = useState<{
    fileName: string;
    productName: string;
    dosageForm: string;
    servingSize: number;
    servingsPerContainer: number;
    flavor: string | null;
    allergen: string | null;
    activeCount: number;
    activeMatched: number;
    excipientCount: number;
    excipientMatched: number;
    brandedIngredients: string[];
  } | null>(null);

  // UI state
  const [extracting, setExtracting] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [saving, setSaving] = useState(false);
  const [searchIdx, setSearchIdx] = useState<{ section: "active" | "excipient"; idx: number } | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [addToDbModal, setAddToDbModal] = useState<{ line: FormulaLine; section: "active" | "excipient"; idx: number } | null>(null);
  const [mfgOpen, setMfgOpen] = useState(false);
  const [pkgOpen, setPkgOpen] = useState(false);
  const [regOpen, setRegOpen] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const searchTimeout = useRef<NodeJS.Timeout | null>(null);

  // Auto-update mfg when dosage form changes
  useEffect(() => {
    setMfg(DOSAGE_FORM_MFG[dosageForm] || DOSAGE_FORM_MFG["tablet"]);
  }, [dosageForm]);

  const servingSizeNum = parseInt(servingSize) || 1;
  const containerCountNum = parseInt(containerCount) || 60;

  // ─── Ingredient Search ──────────────────────────────────────────────

  const doSearch = useCallback((q: string) => {
    setSearchQuery(q);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    if (q.length < 2) { setSearchResults([]); return; }
    searchTimeout.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/ingredients/search?q=${encodeURIComponent(q)}`);
        setSearchResults(await res.json());
      } catch { setSearchResults([]); }
    }, 200);
  }, []);

  const selectIngredient = (section: "active" | "excipient", idx: number, ing: any) => {
    const ov = dosageForm === "capsule" ? ing.overageCapsule : ing.overageTablet;
    const wa = dosageForm === "capsule" ? ing.wastageCapsule : ing.wastageTablet;
    const updated: FormulaLine = {
      key: key(), name: ing.name, rmId: ing.rmId,
      labelClaimMg: "", activeContentPct: ing.activeContentPct,
      overagePct: ov || ing.baseOveragePct || "10",
      wastagePct: wa || ing.baseWastagePct || "3",
      costPerKg: ing.costPerKg, supplier: ing.supplierName || "",
      isEstimated: ing.isEstimatedPrice, isExcipient: section === "excipient",
      inDb: true, dbId: ing.id,
    };
    if (section === "active") {
      const lines = [...activeLines]; lines[idx] = updated; setActiveLines(lines);
    } else {
      const lines = [...excipientLines]; lines[idx] = updated; setExcipientLines(lines);
    }
    setSearchIdx(null); setSearchResults([]); setSearchQuery("");
  };

  // ─── Line Management ────────────────────────────────────────────────

  const updateLine = (section: "active" | "excipient", idx: number, field: keyof FormulaLine, value: string | boolean) => {
    const lines = section === "active" ? [...activeLines] : [...excipientLines];
    lines[idx] = { ...lines[idx], [field]: value };
    section === "active" ? setActiveLines(lines) : setExcipientLines(lines);
  };

  const removeLine = (section: "active" | "excipient", idx: number) => {
    if (section === "active") {
      if (activeLines.length <= 1) return;
      setActiveLines(activeLines.filter((_, i) => i !== idx));
    } else {
      setExcipientLines(excipientLines.filter((_, i) => i !== idx));
    }
  };

  // ─── Live Cost Calculation ──────────────────────────────────────────

  const allLines = useMemo(() => [...activeLines, ...excipientLines], [activeLines, excipientLines]);

  const costs = useMemo(() => {
    let rmPerServing = 0;
    let totalFillMg = 0;

    for (const line of allLines) {
      if (!line.name.trim()) continue;
      const lc = parseFloat(line.labelClaimMg) || 0;
      const ac = parseFloat(line.activeContentPct) || 100;
      const ov = parseFloat(line.overagePct) || 0;
      const wa = parseFloat(line.wastagePct) || 0;
      const cost = parseFloat(line.costPerKg) || 0;

      if (lc > 0 && ac > 0 && cost > 0) {
        const result = calculateIngredientCost({
          name: line.name, labelClaimMg: lc, activeContentPct: ac,
          overagePct: ov, wastagePct: wa, costPerKg: cost, isEstimatedPrice: line.isEstimated,
        });
        rmPerServing += result.costPerUnit;
        totalFillMg += result.finalMg;
      }
    }

    const rmPerBottle = rmPerServing * containerCountNum * servingSizeNum;
    const mfgPerBottle = (mfg.blending + mfg.processing) * containerCountNum * servingSizeNum + rmPerBottle * (mfg.wastePct / 100);
    const pkgPerBottle = Object.values(pkg).reduce((s, v) => s + v, 0);
    const overheadPerBottle = (rmPerBottle + mfgPerBottle) * 0.15;
    const cogsPerBottle = rmPerBottle + mfgPerBottle + pkgPerBottle + overheadPerBottle;

    const tiers = DEFAULT_TIERS.map((tier) => {
      const setup = mfg.setupPerBatch / tier.quantity;
      const totalCogs = cogsPerBottle + setup;
      const price = totalCogs / (1 - tier.marginPct / 100);
      return { quantity: tier.quantity, marginPct: tier.marginPct, price, total: price * tier.quantity };
    });

    return { rmPerBottle, mfgPerBottle, pkgPerBottle, overheadPerBottle, cogsPerBottle, tiers, totalFillMg };
  }, [allLines, mfg, pkg, containerCountNum, servingSizeNum]);

  const hasEstimated = allLines.some((l) => l.isEstimated);

  // ─── AI Extraction ──────────────────────────────────────────────────

  const handleExtract = async (file: File) => {
    setExtracting(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/extract", { method: "POST", body: fd });
      const data = await res.json();

      if (!data.success) { setExtracting(false); return; }
      const ext = data.extracted;

      // Determine dosage form for overage/wastage column selection
      const form = (ext.dosageForm || "tablet").toLowerCase();

      // Fill product info
      if (ext.productName) setProductName(ext.productName);
      if (form) setDosageForm(form);
      if (ext.servingSize) setServingSize(String(ext.servingSize));
      if (ext.servingsPerContainer) setContainerCount(String(ext.servingsPerContainer));
      if (ext.flavor) setFlavor(ext.flavor);
      if (ext.allergenInfo) setAllergenStatement(ext.allergenInfo);

      // Build active ingredient lines with proper DB field mapping
      const newActives: FormulaLine[] = [];
      let activeMatched = 0;
      for (const mi of data.matchedIngredients || []) {
        const db = mi.dbMatch;
        if (db) activeMatched++;

        // Select dosage-form-specific overage/wastage, with fallbacks
        const ov = db ? (form === "capsule" ? (db.overageCapsule ?? db.baseOveragePct) : (db.overageTablet ?? db.baseOveragePct)) : null;
        const wa = db ? (form === "capsule" ? (db.wastageCapsule ?? db.baseWastagePct) : (db.wastageTablet ?? db.baseWastagePct)) : null;

        newActives.push({
          key: key(),
          name: db?.name || mi.name,
          rmId: db?.rmId || "",
          labelClaimMg: String(mi.amount || ""),
          activeContentPct: String(db?.activeContentPct ?? "100"),
          overagePct: String(ov ?? "10"),
          wastagePct: String(wa ?? "3"),
          costPerKg: String(db?.costPerKg ?? ""),
          supplier: db?.supplierName || "",
          isEstimated: db?.isEstimatedPrice ?? !db,
          isExcipient: false,
          inDb: !!db,
          dbId: db?.id || null,
          aiCategory: mi.notes ? "Probiotics" : "Specialty Compounds",
          aiUnit: mi.unit,
        });
      }
      if (newActives.length > 0) setActiveLines(newActives);

      // Build excipient lines
      const newExcipients: FormulaLine[] = [];
      let excipientMatched = 0;
      for (const me of data.matchedExcipients || []) {
        const db = me.dbMatch;
        if (db) excipientMatched++;

        newExcipients.push({
          key: key(),
          name: db?.name || me.name,
          rmId: db?.rmId || "",
          labelClaimMg: "",
          activeContentPct: String(db?.activeContentPct ?? "95"),
          overagePct: "0",
          wastagePct: String(db?.baseWastagePct ?? "3"),
          costPerKg: String(db?.costPerKg ?? ""),
          supplier: db?.supplierName || "",
          isEstimated: db?.isEstimatedPrice ?? !db,
          isExcipient: true,
          inDb: !!db,
          dbId: db?.id || null,
        });
      }
      if (newExcipients.length > 0) setExcipientLines(newExcipients);

      // Build extraction summary
      setExtractionSummary({
        fileName: file.name,
        productName: ext.productName || "Unknown Product",
        dosageForm: ext.dosageForm || "Unknown",
        servingSize: ext.servingSize || 1,
        servingsPerContainer: ext.servingsPerContainer || 0,
        flavor: ext.flavor || null,
        allergen: ext.allergenInfo || null,
        activeCount: newActives.length,
        activeMatched,
        excipientCount: newExcipients.length,
        excipientMatched,
        brandedIngredients: ext.brandedIngredients || [],
      });

      setStatus("Formulating");
    } finally {
      setExtracting(false);
    }
  };

  // ─── Save Deal ──────────────────────────────────────────────────────

  const saveDeal = async () => {
    setSaving(true);
    try {
      const body = {
        customerCompany, customerEmail, productName, dosageForm,
        servingSize, servingSizeUnit: dosageForm,
        servingsPerContainer: containerCount, countPerBottle: containerCount,
        flavor, status,
        formulaJson: [...activeLines, ...excipientLines].filter((l) => l.name.trim()),
        otherIngredients: excipientLines.map((l) => l.name).join(", "),
        allergenStatement, certifications: certifications.join(", "),
        internalNotes, customerNotes,
      };

      if (dealId) {
        await fetch(`/api/deals/${dealId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
      } else {
        const res = await fetch("/api/deals", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const data = await res.json();
        if (data.success) {
          setDealId(data.deal.id);
          setDealNumber(data.deal.rfqNumber);
        }
      }
    } finally {
      setSaving(false);
    }
  };

  // ─── Add to DB callback ─────────────────────────────────────────────

  const handleAddToDb = (newIngredient: any) => {
    if (!addToDbModal) return;
    const { section, idx } = addToDbModal;
    const lines = section === "active" ? [...activeLines] : [...excipientLines];
    lines[idx] = {
      ...lines[idx],
      name: newIngredient.name,
      rmId: newIngredient.rmId,
      costPerKg: newIngredient.costPerKg || "",
      activeContentPct: newIngredient.activeContentPct || "100",
      supplier: newIngredient.supplierName || "Unknown",
      isEstimated: true,
      inDb: true,
      dbId: newIngredient.id,
    };
    section === "active" ? setActiveLines(lines) : setExcipientLines(lines);
    setAddToDbModal(null);
  };

  // ─── Render ─────────────────────────────────────────────────────────

  return (
    <div className="flex gap-6 max-w-[1400px]">
      {/* Left Panel (scrollable) */}
      <div className="flex-1 min-w-0 space-y-4 pb-20">

        {/* Upload Zone */}
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files?.[0]; if (f) handleExtract(f); }}
          onClick={() => !extracting && fileInputRef.current?.click()}
          className={`rounded-2xl border-2 border-dashed p-6 text-center cursor-pointer transition-all ${
            dragOver ? "border-[#d10a11] bg-red-50/50" : extracting ? "border-blue-300 bg-blue-50/30" : "border-gray-200 hover:border-gray-300"
          }`}
        >
          <input ref={fileInputRef} type="file" accept=".pdf,.png,.jpg,.jpeg" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleExtract(f); }} className="hidden" />
          {extracting ? (
            <div className="flex items-center justify-center gap-3">
              <Loader2 className="h-6 w-6 text-blue-500 animate-spin" />
              <span className="text-sm font-semibold text-blue-700">AI extracting supplement facts...</span>
            </div>
          ) : (
            <div className="flex items-center justify-center gap-3">
              <FileUp className="h-5 w-5 text-gray-400" />
              <span className="text-sm text-gray-500">Drop Supplement Facts panel (PDF/Image) or <span className="text-[#d10a11] font-medium">click to upload</span></span>
            </div>
          )}
        </div>

        {/* AI Extraction Summary */}
        {extractionSummary && (
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl border border-blue-200 p-5 shadow-sm">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-blue-600" />
                <span className="text-sm font-semibold text-blue-900">AI Extracted from: {extractionSummary.fileName}</span>
              </div>
              <button onClick={() => setExtractionSummary(null)} className="text-blue-400 hover:text-blue-600 text-xs">Dismiss</button>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
              <div>
                <span className="text-blue-500 font-medium">Product</span>
                <p className="text-gray-900 font-semibold">{extractionSummary.productName}</p>
              </div>
              <div>
                <span className="text-blue-500 font-medium">Format</span>
                <p className="text-gray-900 capitalize">{extractionSummary.dosageForm} &middot; {extractionSummary.servingSize} per serving &middot; {extractionSummary.servingsPerContainer} count</p>
              </div>
              <div>
                <span className="text-blue-500 font-medium">Active Ingredients</span>
                <p className="text-gray-900">
                  {extractionSummary.activeCount} found &middot;{" "}
                  <span className="text-green-600 font-medium">{extractionSummary.activeMatched} matched</span>
                  {extractionSummary.activeCount - extractionSummary.activeMatched > 0 && (
                    <span className="text-red-600 font-medium"> &middot; {extractionSummary.activeCount - extractionSummary.activeMatched} NOT in DB</span>
                  )}
                </p>
              </div>
              <div>
                <span className="text-blue-500 font-medium">Excipients</span>
                <p className="text-gray-900">
                  {extractionSummary.excipientCount} found &middot;{" "}
                  <span className="text-green-600 font-medium">{extractionSummary.excipientMatched} matched</span>
                  {extractionSummary.excipientCount - extractionSummary.excipientMatched > 0 && (
                    <span className="text-red-600 font-medium"> &middot; {extractionSummary.excipientCount - extractionSummary.excipientMatched} NOT in DB</span>
                  )}
                </p>
              </div>
            </div>
            {extractionSummary.brandedIngredients.length > 0 && (
              <div className="mt-2 text-xs">
                <span className="text-blue-500 font-medium">Branded Ingredients: </span>
                <span className="text-amber-700 font-medium">{extractionSummary.brandedIngredients.join(", ")}</span>
              </div>
            )}
            {extractionSummary.allergen && (
              <div className="mt-1 text-xs">
                <span className="text-blue-500 font-medium">Allergen: </span>
                <span className="text-gray-700">{extractionSummary.allergen}</span>
              </div>
            )}
          </div>
        )}

        {/* Customer & Product */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
            <Field label="Product Name" value={productName} onChange={setProductName} placeholder="Bariatric Probiotic" span={2} />
            <Field label="Customer" value={customerCompany} onChange={setCustomerCompany} placeholder="BioSchwartz LLC" />
            <Field label="Customer Email" value={customerEmail} onChange={setCustomerEmail} placeholder="info@bioschwartz.com" />
          </div>
          <div className="grid grid-cols-4 gap-3">
            <div>
              <label className="block text-[10px] font-medium text-gray-500 mb-1">Format</label>
              <select value={dosageForm} onChange={(e) => setDosageForm(e.target.value)} className="input-field text-xs py-1.5 w-full">
                <option value="capsule">Capsule</option>
                <option value="tablet">Tablet</option>
                <option value="powder">Powder</option>
                <option value="softgel">Softgel</option>
                <option value="gummy">Gummy</option>
              </select>
            </div>
            <Field label="Serving Size" value={servingSize} onChange={setServingSize} type="number" />
            <Field label="Count / Container" value={containerCount} onChange={setContainerCount} type="number" />
            <Field label="Flavor" value={flavor} onChange={setFlavor} placeholder="Cherry Strawberry" />
          </div>
        </div>

        {/* Active Ingredients */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
              <FlaskConical className="h-4 w-4 text-blue-500" /> Active Ingredients
            </h2>
            <button onClick={() => setActiveLines([...activeLines, emptyLine(false)])} className="text-xs text-[#d10a11] font-medium hover:underline flex items-center gap-1">
              <Plus className="h-3 w-3" /> Add Active
            </button>
          </div>
          <IngredientTableUI
            lines={activeLines}
            section="active"
            searchIdx={searchIdx}
            searchQuery={searchQuery}
            searchResults={searchResults}
            onSearch={(idx) => { setSearchIdx({ section: "active", idx }); setSearchQuery(activeLines[idx]?.name || ""); }}
            onDoSearch={doSearch}
            onSelectIngredient={selectIngredient}
            onUpdate={updateLine}
            onRemove={removeLine}
            onAddToDb={(idx) => setAddToDbModal({ line: activeLines[idx], section: "active", idx })}
            onCloseSearch={() => { setSearchIdx(null); setSearchResults([]); }}
          />
        </div>

        {/* Excipients */}
        <div className="bg-gray-50 rounded-2xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
              <FlaskConical className="h-4 w-4 text-gray-400" /> Excipients / Other Ingredients
            </h2>
            <button onClick={() => setExcipientLines([...excipientLines, emptyLine(true)])} className="text-xs text-gray-500 font-medium hover:underline flex items-center gap-1">
              <Plus className="h-3 w-3" /> Add Excipient
            </button>
          </div>
          {excipientLines.length === 0 ? (
            <p className="text-xs text-gray-400 italic py-2">No excipients yet. They will be populated from the "Other Ingredients" list when you upload a supplement facts panel.</p>
          ) : (
            <IngredientTableUI
              lines={excipientLines}
              section="excipient"
              searchIdx={searchIdx}
              searchQuery={searchQuery}
              searchResults={searchResults}
              onSearch={(idx) => { setSearchIdx({ section: "excipient", idx }); setSearchQuery(excipientLines[idx]?.name || ""); }}
              onDoSearch={doSearch}
              onSelectIngredient={selectIngredient}
              onUpdate={updateLine}
              onRemove={removeLine}
              onAddToDb={(idx) => setAddToDbModal({ line: excipientLines[idx], section: "excipient", idx })}
              onCloseSearch={() => { setSearchIdx(null); setSearchResults([]); }}
            />
          )}
        </div>

        {/* Manufacturing (collapsible) */}
        <Collapsible title="Manufacturing Costs" icon={Factory} open={mfgOpen} onToggle={() => setMfgOpen(!mfgOpen)} subtitle={`$${costs.mfgPerBottle.toFixed(2)}/bottle · ${mfg.processingLabel}`}>
          <div className="grid grid-cols-4 gap-3">
            <Field label="Blending / Unit" value={String(mfg.blending)} onChange={(v) => setMfg({ ...mfg, blending: parseFloat(v) || 0 })} type="number" />
            <Field label={mfg.processingLabel} value={String(mfg.processing)} onChange={(v) => setMfg({ ...mfg, processing: parseFloat(v) || 0 })} type="number" />
            <Field label="Waste %" value={String(mfg.wastePct)} onChange={(v) => setMfg({ ...mfg, wastePct: parseFloat(v) || 0 })} type="number" />
            <Field label="Setup / Batch" value={String(mfg.setupPerBatch)} onChange={(v) => setMfg({ ...mfg, setupPerBatch: parseFloat(v) || 0 })} type="number" />
          </div>
        </Collapsible>

        {/* Packaging (collapsible) */}
        <Collapsible title="Packaging Costs" icon={Package} open={pkgOpen} onToggle={() => setPkgOpen(!pkgOpen)} subtitle={`$${costs.pkgPerBottle.toFixed(2)}/bottle · ${pkgPreset}`}>
          <div className="mb-3">
            <label className="block text-[10px] font-medium text-gray-500 mb-1">Preset</label>
            <select value={pkgPreset} onChange={(e) => {
              setPkgPreset(e.target.value);
              const p = PKG_PRESETS.find((p) => p.name === e.target.value);
              if (p) setPkg(p.values);
            }} className="input-field text-xs py-1.5 w-64">
              {PKG_PRESETS.map((p) => <option key={p.name} value={p.name}>{p.name}</option>)}
              <option value="Custom">Custom</option>
            </select>
          </div>
          <div className="grid grid-cols-4 gap-3">
            {Object.entries(pkg).map(([k, v]) => (
              <Field key={k} label={formatPkgLabel(k)} value={String(v)} onChange={(val) => { setPkg({ ...pkg, [k]: parseFloat(val) || 0 }); setPkgPreset("Custom"); }} type="number" />
            ))}
          </div>
        </Collapsible>

        {/* Regulatory (collapsible) */}
        <Collapsible title="Regulatory & Compliance" icon={Shield} open={regOpen} onToggle={() => setRegOpen(!regOpen)}>
          <div className="mb-3">
            <label className="block text-[10px] font-medium text-gray-500 mb-2">Certifications</label>
            <div className="flex flex-wrap gap-1.5">
              {["cGMP", "NSF", "Organic", "Non-GMO", "Kosher", "Halal", "Vegan", "Gluten-Free"].map((c) => (
                <button key={c} onClick={() => setCertifications(certifications.includes(c) ? certifications.filter((x) => x !== c) : [...certifications, c])}
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-medium ${certifications.includes(c) ? "bg-[#d10a11] text-white" : "bg-gray-100 text-gray-500"}`}
                >{c}</button>
              ))}
            </div>
          </div>
          <Field label="Allergen Statement" value={allergenStatement} onChange={setAllergenStatement} placeholder="Not manufactured with..." />
        </Collapsible>

        {/* Notes (collapsible) */}
        <Collapsible title="Notes" icon={MessageSquare} open={notesOpen} onToggle={() => setNotesOpen(!notesOpen)}>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-medium text-gray-500 mb-1">Internal Notes</label>
              <textarea value={internalNotes} onChange={(e) => setInternalNotes(e.target.value)} rows={3} className="input-field text-xs resize-none" />
            </div>
            <div>
              <label className="block text-[10px] font-medium text-gray-500 mb-1">Customer Notes</label>
              <textarea value={customerNotes} onChange={(e) => setCustomerNotes(e.target.value)} rows={3} className="input-field text-xs resize-none" />
            </div>
          </div>
        </Collapsible>
      </div>

      {/* Right Panel (sticky cost summary) */}
      <div className="w-80 shrink-0 hidden lg:block">
        <CostSummaryPanel
          dealNumber={dealNumber}
          status={status}
          rmCost={costs.rmPerBottle}
          mfgCost={costs.mfgPerBottle}
          pkgCost={costs.pkgPerBottle}
          overheadCost={costs.overheadPerBottle}
          cogs={costs.cogsPerBottle}
          tiers={costs.tiers}
          ingredientCount={allLines.filter((l) => l.name.trim()).length}
          fillMg={costs.totalFillMg}
          hasEstimated={hasEstimated}
          saving={saving}
          onSave={saveDeal}
        />
      </div>

      {/* Add to DB Modal */}
      {addToDbModal && (
        <AddToDbModal
          ingredientName={addToDbModal.line.name}
          suggestedCategory={addToDbModal.line.aiCategory}
          onSave={handleAddToDb}
          onClose={() => setAddToDbModal(null)}
        />
      )}
    </div>
  );
}

// ─── Sub-Components ─────────────────────────────────────────────────────

function IngredientTableUI({ lines, section, searchIdx, searchQuery, searchResults, onSearch, onDoSearch, onSelectIngredient, onUpdate, onRemove, onAddToDb, onCloseSearch }: {
  lines: FormulaLine[]; section: "active" | "excipient";
  searchIdx: { section: string; idx: number } | null; searchQuery: string; searchResults: any[];
  onSearch: (idx: number) => void; onDoSearch: (q: string) => void;
  onSelectIngredient: (section: "active" | "excipient", idx: number, ing: any) => void;
  onUpdate: (section: "active" | "excipient", idx: number, field: keyof FormulaLine, value: string | boolean) => void;
  onRemove: (section: "active" | "excipient", idx: number) => void;
  onAddToDb: (idx: number) => void; onCloseSearch: () => void;
}) {
  const isExcipientTable = section === "excipient";

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[11px]">
        <thead>
          <tr className="text-gray-500 font-medium border-b">
            <th className="text-left px-1 py-2 w-6">#</th>
            <th className="text-left px-1 py-2 min-w-[200px]">Ingredient</th>
            {!isExcipientTable && <th className="text-right px-1 py-2 w-20">Label (mg)</th>}
            {!isExcipientTable && <th className="text-right px-1 py-2 w-16">Active %</th>}
            <th className="text-right px-1 py-2 w-14">Ov %</th>
            <th className="text-right px-1 py-2 w-14">Wa %</th>
            <th className="text-right px-1 py-2 w-20">$/Kg</th>
            <th className="text-left px-1 py-2 w-24">Supplier</th>
            <th className="w-6"></th>
          </tr>
        </thead>
        <tbody>
          {lines.map((line: FormulaLine, i: number) => {
            const isSearching = searchIdx?.section === section && searchIdx?.idx === i;
            const notInDb = !line.inDb && line.name.trim().length > 0;

            return (
              <tr key={line.key} className={`border-b border-gray-50 ${
                notInDb ? "bg-red-100/70 border-l-4 border-l-red-500" : line.inDb && line.name.trim() ? "bg-green-50/30" : ""
              }`}>
                <td className="px-1 py-1.5 text-gray-400 text-center">{i + 1}</td>
                <td className="px-1 py-1.5 relative">
                  {isSearching ? (
                    <div className="relative">
                      <input autoFocus value={searchQuery} onChange={(e) => onDoSearch(e.target.value)}
                        onBlur={() => setTimeout(onCloseSearch, 200)}
                        className="input-field text-[11px] py-1 pl-6 w-full" placeholder="Search ingredients..." />
                      <Search className="absolute left-2 top-1.5 h-3 w-3 text-gray-400" />
                      {searchResults.length > 0 && (
                        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border rounded-lg shadow-xl max-h-48 overflow-y-auto">
                          {searchResults.map((r: any) => (
                            <button key={r.id} onMouseDown={() => onSelectIngredient(section, i, r)}
                              className="w-full text-left px-3 py-2 hover:bg-blue-50 text-[11px] border-b border-gray-50">
                              <div className="flex items-center justify-between">
                                <span className="font-medium text-gray-900">{r.name}</span>
                                <span className="font-mono text-gray-500">${r.costPerKg}/kg</span>
                              </div>
                              <div className="text-[10px] text-gray-400 mt-0.5">{r.rmId} &middot; {r.category} &middot; {r.supplierName || "Unknown"}</div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5">
                      {line.inDb && line.name.trim() && <CheckCircle2 className="h-3 w-3 text-green-500 shrink-0" />}
                      {notInDb && <XCircle className="h-3 w-3 text-red-500 shrink-0" />}
                      <button onClick={() => onSearch(i)} className="text-left text-[11px] hover:bg-gray-100 rounded px-1 py-0.5 flex-1 truncate font-medium">
                        {line.name || <span className="text-gray-400 italic font-normal">Click to search...</span>}
                      </button>
                      {line.rmId && <span className="text-[9px] text-gray-400 font-mono shrink-0">{line.rmId}</span>}
                      {notInDb && (
                        <button onClick={() => onAddToDb(i)} className="shrink-0 px-2 py-1 bg-red-600 text-white text-[9px] font-bold rounded-md hover:bg-red-700 shadow-sm">
                          + Add to DB
                        </button>
                      )}
                    </div>
                  )}
                </td>
                {!isExcipientTable && (
                  <td className="px-1 py-1.5"><input type="number" value={line.labelClaimMg} onChange={(e) => onUpdate(section, i, "labelClaimMg", e.target.value)} className="input-field text-[11px] py-1 text-right w-full" placeholder="0" /></td>
                )}
                {!isExcipientTable && (
                  <td className="px-1 py-1.5"><input type="number" value={line.activeContentPct} onChange={(e) => onUpdate(section, i, "activeContentPct", e.target.value)} className="input-field text-[11px] py-1 text-right w-full bg-blue-50/50" placeholder="100" /></td>
                )}
                <td className="px-1 py-1.5"><input type="number" value={line.overagePct} onChange={(e) => onUpdate(section, i, "overagePct", e.target.value)} className="input-field text-[11px] py-1 text-right w-full" placeholder="0" /></td>
                <td className="px-1 py-1.5"><input type="number" value={line.wastagePct} onChange={(e) => onUpdate(section, i, "wastagePct", e.target.value)} className="input-field text-[11px] py-1 text-right w-full" placeholder="3" /></td>
                <td className="px-1 py-1.5"><input type="number" value={line.costPerKg} onChange={(e) => onUpdate(section, i, "costPerKg", e.target.value)} className="input-field text-[11px] py-1 text-right w-full font-mono" placeholder="0.00" /></td>
                <td className="px-1 py-1.5 text-[10px] text-gray-500 truncate max-w-[96px]" title={line.supplier}>{line.supplier || "—"}</td>
                <td className="px-1 py-1.5">
                  <button onClick={() => onRemove(section, i)} className="p-0.5 text-gray-300 hover:text-red-500"><Trash2 className="h-3 w-3" /></button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function Collapsible({ title, icon: Icon, open, onToggle, subtitle, children }: { title: string; icon: React.ComponentType<{ className?: string }>; open: boolean; onToggle: () => void; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      <button onClick={onToggle} className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-gray-400" />
          <span className="text-sm font-semibold text-gray-900">{title}</span>
          {subtitle && !open && <span className="text-xs text-gray-400 ml-2">{subtitle}</span>}
        </div>
        {open ? <ChevronDown className="h-4 w-4 text-gray-400" /> : <ChevronRight className="h-4 w-4 text-gray-400" />}
      </button>
      {open && <div className="px-4 pb-4">{children}</div>}
    </div>
  );
}

function Field({ label, value, onChange, placeholder, type, span, small }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string; span?: number; small?: boolean }) {
  return (
    <div className={span === 2 ? "col-span-2" : ""}>
      <label className="block text-[10px] font-medium text-gray-500 mb-1">{label}</label>
      <input type={type || "text"} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className={`input-field ${small ? "text-xs py-1.5" : "text-sm"}`} />
    </div>
  );
}

function formatPkgLabel(key: string): string {
  const map: Record<string, string> = {
    bottleCost: "Bottle", capCost: "Cap", desiccantCost: "Desiccant", sleeveCost: "Sleeve",
    labelCost: "Label", cartonCostPerUnit: "Carton", palletCostPerUnit: "Pallet", packagingLaborPerUnit: "Pkg Labor",
  };
  return map[key] || key;
}
