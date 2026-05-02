import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { quotes, quoteTiers, quoteLineItems } from "@/lib/db/schema";
import { desc, eq, count } from "drizzle-orm";
import { generateQuoteNumber } from "@/lib/utils";

export const dynamic = "force-dynamic";

/** GET /api/quotes — list all quotes */
export async function GET() {
  try {
    const allQuotes = await db
      .select()
      .from(quotes)
      .orderBy(desc(quotes.createdAt))
      .limit(50);

    return NextResponse.json(allQuotes);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/** POST /api/quotes — save a new quote with tiers and line items */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      productName,
      customerName,
      customerId,
      formulationId,
      dosageForm,
      servingSize,
      containerCount,
      tiers: tierData,
      ingredients: ingredientLines,
      manufacturing,
      packaging,
      cogsPerBottle,
      totalFillMg,
      notes,
    } = body;

    // Create the quote — link to customer + formulation when provided so the
    // xlsx/pdf exporters can join through and read structured data instead of
    // parsing the notes blob.
    const quoteNumber = generateQuoteNumber();
    const validUntil = new Date();
    validUntil.setDate(validUntil.getDate() + 30);

    const [quote] = await db
      .insert(quotes)
      .values({
        quoteNumber,
        status: "Draft",
        version: 1,
        validUntil: validUntil.toISOString().split("T")[0],
        customerId: customerId ?? null,
        formulationId: formulationId ?? null,
        notes: JSON.stringify({
          productName,
          customerName,
          dosageForm,
          servingSize,
          containerCount,
          totalFillMg,
          manufacturing,
          packaging,
          ingredientCount: ingredientLines?.length ?? 0,
          userNotes: notes ?? "",
        }),
      })
      .returning();

    // Save tiers — accept either {tierQuantity} (pricing-engine output) or {quantity} (legacy).
    // Same with COGS: either flat fields or nested under tier.cogs.
    if (tierData && Array.isArray(tierData)) {
      for (const tier of tierData) {
        const qty = tier.tierQuantity ?? tier.quantity;
        const cogs = tier.cogs ?? tier;
        const [savedTier] = await db
          .insert(quoteTiers)
          .values({
            quoteId: quote.id,
            tierQuantity: qty,
            rawMaterialCost: String(cogs.rawMaterialCost ?? 0),
            manufacturingCost: String(cogs.manufacturingCost ?? 0),
            packagingCost: String(cogs.packagingCost ?? 0),
            overheadCost: String(cogs.overheadCost ?? 0),
            cogsPerUnit: String(cogs.totalCogs ?? tier.cogsPerUnit ?? 0),
            marginPct: String(tier.marginPct),
            pricePerUnit: String(tier.pricePerUnit),
            totalBatchPrice: String(tier.totalBatchPrice),
          })
          .returning();

        // Save ingredient line items for this tier
        if (ingredientLines && Array.isArray(ingredientLines)) {
          const lineValues = ingredientLines.map((line: any, idx: number) => ({
            quoteTierId: savedTier.id,
            lineType: line.isExcipient ? "excipient" : "raw_material",
            description: `${line.name} (${line.rmId}) — ${line.labelClaimMg}mg @ ${line.activeContentPct}% AC`,
            quantity: String(line.finalMg),
            unitCost: String(line.costPerKg),
            totalCost: String(line.lineCost),
            sortOrder: idx,
          }));
          await db.insert(quoteLineItems).values(lineValues);
        }
      }
    }

    return NextResponse.json({
      success: true,
      quoteId: quote.id,
      quoteNumber,
      message: `Quote ${quoteNumber} saved.`,
    });
  } catch (error: any) {
    console.error("Save quote error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
