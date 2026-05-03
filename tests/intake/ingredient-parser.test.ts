/**
 * Ingredient parser tests. Ported from supplement-quote-app26's vitest suite,
 * adapted to bun's built-in test runner.
 *
 * Run: `bun test tests/intake/ingredient-parser.test.ts`
 */

import { describe, it, expect } from "bun:test";
import { parseIngredients, ingredientsToRawText } from "../../src/domains/intake/ingredient-parser";
import { detectFormat } from "../../src/domains/intake/format-detector";

describe("parseIngredients", () => {
  it("parses simple ingredient with amount and unit", () => {
    const result = parseIngredients("Vitamin C 500mg");
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("Vitamin C");
    expect(result[0].amount).toBe("500");
    expect(result[0].unit).toBe("mg");
    expect(result[0].isActive).toBe(true);
  });

  it("parses ingredient with space between amount and unit", () => {
    const result = parseIngredients("Zinc 5.5 mg");
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("Zinc");
    expect(result[0].amount).toBe("5.5");
    expect(result[0].unit).toBe("mg");
  });

  it("parses ingredient with ratio extract", () => {
    const result = parseIngredients("Elderberry 10:1 200mg");
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("Elderberry");
    expect(result[0].amount).toBe("200");
    expect(result[0].unit).toBe("mg");
    expect(result[0].notes).toContain("10:1");
  });

  it("parses multiple ingredients on separate lines", () => {
    const text = `Vitamin C 500mg
Vitamin D 1000 IU
Zinc 15mg`;
    const result = parseIngredients(text);
    expect(result).toHaveLength(3);
    expect(result[0].name).toBe("Vitamin C");
    expect(result[1].name).toBe("Vitamin D");
    expect(result[1].unit).toBe("IU");
    expect(result[2].name).toBe("Zinc");
  });

  it("handles bullet points", () => {
    const text = `• Vitamin C 500mg
- Zinc 15mg
* Vitamin D 1000IU`;
    const result = parseIngredients(text);
    expect(result).toHaveLength(3);
    expect(result[0].name).toBe("Vitamin C");
    expect(result[1].name).toBe("Zinc");
    expect(result[2].name).toBe("Vitamin D");
  });

  it("marks ingredients after \"Other Ingredients:\" as inactive", () => {
    const text = `Vitamin C 500mg
Zinc 15mg
Other Ingredients:
Magnesium Stearate
Cellulose`;
    const result = parseIngredients(text);
    expect(result.length).toBeGreaterThanOrEqual(2);
    const active = result.filter((r) => r.isActive);
    const inactive = result.filter((r) => !r.isActive);
    expect(active.length).toBe(2);
    expect(inactive.length).toBeGreaterThanOrEqual(2);
    expect(inactive.some((r) => r.name === "Magnesium Stearate")).toBe(true);
    expect(inactive.some((r) => r.name === "Cellulose")).toBe(true);
  });

  it("handles empty input", () => {
    expect(parseIngredients("")).toEqual([]);
    expect(parseIngredients("   ")).toEqual([]);
  });

  it("parses CFU units for probiotics", () => {
    const result = parseIngredients("Lactobacillus 10 billion CFU");
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("Lactobacillus");
    expect(result[0].amount).toBe("10");
    expect(result[0].unit).toBe("billion CFU");
  });

  it("parses + delimited single line (Asher Elderberry canonical)", () => {
    const result = parseIngredients("Elderberry 10:1 500mg + Vit C 90mg + Vit D 1000 IU + Zinc 11mg");
    expect(result).toHaveLength(4);
    expect(result[0].name).toBe("Elderberry");
    expect(result[0].amount).toBe("500");
    expect(result[1].name).toBe("Vit C");
    expect(result[1].amount).toBe("90");
    expect(result[2].name).toBe("Vit D");
    expect(result[2].unit).toBe("IU");
    expect(result[3].name).toBe("Zinc");
    expect(result[3].amount).toBe("11");
  });
});

describe("detectFormat", () => {
  it("detects CAPSULE", () => {
    expect(detectFormat("Vitamin C 500mg capsule form").format).toBe("CAPSULE");
    expect(detectFormat("60 veggie caps").format).toBe("CAPSULE");
  });

  it("detects TABLET", () => {
    expect(detectFormat("Vitamin C 500mg tablet").format).toBe("TABLET");
    expect(detectFormat("90 tabs per bottle").format).toBe("TABLET");
  });

  it("detects POWDER", () => {
    expect(detectFormat("Protein powder 30g per scoop").format).toBe("POWDER");
  });

  it("returns null for ambiguous text", () => {
    expect(detectFormat("Vitamin C 500mg").format).toBe(null);
  });

  it("flags STICKPACK as out-of-scope", () => {
    const r = detectFormat("Hydration stickpack 8.5g");
    expect(r.format).toBe("STICKPACK_OOS");
    expect(r.isSupported).toBe(false);
    expect(r.warning).toContain("Stick packs");
  });
});

describe("ingredientsToRawText", () => {
  it("converts ingredients back to text", () => {
    const ingredients = [
      { id: "1", name: "Vitamin C", amount: "500", unit: "mg", notes: "", isActive: true },
      { id: "2", name: "Zinc", amount: "15", unit: "mg", notes: "", isActive: true },
    ];
    const result = ingredientsToRawText(ingredients);
    expect(result).toContain("Vitamin C 500mg");
    expect(result).toContain("Zinc 15mg");
  });

  it("separates active and inactive ingredients", () => {
    const ingredients = [
      { id: "1", name: "Vitamin C", amount: "500", unit: "mg", notes: "", isActive: true },
      { id: "2", name: "Cellulose", amount: "", unit: "", notes: "", isActive: false },
    ];
    const result = ingredientsToRawText(ingredients);
    expect(result).toContain("Vitamin C 500mg");
    expect(result).toContain("Other Ingredients:");
    expect(result).toContain("Cellulose");
  });
});
