/**
 * GET  /api/orders        — list POs (newest first)
 * POST /api/orders        — accept a quote: create PO + line items, link to quote
 *
 * POST body:
 *   {
 *     acceptedQuoteId: string,    // FK to quotes
 *     tierQuantity: number,       // which tier customer accepted (2K/5K/10K)
 *     unitPrice: number,
 *     customerPoNumber?: string,  // their internal PO ref
 *     targetShipDate?: string,    // ISO date
 *     notes?: string,
 *   }
 */

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { purchaseOrders, poLineItems, quotes, quoteTiers } from "@/lib/db/schema";
import { desc, eq } from "drizzle-orm";
import { generatePoNumber } from "@/domains/orders/id-generator";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const rows = await db.select().from(purchaseOrders).orderBy(desc(purchaseOrders.createdAt)).limit(100);
    return NextResponse.json(rows);
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (!body.acceptedQuoteId) return NextResponse.json({ error: "acceptedQuoteId required" }, { status: 400 });

    const [quote] = await db.select().from(quotes).where(eq(quotes.id, body.acceptedQuoteId)).limit(1);
    if (!quote) return NextResponse.json({ error: "Quote not found" }, { status: 404 });

    const tiers = await db.select().from(quoteTiers).where(eq(quoteTiers.quoteId, quote.id));
    const tierQty = body.tierQuantity ?? tiers[0]?.tierQuantity;
    const tier = tiers.find((t) => t.tierQuantity === tierQty);
    const unitPrice = body.unitPrice ?? (tier ? parseFloat(tier.pricePerUnit) : 0);

    const poNumber = await generatePoNumber();
    const totalValue = unitPrice * tierQty;

    const [po] = await db
      .insert(purchaseOrders)
      .values({
        poNumber,
        customerId: quote.customerId,
        acceptedQuoteId: quote.id,
        customerPoNumber: body.customerPoNumber ?? null,
        tierQuantity: tierQty,
        unitPrice: String(unitPrice),
        totalValue: String(totalValue),
        status: "Accepted",
        acceptedAt: new Date(),
        targetShipDate: body.targetShipDate ?? null,
        notes: body.notes ?? null,
      })
      .returning();

    // Create one line item linked to the formulation
    if (quote.formulationId) {
      await db.insert(poLineItems).values({
        purchaseOrderId: po.id,
        formulationId: quote.formulationId,
        quantity: tierQty,
        unitPrice: String(unitPrice),
        lineTotal: String(totalValue),
        sortOrder: 0,
      });
    }

    // Update the source quote's status to Accepted
    await db.update(quotes).set({ status: "Accepted", updatedAt: new Date() }).where(eq(quotes.id, quote.id));

    return NextResponse.json({ success: true, purchaseOrderId: po.id, poNumber });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("Create PO error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
