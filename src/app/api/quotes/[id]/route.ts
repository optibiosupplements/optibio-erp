/**
 * GET    /api/quotes/[id]   — fetch quote + tiers + line items + linked formulation/customer
 * PATCH  /api/quotes/[id]   — partial update (status, validUntil, notes)
 * DELETE /api/quotes/[id]   — delete quote (cascades to tiers + line items)
 */

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { quotes, quoteTiers, quoteLineItems, customers, formulations } from "@/lib/db/schema";
import { eq, asc } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const [q] = await db.select().from(quotes).where(eq(quotes.id, id)).limit(1);
    if (!q) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const tiers = await db
      .select()
      .from(quoteTiers)
      .where(eq(quoteTiers.quoteId, id))
      .orderBy(asc(quoteTiers.tierQuantity));

    const lineItems = tiers.length > 0
      ? await db
          .select()
          .from(quoteLineItems)
          .where(eq(quoteLineItems.quoteTierId, tiers[0].id))
          .orderBy(asc(quoteLineItems.sortOrder))
      : [];

    const [customer] = q.customerId
      ? await db.select().from(customers).where(eq(customers.id, q.customerId)).limit(1)
      : [null];

    const [formulation] = q.formulationId
      ? await db.select().from(formulations).where(eq(formulations.id, q.formulationId)).limit(1)
      : [null];

    return NextResponse.json({ quote: q, tiers, lineItems, customer, formulation });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

const ALLOWED = ["status", "validUntil", "notes"] as const;

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const body = await req.json();
    const updates: Record<string, unknown> = {};
    for (const k of ALLOWED) {
      if (body[k] !== undefined) updates[k] = body[k];
    }
    updates.updatedAt = new Date();
    const [updated] = await db.update(quotes).set(updates).where(eq(quotes.id, id)).returning();
    if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ success: true, quote: updated });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const [deleted] = await db.delete(quotes).where(eq(quotes.id, id)).returning();
    if (!deleted) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
