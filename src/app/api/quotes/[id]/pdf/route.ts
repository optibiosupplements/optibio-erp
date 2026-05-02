/**
 * GET /api/quotes/[id]/pdf
 *
 * Real branded PDF (pdfkit, single page, US Letter). Replaces the prior HTML
 * fallback. See docs/PHASE-5-PLAN.md for the SME panel review that informed
 * the layout.
 */

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  quotes, quoteTiers, formulations, formulationIngredients, ingredients, customers,
} from "@/lib/db/schema";
import { eq, asc } from "drizzle-orm";
import { buildQuotePdf } from "@/domains/pdf/quote";

export const dynamic = "force-dynamic";

function safeJSON(s: string | null): Record<string, unknown> {
  if (!s) return {};
  try { return JSON.parse(s); } catch { return {}; }
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const [q] = await db.select().from(quotes).where(eq(quotes.id, id)).limit(1);
    if (!q) return NextResponse.json({ error: "Quote not found" }, { status: 404 });

    const meta = safeJSON(q.notes);

    const [customer] = q.customerId
      ? await db.select().from(customers).where(eq(customers.id, q.customerId)).limit(1)
      : [null];

    const [formulation] = q.formulationId
      ? await db.select().from(formulations).where(eq(formulations.id, q.formulationId)).limit(1)
      : [null];

    const formIngs = q.formulationId
      ? await db
          .select({ line: formulationIngredients, ing: ingredients })
          .from(formulationIngredients)
          .leftJoin(ingredients, eq(ingredients.id, formulationIngredients.ingredientId))
          .where(eq(formulationIngredients.formulationId, q.formulationId))
          .orderBy(asc(formulationIngredients.sortOrder))
      : [];

    const hasEstimated = formIngs.some((r) => r.ing?.isEstimatedPrice);

    const tierRows = await db.select().from(quoteTiers).where(eq(quoteTiers.quoteId, id)).orderBy(asc(quoteTiers.tierQuantity));

    const buf = await buildQuotePdf({
      quoteNumber: q.quoteNumber,
      productName: formulation?.name ?? (meta.productName as string) ?? "—",
      customerName: customer?.companyName ?? (meta.customerName as string) ?? "—",
      customerCompany: customer?.companyName,
      customerPo: undefined,
      dosageForm: formulation?.dosageForm ?? (meta.dosageForm as string) ?? "—",
      capsuleSize: formulation?.capsuleSize ?? null,
      capsulesPerServing: formulation?.capsulesPerServing ?? 1,
      servingsPerContainer: formulation?.servingsPerContainer ?? (meta.containerCount as number) ?? "—",
      validUntil: q.validUntil ?? "—",
      issuedDate: new Date(q.createdAt).toISOString().slice(0, 10),
      hasEstimatedPricing: hasEstimated,
      tiers: tierRows.map((t) => ({
        qty: t.tierQuantity,
        pricePerUnit: parseFloat(t.pricePerUnit),
        totalBatch: parseFloat(t.totalBatchPrice),
        marginPct: parseFloat(t.marginPct),
      })),
      ingredients: formIngs
        .filter((r) => !r.line.isExcipient)
        .map((r) => ({
          name: r.ing?.name ?? "Ingredient",
          labelClaim: `${parseFloat(r.line.labelClaimMg).toFixed(2)} mg`,
          notes: parseFloat(r.line.overagePct) > 0 ? `+${parseFloat(r.line.overagePct).toFixed(0)}% overage` : "",
        })),
    });

    return new NextResponse(buf as BodyInit, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${q.quoteNumber}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("Quote PDF error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
