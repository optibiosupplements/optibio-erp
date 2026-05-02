import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { rawMaterialLots, lotMovements } from "@/lib/db/schema";
import { eq, asc } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const [lot] = await db.select().from(rawMaterialLots).where(eq(rawMaterialLots.id, id)).limit(1);
    if (!lot) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const movements = await db.select().from(lotMovements).where(eq(lotMovements.rawMaterialLotId, id)).orderBy(asc(lotMovements.movementDate));
    return NextResponse.json({ lot, movements });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}

const ALLOWED = ["status", "expiryDate", "supplierCoaUrl", "costPerKgActual", "notes"] as const;

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const body = await req.json();
    const updates: Record<string, unknown> = { updatedAt: new Date() };
    for (const k of ALLOWED) if (body[k] !== undefined) updates[k] = body[k];
    const [updated] = await db.update(rawMaterialLots).set(updates).where(eq(rawMaterialLots.id, id)).returning();
    if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ success: true, lot: updated });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
