/**
 * GET  /api/formulations          — list formulations (newest first)
 * POST /api/formulations          — create a formulation + child ingredient rows
 *
 * POST body shape:
 *   {
 *     name: string,
 *     dosageForm: "Capsule" | "Tablet" | "Powder",
 *     rfqId?: string,
 *     customerId?: string,
 *     capsuleSize?: string,
 *     capsulesPerServing?: number,
 *     servingsPerContainer?: number,
 *     totalFillMg?: number,
 *     fillPercentage?: number,
 *     excipientComplexity?: "standard" | "moderate" | "high",
 *     status?: "Draft" | "In Review" | "Locked",
 *     notes?: string,
 *     ingredients: [{
 *       ingredientId?: string,            // FK to ingredients.id (omit for ad-hoc)
 *       name: string,                     // free-text fallback
 *       labelClaimMg: number,
 *       activeContentPct: number,
 *       overagePct: number,
 *       wastagePct: number,
 *       costPerKg: number,
 *       isExcipient?: boolean,
 *     }]
 *   }
 *
 * Updates linked RFQ status to "Formulating" and rfqs.formulationId.
 */

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { formulations, formulationIngredients, rfqs } from "@/lib/db/schema";
import { desc, eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const rows = await db.select().from(formulations).orderBy(desc(formulations.createdAt)).limit(100);
    return NextResponse.json(rows);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

interface IngredientLineInput {
  ingredientId?: string;
  name: string;
  labelClaimMg: number;
  activeContentPct: number;
  overagePct: number;
  wastagePct: number;
  costPerKg: number;
  isExcipient?: boolean;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    if (!body.name) return NextResponse.json({ error: "name is required" }, { status: 400 });
    if (!body.dosageForm) return NextResponse.json({ error: "dosageForm is required" }, { status: 400 });
    const ingsIn: IngredientLineInput[] = body.ingredients ?? [];

    const [formulation] = await db
      .insert(formulations)
      .values({
        name: body.name,
        customerId: body.customerId ?? null,
        dosageForm: body.dosageForm,
        capsuleSize: body.capsuleSize ?? null,
        capsulesPerServing: body.capsulesPerServing ?? 1,
        servingsPerContainer: body.servingsPerContainer ?? null,
        totalFillMg: body.totalFillMg != null ? String(body.totalFillMg) : null,
        fillPercentage: body.fillPercentage != null ? String(body.fillPercentage) : null,
        excipientComplexity: body.excipientComplexity ?? "standard",
        status: body.status ?? "Draft",
        notes: body.notes ?? null,
      })
      .returning();

    if (ingsIn.length > 0) {
      const lines = ingsIn.map((i, idx) => {
        const adjustedMg = i.activeContentPct > 0 ? i.labelClaimMg / (i.activeContentPct / 100) : i.labelClaimMg;
        const finalMg = adjustedMg * (1 + (i.overagePct ?? 0) / 100);
        const lineCost = (finalMg / 1_000_000) * (i.costPerKg ?? 0) * (1 + (i.wastagePct ?? 0) / 100);
        return {
          formulationId: formulation.id,
          ingredientId: i.ingredientId ?? null,
          labelClaimMg: String(i.labelClaimMg),
          activeContentPct: String(i.activeContentPct),
          adjustedMg: String(round(adjustedMg, 4)),
          overagePct: String(i.overagePct ?? 0),
          finalMg: String(round(finalMg, 4)),
          costPerKg: String(i.costPerKg ?? 0),
          wastagePct: String(i.wastagePct ?? 0),
          lineCost: String(round(lineCost, 6)),
          isExcipient: !!i.isExcipient,
          sortOrder: idx,
        };
      });
      await db.insert(formulationIngredients).values(lines);
    }

    // If linked to an RFQ, update its status + linkage
    if (body.rfqId) {
      try {
        await db
          .update(rfqs)
          .set({ status: "Formulating", formulationId: formulation.id, updatedAt: new Date() })
          .where(eq(rfqs.id, body.rfqId));
      } catch {
        // RFQ link is informational — don't block formulation creation if it fails
      }
    }

    return NextResponse.json({ success: true, formulationId: formulation.id, formulation });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("Create formulation error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

function round(v: number, d: number): number {
  const f = Math.pow(10, d);
  return Math.round(v * f) / f;
}
