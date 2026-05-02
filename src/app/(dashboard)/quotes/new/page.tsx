"use client";

/**
 * /quotes/new?formulationId=... — Quote Workspace
 *
 * Pipeline:
 *   1. Load formulation + ingredient lines (with real costs)
 *   2. Run pricing engine: RM cost + Manufacturing + Packaging + Overhead
 *   3. Generate 3 tiers (2K/40%, 5K/35%, 10K/30%) — all editable
 *   4. Save → POST /api/quotes (creates quote + tiers + line items, links to formulation)
 *   5. View page offers Excel + PDF download
 *
 * If no formulationId is provided, show a picker / nudge to The Lab.
 */

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Loader2, Save, FileSpreadsheet, AlertTriangle, FlaskConical, ChevronLeft } from "lucide-react";
import {
  calculateRawMaterialCost,
  calculateCOGS,
  generateTieredQuote,
} from "@/domains/pricing/pricing.engine";
import {
  DEFAULT_TIERS,
  DEFAULT_MANUFACTURING,
  DOSAGE_FORM_MFG,
  PKG_PRESETS,
  type IngredientLine,
  type ManufacturingCosts,
  type PackagingCosts,
  type TierConfig,
} from "@/domains/pricing/pricing.types";

interface FormulationLineRow {
  line: {
    id: string;
    labelClaimMg: string;
    activeContentPct: string;
    overagePct: string;
    finalMg: string;
    costPerKg: string;
    wastagePct: string;
    isExcipient: boolean;
  };
  ingredient: {
    id: string;
    rmId: string;
    name: string;
    isEstimatedPrice: boolean;
  } | null;
}

interface FormulationData {
  formulation: {
    id: string;
    name: string;
    dosageForm: string;
    capsuleSize: string | null;
    capsulesPerServing: number;
    servingsPerContainer: number | null;
    customerId: string | null;
  };
  ingredients: FormulationLineRow[];
}

export default function QuoteWorkspacePage() {
  const router = useRouter();
  const params = useSearchParams();
  const formulationId = params.get("formulationId");

  const [data, setData] = useState<FormulationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Editable knobs
  const [tiers, setTiers] = useState<TierConfig[]>(DEFAULT_TIERS);
  const [overheadPct, setOverheadPct] = useState(15);
  const [pkgPresetIdx, setPkgPresetIdx] = useState(0);
  const [packaging, setPackaging] = useState<PackagingCosts>(PKG_PRESETS[0].values);
  const [mfgOverride, setMfgOverride] = useState<ManufacturingCosts | null>(null);
  const [labCostPerBatch, setLabCostPerBatch] = useState(500);
  const [batchSize, setBatchSize] = useState(2000);

  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!formulationId) {
      setLoading(false);
      setError("No formulationId in URL — open this page from a Formulation detail.");
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/formulations/${formulationId}`);
        if (!res.ok) throw new Error(`Formulation ${formulationId} not found`);
        const fdata = await res.json();
        if (cancelled) return;
        // The /api/formulations/[id] route returns { formulation, ingredients: [{ ...line }] }
        // not joined with ingredient master — fetch joined version manually.
        setData({
          formulation: fdata.formulation,
          ingredients: fdata.ingredients.map((l: FormulationLineRow["line"]) => ({ line: l, ingredient: null })),
        });
        // Pick a sensible packaging preset based on count per bottle
        const count = fdata.formulation.servingsPerContainer ?? 60;
        const presetIdx = count >= 120 ? 2 : count >= 90 ? 1 : 0;
        setPkgPresetIdx(presetIdx);
        setPackaging(PKG_PRESETS[presetIdx].values);
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        if (!cancelled) setError(msg);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [formulationId]);

  // Build IngredientLine[] for the pricing engine
  const ingredientLines: IngredientLine[] = useMemo(() => {
    if (!data) return [];
    return data.ingredients
      .filter((r) => !r.line.isExcipient || (r.line.isExcipient && parseFloat(r.line.costPerKg) > 0))
      .map((r) => ({
        name: r.ingredient?.name ?? "Ingredient",
        labelClaimMg: parseFloat(r.line.labelClaimMg),
        activeContentPct: parseFloat(r.line.activeContentPct),
        overagePct: parseFloat(r.line.overagePct),
        wastagePct: parseFloat(r.line.wastagePct),
        costPerKg: parseFloat(r.line.costPerKg),
        isEstimatedPrice: r.ingredient?.isEstimatedPrice ?? false,
      }));
  }, [data]);

  const manufacturing: ManufacturingCosts = useMemo(() => {
    if (mfgOverride) return mfgOverride;
    if (!data) return DEFAULT_MANUFACTURING;
    const key = data.formulation.dosageForm.toLowerCase();
    const dfMfg = DOSAGE_FORM_MFG[key];
    if (!dfMfg) return DEFAULT_MANUFACTURING;
    return {
      blendingLaborPerBottle: dfMfg.blending,
      encapsulationLaborPerBottle: dfMfg.processing,
      productionWastePct: dfMfg.wastePct,
    };
  }, [data, mfgOverride]);

  // Run pricing engine — pure, recalc on every render
  const summary = useMemo(() => {
    if (ingredientLines.length === 0) return null;
    return generateTieredQuote({
      ingredients: ingredientLines,
      manufacturing,
      packaging,
      tiers,
    });
  }, [ingredientLines, manufacturing, packaging, tiers]);

  // Spread lab cost across batchSize
  const labPerUnit = batchSize > 0 ? labCostPerBatch / batchSize : 0;

  function updateTier(idx: number, patch: Partial<TierConfig>) {
    setTiers((prev) => prev.map((t, i) => (i === idx ? { ...t, ...patch } : t)));
  }

  async function save() {
    if (!data || !summary) return;
    startTransition(async () => {
      try {
        const res = await fetch("/api/quotes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            productName: data.formulation.name,
            customerId: data.formulation.customerId ?? undefined,
            formulationId: data.formulation.id,
            dosageForm: data.formulation.dosageForm,
            servingSize: `${data.formulation.capsulesPerServing} ${data.formulation.dosageForm}`,
            containerCount: data.formulation.servingsPerContainer,
            tiers: summary.tiers,
            ingredients: data.ingredients
              .filter((r) => !r.line.isExcipient)
              .map((r) => ({
                name: r.ingredient?.name ?? "Ingredient",
                rmId: r.ingredient?.rmId ?? "",
                labelClaimMg: parseFloat(r.line.labelClaimMg),
                activeContentPct: parseFloat(r.line.activeContentPct),
                finalMg: parseFloat(r.line.finalMg),
                costPerKg: parseFloat(r.line.costPerKg),
                lineCost: parseFloat(r.line.costPerKg) * (parseFloat(r.line.finalMg) / 1_000_000) * (1 + parseFloat(r.line.wastagePct) / 100),
                isExcipient: r.line.isExcipient,
              })),
            manufacturing,
            packaging,
          }),
        });
        const result = await res.json();
        if (result.success) router.push(`/quotes/${result.quoteId}`);
        else alert(`Save failed: ${result.error}`);
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        alert(`Save failed: ${msg}`);
      }
    });
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="max-w-3xl mx-auto bg-amber-50 border border-amber-200 rounded-md p-5">
        <div className="flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-700 flex-shrink-0 mt-0.5" />
          <div>
            <h2 className="text-sm font-semibold text-amber-900">Cannot start quote</h2>
            <p className="text-xs text-amber-800 mt-1">{error ?? "Formulation not loaded"}</p>
            <Link href="/formulations" className="inline-flex items-center gap-1 mt-3 text-xs text-amber-900 underline">
              <ChevronLeft className="h-3 w-3" /> Go to The Lab
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto pb-24">
      <div className="mb-3">
        <Link href={`/formulations/${data.formulation.id}`} className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700">
          <ChevronLeft className="h-3.5 w-3.5" /> Back to Formulation
        </Link>
      </div>

      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-[#d10a11]" />
            Quote Workspace
          </h1>
          <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1.5">
            <FlaskConical className="h-3 w-3" /> {data.formulation.name} · {data.formulation.dosageForm}
            {data.formulation.capsuleSize && <> · Size {data.formulation.capsuleSize}</>}
            {data.formulation.servingsPerContainer && <> · {data.formulation.servingsPerContainer}/bottle</>}
          </p>
        </div>
      </div>

      {/* Cost knobs */}
      <section className="bg-white border border-slate-200 rounded-lg p-5 mb-4 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-800 mb-3">Cost Inputs</h2>
        <div className="grid grid-cols-3 gap-4 text-sm">
          <div>
            <label className="block text-xs font-medium text-slate-600 uppercase tracking-wide mb-1">Packaging Preset</label>
            <select
              value={pkgPresetIdx}
              onChange={(e) => {
                const idx = parseInt(e.target.value, 10);
                setPkgPresetIdx(idx);
                setPackaging(PKG_PRESETS[idx].values);
              }}
              className="w-full border border-slate-300 rounded-md px-2 py-1.5 text-sm"
            >
              {PKG_PRESETS.map((p, i) => (
                <option key={p.name} value={i}>{p.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 uppercase tracking-wide mb-1">Overhead %</label>
            <input
              type="number"
              value={overheadPct}
              onChange={(e) => setOverheadPct(parseFloat(e.target.value) || 0)}
              className="w-full border border-slate-300 rounded-md px-2 py-1.5 text-sm tabular-nums"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 uppercase tracking-wide mb-1">Lab Cost / Batch ($)</label>
            <input
              type="number"
              value={labCostPerBatch}
              onChange={(e) => setLabCostPerBatch(parseFloat(e.target.value) || 0)}
              className="w-full border border-slate-300 rounded-md px-2 py-1.5 text-sm tabular-nums"
            />
            <p className="text-[11px] text-slate-500 mt-0.5">@ batch {batchSize}: ${labPerUnit.toFixed(4)}/unit</p>
          </div>
        </div>
      </section>

      {/* RM cost table */}
      <section className="bg-white border border-slate-200 rounded-lg p-5 mb-4 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-800 mb-3">Raw Materials per Unit</h2>
        {summary ? (
          <table className="w-full text-xs">
            <thead className="text-slate-500 bg-slate-50">
              <tr>
                <th className="text-left px-2 py-2 font-medium">Ingredient</th>
                <th className="text-right px-2 py-2 font-medium">Label Claim</th>
                <th className="text-right px-2 py-2 font-medium">Adjusted</th>
                <th className="text-right px-2 py-2 font-medium">Final</th>
                <th className="text-right px-2 py-2 font-medium">Cost / Unit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {summary.ingredientBreakdown.map((line, i) => (
                <tr key={i}>
                  <td className="px-2 py-1.5 text-slate-900">
                    {line.name}
                    {line.isEstimatedPrice && <span className="ml-1 text-[10px] bg-amber-100 text-amber-800 rounded px-1">EST</span>}
                  </td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{line.labelClaimMg.toFixed(2)} mg</td>
                  <td className="px-2 py-1.5 text-right tabular-nums text-slate-600">{line.adjustedMg.toFixed(2)}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{line.finalMg.toFixed(2)}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums font-mono">${line.costPerUnit.toFixed(6)}</td>
                </tr>
              ))}
              <tr className="bg-slate-50 font-semibold">
                <td colSpan={4} className="px-2 py-1.5 text-right text-slate-700">Total RM / Unit:</td>
                <td className="px-2 py-1.5 text-right tabular-nums font-mono">${summary.tiers[0].cogs.rawMaterialCost.toFixed(4)}</td>
              </tr>
            </tbody>
          </table>
        ) : (
          <p className="text-xs text-slate-500">No ingredients yet.</p>
        )}
      </section>

      {/* Tiered Pricing */}
      <section className="bg-white border border-slate-200 rounded-lg p-5 mb-4 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-800 mb-3">Tiered Pricing</h2>
        {summary ? (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs text-slate-600">
              <tr>
                <th className="text-left px-3 py-2 font-medium">Tier (units)</th>
                <th className="text-right px-3 py-2 font-medium">Margin %</th>
                <th className="text-right px-3 py-2 font-medium">RM</th>
                <th className="text-right px-3 py-2 font-medium">Mfg</th>
                <th className="text-right px-3 py-2 font-medium">Pkg</th>
                <th className="text-right px-3 py-2 font-medium">Overhead</th>
                <th className="text-right px-3 py-2 font-medium">COGS / Unit</th>
                <th className="text-right px-3 py-2 font-medium">Price / Unit</th>
                <th className="text-right px-3 py-2 font-medium">Batch Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 tabular-nums">
              {summary.tiers.map((t, i) => (
                <tr key={i}>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      value={tiers[i].quantity}
                      onChange={(e) => updateTier(i, { quantity: parseInt(e.target.value, 10) || 0 })}
                      className="w-24 border border-transparent hover:border-slate-200 focus:border-[#d10a11] rounded px-1 py-0.5 text-right"
                    />
                  </td>
                  <td className="px-3 py-2 text-right">
                    <input
                      type="number"
                      value={tiers[i].marginPct}
                      onChange={(e) => updateTier(i, { marginPct: parseFloat(e.target.value) || 0 })}
                      className="w-16 border border-transparent hover:border-slate-200 focus:border-[#d10a11] rounded px-1 py-0.5 text-right"
                    />
                  </td>
                  <td className="px-3 py-2 text-right text-slate-600">${t.cogs.rawMaterialCost.toFixed(4)}</td>
                  <td className="px-3 py-2 text-right text-slate-600">${t.cogs.manufacturingCost.toFixed(4)}</td>
                  <td className="px-3 py-2 text-right text-slate-600">${t.cogs.packagingCost.toFixed(4)}</td>
                  <td className="px-3 py-2 text-right text-slate-600">${t.cogs.overheadCost.toFixed(4)}</td>
                  <td className="px-3 py-2 text-right font-medium text-slate-800">${t.cogs.totalCogs.toFixed(4)}</td>
                  <td className="px-3 py-2 text-right font-bold text-[#d10a11]">${t.pricePerUnit.toFixed(2)}</td>
                  <td className="px-3 py-2 text-right text-slate-700">${t.totalBatchPrice.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-xs text-slate-500">Add ingredients to see pricing.</p>
        )}
      </section>

      {/* Sticky save bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 px-6 py-3 flex items-center justify-between z-10">
        <div className="text-xs text-slate-500">
          Saving locks the tier prices. You can re-quote anytime by visiting <code className="font-mono">/quotes/new?formulationId={data.formulation.id.slice(0, 8)}…</code>
        </div>
        <button
          onClick={save}
          disabled={!summary || pending}
          className="inline-flex items-center gap-2 px-4 py-2 bg-[#d10a11] hover:bg-[#a30a0f] disabled:opacity-50 text-white text-sm font-semibold rounded-md transition-colors"
        >
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Save Quote
        </button>
      </div>
    </div>
  );
}
