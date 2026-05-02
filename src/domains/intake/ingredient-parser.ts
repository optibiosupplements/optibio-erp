/**
 * Greedy ingredient parser. Ported from supplement-quote-app26.
 *
 * Splits raw text into structured ingredient lines. Never throws — empty input
 * returns []. Per the spec doc ("What should happen when the user clicks"),
 * parsing failure must NEVER block RFQ creation.
 *
 * Active vs Inactive split: any line containing one of INACTIVE_DELIMITERS
 * flips subsequent lines to inactive. Fallback: treat all as active.
 */

export interface ParsedIngredient {
  id: string;
  name: string;
  amount: string;
  unit: string;
  notes: string;
  isActive: boolean;
}

const UNITS = [
  "mg", "g", "kg", "mcg", "µg", "ug",
  "IU", "iu",
  "ml", "mL", "L", "l",
  "%", "ppm", "ppb",
  "billion CFU", "CFU", "cfu",
  "serving", "servings",
  "cap", "caps", "capsule", "capsules",
  "tab", "tabs", "tablet", "tablets",
  "scoop", "scoops",
];

const AMOUNT_UNIT_PATTERN = new RegExp(
  `(\\d+(?:[.,]\\d+)?(?::\\d+)?)?\\s*(${UNITS.join("|")})(?:\\s|$|,|;)`,
  "gi",
);

const RATIO_PATTERN = /(\d+:\d+)/;

const INACTIVE_DELIMITERS = [
  "other ingredients:",
  "other ingredients",
  "inactive ingredients:",
  "inactive ingredients",
  "excipients:",
  "excipients",
  "non-medicinal ingredients:",
  "non-medicinal ingredients",
];

export function parseIngredients(rawText: string): ParsedIngredient[] {
  if (!rawText?.trim()) return [];

  const ingredients: ParsedIngredient[] = [];

  // Support both newline-separated and `+`/`,` delimited single-line input
  // (e.g. "Elderberry 10:1 500mg + Vit C 90mg + Vit D 1000 IU + Zinc 11mg")
  const normalized = rawText
    .replace(/\s+\+\s+/g, "\n")
    .replace(/(\d+\s*(?:mg|mcg|g|IU|iu|cfu|CFU|%|ml|L)),\s+/gi, "$1\n");

  const lines = normalized.split(/[\n\r]+/).map((l) => l.trim()).filter(Boolean);

  let isInactiveSection = false;

  for (const line of lines) {
    const lowerLine = line.toLowerCase();
    if (INACTIVE_DELIMITERS.some((d) => lowerLine.includes(d))) {
      isInactiveSection = true;
      const afterDelimiter = INACTIVE_DELIMITERS.reduce(
        (text, d) => text.replace(new RegExp(d, "gi"), ""),
        line,
      ).trim();
      if (!afterDelimiter) continue;
    }

    if (/^(capsule|tablet|powder|liquid|gummy)s?\s*$/i.test(line)) continue;

    const parsed = parseIngredientLine(line, isInactiveSection);
    if (parsed) ingredients.push(parsed);
  }

  return ingredients;
}

function parseIngredientLine(line: string, isInactive: boolean): ParsedIngredient | null {
  let cleanLine = line
    .replace(/^[-•*·]\s*/, "")
    .replace(/^\d+[.)]\s*/, "")
    .trim();

  if (!cleanLine) return null;

  let ratio = "";
  const ratioMatch = cleanLine.match(RATIO_PATTERN);
  if (ratioMatch) ratio = ratioMatch[1];

  let amount = "";
  let unit = "";
  let name = cleanLine;
  let notes = "";

  AMOUNT_UNIT_PATTERN.lastIndex = 0;
  const amountMatch = AMOUNT_UNIT_PATTERN.exec(cleanLine);

  if (amountMatch) {
    amount = amountMatch[1] || "";
    unit = amountMatch[2] || "";

    const matchIndex = amountMatch.index;
    name = cleanLine.substring(0, matchIndex).trim();

    const afterMatch = cleanLine.substring(matchIndex + amountMatch[0].length).trim();
    if (afterMatch && !afterMatch.match(AMOUNT_UNIT_PATTERN)) {
      notes = afterMatch.replace(/^[,;]\s*/, "");
    }
  }

  if (!amount && !unit) {
    const numberMatch = cleanLine.match(/(\d+(?:[.,]\d+)?)/);
    if (numberMatch) {
      amount = numberMatch[1];
      name = cleanLine.replace(numberMatch[0], "").trim();
    }
  }

  name = name
    .replace(RATIO_PATTERN, "")
    .replace(/\s+/g, " ")
    .replace(/[,;]+$/, "")
    .trim();

  if (ratio && !notes.includes(ratio)) {
    notes = notes ? `${ratio} extract, ${notes}` : `${ratio} extract`;
  }

  if (!name || name.length < 2) return null;

  return {
    id: `ing_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`,
    name,
    amount,
    unit,
    notes,
    isActive: !isInactive,
  };
}

export function ingredientsToRawText(ingredients: ParsedIngredient[]): string {
  const active = ingredients.filter((i) => i.isActive);
  const inactive = ingredients.filter((i) => !i.isActive);

  let text = "";
  for (const ing of active) text += formatIngredientLine(ing) + "\n";
  if (inactive.length > 0) {
    text += "\nOther Ingredients:\n";
    for (const ing of inactive) text += formatIngredientLine(ing) + "\n";
  }
  return text.trim();
}

function formatIngredientLine(ing: ParsedIngredient): string {
  let line = ing.name;
  if (ing.amount) {
    line += ` ${ing.amount}`;
    if (ing.unit) line += ing.unit;
  }
  if (ing.notes) line += ` (${ing.notes})`;
  return line;
}
