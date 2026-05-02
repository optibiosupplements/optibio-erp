/**
 * GET  /api/batches       — list production runs (newest first)
 * POST /api/batches       — start a production run from a PO
 *
 * POST body:
 *   {
 *     purchaseOrderId: string,
 *     formulationId?: string,    // defaults to PO line 1
 *     targetBatchSize: number,   // capsules
 *     leadQcAnalyst?: string,
 *     releaseQaManager?: string,
 *     startDate?: string,
 *   }
 */

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { productionRuns, purchaseOrders, poLineItems } from "@/lib/db/schema";
import { desc, eq } from "drizzle-orm";
import { generateBatchNumber } from "@/domains/orders/id-generator";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const rows = await db.select().from(productionRuns).orderBy(desc(productionRuns.createdAt)).limit(100);
    return NextResponse.json(rows);
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (!body.purchaseOrderId) return NextResponse.json({ error: "purchaseOrderId required" }, { status: 400 });
    if (!body.targetBatchSize) return NextResponse.json({ error: "targetBatchSize required" }, { status: 400 });

    const [po] = await db.select().from(purchaseOrders).where(eq(purchaseOrders.id, body.purchaseOrderId)).limit(1);
    if (!po) return NextResponse.json({ error: "PO not found" }, { status: 404 });

    let formulationId = body.formulationId;
    if (!formulationId) {
      const lines = await db.select().from(poLineItems).where(eq(poLineItems.purchaseOrderId, po.id)).limit(1);
      formulationId = lines[0]?.formulationId ?? null;
    }

    const batchNumber = await generateBatchNumber();

    const [run] = await db
      .insert(productionRuns)
      .values({
        batchNumber,
        formulationId: formulationId ?? null,
        purchaseOrderId: po.id,
        targetBatchSize: parseInt(String(body.targetBatchSize), 10),
        startDate: body.startDate ?? null,
        status: "Scheduled",
        leadQcAnalyst: body.leadQcAnalyst ?? null,
        releaseQaManager: body.releaseQaManager ?? null,
        notes: body.notes ?? null,
      })
      .returning();

    // Move PO into "In Production"
    await db.update(purchaseOrders).set({ status: "In Production", updatedAt: new Date() }).where(eq(purchaseOrders.id, po.id));

    return NextResponse.json({ success: true, productionRunId: run.id, batchNumber });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("Create batch error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
