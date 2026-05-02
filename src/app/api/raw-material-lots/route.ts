/**
 * GET  /api/raw-material-lots     — list (newest first)
 * POST /api/raw-material-lots     — register an incoming lot
 *
 * POST body:
 *   { ingredientId, supplierId?, lotNumber, quantityKg, receivedDate, expiryDate?,
 *     manufacturingDateAtSupplier?, supplierCoaUrl?, costPerKgActual?, status?, notes? }
 */

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { rawMaterialLots, lotMovements } from "@/lib/db/schema";
import { desc } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const rows = await db.select().from(rawMaterialLots).orderBy(desc(rawMaterialLots.receivedDate)).limit(200);
    return NextResponse.json(rows);
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (!body.ingredientId) return NextResponse.json({ error: "ingredientId required" }, { status: 400 });
    if (!body.lotNumber) return NextResponse.json({ error: "lotNumber required" }, { status: 400 });
    if (!body.quantityKg) return NextResponse.json({ error: "quantityKg required" }, { status: 400 });

    const [lot] = await db.insert(rawMaterialLots).values({
      lotNumber: body.lotNumber,
      ingredientId: body.ingredientId,
      supplierId: body.supplierId ?? null,
      quantityKg: String(parseFloat(body.quantityKg)),
      receivedDate: body.receivedDate ?? new Date().toISOString().slice(0, 10),
      expiryDate: body.expiryDate ?? null,
      manufacturingDateAtSupplier: body.manufacturingDateAtSupplier ?? null,
      supplierCoaUrl: body.supplierCoaUrl ?? null,
      costPerKgActual: body.costPerKgActual ? String(parseFloat(body.costPerKgActual)) : null,
      status: body.status ?? "Quarantine",
      notes: body.notes ?? null,
    }).returning();

    // Log the receipt as a lot movement
    await db.insert(lotMovements).values({
      rawMaterialLotId: lot.id,
      quantityKg: String(parseFloat(body.quantityKg)),
      movementType: "Receipt",
      operator: body.operator ?? null,
      notes: `Initial receipt of lot ${body.lotNumber}`,
    });

    return NextResponse.json({ success: true, lotId: lot.id });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
