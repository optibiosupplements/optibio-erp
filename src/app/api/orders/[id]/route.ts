import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { purchaseOrders, poLineItems } from "@/lib/db/schema";
import { eq, asc } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const [po] = await db.select().from(purchaseOrders).where(eq(purchaseOrders.id, id)).limit(1);
    if (!po) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const lines = await db.select().from(poLineItems).where(eq(poLineItems.purchaseOrderId, id)).orderBy(asc(poLineItems.sortOrder));
    return NextResponse.json({ purchaseOrder: po, lineItems: lines });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}

const ALLOWED = ["status", "customerPoNumber", "targetShipDate", "notes"] as const;

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const body = await req.json();
    const updates: Record<string, unknown> = { updatedAt: new Date() };
    for (const k of ALLOWED) if (body[k] !== undefined) updates[k] = body[k];
    const [updated] = await db.update(purchaseOrders).set(updates).where(eq(purchaseOrders.id, id)).returning();
    if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ success: true, purchaseOrder: updated });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
