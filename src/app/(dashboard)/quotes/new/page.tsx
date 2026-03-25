"use client";

import { useState, useCallback } from "react";
import { Plus, Trash2, Calculator, FileText, AlertTriangle } from "lucide-react";
import { generateTieredQuote } from "@/domains/pricing/pricing.engine";
import type { IngredientLine, QuoteSummary } from "@/domains/pricing/pricing.types";
import { sizeCapsule, CAPSULE_CAPACITIES } from "@/domains/formulation/capsule-sizer";
import { calculateExcipients, determineComplexity } from "@/domains/formulation/excipient-calculator";

interface FormIngredient {
  name: string;
  labelClaimMg: string;
  activeContentPct: string;
  overagePct: string;
  wastagePct: string;
  costPerKg: string;
  isEstimated: boolean;
}

const EMPTY_INGREDIENT: FormIngredient = {
  name: "",
  labelClaimMg: "",
  activeContentPct: "100",
  overagePct: "10",
  wastagePct: "3",
  costPerKg: "",
  isEstimated: false,
};

export default function NewQuotePage() {
  const [productName, setProductName] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [dosageForm, setDosageForm] = useState<"capsule" | "tablet">("capsule");
  const [ingredients, setIngredients] = useState<FormIngredient[]>([{ ...EMPTY_INGREDIENT }]);
  const [quote, setQuote] = useState<QuoteSummary | null>(null);
  const [capsuleResult, setCapsuleResult] = useState<ReturnType<typeof sizeCapsule> | null>(null);
  const [errors, setErrors] = useState<string[]>([]);

  const addIngredient = () => {
    setIngredients([...ingredients, { ...EMPTY_INGREDIENT }]);
  };

  const removeIngredient = (index: number) => {
    setIngredients(ingredients.filter((_, i) => i !== index));
  };

  const updateIngredient = (index: number, field: keyof FormIngredient, value: string | boolean) => {
    const updated = [...ingredients];
    updated[index] = { ...updated[index], [field]: value };
    setIngredients(updated);
  };

  const calculateQuote = useCallback(() => {
    const errs: string[] = [];
    const lines: IngredientLine[] = [];

    for (const ing of ingredients) {
      if (!ing.name.trim()) continue;
      const lc = parseFloat(ing.labelClaimMg);
      const ac = parseFloat(ing.activeContentPct);
      const ov = parseFloat(ing.overagePct);
      const wa = parseFloat(ing.wastagePct);
      const cost = parseFloat(ing.costPerKg);

      if (isNaN(lc) || lc <= 0) { errs.push(`${ing.name}: invalid label claim`); continue; }
      if (isNaN(ac) || ac <= 0 || ac > 100) { errs.push(`${ing.name}: active content must be 1-100%`); continue; }
      if (isNaN(cost) || cost <= 0) { errs.push(`${ing.name}: invalid cost/kg`); continue; }

      lines.push({
        name: ing.name,
        labelClaimMg: lc,
        activeContentPct: ac,
        overagePct: isNaN(ov) ? 10 : ov,
        wastagePct: isNaN(wa) ? 3 : wa,
        costPerKg: cost,
        isEstimatedPrice: ing.isEstimated,
      });
    }

    if (lines.length === 0) {
      errs.push("Add at least one ingredient with valid data.");
      setErrors(errs);
      return;
    }

    setErrors(errs);

    // Calculate total fill weight for capsule sizing
    const totalActiveMg = lines.reduce((sum, l) => {
      const adjusted = l.labelClaimMg / (l.activeContentPct / 100);
      return sum + adjusted * (1 + l.overagePct / 100);
    }, 0);

    if (dosageForm === "capsule") {
      const hasBotanicals = lines.some((l) => l.name.toLowerCase().includes("extract"));
      const complexity = determineComplexity(lines.length, hasBotanicals, false);

      // Estimate target fill (actives + ~20% excipients)
      const estimatedFill = totalActiveMg * 1.2;
      const sizing = sizeCapsule(estimatedFill);
      setCapsuleResult(sizing);

      if (sizing.feasible) {
        const capsuleCapacity = CAPSULE_CAPACITIES[sizing.capsuleSize];
        const targetFill = capsuleCapacity * sizing.capsulesPerServing;
        calculateExcipients(totalActiveMg, targetFill, complexity);
      }
    } else {
      setCapsuleResult(null);
    }

    const result = generateTieredQuote({ ingredients: lines });
    setQuote(result);
  }, [ingredients, dosageForm]);

  return (
    <div className="max-w-6xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">New Quote</h1>
          <p className="text-sm text-gray-500 mt-1">Build a formulation and generate tiered pricing</p>
        </div>
      </div>

      {/* Product Info */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Product Information</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Product Name</label>
            <input
              type="text"
              value={productName}
              onChange={(e) => setProductName(e.target.value)}
              placeholder="e.g., Immune Support Capsules"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#d10a11]/20 focus:border-[#d10a11]"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Customer</label>
            <input
              type="text"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="Customer name"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#d10a11]/20 focus:border-[#d10a11]"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Dosage Form</label>
            <select
              value={dosageForm}
              onChange={(e) => setDosageForm(e.target.value as "capsule" | "tablet")}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#d10a11]/20 focus:border-[#d10a11]"
            >
              <option value="capsule">Capsule</option>
              <option value="tablet">Tablet</option>
            </select>
          </div>
        </div>
      </div>

      {/* Ingredients */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Ingredients</h2>
          <button
            onClick={addIngredient}
            className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-[#d10a11] bg-red-50 rounded-lg hover:bg-red-100 transition-colors"
          >
            <Plus className="h-4 w-4" /> Add Ingredient
          </button>
        </div>

        <div className="space-y-3">
          <div className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr_auto] gap-2 text-xs font-medium text-gray-500 px-1">
            <span>Ingredient Name</span>
            <span>Label Claim (mg)</span>
            <span>Active Content %</span>
            <span>Overage %</span>
            <span>Wastage %</span>
            <span>Cost/Kg ($)</span>
            <span></span>
          </div>

          {ingredients.map((ing, i) => (
            <div key={i} className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr_auto] gap-2 items-center">
              <input
                type="text"
                value={ing.name}
                onChange={(e) => updateIngredient(i, "name", e.target.value)}
                placeholder="Ingredient name"
                className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#d10a11]/20 focus:border-[#d10a11]"
              />
              <input
                type="number"
                value={ing.labelClaimMg}
                onChange={(e) => updateIngredient(i, "labelClaimMg", e.target.value)}
                placeholder="500"
                className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#d10a11]/20 focus:border-[#d10a11]"
              />
              <input
                type="number"
                value={ing.activeContentPct}
                onChange={(e) => updateIngredient(i, "activeContentPct", e.target.value)}
                placeholder="100"
                className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#d10a11]/20 focus:border-[#d10a11]"
              />
              <input
                type="number"
                value={ing.overagePct}
                onChange={(e) => updateIngredient(i, "overagePct", e.target.value)}
                placeholder="10"
                className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#d10a11]/20 focus:border-[#d10a11]"
              />
              <input
                type="number"
                value={ing.wastagePct}
                onChange={(e) => updateIngredient(i, "wastagePct", e.target.value)}
                placeholder="3"
                className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#d10a11]/20 focus:border-[#d10a11]"
              />
              <input
                type="number"
                value={ing.costPerKg}
                onChange={(e) => updateIngredient(i, "costPerKg", e.target.value)}
                placeholder="50.00"
                className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#d10a11]/20 focus:border-[#d10a11]"
              />
              <button
                onClick={() => removeIngredient(i)}
                disabled={ingredients.length === 1}
                className="p-2 text-gray-400 hover:text-red-500 disabled:opacity-30 transition-colors"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Errors */}
      {errors.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
            <div>
              {errors.map((err, i) => (
                <p key={i} className="text-sm text-amber-700">{err}</p>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Calculate Button */}
      <div className="flex gap-3 mb-8">
        <button
          onClick={calculateQuote}
          className="inline-flex items-center gap-2 px-6 py-3 bg-[#d10a11] text-white font-medium rounded-lg hover:bg-[#a30a0f] transition-colors"
        >
          <Calculator className="h-5 w-5" /> Calculate Quote
        </button>
      </div>

      {/* Capsule Sizing Result */}
      {capsuleResult && (
        <div className={`rounded-xl border p-4 mb-6 ${capsuleResult.feasible ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"}`}>
          <h3 className="font-semibold text-sm mb-1">{capsuleResult.feasible ? "Capsule Sizing" : "Sizing Issue"}</h3>
          <p className="text-sm">{capsuleResult.recommendation}</p>
          {capsuleResult.warnings.map((w, i) => (
            <p key={i} className="text-xs text-amber-600 mt-1">{w}</p>
          ))}
        </div>
      )}

      {/* Quote Results */}
      {quote && (
        <div className="space-y-6">
          {/* Ingredient Breakdown */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Ingredient Cost Breakdown (Per Unit)</h2>
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b">
                  <th className="text-left px-3 py-2 font-medium text-gray-600">Ingredient</th>
                  <th className="text-right px-3 py-2 font-medium text-gray-600">Label Claim</th>
                  <th className="text-right px-3 py-2 font-medium text-gray-600">Adjusted (mg)</th>
                  <th className="text-right px-3 py-2 font-medium text-gray-600">Final (mg)</th>
                  <th className="text-right px-3 py-2 font-medium text-gray-600">Cost/Unit</th>
                  <th className="text-center px-3 py-2 font-medium text-gray-600">Est.</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {quote.ingredientBreakdown.map((line, i) => (
                  <tr key={i}>
                    <td className="px-3 py-2 font-medium">{line.name}</td>
                    <td className="px-3 py-2 text-right">{line.labelClaimMg}mg</td>
                    <td className="px-3 py-2 text-right">{line.adjustedMg.toFixed(2)}mg</td>
                    <td className="px-3 py-2 text-right">{line.finalMg.toFixed(2)}mg</td>
                    <td className="px-3 py-2 text-right font-mono">${line.costPerUnit.toFixed(4)}</td>
                    <td className="px-3 py-2 text-center">
                      {line.isEstimatedPrice && (
                        <span className="inline-block px-2 py-0.5 bg-amber-100 text-amber-700 text-xs rounded-full">Est.</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Tiered Pricing */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Tiered Pricing</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {quote.tiers.map((tier, i) => (
                <div key={i} className="border border-gray-200 rounded-xl p-5">
                  <div className="text-center mb-4">
                    <p className="text-2xl font-bold text-gray-900">{tier.tierQuantity.toLocaleString()}</p>
                    <p className="text-xs text-gray-500 uppercase tracking-wide">units</p>
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Raw Materials</span>
                      <span className="font-mono">${tier.cogs.rawMaterialCost.toFixed(4)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Manufacturing</span>
                      <span className="font-mono">${tier.cogs.manufacturingCost.toFixed(4)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Packaging</span>
                      <span className="font-mono">${tier.cogs.packagingCost.toFixed(4)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Overhead (15%)</span>
                      <span className="font-mono">${tier.cogs.overheadCost.toFixed(4)}</span>
                    </div>
                    <div className="border-t pt-2 flex justify-between font-medium">
                      <span>COGS/Unit</span>
                      <span className="font-mono">${tier.cogs.totalCogs.toFixed(4)}</span>
                    </div>
                    <div className="flex justify-between text-gray-500">
                      <span>Margin</span>
                      <span>{tier.marginPct}%</span>
                    </div>
                    <div className="border-t pt-2 flex justify-between font-bold text-[#d10a11]">
                      <span>Price/Unit</span>
                      <span className="font-mono">${tier.pricePerUnit.toFixed(4)}</span>
                    </div>
                    <div className="flex justify-between text-lg font-bold">
                      <span>Total</span>
                      <span className="font-mono">${tier.totalBatchPrice.toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Estimated Price Warning */}
          {quote.ingredientBreakdown.some((l) => l.isEstimatedPrice) && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
                <p className="text-sm text-amber-700">
                  <strong>Estimated pricing:</strong> Some ingredients use Internal Database prices.
                  Verify with real supplier quotes before sending to customer.
                </p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
