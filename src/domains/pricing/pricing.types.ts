export interface IngredientLine {
  name: string;
  labelClaimMg: number;
  activeContentPct: number;
  overagePct: number;
  wastagePct: number;
  costPerKg: number;
  isEstimatedPrice: boolean;
}

export interface ManufacturingCosts {
  blendingLaborPerBottle: number;
  encapsulationLaborPerBottle: number;
  productionWastePct: number;
}

export interface PackagingCosts {
  bottleCost: number;
  capCost: number;
  desiccantCost: number;
  sleeveCost: number;
  labelCost: number;
  cartonCostPerUnit: number;
  palletCostPerUnit: number;
  packagingLaborPerUnit: number;
}

export interface TierConfig {
  quantity: number;
  marginPct: number;
}

export interface COGSBreakdown {
  rawMaterialCost: number;
  manufacturingCost: number;
  packagingCost: number;
  overheadCost: number;
  totalCogs: number;
}

export interface IngredientCostLine {
  name: string;
  labelClaimMg: number;
  adjustedMg: number;
  finalMg: number;
  costPerUnit: number;
  isEstimatedPrice: boolean;
}

export interface TieredQuote {
  tierQuantity: number;
  cogs: COGSBreakdown;
  marginPct: number;
  pricePerUnit: number;
  totalBatchPrice: number;
}

export interface QuoteSummary {
  ingredientBreakdown: IngredientCostLine[];
  tiers: TieredQuote[];
}

export const DEFAULT_TIERS: TierConfig[] = [
  { quantity: 2000, marginPct: 40 },
  { quantity: 5000, marginPct: 35 },
  { quantity: 10000, marginPct: 30 },
];

export const DEFAULT_MANUFACTURING: ManufacturingCosts = {
  blendingLaborPerBottle: 0.048,
  encapsulationLaborPerBottle: 0.077,
  productionWastePct: 2,
};

export const DEFAULT_PACKAGING: PackagingCosts = {
  bottleCost: 0.428,
  capCost: 0.113,
  desiccantCost: 0.0234,
  sleeveCost: 0.01,
  labelCost: 0.0,
  cartonCostPerUnit: 0.01875,
  palletCostPerUnit: 0.00247,
  packagingLaborPerUnit: 0.03462,
};
