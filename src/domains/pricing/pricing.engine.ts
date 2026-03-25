/**
 * Optibio Pricing Engine
 *
 * CRITICAL: Uses Active Content % for all dosage calculations, NOT Assay %.
 *
 * Formula:
 *   adjustedMg = labelClaimMg / (activeContentPct / 100)
 *   finalMg    = adjustedMg * (1 + overagePct / 100)
 *   rmCostPerUnit = (finalMg / 1_000_000) * costPerKg
 *   withWastage   = rmCostPerUnit * (1 + wastagePct / 100)
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

/** Calculate cost for a single ingredient per unit (capsule/tablet) */
export function calculateIngredientCost(line: IngredientLine): IngredientCostLine {
  const adjustedMg = line.labelClaimMg / (line.activeContentPct / 100);
  const finalMg = adjustedMg * (1 + line.overagePct / 100);
  const rmCostPerUnit = (finalMg / 1_000_000) * line.costPerKg;
  const costWithWastage = rmCostPerUnit * (1 + line.wastagePct / 100);

  return {
    name: line.name,
    labelClaimMg: line.labelClaimMg,
    adjustedMg: round(adjustedMg, 4),
    finalMg: round(finalMg, 4),
    costPerUnit: round(costWithWastage, 6),
    isEstimatedPrice: line.isEstimatedPrice,
  };
}

/** Calculate total raw material cost across all ingredients */
export function calculateRawMaterialCost(lines: IngredientLine[]): {
  total: number;
  breakdown: IngredientCostLine[];
} {
  const breakdown = lines.map(calculateIngredientCost);
  const total = breakdown.reduce((sum, line) => sum + line.costPerUnit, 0);
  return { total: round(total, 6), breakdown };
}

/** Calculate full COGS for one unit */
export function calculateCOGS(params: {
  ingredients: IngredientLine[];
  manufacturing?: ManufacturingCosts;
  packaging?: PackagingCosts;
  overheadPct?: number;
}): COGSBreakdown {
  const mfg = params.manufacturing ?? DEFAULT_MANUFACTURING;
  const pkg = params.packaging ?? DEFAULT_PACKAGING;
  const overheadPct = params.overheadPct ?? 15;

  const { total: rawMaterialCost } = calculateRawMaterialCost(params.ingredients);

  const manufacturingCost =
    mfg.blendingLaborPerBottle +
    mfg.encapsulationLaborPerBottle +
    rawMaterialCost * (mfg.productionWastePct / 100);

  const packagingCost =
    pkg.bottleCost +
    pkg.capCost +
    pkg.desiccantCost +
    pkg.sleeveCost +
    pkg.labelCost +
    pkg.cartonCostPerUnit +
    pkg.palletCostPerUnit +
    pkg.packagingLaborPerUnit;

  const overheadCost = (rawMaterialCost + manufacturingCost) * (overheadPct / 100);

  const totalCogs = rawMaterialCost + manufacturingCost + packagingCost + overheadCost;

  return {
    rawMaterialCost: round(rawMaterialCost, 4),
    manufacturingCost: round(manufacturingCost, 4),
    packagingCost: round(packagingCost, 4),
    overheadCost: round(overheadCost, 4),
    totalCogs: round(totalCogs, 4),
  };
}

/** Generate tiered pricing quote (default: 2K/5K/10K) */
export function generateTieredQuote(params: {
  ingredients: IngredientLine[];
  manufacturing?: ManufacturingCosts;
  packaging?: PackagingCosts;
  tiers?: TierConfig[];
}): QuoteSummary {
  const tiers = params.tiers ?? DEFAULT_TIERS;
  const { breakdown } = calculateRawMaterialCost(params.ingredients);
  const cogs = calculateCOGS(params);

  const tieredQuotes: TieredQuote[] = tiers.map((tier) => {
    // Price = COGS / (1 - margin/100) — ensures the margin is on selling price
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
