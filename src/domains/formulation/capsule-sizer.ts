/**
 * Capsule Sizer — determines if a formulation fits in a capsule
 * and recommends the optimal capsule size + capsules per serving.
 */

export const CAPSULE_CAPACITIES: Record<string, number> = {
  "3": 200,
  "2": 300,
  "1": 400,
  "0": 500,
  "00": 735,
  "000": 1000,
};

const SIZES_ORDERED = ["3", "2", "1", "0", "00", "000"];

export interface SizingResult {
  feasible: boolean;
  capsuleSize: string;
  capsulesPerServing: number;
  totalMgPerServing: number;
  totalMgPerCapsule: number;
  fillPercentage: number;
  recommendation: string;
  warnings: string[];
}

/**
 * Find the optimal capsule configuration for a given fill weight.
 * Tries from smallest capsule up, then increases capsules per serving (max 6).
 */
export function sizeCapsule(
  totalFillMg: number,
  maxCapsulesPerServing = 6
): SizingResult {
  const warnings: string[] = [];

  for (let caps = 1; caps <= maxCapsulesPerServing; caps++) {
    const mgPerCapsule = totalFillMg / caps;

    for (const size of SIZES_ORDERED) {
      const capacity = CAPSULE_CAPACITIES[size];
      if (mgPerCapsule <= capacity) {
        const fillPct = (mgPerCapsule / capacity) * 100;

        if (fillPct < 50 && caps === 1) {
          warnings.push(
            `Fill is only ${fillPct.toFixed(0)}% — consider a smaller capsule or adding more filler.`
          );
        }

        return {
          feasible: true,
          capsuleSize: size,
          capsulesPerServing: caps,
          totalMgPerServing: totalFillMg,
          totalMgPerCapsule: Math.round(mgPerCapsule * 100) / 100,
          fillPercentage: Math.round(fillPct * 100) / 100,
          recommendation:
            caps === 1
              ? `Size ${size} capsule (${fillPct.toFixed(0)}% fill)`
              : `${caps} × Size ${size} capsules (${fillPct.toFixed(0)}% fill each)`,
          warnings,
        };
      }
    }
  }

  return {
    feasible: false,
    capsuleSize: "",
    capsulesPerServing: 0,
    totalMgPerServing: totalFillMg,
    totalMgPerCapsule: 0,
    fillPercentage: 0,
    recommendation: "Formulation exceeds maximum capsule capacity. Consider reducing ingredients or switching to tablet format.",
    warnings: [
      `Total fill ${totalFillMg}mg exceeds ${maxCapsulesPerServing} × Size 000 (${maxCapsulesPerServing * 1000}mg max).`,
    ],
  };
}
