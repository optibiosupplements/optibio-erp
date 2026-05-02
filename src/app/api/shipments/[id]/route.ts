import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { shipments, purchaseOrders } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const [s] = await db.select().from(shipments).where(eq(shipments.id, id)).limit(1);
    if (!s) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(s);
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}

const ALLOWED = ["status", "carrier", "trackingNumber", "shipDate", "deliveredDate", "customerSignatureUrl", "notes"] as const;

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const body = await req.json();
    const updates: Record<string, unknown> = { updatedAt: new Date() };
    for (const k of ALLOWED) if (body[k] !== undefined) updates[k] = body[k];
    const [updated] = await db.update(shipments).set(updates).where(eq(shipments.id, id)).returning();
    if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });

    // If shipment is Delivered, advance PO status
    if (body.status === "Delivered" && updated.purchaseOrderId) {
      await db.update(purchaseOrders).set({ status: "Delivered", updatedAt: new Date() }).where(eq(purchaseOrders.id, updated.purchaseOrderId));
    }

    return NextResponse.json({ success: true, shipment: updated });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
