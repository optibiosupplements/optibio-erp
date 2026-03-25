"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import {
  Plus,
  Trash2,
  Calculator,
  FileDown,
  AlertTriangle,
  Search,
  ChevronRight,
  Package,
  Factory,
  FlaskConical,
  DollarSign,
  Check,
  Save,
  Loader2,
  Upload,
  FileUp,
  Sparkles,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { generateTieredQuote } from "@/domains/pricing/pricing.engine";
import type { IngredientLine, QuoteSummary } from "@/domains/pricing/pricing.types";
import { sizeCapsule, CAPSULE_CAPACITIES } from "@/domains/formulation/capsule-sizer";

// ─── Types ──────────────────────────────────────────────────────────────────

interface DbIngredient {
  id: string;
  rmId: string;
  name: string;
  category: string;
  supplierName: string;
  costPerKg: string;
  activeContentPct: string;
  baseOveragePct: string;
  baseWastagePct: string;
  overageCapsule: string | null;
  overageTablet: string | null;
  wastageCapsule: string | null;
  wastageTablet: string | null;
  isEstimatedPrice: boolean;
  labelClaimActive: boolean;
}

interface FormulaLine {
  key: string;
  dbIngredient: DbIngredient | null;
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
  // Calculated
  adjustedMg: number;
  finalMg: number;
  rmRequiredKg: number;
  lineCost: number;
}

interface PackagingLine {
  name: string;
  costPerBottle: number;
}

interface MfgCosts {
  blendingLaborPerUnit: number;
  compressionOrEncapPerUnit: number;
  productionWastePct: number;
  setupCostPerBatch: number;
}

// ─── Defaults ───────────────────────────────────────────────────────────────

const DEFAULT_MFG: MfgCosts = {
  blendingLaborPerUnit: 0.048,
  compressionOrEncapPerUnit: 0.065,
  productionWastePct: 2,
  setupCostPerBatch: 200,
};

const DEFAULT_PKG: PackagingLine[] = [
  { name: "HDPE Bottle", costPerBottle: 0.428 },
  { name: "Cap", costPerBottle: 0.113 },
  { name: "Desiccant", costPerBottle: 0.0234 },
  { name: "Heat Shrink Sleeve", costPerBottle: 0.01 },
  { name: "Label", costPerBottle: 0.065 },
  { name: "Carton (IFC Box)", costPerBottle: 0.01875 },
  { name: "Pallet Cost", costPerBottle: 0.00247 },
  { name: "Packaging Labor", costPerBottle: 0.03462 },
];

const TIERS = [
  { quantity: 2000, marginPct: 40 },
  { quantity: 5000, marginPct: 35 },
  { quantity: 10000, marginPct: 30 },
];

let lineCounter = 0;
function nextKey() {
  return "line-" + ++lineCounter;
}

function emptyLine(): FormulaLine {
  return {
    key: nextKey(),
    dbIngredient: null,
    name: "",
    rmId: "",
    labelClaimMg: "",
    activeContentPct: "100",
    overagePct: "10",
    wastagePct: "3",
    costPerKg: "",
    supplier: "",
    isEstimated: false,
    isExcipient: false,
    adjustedMg: 0,
    finalMg: 0,
    rmRequiredKg: 0,
    lineCost: 0,
  };
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function NewQuotePage() {
  // Product info
  const [productName, setProductName] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [dosageForm, setDosageForm] = useState<"capsule" | "tablet">("tablet");
  const [servingSize, setServingSize] = useState("1");
  const [containerCount, setContainerCount] = useState("60");

  // Part A: Formula
  const [lines, setLines] = useState<FormulaLine[]>([emptyLine()]);

  // Part B: Manufacturing
  const [mfg, setMfg] = useState<MfgCosts>(DEFAULT_MFG);

  // Part C: Packaging
  const [pkg, setPkg] = useState<PackagingLine[]>(DEFAULT_PKG);

  // Results
  const [calculated, setCalculated] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [capsuleResult, setCapsuleResult] = useState<ReturnType<typeof sizeCapsule> | null>(null);

  // AI Extraction
  const [extracting, setExtracting] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExtract = async (file: File) => {
    setExtracting(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/extract", { method: "POST", body: formData });
      const data = await res.json();

      if (!data.success) {
        setErrors([data.error || "Extraction failed"]);
        return;
      }

      const ext = data.extracted;

      // Fill product info
      if (ext.productName) setProductName(ext.productName);
      if (ext.dosageForm) setDosageForm(ext.dosageForm === "capsule" ? "capsule" : "tablet");
      if (ext.servingSize) setServingSize(String(ext.servingSize));
      if (ext.servingsPerContainer) setContainerCount(String(ext.servingsPerContainer));

      // Build formula lines from matched ingredients
      const newLines: FormulaLine[] = [];

      for (const mi of data.matchedIngredients || []) {
        const db = mi.dbMatch;
        const ovPct = dosageForm === "capsule" ? db?.overageCapsule : db?.overageTablet;
        const waPct = dosageForm === "capsule" ? db?.wastageCapsule : db?.wastageTablet;

        newLines.push({
          key: nextKey(),
          dbIngredient: db,
          name: db?.name || mi.name,
          rmId: db?.rmId || "",
          labelClaimMg: String(mi.amount || ""),
          activeContentPct: db?.activeContentPct || "100",
          overagePct: ovPct || db?.baseOveragePct || "10",
          wastagePct: waPct || db?.baseWastagePct || "3",
          costPerKg: db?.costPerKg || "",
          supplier: db?.supplierName || "",
          isEstimated: db?.isEstimatedPrice || false,
          isExcipient: false,
          adjustedMg: 0,
          finalMg: 0,
          rmRequiredKg: 0,
          lineCost: 0,
        });
      }

      if (newLines.length > 0) {
        setLines(newLines);
      }

      setErrors([]);
      setCalculated(false);
    } catch (err: any) {
      setErrors(["Extraction failed: " + (err.message || "Unknown error")]);
    } finally {
      setExtracting(false);
    }
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleExtract(file);
  };

  const onFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleExtract(file);
  };

  // Derived
  const servingSizeNum = parseInt(servingSize) || 1;
  const containerCountNum = parseInt(containerCount) || 60;
  const batchUnits = (qty: number) => qty; // qty = bottles

  // ─── Ingredient Search ──────────────────────────────────────────────────

  const [searchIndex, setSearchIndex] = useState<number | null>(null);
  const [searchResults, setSearchResults] = useState<DbIngredient[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const searchTimeout = useRef<NodeJS.Timeout | null>(null);

  const doSearch = useCallback((query: string) => {
    setSearchQuery(query);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }
    searchTimeout.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/ingredients/search?q=${encodeURIComponent(query)}`);
        const data = await res.json();
        setSearchResults(data);
      } catch {
        setSearchResults([]);
      }
    }, 250);
  }, []);

  const selectIngredient = (lineIdx: number, ing: DbIngredient) => {
    const ovPct = dosageForm === "capsule" ? ing.overageCapsule : ing.overageTablet;
    const waPct = dosageForm === "capsule" ? ing.wastageCapsule : ing.wastageTablet;

    const updated = [...lines];
    updated[lineIdx] = {
      ...updated[lineIdx],
      dbIngredient: ing,
      name: ing.name,
      rmId: ing.rmId,
      activeContentPct: ing.activeContentPct,
      overagePct: ovPct ?? ing.baseOveragePct ?? "10",
      wastagePct: waPct ?? ing.baseWastagePct ?? "3",
      costPerKg: ing.costPerKg,
      supplier: ing.supplierName || "",
      isEstimated: ing.isEstimatedPrice,
      isExcipient: !ing.labelClaimActive,
    };
    setLines(updated);
    setSearchIndex(null);
    setSearchResults([]);
    setSearchQuery("");
  };

  // ─── Line Management ────────────────────────────────────────────────────

  const addLine = () => setLines([...lines, emptyLine()]);
  const removeLine = (i: number) => {
    if (lines.length <= 1) return;
    setLines(lines.filter((_, idx) => idx !== i));
  };
  const updateLine = (i: number, field: keyof FormulaLine, value: string | boolean) => {
    const updated = [...lines];
    updated[i] = { ...updated[i], [field]: value };
    setLines(updated);
  };

  // ─── Calculate ──────────────────────────────────────────────────────────

  const calculate = useCallback(() => {
    const errs: string[] = [];
    const calculated: FormulaLine[] = [];

    for (const line of lines) {
      if (!line.name.trim()) continue;
      const lc = parseFloat(line.labelClaimMg);
      const ac = parseFloat(line.activeContentPct);
      const ov = parseFloat(line.overagePct);
      const wa = parseFloat(line.wastagePct);
      const cost = parseFloat(line.costPerKg);

      if (isNaN(lc) || lc <= 0) { errs.push(`${line.name}: enter label claim (mg)`); continue; }
      if (isNaN(ac) || ac <= 0) { errs.push(`${line.name}: enter active content %`); continue; }
      if (isNaN(cost) || cost <= 0) { errs.push(`${line.name}: enter cost/kg`); continue; }

      const adjustedMg = lc / (ac / 100);
      const finalMg = adjustedMg * (1 + (isNaN(ov) ? 0 : ov) / 100);
      const totalServings = containerCountNum * servingSizeNum;
      const rmRequiredKg = (finalMg * totalServings) / 1_000_000; // per batch of 1 bottle
      const rmCostPerUnit = (finalMg / 1_000_000) * cost;
      const lineCost = rmCostPerUnit * (1 + (isNaN(wa) ? 0 : wa) / 100);

      calculated.push({
        ...line,
        adjustedMg: round(adjustedMg),
        finalMg: round(finalMg),
        rmRequiredKg: round(rmRequiredKg, 6),
        lineCost: round(lineCost, 6),
      });
    }

    if (calculated.length === 0) {
      errs.push("Add at least one ingredient with valid data.");
    }

    setErrors(errs);
    if (errs.length > 0) return;

    setLines(calculated);

    // Capsule sizing
    const totalFillMg = calculated.reduce((s, l) => s + l.finalMg, 0) * servingSizeNum;
    if (dosageForm === "capsule") {
      setCapsuleResult(sizeCapsule(totalFillMg));
    } else {
      setCapsuleResult(null);
    }

    setCalculated(true);
  }, [lines, dosageForm, servingSizeNum, containerCountNum]);

  // ─── Derived Totals ─────────────────────────────────────────────────────

  const totalRmPerServing = lines.reduce((s, l) => s + l.lineCost, 0);
  const totalRmPerBottle = totalRmPerServing * containerCountNum * servingSizeNum;
  const totalFillMg = lines.reduce((s, l) => s + l.finalMg, 0);

  const mfgPerBottle =
    (mfg.blendingLaborPerUnit + mfg.compressionOrEncapPerUnit) * containerCountNum * servingSizeNum +
    totalRmPerBottle * (mfg.productionWastePct / 100);

  const pkgPerBottle = pkg.reduce((s, p) => s + p.costPerBottle, 0);
  const overheadPerBottle = (totalRmPerBottle + mfgPerBottle) * 0.15;
  const cogsPerBottle = totalRmPerBottle + mfgPerBottle + pkgPerBottle + overheadPerBottle;

  const hasEstimated = lines.some((l) => l.isEstimated);
  const [saving, setSaving] = useState(false);
  const [savedQuoteNumber, setSavedQuoteNumber] = useState<string | null>(null);
  const router = useRouter();

  const saveQuote = async () => {
    if (!calculated) return;
    setSaving(true);
    try {
      const tierData = TIERS.map((tier) => {
        const setupAmortized = mfg.setupCostPerBatch / tier.quantity;
        const totalCogs = cogsPerBottle + setupAmortized;
        const price = totalCogs / (1 - tier.marginPct / 100);
        return {
          quantity: tier.quantity,
          rawMaterialCost: totalRmPerBottle,
          manufacturingCost: mfgPerBottle,
          packagingCost: pkgPerBottle,
          overheadCost: overheadPerBottle,
          cogsPerUnit: totalCogs,
          marginPct: tier.marginPct,
          pricePerUnit: price,
          totalBatchPrice: price * tier.quantity,
        };
      });

      const res = await fetch("/api/quotes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productName,
          customerName,
          dosageForm,
          servingSize: servingSizeNum,
          containerCount: containerCountNum,
          tiers: tierData,
          ingredients: lines.filter((l) => l.name.trim()).map((l) => ({
            name: l.name,
            rmId: l.rmId,
            labelClaimMg: l.labelClaimMg,
            activeContentPct: l.activeContentPct,
            overagePct: l.overagePct,
            wastagePct: l.wastagePct,
            costPerKg: l.costPerKg,
            finalMg: l.finalMg,
            lineCost: l.lineCost,
            isExcipient: l.isExcipient,
            isEstimated: l.isEstimated,
          })),
          manufacturing: mfg,
          packaging: pkg,
          cogsPerBottle,
          totalFillMg,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setSavedQuoteNumber(data.quoteNumber);
      }
    } catch (err) {
      console.error("Save failed:", err);
    } finally {
      setSaving(false);
    }
  };

  // ─── Render ─────────────────────────────────────────────────────────────

  return (
    <div className="max-w-7xl pb-20">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Quote Builder</h1>
        <p className="text-sm text-gray-500 mt-1">
          TM-style formulation costing — Part A (Raw Materials) → Part B (Manufacturing) → Part C (Packaging) → Pricing
        </p>
      </div>

      {/* ── AI Intake: Drag & Drop ────────────────────────────────────── */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        className={`relative mb-6 rounded-2xl border-2 border-dashed p-8 text-center transition-all cursor-pointer ${
          dragOver
            ? "border-[#d10a11] bg-red-50/50"
            : extracting
            ? "border-blue-300 bg-blue-50/30"
            : "border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50/50"
        }`}
        onClick={() => !extracting && fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.png,.jpg,.jpeg,.webp"
          onChange={onFileSelect}
          className="hidden"
        />
        {extracting ? (
          <div className="flex flex-col items-center gap-3">
            <div className="relative">
              <Loader2 className="h-10 w-10 text-blue-500 animate-spin" />
              <Sparkles className="h-4 w-4 text-blue-400 absolute -top-1 -right-1 animate-pulse" />
            </div>
            <div>
              <p className="text-sm font-semibold text-blue-700">AI is extracting the supplement facts panel...</p>
              <p className="text-xs text-blue-500 mt-1">Identifying ingredients, dosages, and matching against 2,567 ingredients in our database</p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3">
            <div className="flex items-center gap-2">
              <div className="p-3 rounded-xl bg-gray-100">
                <FileUp className="h-6 w-6 text-gray-400" />
              </div>
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-700">
                Drop a Supplement Facts panel here
              </p>
              <p className="text-xs text-gray-400 mt-1">
                PDF, PNG, or JPG — AI will extract all ingredients, dosages, and auto-build the formulation
              </p>
            </div>
            <div className="flex items-center gap-4 mt-1">
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 rounded-lg text-xs text-gray-500">
                <Upload className="h-3 w-3" /> Upload file
              </span>
              <span className="text-xs text-gray-300">or drag & drop</span>
            </div>
          </div>
        )}
      </div>

      {/* ── Step 0: Product Info ─────────────────────────────────────────── */}
      <Section icon={FlaskConical} title="Product Information" step={0}>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <Field label="Product Name" span={2}>
            <input value={productName} onChange={(e) => setProductName(e.target.value)} placeholder="e.g., Bariatric Probiotic 60ct" className="input-field" />
          </Field>
          <Field label="Customer">
            <input value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="BioSchwartz LLC" className="input-field" />
          </Field>
          <Field label="Dosage Form">
            <select value={dosageForm} onChange={(e) => setDosageForm(e.target.value as any)} className="input-field">
              <option value="capsule">Capsule</option>
              <option value="tablet">Tablet</option>
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Serving Size">
              <input type="number" value={servingSize} onChange={(e) => setServingSize(e.target.value)} className="input-field" />
            </Field>
            <Field label="Count/Bottle">
              <input type="number" value={containerCount} onChange={(e) => setContainerCount(e.target.value)} className="input-field" />
            </Field>
          </div>
        </div>
      </Section>

      {/* ── Part A: Raw Materials ────────────────────────────────────────── */}
      <Section icon={FlaskConical} title="Part A — Raw Materials" step={1}>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-gray-50 border-b text-gray-600 font-medium">
                <th className="text-left px-2 py-2.5 w-8">#</th>
                <th className="text-left px-2 py-2.5 min-w-[200px]">Ingredient</th>
                <th className="text-left px-2 py-2.5 w-20">RM ID</th>
                <th className="text-right px-2 py-2.5 w-20">Label Claim</th>
                <th className="text-right px-2 py-2.5 w-16">Active %</th>
                <th className="text-right px-2 py-2.5 w-20">Adj. (mg)</th>
                <th className="text-right px-2 py-2.5 w-16">Ov. %</th>
                <th className="text-right px-2 py-2.5 w-20">Final (mg)</th>
                <th className="text-right px-2 py-2.5 w-16">Waste %</th>
                <th className="text-right px-2 py-2.5 w-20">Cost/Kg</th>
                <th className="text-right px-2 py-2.5 w-16">Supplier</th>
                <th className="text-right px-2 py-2.5 w-24">Line Cost</th>
                <th className="text-center px-2 py-2.5 w-10">Est</th>
                <th className="w-8"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {lines.map((line, i) => (
                <tr key={line.key} className={`hover:bg-blue-50/30 transition-colors ${line.isExcipient ? "bg-gray-50/50" : ""}`}>
                  <td className="px-2 py-1.5 text-gray-400 font-mono">{i + 1}</td>
                  <td className="px-2 py-1.5 relative">
                    {searchIndex === i ? (
                      <div className="relative">
                        <Search className="absolute left-2 top-2 h-3.5 w-3.5 text-gray-400" />
                        <input
                          autoFocus
                          value={searchQuery}
                          onChange={(e) => doSearch(e.target.value)}
                          onBlur={() => setTimeout(() => setSearchIndex(null), 200)}
                          placeholder="Search ingredients..."
                          className="input-field pl-7 text-xs"
                        />
                        {searchResults.length > 0 && (
                          <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-xl max-h-60 overflow-y-auto">
                            {searchResults.map((r) => (
                              <button
                                key={r.id}
                                onMouseDown={() => selectIngredient(i, r)}
                                className="w-full text-left px-3 py-2 hover:bg-blue-50 text-xs border-b border-gray-50 last:border-0"
                              >
                                <div className="font-medium text-gray-900">{r.name}</div>
                                <div className="text-gray-500 flex gap-2 mt-0.5">
                                  <span>{r.rmId}</span>
                                  <span>•</span>
                                  <span>{r.category}</span>
                                  <span>•</span>
                                  <span>${r.costPerKg}/kg</span>
                                  <span>•</span>
                                  <span>Active: {r.activeContentPct}%</span>
                                  {r.isEstimatedPrice && <span className="text-amber-600">⚠ Est.</span>}
                                </div>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    ) : (
                      <button
                        onClick={() => { setSearchIndex(i); setSearchQuery(line.name); }}
                        className="w-full text-left text-xs px-2 py-1.5 rounded border border-transparent hover:border-gray-200 transition-colors"
                      >
                        {line.name || <span className="text-gray-400 italic">Click to search...</span>}
                      </button>
                    )}
                  </td>
                  <td className="px-2 py-1.5 font-mono text-gray-400 text-[10px]">{line.rmId}</td>
                  <td className="px-2 py-1.5">
                    <input type="number" value={line.labelClaimMg} onChange={(e) => updateLine(i, "labelClaimMg", e.target.value)} placeholder="mg" className="input-field text-right text-xs w-full" />
                  </td>
                  <td className="px-2 py-1.5">
                    <input type="number" value={line.activeContentPct} onChange={(e) => updateLine(i, "activeContentPct", e.target.value)} className="input-field text-right text-xs w-full bg-blue-50/50" />
                  </td>
                  <td className="px-2 py-1.5 text-right font-mono text-gray-600">{line.adjustedMg ? line.adjustedMg.toFixed(1) : "—"}</td>
                  <td className="px-2 py-1.5">
                    <input type="number" value={line.overagePct} onChange={(e) => updateLine(i, "overagePct", e.target.value)} className="input-field text-right text-xs w-full" />
                  </td>
                  <td className="px-2 py-1.5 text-right font-mono font-medium text-gray-900">{line.finalMg ? line.finalMg.toFixed(1) : "—"}</td>
                  <td className="px-2 py-1.5">
                    <input type="number" value={line.wastagePct} onChange={(e) => updateLine(i, "wastagePct", e.target.value)} className="input-field text-right text-xs w-full" />
                  </td>
                  <td className="px-2 py-1.5">
                    <input type="number" value={line.costPerKg} onChange={(e) => updateLine(i, "costPerKg", e.target.value)} className="input-field text-right text-xs w-full" />
                  </td>
                  <td className="px-2 py-1.5 text-[10px] text-gray-500 truncate max-w-[80px]">{line.supplier}</td>
                  <td className="px-2 py-1.5 text-right font-mono text-sm font-semibold text-gray-900">
                    {line.lineCost > 0 ? "$" + line.lineCost.toFixed(5) : "—"}
                  </td>
                  <td className="px-2 py-1.5 text-center">
                    {line.isEstimated && <span className="inline-block w-2 h-2 rounded-full bg-amber-400" title="Estimated price" />}
                  </td>
                  <td className="px-1 py-1.5">
                    <button onClick={() => removeLine(i)} disabled={lines.length <= 1} className="p-1 text-gray-300 hover:text-red-500 disabled:opacity-20 transition-colors">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
            {calculated && (
              <tfoot>
                <tr className="bg-gray-50 border-t-2 border-gray-300 font-semibold text-xs">
                  <td colSpan={7} className="px-2 py-2.5 text-right">Total Fill Weight per Serving:</td>
                  <td className="px-2 py-2.5 text-right font-mono">{totalFillMg.toFixed(1)} mg</td>
                  <td colSpan={3} className="px-2 py-2.5 text-right">Total RM per Serving:</td>
                  <td className="px-2 py-2.5 text-right font-mono text-[#d10a11]">${totalRmPerServing.toFixed(5)}</td>
                  <td colSpan={2}></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
        <div className="mt-3 flex gap-2">
          <button onClick={addLine} className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-[#d10a11] bg-red-50 rounded-lg hover:bg-red-100 transition-colors">
            <Plus className="h-3.5 w-3.5" /> Add Ingredient
          </button>
        </div>
      </Section>

      {/* ── Part B: Manufacturing Costs ──────────────────────────────────── */}
      <Section icon={Factory} title="Part B — Manufacturing Costs" step={2}>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Field label="Blending Labor / Unit">
            <input type="number" step="0.001" value={mfg.blendingLaborPerUnit} onChange={(e) => setMfg({ ...mfg, blendingLaborPerUnit: parseFloat(e.target.value) || 0 })} className="input-field text-right" />
          </Field>
          <Field label={dosageForm === "capsule" ? "Encapsulation / Unit" : "Compression / Unit"}>
            <input type="number" step="0.001" value={mfg.compressionOrEncapPerUnit} onChange={(e) => setMfg({ ...mfg, compressionOrEncapPerUnit: parseFloat(e.target.value) || 0 })} className="input-field text-right" />
          </Field>
          <Field label="Production Waste %">
            <input type="number" step="0.1" value={mfg.productionWastePct} onChange={(e) => setMfg({ ...mfg, productionWastePct: parseFloat(e.target.value) || 0 })} className="input-field text-right" />
          </Field>
          <Field label="Setup Cost / Batch">
            <input type="number" value={mfg.setupCostPerBatch} onChange={(e) => setMfg({ ...mfg, setupCostPerBatch: parseFloat(e.target.value) || 0 })} className="input-field text-right" />
          </Field>
        </div>
        {calculated && (
          <div className="mt-4 p-3 bg-gray-50 rounded-lg text-sm">
            <span className="text-gray-600">Mfg. Cost per Bottle:</span>{" "}
            <span className="font-mono font-semibold">${mfgPerBottle.toFixed(4)}</span>
          </div>
        )}
      </Section>

      {/* ── Part C: Packaging Costs ──────────────────────────────────────── */}
      <Section icon={Package} title="Part C — Packaging Costs" step={3}>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {pkg.map((p, i) => (
            <Field key={i} label={p.name}>
              <input
                type="number"
                step="0.001"
                value={p.costPerBottle}
                onChange={(e) => {
                  const updated = [...pkg];
                  updated[i] = { ...updated[i], costPerBottle: parseFloat(e.target.value) || 0 };
                  setPkg(updated);
                }}
                className="input-field text-right"
              />
            </Field>
          ))}
        </div>
        {calculated && (
          <div className="mt-4 p-3 bg-gray-50 rounded-lg text-sm">
            <span className="text-gray-600">Packaging Cost per Bottle:</span>{" "}
            <span className="font-mono font-semibold">${pkgPerBottle.toFixed(4)}</span>
          </div>
        )}
      </Section>

      {/* ── Errors ───────────────────────────────────────────────────────── */}
      {errors.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
            <div className="space-y-1">
              {errors.map((err, i) => (
                <p key={i} className="text-sm text-amber-700">{err}</p>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Calculate Button ─────────────────────────────────────────────── */}
      <div className="flex gap-3 mb-8">
        <button onClick={calculate} className="inline-flex items-center gap-2 px-6 py-3 bg-[#d10a11] text-white font-semibold rounded-xl hover:bg-[#a30a0f] transition-colors shadow-sm">
          <Calculator className="h-5 w-5" /> Calculate Quote
        </button>
      </div>

      {/* ── Results ──────────────────────────────────────────────────────── */}
      {calculated && (
        <>
          {/* Capsule Sizing */}
          {capsuleResult && (
            <div className={`rounded-xl border p-4 mb-6 ${capsuleResult.feasible ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"}`}>
              <h3 className="font-semibold text-sm mb-1">{capsuleResult.feasible ? "✓ Capsule Sizing" : "✗ Sizing Issue"}</h3>
              <p className="text-sm">{capsuleResult.recommendation}</p>
              {capsuleResult.warnings.map((w, i) => (
                <p key={i} className="text-xs text-amber-600 mt-1">{w}</p>
              ))}
            </div>
          )}

          {/* COGS Summary */}
          <Section icon={DollarSign} title="COGS Summary (per Bottle)" step={4}>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <CostCard label="Part A — Raw Materials" value={totalRmPerBottle} color="blue" />
              <CostCard label="Part B — Manufacturing" value={mfgPerBottle} color="purple" />
              <CostCard label="Part C — Packaging" value={pkgPerBottle} color="green" />
              <CostCard label="Overhead (15%)" value={overheadPerBottle} color="orange" />
              <CostCard label="Total COGS" value={cogsPerBottle} color="red" highlight />
            </div>
          </Section>

          {/* Tiered Pricing */}
          <Section icon={DollarSign} title="Tiered Pricing" step={5}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {TIERS.map((tier, i) => {
                const setupAmortized = mfg.setupCostPerBatch / tier.quantity;
                const totalCogs = cogsPerBottle + setupAmortized;
                const price = totalCogs / (1 - tier.marginPct / 100);
                const batchTotal = price * tier.quantity;

                return (
                  <div key={i} className={`relative border rounded-2xl p-6 transition-shadow hover:shadow-lg ${i === 1 ? "border-[#d10a11] ring-2 ring-[#d10a11]/10" : "border-gray-200"}`}>
                    {i === 1 && (
                      <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 bg-[#d10a11] text-white text-[10px] font-bold rounded-full uppercase tracking-wider">
                        Recommended
                      </span>
                    )}
                    <div className="text-center mb-5">
                      <p className="text-3xl font-bold text-gray-900">{tier.quantity.toLocaleString()}</p>
                      <p className="text-xs text-gray-500 uppercase tracking-wider mt-1">bottles</p>
                    </div>
                    <div className="space-y-2 text-sm">
                      <Row label="COGS/Bottle" value={`$${totalCogs.toFixed(2)}`} />
                      <Row label="Setup (amortized)" value={`$${setupAmortized.toFixed(4)}`} muted />
                      <Row label="Margin" value={`${tier.marginPct}%`} />
                      <div className="border-t pt-3 mt-3">
                        <Row label="Price/Bottle" value={`$${price.toFixed(2)}`} bold accent />
                      </div>
                      <div className="bg-gray-50 -mx-6 -mb-6 px-6 py-4 rounded-b-2xl mt-4">
                        <div className="flex justify-between items-center">
                          <span className="text-gray-600 font-medium">Batch Total</span>
                          <span className="text-xl font-bold text-gray-900">${batchTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </Section>

          {/* Estimated Warning */}
          {hasEstimated && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-amber-800">Estimated Pricing Warning</p>
                  <p className="text-sm text-amber-700 mt-1">
                    {lines.filter((l) => l.isEstimated).length} ingredient(s) use Internal Database prices (marked with ⚠).
                    Verify with real supplier quotes before sending to customer.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Save / Success */}
          <div className="flex items-center gap-4 mt-2">
            {!savedQuoteNumber ? (
              <button
                onClick={saveQuote}
                disabled={saving}
                className="inline-flex items-center gap-2 px-6 py-3 bg-gray-900 text-white font-semibold rounded-xl hover:bg-gray-800 transition-colors shadow-sm disabled:opacity-50"
              >
                {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />}
                {saving ? "Saving..." : "Save Quote"}
              </button>
            ) : (
              <div className="flex items-center gap-3 px-5 py-3 bg-green-50 border border-green-200 rounded-xl">
                <Check className="h-5 w-5 text-green-600" />
                <div>
                  <p className="text-sm font-semibold text-green-800">Quote saved: {savedQuoteNumber}</p>
                  <button onClick={() => router.push("/quotes")} className="text-xs text-green-600 hover:underline mt-0.5">
                    View all quotes →
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ─── Sub-Components ───────────────────────────────────────────────────────

function Section({ icon: Icon, title, step, children }: { icon: any; title: string; step: number; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-6 mb-6 shadow-sm">
      <div className="flex items-center gap-3 mb-5">
        <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-gray-100 text-gray-500">
          <Icon className="h-4 w-4" />
        </div>
        <h2 className="text-base font-semibold text-gray-900">{title}</h2>
      </div>
      {children}
    </div>
  );
}

function Field({ label, children, span }: { label: string; children: React.ReactNode; span?: number }) {
  return (
    <div className={span ? `col-span-${span}` : ""}>
      <label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>
      {children}
    </div>
  );
}

function CostCard({ label, value, color, highlight }: { label: string; value: number; color: string; highlight?: boolean }) {
  const colors: Record<string, string> = {
    blue: "bg-blue-50 border-blue-100",
    purple: "bg-purple-50 border-purple-100",
    green: "bg-green-50 border-green-100",
    orange: "bg-orange-50 border-orange-100",
    red: highlight ? "bg-[#d10a11] border-[#d10a11] text-white" : "bg-red-50 border-red-100",
  };
  return (
    <div className={`rounded-xl border p-4 ${colors[color]}`}>
      <p className={`text-xs font-medium ${highlight ? "text-white/80" : "text-gray-500"}`}>{label}</p>
      <p className={`text-lg font-bold font-mono mt-1 ${highlight ? "text-white" : "text-gray-900"}`}>${value.toFixed(4)}</p>
    </div>
  );
}

function Row({ label, value, bold, muted, accent }: { label: string; value: string; bold?: boolean; muted?: boolean; accent?: boolean }) {
  return (
    <div className="flex justify-between">
      <span className={`${muted ? "text-gray-400" : "text-gray-600"} ${bold ? "font-medium" : ""}`}>{label}</span>
      <span className={`font-mono ${bold ? "font-bold" : ""} ${accent ? "text-[#d10a11]" : ""} ${muted ? "text-gray-400" : ""}`}>{value}</span>
    </div>
  );
}

function round(v: number, d = 2): number {
  const f = Math.pow(10, d);
  return Math.round(v * f) / f;
}
