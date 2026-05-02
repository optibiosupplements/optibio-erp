/**
 * GET /api/quotes/[id]/xlsx
 *
 * Merged Excel export — best of PH Quote Template (customer-facing clean)
 * AND HGW NPEF working sheet (internal cost stack across tiers).
 *
 *   Sheet 1 — Specs
 *     PH-style header (Project / Customer / Sales / Date / NPEF Code) + packaging stack.
 *
 *   Sheet 2 — Formulation
 *     NPEF-style detailed columns: Sr No · RM# · Ingredient · Label Claim (mg) ·
 *     Assay% · Overage% · Adjusted mg · Final mg · % of formula · Total Qty kg @ batch ·
 *     Price/Kg · Line Cost
 *
 *   Sheet 3 — Cost Sheet
 *     NPEF cost stack laid out across tiers as columns instead of separate sheets.
 *     One column per tier (2K / 5K / 10K). Rows: RM Cost · Capsule Shell · Process Fee ·
 *     Manufacturing Total · Packaging · Wastage · Lab Cost · Subtotal · Overhead %
 *     · Overhead $ · Final Price/Unit · Margin % · Batch Total. Easy to compare tiers
 *     side-by-side — better than HGW's separate sheets per bottle count.
 *
 *   Sheet 4 — Quote
 *     Clean PH-style customer-facing summary: Volume Tiers + Price Per Unit + Batch Total.
 */

import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { db } from "@/lib/db";
import { quotes, quoteTiers, formulations, formulationIngredients, ingredients, customers } from "@/lib/db/schema";
import { eq, asc } from "drizzle-orm";
import {
  MANUFACTURER,
  MICROBIAL_LIMITS,
  HEAVY_METAL_LIMITS,
  REGULATORY_REFS,
  COA_DISCLAIMER,
  physicalSpecsFor,
  potencySpecRange,
  methodFor,
} from "@/domains/coa/standards";

export const dynamic = "force-dynamic";

interface FormulaRow {
  srNo: number;
  rmId: string;
  name: string;
  category: string;
  labelClaimMg: number;
  activeContentPct: number;
  overagePct: number;
  wastagePct: number;
  adjustedMg: number;
  finalMg: number;
  pctOfFormula: number;
  costPerKg: number;
  lineCost: number;
  isExcipient: boolean;
}

interface TierRow {
  qty: number;
  marginPct: number;
  rmCost: number;
  manufacturingCost: number;
  packagingCost: number;
  overheadCost: number;
  cogsPerUnit: number;
  pricePerUnit: number;
  totalBatchPrice: number;
}

interface QuoteData {
  quoteNumber: string;
  validUntil: string;
  productName: string;
  customerName: string;
  dosageForm: string;
  capsuleSize: string;
  capsulesPerServing: number;
  servingsPerContainer: string;
  ingredients: FormulaRow[];
  tiers: TierRow[];
  totalActiveMg: number;
  totalFormulaWeight: number;
}

async function loadQuoteData(id: string): Promise<QuoteData | null> {
  const [q] = await db.select().from(quotes).where(eq(quotes.id, id)).limit(1);
  if (!q) return null;

  const [customer] = q.customerId
    ? await db.select().from(customers).where(eq(customers.id, q.customerId)).limit(1)
    : [null];

  const [formulation] = q.formulationId
    ? await db.select().from(formulations).where(eq(formulations.id, q.formulationId)).limit(1)
    : [null];

  const lines = q.formulationId
    ? await db
        .select()
        .from(formulationIngredients)
        .where(eq(formulationIngredients.formulationId, q.formulationId))
        .orderBy(asc(formulationIngredients.sortOrder))
    : [];

  const ingRows: FormulaRow[] = [];
  let totalFormulaWeight = 0;
  let totalActiveMg = 0;
  let sr = 1;
  for (const line of lines) {
    const ing = line.ingredientId
      ? (await db.select().from(ingredients).where(eq(ingredients.id, line.ingredientId)).limit(1))[0]
      : null;
    const finalMg = parseFloat(line.finalMg);
    const labelClaimMg = parseFloat(line.labelClaimMg);
    totalFormulaWeight += finalMg;
    if (!line.isExcipient) totalActiveMg += labelClaimMg;
    ingRows.push({
      srNo: sr++,
      rmId: ing?.rmId ?? "",
      name: ing?.name ?? "Ingredient",
      category: ing?.category ?? "",
      labelClaimMg,
      activeContentPct: parseFloat(line.activeContentPct),
      overagePct: parseFloat(line.overagePct),
      wastagePct: parseFloat(line.wastagePct),
      adjustedMg: parseFloat(line.adjustedMg),
      finalMg,
      pctOfFormula: 0,
      costPerKg: parseFloat(line.costPerKg),
      lineCost: parseFloat(line.lineCost),
      isExcipient: line.isExcipient,
    });
  }
  for (const r of ingRows) {
    r.pctOfFormula = totalFormulaWeight > 0 ? (r.finalMg / totalFormulaWeight) * 100 : 0;
  }

  const tierRows = await db
    .select()
    .from(quoteTiers)
    .where(eq(quoteTiers.quoteId, q.id))
    .orderBy(asc(quoteTiers.tierQuantity));

  const tiers: TierRow[] = tierRows.length > 0
    ? tierRows.map((t) => ({
        qty: t.tierQuantity,
        marginPct: parseFloat(t.marginPct),
        rmCost: parseFloat(t.rawMaterialCost),
        manufacturingCost: parseFloat(t.manufacturingCost),
        packagingCost: parseFloat(t.packagingCost),
        overheadCost: parseFloat(t.overheadCost),
        cogsPerUnit: parseFloat(t.cogsPerUnit),
        pricePerUnit: parseFloat(t.pricePerUnit),
        totalBatchPrice: parseFloat(t.totalBatchPrice),
      }))
    : [];

  return {
    quoteNumber: q.quoteNumber,
    validUntil: q.validUntil ?? "",
    productName: formulation?.name ?? "—",
    customerName: customer?.companyName ?? "—",
    dosageForm: formulation?.dosageForm ?? "—",
    capsuleSize: formulation?.capsuleSize ?? "—",
    capsulesPerServing: formulation?.capsulesPerServing ?? 1,
    servingsPerContainer: formulation?.servingsPerContainer ? String(formulation.servingsPerContainer) : "—",
    ingredients: ingRows,
    tiers,
    totalActiveMg,
    totalFormulaWeight,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Sheet builders
// ─────────────────────────────────────────────────────────────────────────────

function buildSpecsSheet(d: QuoteData): XLSX.WorkSheet {
  // PH header expanded with NPEF metadata.
  const today = new Date().toISOString().slice(0, 10);
  const rows: (string | number | null)[][] = [
    ["NEW PROJECT EVALUATION FORM"],
    [],
    ["Project Name", d.productName, null, "Quote #", d.quoteNumber],
    ["Customer", d.customerName, null, "Date", today],
    ["Sales", "", null, "Valid Until", d.validUntil],
    ["NPEF Code #", "", null, "Initiator", ""],
    [],
    ["Form", d.dosageForm, null, "Capsule Size", d.capsuleSize],
    ["Capsules / Serving", d.capsulesPerServing, null, "Servings / Bottle", d.servingsPerContainer],
    [],
    ["── Packaging Specs ──"],
    ["Packaging Type", ""],
    ["Material", ""],
    ["Color", ""],
    ["Lid Type", ""],
    ["Lid Color", ""],
    ["Neckband", ""],
    ["Scoop", ""],
    ["Scoop Size", ""],
    ["Cotton", ""],
    ["Desiccant", ""],
    ["Customer Supplied Label", ""],
    ["Component Supplied — Bottle", ""],
    ["Component Supplied — Lid", ""],
    ["Case Pack", ""],
  ];
  const sheet = XLSX.utils.aoa_to_sheet(rows);
  sheet["!cols"] = [{ wch: 28 }, { wch: 32 }, { wch: 4 }, { wch: 22 }, { wch: 24 }];
  sheet["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 4 } }];
  return sheet;
}

function buildFormulationSheet(d: QuoteData): XLSX.WorkSheet {
  const actives = d.ingredients.filter((i) => !i.isExcipient);
  const excipients = d.ingredients.filter((i) => i.isExcipient);

  const rows: (string | number | null)[][] = [];

  rows.push(["BENCH FORMULATION"]);
  rows.push([]);
  rows.push(["Total Active per Serving (mg)", round(d.totalActiveMg, 2), null, null, "Total Formula Weight (mg)", round(d.totalFormulaWeight, 2)]);
  rows.push([]);

  rows.push([
    "Sr",
    "RM #",
    "Ingredient",
    "Label Claim (mg)",
    "Active %",
    "Overage %",
    "Adjusted (mg)",
    "Final (mg)",
    "% of formula",
    "Wastage %",
    "Price / kg ($)",
    "Cost / Unit ($)",
  ]);

  // Actives
  for (const i of actives) {
    rows.push([
      i.srNo,
      i.rmId,
      i.name,
      round(i.labelClaimMg, 2),
      round(i.activeContentPct, 2),
      round(i.overagePct, 2),
      round(i.adjustedMg, 2),
      round(i.finalMg, 2),
      round(i.pctOfFormula, 2),
      round(i.wastagePct, 2),
      round(i.costPerKg, 2),
      round(i.lineCost, 6),
    ]);
  }

  if (excipients.length > 0) {
    rows.push([]);
    rows.push(["── Excipients ──"]);
    rows.push(["Sr", "RM #", "Ingredient", "Label Claim (mg)", "Active %", "Overage %", "Adjusted (mg)", "Final (mg)", "% of formula", "Wastage %", "Price / kg ($)", "Cost / Unit ($)"]);
    for (const i of excipients) {
      rows.push([
        i.srNo, i.rmId, i.name,
        round(i.labelClaimMg, 2), round(i.activeContentPct, 2), round(i.overagePct, 2),
        round(i.adjustedMg, 2), round(i.finalMg, 2), round(i.pctOfFormula, 2),
        round(i.wastagePct, 2), round(i.costPerKg, 2), round(i.lineCost, 6),
      ]);
    }
  }

  // Totals row
  const totalLineCost = d.ingredients.reduce((s, i) => s + i.lineCost, 0);
  rows.push([]);
  rows.push(["", "", "TOTAL", "", "", "", "", round(d.totalFormulaWeight, 2), 100, "", "", round(totalLineCost, 6)]);

  rows.push([]);
  rows.push(["Formulation Notes"]);
  rows.push(["Is this a new product?", ""]);
  rows.push(["Excipient Restriction?", ""]);
  rows.push(["Restricted Excipient(s)", ""]);
  rows.push(["Preferred Lubricants", ""]);
  rows.push(["Preferred Bulking Agents", ""]);
  rows.push(["Preferred Flow Agents", ""]);

  const sheet = XLSX.utils.aoa_to_sheet(rows);
  sheet["!cols"] = [
    { wch: 4 }, { wch: 12 }, { wch: 38 }, { wch: 14 }, { wch: 10 }, { wch: 10 },
    { wch: 14 }, { wch: 14 }, { wch: 12 }, { wch: 10 }, { wch: 14 }, { wch: 14 },
  ];
  sheet["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 11 } }];
  return sheet;
}

function buildCostSheet(d: QuoteData): XLSX.WorkSheet {
  // NPEF-style cost stack, with each tier as a column.
  // RM Cost / Manufacturing / Packaging / Lab / Overhead / Final price.
  const tiers = d.tiers;
  const headerRow: (string | number | null)[] = ["NPEF Cost Sheet", null, ...tiers.map((t) => `${t.qty.toLocaleString()} units`)];

  const rows: (string | number | null)[][] = [];
  rows.push(headerRow);
  rows.push(["", null, ...tiers.map((t) => `${t.marginPct}% margin`)]);
  rows.push([]);

  // RM section
  rows.push(["RAW MATERIALS"]);
  rows.push(["Total RM Cost / Unit", null, ...tiers.map((t) => round(t.rmCost, 4))]);
  rows.push([]);

  // Manufacturing section
  rows.push(["MANUFACTURING"]);
  rows.push(["Capsule Shell / Tablet Cost", null, ...tiers.map(() => "")]);
  rows.push(["Process Fee (Encap / Compress / Fill)", null, ...tiers.map(() => "")]);
  rows.push(["Production Wastage", null, ...tiers.map(() => "")]);
  rows.push(["Manufacturing Total / Unit", null, ...tiers.map((t) => round(t.manufacturingCost, 4))]);
  rows.push([]);

  // Packaging
  rows.push(["PACKAGING"]);
  rows.push(["Bottle / Cap / Label / Carton", null, ...tiers.map(() => "")]);
  rows.push(["Packaging Total / Unit", null, ...tiers.map((t) => round(t.packagingCost, 4))]);
  rows.push([]);

  // Lab + overhead
  rows.push(["OTHER"]);
  rows.push(["Lab / Batch Testing", null, ...tiers.map(() => "")]);
  rows.push(["Overhead", null, ...tiers.map((t) => round(t.overheadCost, 4))]);
  rows.push([]);

  // Subtotal + price
  rows.push(["COGS / Unit", null, ...tiers.map((t) => round(t.cogsPerUnit, 4))]);
  rows.push(["Margin %", null, ...tiers.map((t) => `${round(t.marginPct, 1)}%`)]);
  rows.push(["FINAL PRICE / UNIT", null, ...tiers.map((t) => round(t.pricePerUnit, 2))]);
  rows.push([]);

  // Batch totals
  rows.push(["Tier Quantity (units)", null, ...tiers.map((t) => t.qty)]);
  rows.push(["BATCH TOTAL ($)", null, ...tiers.map((t) => round(t.totalBatchPrice, 2))]);

  const sheet = XLSX.utils.aoa_to_sheet(rows);
  const colWidths = [{ wch: 36 }, { wch: 4 }, ...tiers.map(() => ({ wch: 18 }))];
  sheet["!cols"] = colWidths;
  // Merge title row across cols
  if (tiers.length > 0) {
    sheet["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 1 } }];
  }
  return sheet;
}

function buildQuoteSheet(d: QuoteData): XLSX.WorkSheet {
  // Customer-facing PH-style summary
  const rows: (string | number | null)[][] = [
    ["QUOTE SUMMARY"],
    [],
    ["Project", d.productName],
    ["Quote #", d.quoteNumber],
    ["Date", new Date().toISOString().slice(0, 10)],
    ["Valid Until", d.validUntil || "(set on save)"],
    [],
    ["Volume Tier", "Price Per Unit", "Total"],
  ];
  for (const t of d.tiers) {
    rows.push([
      `${t.qty.toLocaleString()} UNITS`,
      t.pricePerUnit > 0 ? round(t.pricePerUnit, 2) : "",
      t.totalBatchPrice > 0 ? round(t.totalBatchPrice, 2) : "",
    ]);
  }
  rows.push([]);
  rows.push(["Notes:"]);
  rows.push(["• Pricing valid 30 days from quote date."]);
  rows.push(["• MOQ pricing assumes single batch run."]);
  rows.push(["• Custom packaging may incur additional charges."]);
  rows.push(["• Lead time: 8–12 weeks after batch sheet approval."]);

  const sheet = XLSX.utils.aoa_to_sheet(rows);
  sheet["!cols"] = [{ wch: 24 }, { wch: 18 }, { wch: 18 }];
  sheet["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 2 } }];
  return sheet;
}

function buildSpecSheet(d: QuoteData): XLSX.WorkSheet {
  // Customer-ready "Product Specification Sheet" — mirrors COA structure, but
  // with spec ranges only (no test results, since this is pre-batch). Send this
  // alongside the quote so customers know exactly what testing the finished
  // product will pass.
  const today = new Date().toISOString().slice(0, 10);
  const actives = d.ingredients.filter((i) => !i.isExcipient);
  const excipients = d.ingredients.filter((i) => i.isExcipient);
  const productCode = `NS-${d.quoteNumber.replace(/[^0-9]/g, "").slice(-4) || "0000"}C`;

  const rows: (string | number | null)[][] = [];

  // Header
  rows.push(["PRODUCT SPECIFICATION SHEET"]);
  rows.push([`${MANUFACTURER.name} | Finished Product Release Specification | 21 CFR Part 111 Compliant`]);
  rows.push([]);

  // ── PRODUCT IDENTIFICATION ──
  rows.push(["PRODUCT IDENTIFICATION"]);
  rows.push(["Product Name:", d.productName, "", "Spec Sheet Date:", today]);
  rows.push(["Product Code:", productCode, "", "Stability Protocol:", `STAB-${productCode}-001`]);
  rows.push(["Quote #:", d.quoteNumber, "", "Customer:", d.customerName]);
  rows.push(["Form:", d.dosageForm, "", "Capsule Size:", d.capsuleSize]);
  rows.push(["Capsules / Serving:", d.capsulesPerServing, "", "Servings / Bottle:", d.servingsPerContainer]);
  rows.push(["Product Description:", `Size #${d.capsuleSize !== "—" ? d.capsuleSize : "00"} ${d.dosageForm.toLowerCase()}, conforms to spec`, "", "", ""]);
  rows.push([]);

  // ── PHYSICAL SPECIFICATIONS ──
  rows.push(["PHYSICAL SPECIFICATIONS"]);
  rows.push(["Test", "Specification", "Method", "Reference"]);
  for (const spec of physicalSpecsFor(d.dosageForm)) {
    rows.push([spec.test, spec.specification, spec.method, ""]);
  }
  rows.push([]);

  // ── POTENCY SPECIFICATIONS (per serving) ──
  rows.push([`POTENCY SPECIFICATIONS — Per Serving: ${d.capsulesPerServing} ${d.dosageForm}`]);
  rows.push(["21 CFR 101.9(g)(4)(i): Class I nutrients must be ≥100% of label claim"]);
  rows.push(["Dietary Ingredient", "Label Claim", "Specification Range", "Method"]);
  for (const i of actives) {
    const claim = `${round(i.labelClaimMg, 2)} mg`;
    const range = potencySpecRange(i.labelClaimMg, i.overagePct, "mg");
    const method = methodFor(i.category, i.name);
    rows.push([i.name, claim, range, method]);
  }
  if (excipients.length > 0) {
    const otherIng = excipients.map((e) => e.name).join(", ");
    rows.push([]);
    rows.push(["Other Ingredients:", otherIng]);
  }
  rows.push([]);

  // ── CONTAMINANT TESTING ──
  rows.push(["CONTAMINANT TESTING — Microbial Analysis (Finished Product)"]);
  rows.push(["Test", "Specification", "Method"]);
  for (const m of MICROBIAL_LIMITS) {
    rows.push([m.test, m.specification, m.method]);
  }
  rows.push([]);

  rows.push(["CONTAMINANT TESTING — Heavy Metal Analysis (Per Daily Dose)"]);
  rows.push(["Metal", "Specification", "Method", "Basis"]);
  for (const h of HEAVY_METAL_LIMITS) {
    rows.push([`${h.metal} (${h.symbol})`, h.specPerDailyDose, h.method, h.basis]);
  }
  rows.push([]);

  // ── LABORATORY INFORMATION ──
  rows.push(["LABORATORY INFORMATION"]);
  rows.push(["Testing Laboratory:", MANUFACTURER.qcLab]);
  rows.push(["Lab Accreditation:", MANUFACTURER.labAccreditation]);
  rows.push(["Document Type:", "Pre-Batch Specification Sheet"]);
  rows.push(["Note:", "Actual COA with test results issued per batch upon manufacture."]);
  rows.push([]);

  // ── REGULATORY REFERENCES ──
  rows.push(["REGULATORY REFERENCES"]);
  rows.push([REGULATORY_REFS.cFr111]);
  rows.push([REGULATORY_REFS.cFr1019g4i]);
  rows.push([REGULATORY_REFS.cFr1019g6]);
  rows.push([REGULATORY_REFS.iso17025]);
  rows.push([REGULATORY_REFS.usp701]);
  rows.push([REGULATORY_REFS.usp2021]);
  rows.push([REGULATORY_REFS.usp2022]);
  rows.push([REGULATORY_REFS.usp2232]);
  rows.push([]);

  // ── COMPLIANCE BADGES ──
  rows.push(["COMPLIANCE"]);
  rows.push([MANUFACTURER.certifications.join(" | ")]);
  rows.push([]);

  // ── DISCLAIMER ──
  rows.push(["DISCLAIMER"]);
  rows.push([COA_DISCLAIMER]);
  rows.push([]);

  // ── FOOTER ──
  rows.push([`${MANUFACTURER.address} | Ph: ${MANUFACTURER.phone} | ${MANUFACTURER.website}`]);

  const sheet = XLSX.utils.aoa_to_sheet(rows);
  sheet["!cols"] = [{ wch: 36 }, { wch: 38 }, { wch: 22 }, { wch: 26 }, { wch: 22 }];

  // Merge title row across all 5 columns
  sheet["!merges"] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 4 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: 4 } },
  ];

  return sheet;
}

function buildWorkbook(d: QuoteData): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, buildSpecsSheet(d), "Project");
  XLSX.utils.book_append_sheet(wb, buildSpecSheet(d), "Spec Sheet");
  XLSX.utils.book_append_sheet(wb, buildFormulationSheet(d), "Formulation");
  XLSX.utils.book_append_sheet(wb, buildCostSheet(d), "Cost Sheet");
  XLSX.utils.book_append_sheet(wb, buildQuoteSheet(d), "Quote");
  return wb;
}

function round(v: number, d: number): number {
  if (!Number.isFinite(v)) return 0;
  const f = Math.pow(10, d);
  return Math.round(v * f) / f;
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const data = await loadQuoteData(id);
    if (!data) return NextResponse.json({ error: "Quote not found" }, { status: 404 });

    const wb = buildWorkbook(data);
    const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

    const safeName = (data.productName || "Quote").replace(/[^a-z0-9_-]+/gi, "_").slice(0, 60);
    const filename = `${data.quoteNumber}_${safeName}.xlsx`;

    return new NextResponse(buffer as BodyInit, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
