import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { finishedProductLots } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const [lot] = await db.select().from(finishedProductLots).where(eq(finishedProductLots.id, id)).limit(1);
    if (!lot) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(lot);
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}

const ALLOWED = ["status", "quantityUnits", "manufacturingDate", "expirationDate", "productCode", "stabilityProtocol", "notes"] as const;

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const body = await req.json();
    const updates: Record<string, unknown> = { updatedAt: new Date() };
    for (const k of ALLOWED) {
      if (body[k] === undefined) continue;
      if (k === "quantityUnits") {
        const n = parseInt(String(body[k]), 10);
        updates[k] = Number.isNaN(n) ? null : n;
      } else {
        updates[k] = body[k];
      }
    }
    const [updated] = await db.update(finishedProductLots).set(updates).where(eq(finishedProductLots.id, id)).returning();
    if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ success: true, lot: updated });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
