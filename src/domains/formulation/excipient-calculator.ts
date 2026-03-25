/**
 * Excipient Calculator — determines flow agents, lubricants, and filler
 * based on formulation complexity and capsule target fill weight.
 */

export type Complexity = "standard" | "moderate" | "high";

export interface ExcipientConfig {
  sio2Pct: number;
  mgstPct: number;
}

export interface ExcipientLine {
  name: string;
  mg: number;
  pct: number;
  type: "glidant" | "lubricant" | "filler";
}

export interface ExcipientResult {
  feasible: boolean;
  excipients: ExcipientLine[];
  totalExcipientMg: number;
  fillerMg: number;
  reason?: string;
}

const RULES: Record<Complexity, ExcipientConfig> = {
  standard: { sio2Pct: 0.005, mgstPct: 0.0075 },
  moderate: { sio2Pct: 0.0075, mgstPct: 0.0075 },
  high: { sio2Pct: 0.01, mgstPct: 0.01 },
};

/**
 * Determine complexity from formulation characteristics.
 * - HIGH: >8 actives OR >2 botanicals OR hygroscopic
 * - MODERATE: 4-8 actives OR micro-dosing (<5mg)
 * - STANDARD: everything else
 */
export function determineComplexity(
  activeCount: number,
  hasBotanicals: boolean,
  hasHygroscopic: boolean
): Complexity {
  if (activeCount > 8 || (hasBotanicals && activeCount > 2) || hasHygroscopic) return "high";
  if (activeCount >= 4) return "moderate";
  return "standard";
}

/**
 * Calculate excipient loads for a capsule formulation.
 */
export function calculateExcipients(
  activeMassMg: number,
  targetFillMg: number,
  complexity: Complexity = "standard"
): ExcipientResult {
  if (activeMassMg <= 0) {
    return { feasible: false, excipients: [], totalExcipientMg: 0, fillerMg: 0, reason: "Active mass must be > 0" };
  }
  if (targetFillMg <= 0) {
    return { feasible: false, excipients: [], totalExcipientMg: 0, fillerMg: 0, reason: "Target fill must be > 0" };
  }
  if (activeMassMg > targetFillMg) {
    return {
      feasible: false,
      excipients: [],
      totalExcipientMg: 0,
      fillerMg: 0,
      reason: `Active mass (${activeMassMg}mg) exceeds capsule capacity (${targetFillMg}mg). Increase capsule size.`,
    };
  }

  const rule = RULES[complexity];
  const sio2Mg = round(targetFillMg * rule.sio2Pct);
  const mgstMg = round(targetFillMg * rule.mgstPct);
  const fillerMg = round(targetFillMg - activeMassMg - sio2Mg - mgstMg);

  if (fillerMg < 0) {
    return {
      feasible: false,
      excipients: [],
      totalExcipientMg: 0,
      fillerMg: 0,
      reason: `Actives + excipients exceed target fill by ${Math.abs(fillerMg).toFixed(1)}mg. Increase capsule size.`,
    };
  }

  const excipients: ExcipientLine[] = [
    { name: "Silicon Dioxide", mg: sio2Mg, pct: rule.sio2Pct * 100, type: "glidant" },
    { name: "Magnesium Stearate", mg: mgstMg, pct: rule.mgstPct * 100, type: "lubricant" },
  ];

  if (fillerMg > 0) {
    excipients.push({
      name: "Microcrystalline Cellulose",
      mg: fillerMg,
      pct: round((fillerMg / targetFillMg) * 100),
      type: "filler",
    });
  }

  return {
    feasible: true,
    excipients,
    totalExcipientMg: round(sio2Mg + mgstMg + fillerMg),
    fillerMg,
  };
}

function round(v: number, d = 2): number {
  const f = Math.pow(10, d);
  return Math.round(v * f) / f;
}
