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

// ─── Dosage-Form-Specific Manufacturing Defaults ────────────────────────

export interface MfgDefaults {
  blending: number;
  processing: number;
  processingLabel: string;
  wastePct: number;
  setupPerBatch: number;
}

export const DOSAGE_FORM_MFG: Record<string, MfgDefaults> = {
  capsule: { blending: 0.048, processing: 0.077, processingLabel: "Encapsulation / Unit", wastePct: 2, setupPerBatch: 200 },
  tablet:  { blending: 0.048, processing: 0.065, processingLabel: "Compression / Unit", wastePct: 2.5, setupPerBatch: 200 },
  powder:  { blending: 0.035, processing: 0.025, processingLabel: "Filling / Unit", wastePct: 1.5, setupPerBatch: 150 },
  softgel: { blending: 0.048, processing: 0.09,  processingLabel: "Encapsulation / Unit", wastePct: 3, setupPerBatch: 250 },
  gummy:   { blending: 0.055, processing: 0.12,  processingLabel: "Molding / Unit", wastePct: 3, setupPerBatch: 300 },
};

// ─── Packaging Presets ──────────────────────────────────────────────────

export interface PkgPreset {
  name: string;
  values: PackagingCosts;
}

export const PKG_PRESETS: PkgPreset[] = [
  {
    name: "Standard 60ct Bottle",
    values: { bottleCost: 0.428, capCost: 0.113, desiccantCost: 0.0234, sleeveCost: 0.01, labelCost: 0.065, cartonCostPerUnit: 0.01875, palletCostPerUnit: 0.00247, packagingLaborPerUnit: 0.03462 },
  },
  {
    name: "Standard 90ct Bottle",
    values: { bottleCost: 0.48, capCost: 0.113, desiccantCost: 0.0234, sleeveCost: 0.012, labelCost: 0.065, cartonCostPerUnit: 0.02, palletCostPerUnit: 0.00247, packagingLaborPerUnit: 0.03462 },
  },
  {
    name: "Standard 120ct Bottle",
    values: { bottleCost: 0.55, capCost: 0.113, desiccantCost: 0.028, sleeveCost: 0.014, labelCost: 0.065, cartonCostPerUnit: 0.022, palletCostPerUnit: 0.00247, packagingLaborPerUnit: 0.03462 },
  },
  {
    name: "Stick Pack (30ct Box)",
    values: { bottleCost: 0.0, capCost: 0.0, desiccantCost: 0.0, sleeveCost: 0.0, labelCost: 0.0, cartonCostPerUnit: 0.35, palletCostPerUnit: 0.00247, packagingLaborPerUnit: 0.045 },
  },
];
