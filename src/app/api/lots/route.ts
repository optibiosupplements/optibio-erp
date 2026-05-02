/**
 * GET  /api/lots          — list finished-product lots (newest first)
 * POST /api/lots          — register a finished-product lot from a completed batch
 *
 * POST body:
 *   {
 *     productionRunId: string,
 *     quantityUnits: number,        // bottles produced
 *     manufacturingDate?: string,   // ISO date, defaults today
 *     expirationDate?: string,      // defaults to manufacturingDate + 36 months
 *     productCode?: string,         // e.g. NS-3318C
 *     stabilityProtocol?: string,
 *     notes?: string,
 *   }
 */

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { finishedProductLots, productionRuns } from "@/lib/db/schema";
import { desc, eq } from "drizzle-orm";
import { generateLotNumber } from "@/domains/orders/id-generator";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const rows = await db.select().from(finishedProductLots).orderBy(desc(finishedProductLots.createdAt)).limit(100);
    return NextResponse.json(rows);
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}

function plus36Months(iso: string): string {
  const d = new Date(iso);
  d.setMonth(d.getMonth() + 36);
  return d.toISOString().slice(0, 10);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (!body.productionRunId) return NextResponse.json({ error: "productionRunId required" }, { status: 400 });
    if (!body.quantityUnits) return NextResponse.json({ error: "quantityUnits required" }, { status: 400 });

    const [run] = await db.select().from(productionRuns).where(eq(productionRuns.id, body.productionRunId)).limit(1);
    if (!run) return NextResponse.json({ error: "Production run not found" }, { status: 404 });
    if (!run.formulationId) return NextResponse.json({ error: "Production run has no formulation" }, { status: 400 });

    const lotNumber = await generateLotNumber();
    const mfgDate = body.manufacturingDate ?? new Date().toISOString().slice(0, 10);

    const [lot] = await db
      .insert(finishedProductLots)
      .values({
        lotNumber,
        formulationId: run.formulationId,
        productionRunId: run.id,
        quantityUnits: parseInt(String(body.quantityUnits), 10),
        manufacturingDate: mfgDate,
        expirationDate: body.expirationDate ?? plus36Months(mfgDate),
        productCode: body.productCode ?? null,
        stabilityProtocol: body.stabilityProtocol ?? (body.productCode ? `STAB-${body.productCode}-001` : null),
        status: "In QC",
        notes: body.notes ?? null,
      })
      .returning();

    // Mark production run complete (if not already)
    if (run.status !== "Complete") {
      await db.update(productionRuns).set({ status: "Complete", completionDate: mfgDate, updatedAt: new Date() }).where(eq(productionRuns.id, run.id));
    }

    return NextResponse.json({ success: true, lotId: lot.id, lotNumber });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("Create lot error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
