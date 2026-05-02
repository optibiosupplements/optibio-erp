/**
 * GET  /api/coas       — list COAs (newest first)
 * POST /api/coas       — generate a draft COA from a finished-product lot
 *
 * Auto-creates the COA row + a full set of test result rows (potency lines from
 * the formulation, plus standard microbial + heavy metal limits from the COA
 * standards module). Test results are SPECIFICATION-only by default — QC fills
 * the actual `result` and `status` values during release.
 *
 * POST body:
 *   { lotId: string }
 */

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  finishedProductCoas,
  coaTestResults,
  finishedProductLots,
  formulations,
  formulationIngredients,
  ingredients,
} from "@/lib/db/schema";
import { desc, eq, asc } from "drizzle-orm";
import { generateCoaNumber } from "@/domains/orders/id-generator";
import {
  MICROBIAL_LIMITS,
  HEAVY_METAL_LIMITS,
  physicalSpecsFor,
  potencySpecRange,
  methodFor,
} from "@/domains/coa/standards";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const rows = await db.select().from(finishedProductCoas).orderBy(desc(finishedProductCoas.createdAt)).limit(100);
    return NextResponse.json(rows);
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (!body.lotId) return NextResponse.json({ error: "lotId required" }, { status: 400 });

    const [lot] = await db.select().from(finishedProductLots).where(eq(finishedProductLots.id, body.lotId)).limit(1);
    if (!lot) return NextResponse.json({ error: "Lot not found" }, { status: 404 });

    const [formulation] = await db.select().from(formulations).where(eq(formulations.id, lot.formulationId)).limit(1);
    if (!formulation) return NextResponse.json({ error: "Formulation not found" }, { status: 400 });

    const productCode = lot.productCode ?? `NS-${lot.lotNumber.replace(/-/g, "")}C`;
    const coaNumber = await generateCoaNumber(productCode, lot.lotNumber);

    const [coa] = await db
      .insert(finishedProductCoas)
      .values({
        coaNumber,
        finishedProductLotId: lot.id,
        revision: 0,
        disposition: "Approved for Release",
        labSampleId: `QC-${lot.lotNumber}-FP`,
        notes: body.notes ?? null,
      })
      .returning();

    // Build test result spec rows. QC will edit `result` and `status` later.
    const lines = await db
      .select({ line: formulationIngredients, ing: ingredients })
      .from(formulationIngredients)
      .leftJoin(ingredients, eq(ingredients.id, formulationIngredients.ingredientId))
      .where(eq(formulationIngredients.formulationId, formulation.id))
      .orderBy(asc(formulationIngredients.sortOrder));

    const testRows: Array<typeof coaTestResults.$inferInsert> = [];
    let order = 0;

    // Physical specs
    for (const spec of physicalSpecsFor(formulation.dosageForm)) {
      testRows.push({
        coaId: coa.id,
        category: "Physical",
        testName: spec.test,
        specification: spec.specification,
        result: "TBD",
        method: spec.method,
        status: "Pass",
        sortOrder: order++,
      });
    }

    // Potency lines (active ingredients only)
    for (const { line, ing } of lines) {
      if (line.isExcipient) continue;
      const labelClaim = parseFloat(line.labelClaimMg);
      testRows.push({
        coaId: coa.id,
        category: "Potency",
        testName: ing?.name ?? "Ingredient",
        specification: potencySpecRange(labelClaim, parseFloat(line.overagePct), "mg"),
        result: "TBD",
        method: methodFor(ing?.category, ing?.name ?? ""),
        status: "Pass",
        sortOrder: order++,
      });
    }

    // Microbial
    for (const m of MICROBIAL_LIMITS) {
      testRows.push({
        coaId: coa.id,
        category: "Microbial",
        testName: m.test,
        specification: m.specification,
        result: "TBD",
        method: m.method,
        status: "Pass",
        sortOrder: order++,
      });
    }

    // Heavy Metals
    for (const h of HEAVY_METAL_LIMITS) {
      testRows.push({
        coaId: coa.id,
        category: "Heavy Metal",
        testName: `${h.metal} (${h.symbol})`,
        specification: h.specPerDailyDose,
        result: "TBD",
        method: h.method,
        status: "Pass",
        sortOrder: order++,
      });
    }

    if (testRows.length > 0) {
      await db.insert(coaTestResults).values(testRows);
    }

    return NextResponse.json({ success: true, coaId: coa.id, coaNumber });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("Create COA error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
