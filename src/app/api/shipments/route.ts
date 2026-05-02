/**
 * GET  /api/shipments       — list (newest first)
 * POST /api/shipments       — create a shipment from a PO + finished-product lot
 *
 * POST body:
 *   { purchaseOrderId, finishedProductLotId?, quantityUnits, carrier?, trackingNumber?, shipDate? }
 */

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { shipments, purchaseOrders, finishedProductLots, activities } from "@/lib/db/schema";
import { desc, eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const rows = await db.select().from(shipments).orderBy(desc(shipments.createdAt)).limit(100);
    return NextResponse.json(rows);
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (!body.purchaseOrderId) return NextResponse.json({ error: "purchaseOrderId required" }, { status: 400 });
    if (!body.quantityUnits) return NextResponse.json({ error: "quantityUnits required" }, { status: 400 });

    const [po] = await db.select().from(purchaseOrders).where(eq(purchaseOrders.id, body.purchaseOrderId)).limit(1);
    if (!po) return NextResponse.json({ error: "PO not found" }, { status: 404 });

    const [shipment] = await db
      .insert(shipments)
      .values({
        purchaseOrderId: po.id,
        finishedProductLotId: body.finishedProductLotId ?? null,
        quantityUnits: parseInt(String(body.quantityUnits), 10),
        carrier: body.carrier ?? null,
        trackingNumber: body.trackingNumber ?? null,
        shipDate: body.shipDate ?? new Date().toISOString().slice(0, 10),
        status: body.shipDate ? "Picked Up" : "Scheduled",
        notes: body.notes ?? null,
      })
      .returning();

    // Bump PO status to Shipped if it isn't already further along
    if (!["Delivered", "Closed"].includes(po.status)) {
      await db.update(purchaseOrders).set({ status: "Shipped", updatedAt: new Date() }).where(eq(purchaseOrders.id, po.id));
    }

    // Mark the lot as Shipped
    if (body.finishedProductLotId) {
      await db.update(finishedProductLots)
        .set({ status: "Shipped", updatedAt: new Date() })
        .where(eq(finishedProductLots.id, body.finishedProductLotId));
    }

    // Activity log
    if (po.customerId) {
      try {
        await db.insert(activities).values({
          customerId: po.customerId,
          type: "shipment",
          subject: `Shipment created for ${po.poNumber}`,
          description: `${body.quantityUnits} units · ${body.carrier ?? "TBD"}${body.trackingNumber ? ` · #${body.trackingNumber}` : ""}`,
          completedAt: new Date(),
        });
      } catch {}
    }

    return NextResponse.json({ success: true, shipmentId: shipment.id });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("Create shipment error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
