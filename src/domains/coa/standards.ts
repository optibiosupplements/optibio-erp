/**
 * COA Standards — codified from `Desktop/Quotation/new quote app/COA Template/
 * COA_WomensProbiotic_NS-3318C_Lot2508-231_Final.pdf`.
 *
 * These are the static spec ranges and contaminant limits that appear on
 * every Nutra Solutions USA Certificate of Analysis. Per-product values
 * (label claims, batch size, lot #, results) come from the formulation/quote
 * record. The spec ranges follow:
 *
 *   - 21 CFR Part 111 (cGMP for dietary supplements)
 *   - 21 CFR 101.9(g)(4)(i)  — Class I nutrients ≥100% of label claim
 *   - 21 CFR 101.9(g)(6)     — allowable overage upper bound
 *   - USP <701>              — Disintegration
 *   - USP <2021>             — Microbial Enumeration (TAMC, TYMC)
 *   - USP <2022>             — Microbial Tests for Specified Organisms (E.coli, Salmonella)
 *   - USP <2232>             — Elemental Contaminants in Dietary Supplements
 *
 * Heavy metal limits are stated PER DAILY DOSE (not per gram) — California Prop 65
 * style. ICP-MS is the standard method.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Manufacturer (Nutra Solutions USA)
// ─────────────────────────────────────────────────────────────────────────────

export const MANUFACTURER = {
  name: "Nutra Solutions USA",
  address: "1019 Grand Blvd, Deer Park, NY 11729",
  phone: "631-392-1900",
  website: "www.nutrasolutionsusa.com",
  certifications: [
    "21 CFR Part 111 Compliant",
    "cGMP Manufactured",
    "ISO 17025 Lab",
    "Amazon Compliant",
  ],
  qcLab: "Nutra Solutions USA — In-House QC Lab",
  labAccreditation: "ISO 17025:2017",
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// Physical specifications (capsule format)
// ─────────────────────────────────────────────────────────────────────────────

export interface PhysicalSpec {
  test: string;
  specification: string;
  method: string;
  notes?: string;
}

export const CAPSULE_PHYSICAL_SPECS: PhysicalSpec[] = [
  { test: "Average Fill Weight (10 capsules)", specification: "± 10% of theoretical fill", method: "SOP-QC-001" },
  { test: "Average Filled Weight (10 capsules)", specification: "± 10% of theoretical filled", method: "SOP-QC-001" },
  { test: "Disintegration", specification: "≤ 30 minutes", method: "USP <701>" },
  { test: "Appearance", specification: "Conforms to product description", method: "Visual" },
];

export const TABLET_PHYSICAL_SPECS: PhysicalSpec[] = [
  { test: "Average Tablet Weight (10 tablets)", specification: "± 5% of theoretical", method: "SOP-QC-002" },
  { test: "Hardness", specification: "8–12 kP", method: "USP <1217>" },
  { test: "Friability", specification: "≤ 1.0%", method: "USP <1216>" },
  { test: "Disintegration", specification: "≤ 30 minutes", method: "USP <701>" },
  { test: "Appearance", specification: "Conforms to product description", method: "Visual" },
];

export const POWDER_PHYSICAL_SPECS: PhysicalSpec[] = [
  { test: "Bulk Density", specification: "Per product specification", method: "SOP-QC-003" },
  { test: "Moisture Content", specification: "≤ 5.0%", method: "Karl Fischer" },
  { test: "Particle Size", specification: "Per product specification", method: "Sieve Analysis" },
  { test: "Appearance", specification: "Conforms to product description", method: "Visual" },
];

export function physicalSpecsFor(format: string | null | undefined): PhysicalSpec[] {
  const f = (format ?? "").toLowerCase();
  if (f === "tablet") return TABLET_PHYSICAL_SPECS;
  if (f === "powder") return POWDER_PHYSICAL_SPECS;
  return CAPSULE_PHYSICAL_SPECS; // default
}

// ─────────────────────────────────────────────────────────────────────────────
// Microbial limits (USP <2021>, <2022>) — finished dietary supplement
// ─────────────────────────────────────────────────────────────────────────────

export interface MicrobialLimit {
  test: string;
  specification: string;
  method: string;
}

export const MICROBIAL_LIMITS: MicrobialLimit[] = [
  { test: "Total Aerobic Microbial Count (TAMC)", specification: "< 10,000 CFU/g", method: "USP <2021>" },
  { test: "Total Combined Yeasts/Molds Count (TYMC)", specification: "< 1,000 CFU/g", method: "USP <2021>" },
  { test: "Escherichia coli", specification: "Negative / 10g", method: "USP <2022>" },
  { test: "Salmonella spp.", specification: "Negative / 25g", method: "USP <2022>" },
  { test: "Staphylococcus aureus", specification: "Negative / 10g", method: "USP <2022>" },
];

// ─────────────────────────────────────────────────────────────────────────────
// Heavy metal limits — Per Daily Dose (California Prop 65 style)
// USP <2232> + 21 CFR
// ─────────────────────────────────────────────────────────────────────────────

export interface HeavyMetalLimit {
  metal: string;
  symbol: string;
  specPerDailyDose: string;
  method: string;
  basis: string;
}

export const HEAVY_METAL_LIMITS: HeavyMetalLimit[] = [
  { metal: "Lead", symbol: "Pb", specPerDailyDose: "NMT 0.5 mcg", method: "ICP-MS", basis: "Prop 65" },
  { metal: "Mercury", symbol: "Hg", specPerDailyDose: "NMT 0.3 mcg", method: "ICP-MS", basis: "Prop 65" },
  { metal: "Cadmium", symbol: "Cd", specPerDailyDose: "NMT 4.1 mcg", method: "ICP-MS", basis: "Prop 65" },
  { metal: "Arsenic (Inorganic)", symbol: "As", specPerDailyDose: "NMT 10 mcg", method: "ICP-MS", basis: "USP <2232>" },
];

// ─────────────────────────────────────────────────────────────────────────────
// Potency spec range builder — per 21 CFR 101.9(g)(4)(i) + (g)(6)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Compute the spec range a finished-product COA should report for an active
 * ingredient given its label claim and overage tolerance.
 *
 * The lower bound is ALWAYS the label claim (Class I nutrients per 21 CFR
 * 101.9(g)(4)(i)). The upper bound is label claim × (1 + overage%/100), which
 * is what a properly formulated batch will assay at when made with the
 * documented overage.
 *
 * Examples:
 *   labelClaim=90mg, overage=10% → "90–99 mg (100–110%)"
 *   labelClaim=500mg, overage=20% → "500–600 mg (100–120%)"
 */
export function potencySpecRange(labelClaim: number, overagePct: number, unit: string): string {
  if (!Number.isFinite(labelClaim) || labelClaim <= 0) return "Per product specification";
  const upper = labelClaim * (1 + (overagePct || 0) / 100);
  const upperPct = 100 + (overagePct || 0);
  return `${round(labelClaim, 2)}–${round(upper, 2)} ${unit} (100–${round(upperPct, 0)}%)`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Common test methods (lookup by ingredient category)
// ─────────────────────────────────────────────────────────────────────────────

export function methodFor(category: string | null | undefined, ingredientName: string): string {
  const cat = (category ?? "").toLowerCase();
  const name = ingredientName.toLowerCase();
  if (name.includes("probiotic") || name.includes("lactobacillus") || name.includes("bifidobacterium")) return "Plate Count";
  if (cat.includes("vitamin")) return "HPLC";
  if (cat.includes("mineral")) return "ICP-MS";
  if (cat.includes("amino acid")) return "HPLC";
  if (cat.includes("botanical") || cat.includes("herb")) return "HPLC";
  if (cat.includes("fatty acid") || name.includes("omega")) return "GC";
  return "HPLC"; // safe default
}

// ─────────────────────────────────────────────────────────────────────────────
// Compliance / regulatory references
// ─────────────────────────────────────────────────────────────────────────────

export const REGULATORY_REFS = {
  cFr111: "21 CFR Part 111 — Current Good Manufacturing Practice for dietary supplements",
  cFr1019g4i: "21 CFR 101.9(g)(4)(i) — Class I nutrients (added) must be ≥100% of label claim",
  cFr1019g6: "21 CFR 101.9(g)(6) — Allowable overage; maximum determined by product stability",
  iso17025: "ISO/IEC 17025:2017 — General requirements for testing and calibration laboratories",
  usp701: "USP <701> — Disintegration",
  usp2021: "USP <2021> — Microbial Enumeration Tests for Nutritional and Dietary Supplements",
  usp2022: "USP <2022> — Microbiological Procedures for Absence of Specified Microorganisms",
  usp2232: "USP <2232> — Elemental Contaminants in Dietary Supplements",
} as const;

export const COA_DISCLAIMER = `This Certificate of Analysis has been prepared by ${MANUFACTURER.name} exclusively for the customer identified herein. All analytical work was conducted in accordance with scientifically valid, validated methods per 21 CFR Part 111 requirements. This report relates only to the sample(s) tested. ${MANUFACTURER.name} does not guarantee results upon product delivery if storage or handling conditions are not maintained per product specifications. This document is intended for regulatory and commercial use and may be provided to third parties including Amazon, FDA, and other regulatory bodies upon request.`;

function round(v: number, d: number): number {
  if (!Number.isFinite(v)) return 0;
  const f = Math.pow(10, d);
  return Math.round(v * f) / f;
}
