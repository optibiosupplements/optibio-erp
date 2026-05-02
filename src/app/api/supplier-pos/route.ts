/**
 * GET  /api/supplier-pos    — list our outbound POs to suppliers
 * POST /api/supplier-pos    — create a draft SPO with line items
 *
 * POST body:
 *   {
 *     supplierId,
 *     orderDate?, expectedDate?, paymentTerms?, shippingTerms?, notes?,
 *     lines: [{ ingredientId, description, quantityKg, unitPrice }]
 *   }
 *
 * Mark Received → creates raw_material_lots and lot_movements automatically.
 */

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { supplierPurchaseOrders, supplierPoLineItems } from "@/lib/db/schema";
import { desc, sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

async function generateSpoNumber(): Promise<string> {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const prefix = `SPO-${yy}${mm}-`;
  let seq = 1;
  try {
    const rows = await db
      .select({ n: supplierPurchaseOrders.spoNumber })
      .from(supplierPurchaseOrders)
      .where(sql`${supplierPurchaseOrders.spoNumber} LIKE ${prefix + "%"}`)
      .orderBy(sql`${supplierPurchaseOrders.spoNumber} DESC`)
      .limit(1);
    if (rows[0]?.n) {
      const tail = rows[0].n.slice(prefix.length);
      const parsed = parseInt(tail, 10);
      if (!Number.isNaN(parsed)) seq = parsed + 1;
    }
  } catch {
    seq = Math.floor(Math.random() * 9999) + 1;
  }
  return `${prefix}${String(seq).padStart(4, "0")}`;
}

export async function GET() {
  try {
    const rows = await db.select().from(supplierPurchaseOrders).orderBy(desc(supplierPurchaseOrders.createdAt)).limit(100);
    return NextResponse.json(rows);
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (!body.supplierId) return NextResponse.json({ error: "supplierId required" }, { status: 400 });

    const linesIn: Array<{ ingredientId?: string; description?: string; quantityKg: number | string; unitPrice: number | string }> = body.lines ?? [];
    if (linesIn.length === 0) return NextResponse.json({ error: "at least one line required" }, { status: 400 });

    const totalCost = linesIn.reduce((s, l) => s + parseFloat(String(l.quantityKg)) * parseFloat(String(l.unitPrice)), 0);

    const spoNumber = await generateSpoNumber();
    const today = new Date().toISOString().slice(0, 10);

    const [spo] = await db.insert(supplierPurchaseOrders).values({
      spoNumber,
      supplierId: body.supplierId,
      status: "Draft",
      orderDate: body.orderDate ?? today,
      expectedDate: body.expectedDate ?? null,
      totalCost: String(totalCost.toFixed(2)),
      paymentTerms: body.paymentTerms ?? "Net 30",
      shippingTerms: body.shippingTerms ?? null,
      notes: body.notes ?? null,
    }).returning();

    const lineRows = linesIn.map((l, idx) => ({
      supplierPoId: spo.id,
      ingredientId: l.ingredientId ?? null,
      description: l.description ?? "Raw material",
      quantityKg: String(parseFloat(String(l.quantityKg))),
      unitPrice: String(parseFloat(String(l.unitPrice))),
      lineTotal: String((parseFloat(String(l.quantityKg)) * parseFloat(String(l.unitPrice))).toFixed(2)),
      sortOrder: idx,
    }));
    await db.insert(supplierPoLineItems).values(lineRows);

    return NextResponse.json({ success: true, supplierPoId: spo.id, spoNumber });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("Create SPO error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
