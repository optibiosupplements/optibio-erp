/**
 * Format detector. Phase-1 supported: Capsule, Tablet, Powder.
 * Stickpack/Gummy/Liquid/Softgel are out of scope (route to manual quoting).
 *
 * Per the spec doc safety mode: if no keyword found, return null — do NOT
 * default to Capsule. Let the user pick.
 */

export type SupportedFormat = "CAPSULE" | "TABLET" | "POWDER";
export type UnsupportedFormat = "STICKPACK_OOS" | "GUMMY_OOS" | "LIQUID_OOS" | "SOFTGEL_OOS";
export type DetectedFormat = SupportedFormat | UnsupportedFormat | null;

export interface FormatDetection {
  format: DetectedFormat;
  isSupported: boolean;
  warning?: string;
}

export function detectFormat(text: string): FormatDetection {
  const lower = text.toLowerCase();

  const capsule = (lower.match(/\b(capsule|cap|caps|vcap|veggie cap|hpmc|gelatin)\b/gi) || []).length;
  const tablet = (lower.match(/\b(tablet|tab|tabs|chewable|lozenge|odt)\b/gi) || []).length;
  const powder = (lower.match(/\b(powder|pwdr|scoop|drink mix|bulk powder)\b/gi) || []).length;
  const stickpack = (lower.match(/\b(stick ?pack|sachet)\b/gi) || []).length;
  const gummy = (lower.match(/\b(gummy|gummies|pectin)\b/gi) || []).length;
  const liquid = (lower.match(/\b(liquid|tincture|syrup|drops)\b/gi) || []).length;
  const softgel = (lower.match(/\b(softgel|soft gel)\b/gi) || []).length;

  const counts: Array<[DetectedFormat, number]> = [
    ["CAPSULE", capsule],
    ["TABLET", tablet],
    ["POWDER", powder],
    ["STICKPACK_OOS", stickpack],
    ["GUMMY_OOS", gummy],
    ["LIQUID_OOS", liquid],
    ["SOFTGEL_OOS", softgel],
  ];

  const max = Math.max(...counts.map(([, n]) => n));
  if (max === 0) return { format: null, isSupported: false };

  // ambiguous — multiple formats with the same count
  if (counts.filter(([, n]) => n === max).length > 1) {
    return { format: null, isSupported: false, warning: "Multiple formats detected — please pick one." };
  }

  const [winner] = counts.find(([, n]) => n === max)!;

  switch (winner) {
    case "CAPSULE":
    case "TABLET":
    case "POWDER":
      return { format: winner, isSupported: true };
    case "STICKPACK_OOS":
      return { format: winner, isSupported: false, warning: "Stick packs are not supported in Optibio ERP — quote manually." };
    case "GUMMY_OOS":
      return { format: winner, isSupported: false, warning: "Gummies are not supported in Optibio ERP — quote manually." };
    case "LIQUID_OOS":
      return { format: winner, isSupported: false, warning: "Liquids are not supported in Optibio ERP — quote manually." };
    case "SOFTGEL_OOS":
      return { format: winner, isSupported: false, warning: "Softgels are not supported in Optibio ERP — quote manually." };
    default:
      return { format: null, isSupported: false };
  }
}

export const SUPPORTED_FORMATS: SupportedFormat[] = ["CAPSULE", "TABLET", "POWDER"];
