"use client";

import { useState, useRef, useMemo, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  FileUp, Loader2, Sparkles, Plus, Trash2, Search,
  ChevronDown, ChevronRight, CheckCircle2, XCircle, AlertTriangle,
  FlaskConical, Factory, Package, Shield, MessageSquare,
  ArrowRight, ArrowLeft, ClipboardList, Box, Tag,
} from "lucide-react";
import CostSummaryPanel from "@/components/deal/CostSummaryPanel";
import AddToDbModal from "@/components/deal/AddToDbModal";
import { calculateIngredientCost } from "@/domains/pricing/pricing.engine";
import { DOSAGE_FORM_MFG, PKG_PRESETS, DEFAULT_TIERS, type MfgDefaults, type PackagingCosts } from "@/domains/pricing/pricing.types";

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
  aiCategory?: string;
  aiUnit?: string;
  notes?: string;
}

interface ExtractionResult {
  fileName: string;
  productName: string;
  dosageForm: string;
  servingSize: number;
  servingSizeUnit: string;
  servingsPerContainer: number;
  flavor: string | null;
  allergen: string | null;
  warnings: string | null;
  activeIngredients: { name: string; amount: number; unit: string; percentDV: string | null; notes: string | null }[];
  otherIngredients: string[];
  brandedIngredients: string[];
  activeLines: FormulaLine[];
  excipientLines: FormulaLine[];
  matchedCount: number;
  unmatchedCount: number;
}

let _ctr = 0;
const key = () => "fl-" + ++_ctr;

const emptyLine = (excipient = false): FormulaLine => ({
  key: key(), name: "", rmId: "", labelClaimMg: "", activeContentPct: "100",
  overagePct: excipient ? "0" : "10", wastagePct: "3", costPerKg: "",
  supplier: "", isEstimated: false, isExcipient: excipient, inDb: false, dbId: null,
});

// ─── Steps ──────────────────────────────────────────────────────────────

type Step = "upload" | "review" | "specifications" | "formulation" | "summary";

const STEPS: { id: Step; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "upload", label: "Upload SFP", icon: FileUp },
  { id: "review", label: "Review Extraction", icon: Sparkles },
  { id: "specifications", label: "Product Specs", icon: ClipboardList },
  { id: "formulation", label: "Formulation & Quote", icon: FlaskConical },
  { id: "summary", label: "Summary", icon: CheckCircle2 },
];

// ─── Component ──────────────────────────────────────────────────────────

export default function NewDealWizard() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("upload");

  // IDs (auto-generated)
  const [rfqId, setRfqId] = useState("");
  const [quoteId, setQuoteId] = useState("");
  const [dealId, setDealId] = useState<string | null>(null);

  // Step 1: Upload
  const [extracting, setExtracting] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [extraction, setExtraction] = useState<ExtractionResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Step 3: Specifications
  const [customerCompany, setCustomerCompany] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [productName, setProductName] = useState("");
  const [productDescription, setProductDescription] = useState("");
  const [dosageForm, setDosageForm] = useState("tablet");
  const [servingSize, setServingSize] = useState("1");
  const [servingsPerUnit, setServingsPerUnit] = useState("60");
  const [countPerBottle, setCountPerBottle] = useState("60"); // auto-calculated
  const [moq, setMoq] = useState("2000");
  const [batchSize, setBatchSize] = useState("120000"); // auto-calculated
  const [flavor, setFlavor] = useState("");

  // Packaging
  const [bulkOrPackaged, setBulkOrPackaged] = useState<"bulk" | "packaged">("packaged");
  const [primaryPackaging, setPrimaryPackaging] = useState("HDPE Bottle");
  const [secondaryPackaging, setSecondaryPackaging] = useState(false);
  const [secondaryType, setSecondaryType] = useState("Carton Box");
  const [labeledOrUnlabeled, setLabeledOrUnlabeled] = useState<"labeled" | "unlabeled">("labeled");
  const [labelSupplier, setLabelSupplier] = useState("");

  // Additional requirements
  const [specialRequirements, setSpecialRequirements] = useState("");
  const [formulationNotes, setFormulationNotes] = useState("");

  // Step 4: Formula
  const [activeLines, setActiveLines] = useState<FormulaLine[]>([emptyLine(false)]);
  const [excipientLines, setExcipientLines] = useState<FormulaLine[]>([]);

  // Manufacturing & Packaging costs
  const [mfg, setMfg] = useState<MfgDefaults>(DOSAGE_FORM_MFG["tablet"]);
  const [pkgPreset, setPkgPreset] = useState("Standard 60ct Bottle");
  const [pkg, setPkg] = useState<PackagingCosts>(PKG_PRESETS[0].values);

  // Regulatory
  const [certifications, setCertifications] = useState<string[]>([]);
  const [allergenStatement, setAllergenStatement] = useState("");

  // UI
  const [saving, setSaving] = useState(false);
  const [searchIdx, setSearchIdx] = useState<{ section: "active" | "excipient"; idx: number } | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [addToDbModal, setAddToDbModal] = useState<{ line: FormulaLine; section: "active" | "excipient"; idx: number } | null>(null);
  const searchTimeout = useRef<NodeJS.Timeout | null>(null);

  // Auto-calculations
  useEffect(() => {
    const ss = parseInt(servingSize) || 1;
    const spu = parseInt(servingsPerUnit) || 60;
    const cpb = ss * spu;
    setCountPerBottle(String(cpb));
    const m = parseInt(moq) || 2000;
    setBatchSize(String(cpb * m));
  }, [servingSize, servingsPerUnit, moq]);

  useEffect(() => {
    setMfg(DOSAGE_FORM_MFG[dosageForm] || DOSAGE_FORM_MFG["tablet"]);
  }, [dosageForm]);

  // Generate IDs on mount
  useEffect(() => {
    const ts = Date.now().toString(36).toUpperCase().slice(-6);
    setRfqId(`RFQ-${ts}`);
    setQuoteId(`QT-${ts}`);
  }, []);

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
      labelClaimMg: "", activeContentPct: String(ing.activeContentPct ?? "100"),
      overagePct: String(ov || ing.baseOveragePct || "10"),
      wastagePct: String(wa || ing.baseWastagePct || "3"),
      costPerKg: String(ing.costPerKg ?? ""), supplier: ing.supplierName || "",
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

  // ─── Cost Calculation ──────────────────────────────────────────────

  const allLines = useMemo(() => [...activeLines, ...excipientLines], [activeLines, excipientLines]);
  const servingSizeNum = parseInt(servingSize) || 1;
  const containerCountNum = parseInt(countPerBottle) || 60;

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
    const mfgPerBottle = bulkOrPackaged === "bulk" ? 0 : (mfg.blending + mfg.processing) * containerCountNum * servingSizeNum + rmPerBottle * (mfg.wastePct / 100);
    const pkgPerBottle = bulkOrPackaged === "bulk" ? 0 : Object.values(pkg).reduce((s, v) => s + v, 0);
    const overheadPerBottle = (rmPerBottle + mfgPerBottle) * 0.15;
    const cogsPerBottle = rmPerBottle + mfgPerBottle + pkgPerBottle + overheadPerBottle;

    const tiers = DEFAULT_TIERS.map((tier) => {
      const setup = mfg.setupPerBatch / tier.quantity;
      const totalCogs = cogsPerBottle + setup;
      const price = totalCogs / (1 - tier.marginPct / 100);
      return { quantity: tier.quantity, marginPct: tier.marginPct, price, total: price * tier.quantity };
    });

    return { rmPerBottle, mfgPerBottle, pkgPerBottle, overheadPerBottle, cogsPerBottle, tiers, totalFillMg };
  }, [allLines, mfg, pkg, containerCountNum, servingSizeNum, bulkOrPackaged]);

  const hasEstimated = allLines.some((l) => l.isEstimated);

  // ─── AI Extraction ──────────────────────────────────────────────────

  const handleExtract = async (file: File) => {
    setExtracting(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/extract", { method: "POST", body: fd });
      const data = await res.json();

      if (!data.success) { alert(data.error || "Extraction failed"); setExtracting(false); return; }
      const ext = data.extracted;
      const form = (ext.dosageForm || "tablet").toLowerCase();

      // Build active lines
      const newActives: FormulaLine[] = [];
      let matchedCount = 0;
      for (const mi of data.matchedIngredients || []) {
        const db = mi.dbMatch;
        if (db) matchedCount++;
        const ov = db ? (form === "capsule" ? (db.overageCapsule ?? db.baseOveragePct) : (db.overageTablet ?? db.baseOveragePct)) : null;
        const wa = db ? (form === "capsule" ? (db.wastageCapsule ?? db.baseWastagePct) : (db.wastageTablet ?? db.baseWastagePct)) : null;

        newActives.push({
          key: key(), name: db?.name || mi.name, rmId: db?.rmId || "",
          labelClaimMg: String(mi.amount || ""),
          activeContentPct: String(db?.activeContentPct ?? "100"),
          overagePct: String(ov ?? "10"), wastagePct: String(wa ?? "3"),
          costPerKg: String(db?.costPerKg ?? ""), supplier: db?.supplierName || "",
          isEstimated: db?.isEstimatedPrice ?? true, isExcipient: false,
          inDb: !!db, dbId: db?.id || null,
          aiCategory: mi.notes ? "Probiotics" : "Specialty Compounds", aiUnit: mi.unit,
          notes: mi.notes || undefined,
        });
      }

      // Build excipient lines
      const newExcipients: FormulaLine[] = [];
      let excipientMatchedCount = 0;
      for (const me of data.matchedExcipients || []) {
        const db = me.dbMatch;
        if (db) excipientMatchedCount++;
        newExcipients.push({
          key: key(), name: db?.name || me.name, rmId: db?.rmId || "",
          labelClaimMg: "", activeContentPct: String(db?.activeContentPct ?? "95"),
          overagePct: "0", wastagePct: String(db?.baseWastagePct ?? "3"),
          costPerKg: String(db?.costPerKg ?? ""), supplier: db?.supplierName || "",
          isEstimated: db?.isEstimatedPrice ?? true, isExcipient: true,
          inDb: !!db, dbId: db?.id || null,
        });
      }

      // Build extraction result
      setExtraction({
        fileName: file.name,
        productName: ext.productName || "Unknown Product",
        dosageForm: ext.dosageForm || "tablet",
        servingSize: ext.servingSize || 1,
        servingSizeUnit: ext.servingSizeUnit || "tablet",
        servingsPerContainer: ext.servingsPerContainer || 60,
        flavor: ext.flavor || null,
        allergen: ext.allergenInfo || null,
        warnings: ext.warnings || null,
        activeIngredients: ext.activeIngredients || [],
        otherIngredients: ext.otherIngredients || [],
        brandedIngredients: ext.brandedIngredients || [],
        activeLines: newActives,
        excipientLines: newExcipients,
        matchedCount: matchedCount + excipientMatchedCount,
        unmatchedCount: (newActives.length + newExcipients.length) - (matchedCount + excipientMatchedCount),
      });

      // Pre-fill product info from extraction
      if (ext.productName) setProductName(ext.productName);
      if (form) setDosageForm(form);
      if (ext.servingSize) setServingSize(String(ext.servingSize));
      if (ext.servingsPerContainer) setServingsPerUnit(String(ext.servingsPerContainer));
      if (ext.flavor) setFlavor(ext.flavor);
      if (ext.allergenInfo) setAllergenStatement(ext.allergenInfo);

      // Set formula lines
      if (newActives.length > 0) setActiveLines(newActives);
      if (newExcipients.length > 0) setExcipientLines(newExcipients);

      // Move to review step
      setStep("review");
    } catch (err: any) {
      alert("Extraction error: " + (err.message || "Unknown error"));
    } finally {
      setExtracting(false);
    }
  };

  // ─── Save Deal ──────────────────────────────────────────────────────

  const saveDeal = async () => {
    setSaving(true);
    try {
      const body = {
        rfqNumber: rfqId,
        customerCompany, customerEmail, productName, dosageForm,
        servingSize, servingSizeUnit: dosageForm,
        servingsPerContainer: servingsPerUnit, countPerBottle,
        flavor, status: "Quoted",
        formulaJson: [...activeLines, ...excipientLines].filter((l) => l.name.trim()),
        otherIngredients: excipientLines.map((l) => l.name).join(", "),
        allergenStatement, certifications: certifications.join(", "),
        internalNotes: formulationNotes, customerNotes: specialRequirements,
        bulkOrPackaged, primaryPackaging, secondaryPackaging: secondaryPackaging ? secondaryType : null,
        labeledOrUnlabeled, moq, batchSize,
      };

      if (dealId) {
        await fetch(`/api/deals/${dealId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      } else {
        const res = await fetch("/api/deals", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
        const data = await res.json();
        if (data.success) {
          setDealId(data.deal.id);
          setRfqId(data.deal.rfqNumber);
        }
      }
      setStep("summary");
    } finally {
      setSaving(false);
    }
  };

  // Add to DB callback
  const handleAddToDb = (newIngredient: any) => {
    if (!addToDbModal) return;
    const { section, idx } = addToDbModal;
    const lines = section === "active" ? [...activeLines] : [...excipientLines];
    lines[idx] = {
      ...lines[idx], name: newIngredient.name, rmId: newIngredient.rmId,
      costPerKg: newIngredient.costPerKg || "", activeContentPct: newIngredient.activeContentPct || "100",
      supplier: newIngredient.supplierName || "Unknown", isEstimated: true, inDb: true, dbId: newIngredient.id,
    };
    section === "active" ? setActiveLines(lines) : setExcipientLines(lines);
    setAddToDbModal(null);
  };

  // ─── Render ─────────────────────────────────────────────────────────

  const currentStepIdx = STEPS.findIndex((s) => s.id === step);

  return (
    <div className="max-w-[1400px] mx-auto">
      {/* Step Indicator */}
      <div className="flex items-center gap-1 mb-6 bg-white rounded-2xl border border-gray-200 p-3 shadow-sm">
        {STEPS.map((s, i) => {
          const Icon = s.icon;
          const isActive = s.id === step;
          const isPast = i < currentStepIdx;
          return (
            <div key={s.id} className="flex items-center flex-1">
              <button
                onClick={() => { if (isPast) setStep(s.id); }}
                disabled={!isPast && !isActive}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-colors w-full ${
                  isActive ? "bg-[#d10a11] text-white" : isPast ? "bg-green-50 text-green-700 hover:bg-green-100 cursor-pointer" : "bg-gray-50 text-gray-400"
                }`}
              >
                {isPast ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Icon className="h-3.5 w-3.5" />}
                {s.label}
              </button>
              {i < STEPS.length - 1 && <ArrowRight className="h-3 w-3 text-gray-300 mx-1 shrink-0" />}
            </div>
          );
        })}
      </div>

      {/* RFQ & Quote IDs */}
      <div className="flex items-center gap-4 mb-4 text-xs">
        <span className="font-mono font-bold text-gray-500">{rfqId}</span>
        <span className="text-gray-300">|</span>
        <span className="font-mono font-bold text-gray-500">{quoteId}</span>
      </div>

      {/* ─── Step 1: Upload ─── */}
      {step === "upload" && (
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Upload Supplement Facts Panel</h2>
            <p className="text-sm text-gray-500">Drop a PDF or image of the supplement facts panel. The AI will extract all ingredients, dosages, and product information automatically.</p>
          </div>

          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files?.[0]; if (f) handleExtract(f); }}
            onClick={() => !extracting && fileInputRef.current?.click()}
            className={`rounded-2xl border-2 border-dashed p-16 text-center cursor-pointer transition-all ${
              dragOver ? "border-[#d10a11] bg-red-50/50 scale-[1.01]" : extracting ? "border-blue-300 bg-blue-50/30" : "border-gray-200 hover:border-gray-400 hover:bg-gray-50/50"
            }`}
          >
            <input ref={fileInputRef} type="file" accept=".pdf,.png,.jpg,.jpeg" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleExtract(f); }} className="hidden" />
            {extracting ? (
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="h-10 w-10 text-blue-500 animate-spin" />
                <span className="text-sm font-semibold text-blue-700">AI is extracting supplement facts...</span>
                <span className="text-xs text-blue-500">This usually takes 5-10 seconds</span>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3">
                <FileUp className="h-10 w-10 text-gray-300" />
                <span className="text-base font-medium text-gray-600">Drop Supplement Facts Panel here</span>
                <span className="text-sm text-gray-400">PDF, PNG, or JPG &middot; or <span className="text-[#d10a11] font-medium">click to browse</span></span>
              </div>
            )}
          </div>

          <div className="mt-6 text-center">
            <button onClick={() => setStep("specifications")} className="text-sm text-gray-400 hover:text-gray-600 underline">
              Skip upload &mdash; enter manually
            </button>
          </div>
        </div>
      )}

      {/* ─── Step 2: Review Extraction ─── */}
      {step === "review" && extraction && (
        <div className="max-w-3xl mx-auto space-y-6">
          <div className="text-center mb-4">
            <h2 className="text-xl font-bold text-gray-900 mb-1">AI Extraction Results</h2>
            <p className="text-sm text-gray-500">Review what was extracted from <span className="font-medium">{extraction.fileName}</span></p>
          </div>

          {/* Product Specs Card */}
          <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Product Specs</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div><span className="text-gray-400 text-xs">Product Name</span><p className="font-semibold text-gray-900">{extraction.productName}</p></div>
              <div><span className="text-gray-400 text-xs">Format</span><p className="font-semibold text-gray-900 capitalize">{extraction.dosageForm}</p></div>
              <div><span className="text-gray-400 text-xs">Serving Size</span><p className="font-semibold text-gray-900">{extraction.servingSize} {extraction.servingSizeUnit}</p></div>
              <div><span className="text-gray-400 text-xs">Servings Per Container</span><p className="font-semibold text-gray-900">{extraction.servingsPerContainer}</p></div>
            </div>
            {extraction.flavor && (
              <div className="mt-3 text-sm"><span className="text-gray-400 text-xs">Flavor</span><p className="text-gray-700">{extraction.flavor}</p></div>
            )}
          </div>

          {/* Active Ingredients Table */}
          <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
              Active Ingredients ({extraction.activeIngredients.length})
            </h3>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-gray-500 text-xs font-medium">
                  <th className="text-left py-2 pr-4">Ingredient</th>
                  <th className="text-right py-2 px-3">Label Claim</th>
                  <th className="text-center py-2 px-3">Status</th>
                  <th className="text-left py-2 px-3">Notes</th>
                </tr>
              </thead>
              <tbody>
                {extraction.activeIngredients.map((ing, i) => {
                  const matched = extraction.activeLines[i]?.inDb;
                  return (
                    <tr key={i} className={`border-b border-gray-50 ${!matched ? "bg-red-50" : ""}`}>
                      <td className="py-2.5 pr-4 font-medium text-gray-900">{ing.name}</td>
                      <td className="py-2.5 px-3 text-right font-mono">{ing.amount} {ing.unit}</td>
                      <td className="py-2.5 px-3 text-center">
                        {matched ? (
                          <span className="inline-flex items-center gap-1 text-green-600 text-xs font-medium"><CheckCircle2 className="h-3 w-3" /> Matched</span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-red-600 text-xs font-bold"><XCircle className="h-3 w-3" /> Not in DB</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-xs text-gray-500">{ing.notes || "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Other Ingredients */}
          <div className="bg-gray-50 rounded-2xl border border-gray-200 p-6">
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">
              Other Ingredients (Excipients) ({extraction.otherIngredients.length})
            </h3>
            <p className="text-sm text-gray-700">{extraction.otherIngredients.join(", ")}</p>
          </div>

          {/* Allergen & Warnings */}
          {(extraction.allergen || extraction.warnings) && (
            <div className="bg-amber-50 rounded-2xl border border-amber-200 p-5">
              {extraction.allergen && <p className="text-sm text-amber-800"><span className="font-semibold">Allergen:</span> {extraction.allergen}</p>}
              {extraction.warnings && <p className="text-sm text-amber-800 mt-1"><span className="font-semibold">Warnings:</span> {extraction.warnings}</p>}
            </div>
          )}

          {/* Branded Ingredients */}
          {extraction.brandedIngredients.length > 0 && (
            <div className="bg-blue-50 rounded-2xl border border-blue-200 p-5">
              <p className="text-sm text-blue-800"><span className="font-semibold">Branded Ingredients:</span> {extraction.brandedIngredients.join(", ")}</p>
              <p className="text-xs text-blue-600 mt-1">These may require sourcing from specific authorized suppliers.</p>
            </div>
          )}

          {/* Match Summary */}
          <div className="flex items-center justify-between bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
            <div className="flex items-center gap-4 text-sm">
              <span className="text-green-600 font-semibold">{extraction.matchedCount} matched</span>
              {extraction.unmatchedCount > 0 && <span className="text-red-600 font-semibold">{extraction.unmatchedCount} not in database</span>}
            </div>
            <button onClick={() => setStep("specifications")} className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#d10a11] text-white font-semibold rounded-xl hover:bg-[#a30a0f] transition-colors text-sm">
              Continue to Specifications <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* ─── Step 3: Product Specifications ─── */}
      {step === "specifications" && (
        <div className="max-w-3xl mx-auto space-y-6">
          <h2 className="text-xl font-bold text-gray-900 mb-1">Product Specifications</h2>
          <p className="text-sm text-gray-500 mb-4">Verify and complete all product details before building the formulation.</p>

          {/* RFQ Information */}
          <Section title="RFQ Information">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <Field label="RFQ ID" value={rfqId} onChange={() => {}} disabled />
              <Field label="Company Name *" value={customerCompany} onChange={setCustomerCompany} placeholder="BioSchwartz LLC" />
              <Field label="Contact Email" value={customerEmail} onChange={setCustomerEmail} placeholder="info@bioschwartz.com" />
              <Field label="Phone Number" value={customerPhone} onChange={setCustomerPhone} placeholder="(555) 123-4567" />
              <Field label="Product Description" value={productDescription} onChange={setProductDescription} placeholder="Bariatric probiotic with digestive enzymes" span={2} />
            </div>
          </Section>

          {/* Basic Information */}
          <Section title="Basic Information">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <Field label="Product Name *" value={productName} onChange={setProductName} placeholder="Bariatric Probiotic" />
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Product Format *</label>
                <select value={dosageForm} onChange={(e) => setDosageForm(e.target.value)} className="input-field text-sm">
                  <option value="tablet">Tablet</option>
                  <option value="capsule">Capsule</option>
                  <option value="powder">Powder</option>
                  <option value="softgel">Softgel</option>
                  <option value="gummy">Gummy</option>
                  <option value="liquid">Liquid</option>
                </select>
              </div>
              <Field label="Flavor" value={flavor} onChange={setFlavor} placeholder="Cherry Strawberry" />
            </div>
          </Section>

          {/* Serving & Batch Information */}
          <Section title="Serving & Batch Information">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <Field label="Serving Size (units per serving)" value={servingSize} onChange={setServingSize} type="number" />
              <Field label="Servings Per Unit (per bottle) *" value={servingsPerUnit} onChange={setServingsPerUnit} type="number" />
              <Field label="Count Per Bottle (auto)" value={countPerBottle} onChange={() => {}} disabled />
              <Field label="MOQ (Minimum Order Quantity)" value={moq} onChange={setMoq} type="number" />
              <Field label="Batch Size (auto)" value={parseInt(batchSize).toLocaleString()} onChange={() => {}} disabled />
            </div>
          </Section>

          {/* Packaging & Labeling */}
          <Section title="Packaging & Labeling">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Bulk or Packaged *</label>
                <select value={bulkOrPackaged} onChange={(e) => setBulkOrPackaged(e.target.value as "bulk" | "packaged")} className="input-field text-sm">
                  <option value="packaged">Packaged</option>
                  <option value="bulk">Bulk</option>
                </select>
              </div>
              {bulkOrPackaged === "packaged" && (
                <>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1.5">Primary Packaging</label>
                    <select value={primaryPackaging} onChange={(e) => setPrimaryPackaging(e.target.value)} className="input-field text-sm">
                      <option value="HDPE Bottle">HDPE Bottle</option>
                      <option value="PET Bottle">PET Bottle</option>
                      <option value="Glass Bottle">Glass Bottle</option>
                      <option value="Jar">Jar</option>
                      <option value="Stick Pack">Stick Pack</option>
                      <option value="Gusset Bag">Gusset Bag</option>
                      <option value="Blister Pack">Blister Pack</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1.5">Secondary Packaging?</label>
                    <select value={secondaryPackaging ? "yes" : "no"} onChange={(e) => setSecondaryPackaging(e.target.value === "yes")} className="input-field text-sm">
                      <option value="no">No</option>
                      <option value="yes">Yes</option>
                    </select>
                  </div>
                  {secondaryPackaging && (
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1.5">Secondary Package Type</label>
                      <select value={secondaryType} onChange={(e) => setSecondaryType(e.target.value)} className="input-field text-sm">
                        <option value="Carton Box">Carton Box</option>
                        <option value="Shrink Wrap">Shrink Wrap</option>
                        <option value="Bundle Wrap">Bundle Wrap</option>
                        <option value="Gusset Bag">Gusset Bag</option>
                      </select>
                    </div>
                  )}
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1.5">Labeled or Unlabeled *</label>
                    <select value={labeledOrUnlabeled} onChange={(e) => setLabeledOrUnlabeled(e.target.value as "labeled" | "unlabeled")} className="input-field text-sm">
                      <option value="labeled">Labeled</option>
                      <option value="unlabeled">Unlabeled</option>
                    </select>
                  </div>
                  {labeledOrUnlabeled === "labeled" && (
                    <Field label="Label Supplier" value={labelSupplier} onChange={setLabelSupplier} placeholder="Customer-supplied or In-house" />
                  )}
                </>
              )}
            </div>
          </Section>

          {/* Additional Requirements */}
          <Section title="Additional Requirements">
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Special Requirements</label>
                <textarea value={specialRequirements} onChange={(e) => setSpecialRequirements(e.target.value)} rows={2} className="input-field text-sm resize-none" placeholder="e.g., Caffeine-free, vegan capsule only, specific allergen requirements..." />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Formulation Notes</label>
                <textarea value={formulationNotes} onChange={(e) => setFormulationNotes(e.target.value)} rows={2} className="input-field text-sm resize-none" placeholder="e.g., Request flavor samples first, adjust overage for shelf stability..." />
              </div>
            </div>
          </Section>

          {/* Regulatory */}
          <Section title="Regulatory & Compliance">
            <div className="mb-3">
              <label className="block text-xs font-medium text-gray-600 mb-2">Certifications Required</label>
              <div className="flex flex-wrap gap-2">
                {["cGMP", "NSF", "Organic", "Non-GMO", "Kosher", "Halal", "Vegan", "Gluten-Free"].map((c) => (
                  <button key={c} onClick={() => setCertifications(certifications.includes(c) ? certifications.filter((x) => x !== c) : [...certifications, c])}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${certifications.includes(c) ? "bg-[#d10a11] text-white" : "bg-gray-100 text-gray-500 hover:bg-gray-200"}`}
                  >{c}</button>
                ))}
              </div>
            </div>
            <Field label="Allergen Statement" value={allergenStatement} onChange={setAllergenStatement} placeholder="Not manufactured with wheat, gluten, soy..." />
          </Section>

          {/* Navigation */}
          <div className="flex items-center justify-between pt-4">
            {extraction && (
              <button onClick={() => setStep("review")} className="inline-flex items-center gap-2 px-4 py-2.5 text-gray-600 hover:text-gray-900 text-sm font-medium">
                <ArrowLeft className="h-4 w-4" /> Back to Review
              </button>
            )}
            <button onClick={() => setStep("formulation")} className="inline-flex items-center gap-2 px-6 py-3 bg-[#d10a11] text-white font-semibold rounded-xl hover:bg-[#a30a0f] transition-colors text-sm ml-auto">
              Build Formulation & Quote <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* ─── Step 4: Formulation & Quote ─── */}
      {step === "formulation" && (
        <div className="flex gap-6">
          {/* Left Panel */}
          <div className="flex-1 min-w-0 space-y-4 pb-20">
            {/* Product Header */}
            <div className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-gray-900">{productName || "Untitled Product"}</h2>
                <p className="text-xs text-gray-500">{customerCompany} &middot; {dosageForm} &middot; {countPerBottle} count &middot; MOQ {parseInt(moq).toLocaleString()} &middot; {bulkOrPackaged}</p>
              </div>
              <button onClick={() => setStep("specifications")} className="text-xs text-gray-400 hover:text-gray-600 underline">Edit Specs</button>
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
                lines={activeLines} section="active" isExcipientTable={false}
                searchIdx={searchIdx} searchQuery={searchQuery} searchResults={searchResults}
                onSearch={(idx) => { setSearchIdx({ section: "active", idx }); setSearchQuery(activeLines[idx]?.name || ""); }}
                onDoSearch={doSearch} onSelectIngredient={selectIngredient}
                onUpdate={updateLine} onRemove={removeLine}
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
                <p className="text-xs text-gray-400 italic py-2">No excipients yet.</p>
              ) : (
                <IngredientTableUI
                  lines={excipientLines} section="excipient" isExcipientTable={true}
                  searchIdx={searchIdx} searchQuery={searchQuery} searchResults={searchResults}
                  onSearch={(idx) => { setSearchIdx({ section: "excipient", idx }); setSearchQuery(excipientLines[idx]?.name || ""); }}
                  onDoSearch={doSearch} onSelectIngredient={selectIngredient}
                  onUpdate={updateLine} onRemove={removeLine}
                  onAddToDb={(idx) => setAddToDbModal({ line: excipientLines[idx], section: "excipient", idx })}
                  onCloseSearch={() => { setSearchIdx(null); setSearchResults([]); }}
                />
              )}
            </div>

            {/* Manufacturing */}
            {bulkOrPackaged === "packaged" && (
              <Collapsible title="Manufacturing Costs" icon={Factory} subtitle={`$${costs.mfgPerBottle.toFixed(2)}/bottle`}>
                <div className="grid grid-cols-4 gap-3">
                  <Field label="Blending / Unit" value={String(mfg.blending)} onChange={(v) => setMfg({ ...mfg, blending: parseFloat(v) || 0 })} type="number" />
                  <Field label={mfg.processingLabel} value={String(mfg.processing)} onChange={(v) => setMfg({ ...mfg, processing: parseFloat(v) || 0 })} type="number" />
                  <Field label="Waste %" value={String(mfg.wastePct)} onChange={(v) => setMfg({ ...mfg, wastePct: parseFloat(v) || 0 })} type="number" />
                  <Field label="Setup / Batch" value={String(mfg.setupPerBatch)} onChange={(v) => setMfg({ ...mfg, setupPerBatch: parseFloat(v) || 0 })} type="number" />
                </div>
              </Collapsible>
            )}

            {/* Packaging */}
            {bulkOrPackaged === "packaged" && (
              <Collapsible title="Packaging Costs" icon={Package} subtitle={`$${costs.pkgPerBottle.toFixed(2)}/bottle · ${pkgPreset}`}>
                <div className="mb-3">
                  <label className="block text-xs font-medium text-gray-600 mb-1">Preset</label>
                  <select value={pkgPreset} onChange={(e) => { setPkgPreset(e.target.value); const p = PKG_PRESETS.find((p) => p.name === e.target.value); if (p) setPkg(p.values); }} className="input-field text-sm w-64">
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
            )}
          </div>

          {/* Right Panel */}
          <div className="w-80 shrink-0 hidden lg:block">
            <CostSummaryPanel
              dealNumber={rfqId} status="Formulating"
              rmCost={costs.rmPerBottle} mfgCost={costs.mfgPerBottle}
              pkgCost={costs.pkgPerBottle} overheadCost={costs.overheadPerBottle}
              cogs={costs.cogsPerBottle} tiers={costs.tiers}
              ingredientCount={allLines.filter((l) => l.name.trim()).length}
              fillMg={costs.totalFillMg} hasEstimated={hasEstimated}
              saving={saving} onSave={saveDeal}
            />
          </div>
        </div>
      )}

      {/* ─── Step 5: Summary ─── */}
      {step === "summary" && (
        <div className="max-w-2xl mx-auto text-center py-12">
          <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Deal Saved Successfully</h2>
          <p className="text-sm text-gray-500 mb-6">
            {rfqId} &middot; {productName} &middot; {customerCompany}
          </p>
          <div className="flex items-center justify-center gap-4">
            <button onClick={() => router.push("/deals")} className="px-5 py-2.5 bg-gray-100 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-200">
              View All Deals
            </button>
            <button onClick={() => window.location.reload()} className="px-5 py-2.5 bg-[#d10a11] text-white rounded-xl text-sm font-semibold hover:bg-[#a30a0f]">
              + New Deal
            </button>
          </div>
        </div>
      )}

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

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
      <h3 className="text-sm font-semibold text-gray-900 mb-4">{title}</h3>
      {children}
    </div>
  );
}

function IngredientTableUI({ lines, section, isExcipientTable, searchIdx, searchQuery, searchResults, onSearch, onDoSearch, onSelectIngredient, onUpdate, onRemove, onAddToDb, onCloseSearch }: {
  lines: FormulaLine[]; section: "active" | "excipient"; isExcipientTable: boolean;
  searchIdx: { section: string; idx: number } | null; searchQuery: string; searchResults: any[];
  onSearch: (idx: number) => void; onDoSearch: (q: string) => void;
  onSelectIngredient: (section: "active" | "excipient", idx: number, ing: any) => void;
  onUpdate: (section: "active" | "excipient", idx: number, field: keyof FormulaLine, value: string | boolean) => void;
  onRemove: (section: "active" | "excipient", idx: number) => void;
  onAddToDb: (idx: number) => void; onCloseSearch: () => void;
}) {
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
              <tr key={line.key} className={`border-b border-gray-50 ${notInDb ? "bg-red-100/70 border-l-4 border-l-red-500" : line.inDb && line.name.trim() ? "bg-green-50/30" : ""}`}>
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
                        <button onClick={() => onAddToDb(i)} className="shrink-0 px-2 py-1 bg-red-600 text-white text-[9px] font-bold rounded-md hover:bg-red-700 shadow-sm">+ Add to DB</button>
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

function Collapsible({ title, icon: Icon, subtitle, children }: { title: string; icon: React.ComponentType<{ className?: string }>; subtitle?: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors">
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

function Field({ label, value, onChange, placeholder, type, span, disabled }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string; span?: number; disabled?: boolean }) {
  return (
    <div className={span === 2 ? "col-span-2" : ""}>
      <label className="block text-xs font-medium text-gray-600 mb-1.5">{label}</label>
      <input type={type || "text"} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} disabled={disabled}
        className={`input-field text-sm ${disabled ? "bg-gray-100 text-gray-500 cursor-not-allowed" : ""}`} />
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
