/**
 * Optibio Pricing Engine — calibrated against real Asher quotes (May 2026).
 *
 * CRITICAL: Uses Active Content % for all dosage calculations, NOT Assay %.
 *
 * Per-unit (capsule) raw material cost:
 *   adjustedMg = labelClaimMg / (activeContentPct / 100)
 *   finalMg    = adjustedMg * (1 + overagePct / 100)
 *   rmCostPerCap = (finalMg / 1_000_000) * costPerKg
 *   withWastage  = rmCostPerCap * (1 + wastagePct / 100)
 *
 * COGS per BOTTLE (this is what the customer is buying):
 *   rmCostPerBottle      = rmCostPerCap × capsulesPerServing × servingsPerContainer
 *   capsuleShellPerBottle = costPer1000 / 1000 × caps/bottle (when capsuleSize given)
 *   manufacturingPerBottle = blending + processing labor (per bottle)
 *   packagingPerBottle   = bottle + cap + label + desiccant + sleeve + carton + pallet + labor
 *   labPerBottle         = labCostPerBatch / batchSizeBottles (amortized)
 *   subtotalBeforeOverhead = RM + Caps + Mfg + Pkg + Lab
 *   overhead              = subtotal × (overheadPct / 100)
 *   totalCogs             = subtotal + overhead
 *
 * Tier price (margin on selling price):
 *   pricePerUnit = totalCogs / (1 - marginPct/100)
 *
 * The previous engine had a unit-mismatch bug — it summed per-cap RM with
 * per-bottle Mfg/Pkg as if they were the same unit. Asher Elderberry came out
 * at $1.62/bottle vs the real $7.90. Fixed in this revision.
 */

import {
  type IngredientLine,
  type IngredientCostLine,
  type ManufacturingCosts,
  type PackagingCosts,
  type COGSBreakdown,
  type TierConfig,
  type TieredQuote,
  type QuoteSummary,
  DEFAULT_TIERS,
  DEFAULT_MANUFACTURING,
  DEFAULT_PACKAGING,
} from "./pricing.types";

/** Cost for a single ingredient per CAPSULE (raw + wastage, before any per-bottle multiplication). */
export function calculateIngredientCost(line: IngredientLine): IngredientCostLine {
  const adjustedMg = line.labelClaimMg / (line.activeContentPct / 100);
  const finalMg = adjustedMg * (1 + line.overagePct / 100);
  const rmCostPerCap = (finalMg / 1_000_000) * line.costPerKg;
  const costWithWastage = rmCostPerCap * (1 + line.wastagePct / 100);

  return {
    name: line.name,
    labelClaimMg: line.labelClaimMg,
    adjustedMg: round(adjustedMg, 4),
    finalMg: round(finalMg, 4),
    costPerUnit: round(costWithWastage, 6),
    isEstimatedPrice: line.isEstimatedPrice,
  };
}

/** Total raw material cost across all ingredients, per CAPSULE. */
export function calculateRawMaterialCost(lines: IngredientLine[]): {
  total: number;
  breakdown: IngredientCostLine[];
} {
  const breakdown = lines.map(calculateIngredientCost);
  const total = breakdown.reduce((sum, line) => sum + line.costPerUnit, 0);
  return { total: round(total, 6), breakdown };
}

/**
 * COGS per BOTTLE.
 *
 * unitsPerBottle: capsulesPerServing × servingsPerContainer (default 60 for a
 *   standard 1-cap-per-serving 60-count bottle).
 * capsuleShellCostPer1000: e.g. $7.00/1000 for size 00 vege caps (default $7).
 * labCostPerBatch / batchSizeBottles: amortizes lab testing into a per-bottle cost.
 */
export function calculateCOGS(params: {
  ingredients: IngredientLine[];
  manufacturing?: ManufacturingCosts;
  packaging?: PackagingCosts;
  overheadPct?: number;
  unitsPerBottle?: number;
  capsuleShellCostPer1000?: number;
  labCostPerBatch?: number;
  batchSizeBottles?: number;
}): COGSBreakdown {
  const mfg = params.manufacturing ?? DEFAULT_MANUFACTURING;
  const pkg = params.packaging ?? DEFAULT_PACKAGING;
  const overheadPct = params.overheadPct ?? 15;
  const unitsPerBottle = params.unitsPerBottle ?? 60;
  const shellPer1000 = params.capsuleShellCostPer1000 ?? 7.0;
  const labCostPerBatch = params.labCostPerBatch ?? 500;
  const batchSizeBottles = params.batchSizeBottles ?? 2000;

  const { total: rmCostPerCap } = calculateRawMaterialCost(params.ingredients);

  // Per-BOTTLE costs
  const rawMaterialCost = rmCostPerCap * unitsPerBottle;
  const capsuleShellCost = (shellPer1000 / 1000) * unitsPerBottle;
  // Manufacturing cost includes labor + production-waste fee + capsule shells.
  // Production waste is a flat % of RM (loss during blending/encapsulating).
  const manufacturingCost =
    mfg.blendingLaborPerBottle +
    mfg.encapsulationLaborPerBottle +
    rawMaterialCost * (mfg.productionWastePct / 100) +
    capsuleShellCost;
  const packagingCost =
    pkg.bottleCost +
    pkg.capCost +
    pkg.desiccantCost +
    pkg.sleeveCost +
    pkg.labelCost +
    pkg.cartonCostPerUnit +
    pkg.palletCostPerUnit +
    pkg.packagingLaborPerUnit;
  const labCost = labCostPerBatch / batchSizeBottles;

  const subtotal = rawMaterialCost + manufacturingCost + packagingCost + labCost;
  const overheadCost = subtotal * (overheadPct / 100);
  const totalCogs = subtotal + overheadCost;

  return {
    rawMaterialCost: round(rawMaterialCost, 4),
    manufacturingCost: round(manufacturingCost, 4),
    packagingCost: round(packagingCost, 4),
    overheadCost: round(overheadCost, 4),
    totalCogs: round(totalCogs, 4),
  };
}

/** Generate tiered pricing quote. */
export function generateTieredQuote(params: {
  ingredients: IngredientLine[];
  manufacturing?: ManufacturingCosts;
  packaging?: PackagingCosts;
  tiers?: TierConfig[];
  unitsPerBottle?: number;
  capsuleShellCostPer1000?: number;
  labCostPerBatch?: number;
  overheadPct?: number;
}): QuoteSummary {
  const tiers = params.tiers ?? DEFAULT_TIERS;
  const { breakdown } = calculateRawMaterialCost(params.ingredients);

  const tieredQuotes: TieredQuote[] = tiers.map((tier) => {
    // COGS recalculated per tier so lab amortizes against the right batch size.
    const cogs = calculateCOGS({
      ingredients: params.ingredients,
      manufacturing: params.manufacturing,
      packaging: params.packaging,
      overheadPct: params.overheadPct,
      unitsPerBottle: params.unitsPerBottle,
      capsuleShellCostPer1000: params.capsuleShellCostPer1000,
      labCostPerBatch: params.labCostPerBatch,
      batchSizeBottles: tier.quantity,
    });
    const pricePerUnit = cogs.totalCogs / (1 - tier.marginPct / 100);
    const totalBatchPrice = pricePerUnit * tier.quantity;

    return {
      tierQuantity: tier.quantity,
      cogs,
      marginPct: tier.marginPct,
      pricePerUnit: round(pricePerUnit, 4),
      totalBatchPrice: round(totalBatchPrice, 2),
    };
  });

  return {
    ingredientBreakdown: breakdown,
    tiers: tieredQuotes,
  };
}

function round(value: number, decimals: number): number {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}
