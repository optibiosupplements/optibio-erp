/**
 * Pricing types + calibrated defaults.
 *
 * Calibration target: Asher Elderberry 10:1 500mg + Vit C 90mg + Vit D 1000 IU
 * + Zinc 11mg, 60ct bottle, 2K MOQ → real quoted price $7.90/bottle.
 *
 * Numbers below were tuned to land that case within ±10%. See
 * `tests/fixtures/real-customers/asher-elderberry.json` for the canonical
 * expected pricing.
 */

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
  costPerUnit: number;       // per CAPSULE (not bottle)
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

// ─────────────────────────────────────────────────────────────────────────────
// CALIBRATED DEFAULTS
// ─────────────────────────────────────────────────────────────────────────────

// Calibrated against Asher Elderberry/Beetroot/Berberine/Magnesium 60ct quotes.
// Magnesium Glycinate falls outside ±20% — customer has volume-specific pricing
// at higher tiers we can't infer from a single 2K data point. See LEARNINGS.md.

export const DEFAULT_TIERS: TierConfig[] = [
  { quantity: 2000, marginPct: 37 },
  { quantity: 5000, marginPct: 32 },
  { quantity: 10000, marginPct: 27 },
];

export const DEFAULT_MANUFACTURING: ManufacturingCosts = {
  blendingLaborPerBottle: 0.06,         // 60 bottles per blend, ~$15/hr × 4 min
  encapsulationLaborPerBottle: 0.04,    // 70K caps/hour throughput → $0.013/60-cap bottle + setup
  productionWastePct: 3,
};

export const DEFAULT_PACKAGING: PackagingCosts = {
  bottleCost: 0.30,                      // PET 150cc amber bottle (volume contract)
  capCost: 0.06,                         // 38mm CR cap
  desiccantCost: 0.03,                   // 1g silica
  sleeveCost: 0.01,                      // shrink band
  labelCost: 0.06,                       // pressure-sensitive, 4-color (volume contract)
  cartonCostPerUnit: 0.05,               // 12-count carton ÷ 12
  palletCostPerUnit: 0.005,              // pallet ÷ 1500 bottles
  packagingLaborPerUnit: 0.04,           // 1300 bottles/hr × $15 = $0.012; rounded up for QA
};

export const DEFAULT_OVERHEAD_PCT = 15;
export const DEFAULT_LAB_COST_PER_BATCH = 500;

// ─── Capsule shell costs ($/1000 caps) ──────────────────────────────────────

export const CAPSULE_SHELL_COSTS_PER_1000: Record<string, number> = {
  "3":   5.50,
  "2":   5.50,
  "1":   6.00,
  "0":   6.00,
  "00":  7.00,
  "000": 8.00,
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
  capsule: { blending: 0.18, processing: 0.40, processingLabel: "Encapsulation / Bottle", wastePct: 3,   setupPerBatch: 200 },
  tablet:  { blending: 0.18, processing: 0.34, processingLabel: "Compression / Bottle",   wastePct: 3,   setupPerBatch: 200 },
  powder:  { blending: 0.12, processing: 0.16, processingLabel: "Filling / Bottle",        wastePct: 1.5, setupPerBatch: 150 },
  softgel: { blending: 0.18, processing: 0.50, processingLabel: "Encapsulation / Bottle",  wastePct: 4,   setupPerBatch: 250 },
  gummy:   { blending: 0.20, processing: 0.65, processingLabel: "Molding / Bottle",        wastePct: 4,   setupPerBatch: 300 },
};

// ─── Packaging Presets ──────────────────────────────────────────────────

export interface PkgPreset {
  name: string;
  values: PackagingCosts;
}

export const PKG_PRESETS: PkgPreset[] = [
  {
    name: "Standard 60ct Bottle",
    values: { bottleCost: 0.55, capCost: 0.18, desiccantCost: 0.04, sleeveCost: 0.02, labelCost: 0.12, cartonCostPerUnit: 0.08, palletCostPerUnit: 0.01, packagingLaborPerUnit: 0.18 },
  },
  {
    name: "Standard 90ct Bottle",
    values: { bottleCost: 0.62, capCost: 0.18, desiccantCost: 0.04, sleeveCost: 0.02, labelCost: 0.13, cartonCostPerUnit: 0.10, palletCostPerUnit: 0.012, packagingLaborPerUnit: 0.20 },
  },
  {
    name: "Standard 120ct Bottle",
    values: { bottleCost: 0.72, capCost: 0.18, desiccantCost: 0.05, sleeveCost: 0.025, labelCost: 0.14, cartonCostPerUnit: 0.12, palletCostPerUnit: 0.013, packagingLaborPerUnit: 0.22 },
  },
  {
    name: "Stick Pack (30ct Box)",
    values: { bottleCost: 0.0, capCost: 0.0, desiccantCost: 0.0, sleeveCost: 0.0, labelCost: 0.0, cartonCostPerUnit: 0.45, palletCostPerUnit: 0.012, packagingLaborPerUnit: 0.085 },
  },
];
