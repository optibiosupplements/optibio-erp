/**
 * GET    /api/supplier-pos/[id]                — fetch SPO + lines
 * PATCH  /api/supplier-pos/[id]                — update status / dates / notes
 * POST   /api/supplier-pos/[id]/receive        — mark Received: create raw_material_lots,
 *                                                  log lot_movements, link back to SPO line
 *
 * The receive flow is implemented inline in PATCH when status: "Received" is set
 * with `receiveLines: [{ lineId, lotNumber, quantityKg, costPerKgActual?, supplierCoaUrl? }]`.
 */

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  supplierPurchaseOrders, supplierPoLineItems, rawMaterialLots, lotMovements,
} from "@/lib/db/schema";
import { eq, asc } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const [spo] = await db.select().from(supplierPurchaseOrders).where(eq(supplierPurchaseOrders.id, id)).limit(1);
    if (!spo) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const lines = await db.select().from(supplierPoLineItems).where(eq(supplierPoLineItems.supplierPoId, id)).orderBy(asc(supplierPoLineItems.sortOrder));
    return NextResponse.json({ supplierPo: spo, lineItems: lines });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}

const ALLOWED = ["status", "orderDate", "expectedDate", "receivedDate", "paymentTerms", "shippingTerms", "notes"] as const;

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const body = await req.json();

    const updates: Record<string, unknown> = { updatedAt: new Date() };
    for (const k of ALLOWED) if (body[k] !== undefined) updates[k] = body[k];

    // If marking Received and receive lines provided, create raw_material_lots
    if (body.status === "Received" && Array.isArray(body.receiveLines)) {
      const [spo] = await db.select().from(supplierPurchaseOrders).where(eq(supplierPurchaseOrders.id, id)).limit(1);
      if (!spo) return NextResponse.json({ error: "SPO not found" }, { status: 404 });

      const today = new Date().toISOString().slice(0, 10);
      for (const recv of body.receiveLines as Array<{ lineId: string; lotNumber: string; quantityKg: number; costPerKgActual?: number; supplierCoaUrl?: string }>) {
        const [line] = await db.select().from(supplierPoLineItems).where(eq(supplierPoLineItems.id, recv.lineId)).limit(1);
        if (!line || !line.ingredientId) continue;

        const [lot] = await db.insert(rawMaterialLots).values({
          lotNumber: recv.lotNumber,
          ingredientId: line.ingredientId,
          supplierId: spo.supplierId,
          quantityKg: String(parseFloat(String(recv.quantityKg))),
          receivedDate: today,
          supplierCoaUrl: recv.supplierCoaUrl ?? null,
          costPerKgActual: recv.costPerKgActual != null ? String(recv.costPerKgActual) : null,
          status: "Quarantine",
          notes: `From SPO ${spo.spoNumber}`,
        }).returning();

        await db.insert(lotMovements).values({
          rawMaterialLotId: lot.id,
          quantityKg: String(parseFloat(String(recv.quantityKg))),
          movementType: "Receipt",
          notes: `From SPO ${spo.spoNumber}, line ${line.id}`,
        });

        await db.update(supplierPoLineItems).set({
          receivedQuantityKg: String(parseFloat(String(recv.quantityKg))),
          rawMaterialLotId: lot.id,
        }).where(eq(supplierPoLineItems.id, line.id));
      }

      updates.receivedDate = today;
    }

    const [updated] = await db.update(supplierPurchaseOrders).set(updates).where(eq(supplierPurchaseOrders.id, id)).returning();
    if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ success: true, supplierPo: updated });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
