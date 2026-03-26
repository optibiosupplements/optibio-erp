import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ingredients } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

/** POST /api/ingredients — add a new ingredient */
export async function POST(request: Request) {
  try {
    const body = await request.json();

    if (!body.name || !body.rmId) {
      return NextResponse.json({ error: "name and rmId are required" }, { status: 400 });
    }

    const [ing] = await db
      .insert(ingredients)
      .values({
        rmId: body.rmId,
        name: body.name,
        scientificName: body.scientificName || null,
        category: body.category || "Other",
        subcategory: body.subcategory || null,
        supplierName: body.supplierName || null,
        costPerKg: String(body.costPerKg ?? 0),
        assayPercentage: String(body.assayPercentage ?? 100),
        activeContentPct: String(body.activeContentPct ?? 100),
        activeSource: body.activeSource || null,
        labelClaimActive: body.labelClaimActive ?? true,
        multiComponent: body.multiComponent ?? false,
        baseOveragePct: String(body.baseOveragePct ?? 10),
        baseWastagePct: String(body.baseWastagePct ?? 3),
        overageCapsule: body.overageCapsule ? String(body.overageCapsule) : null,
        overageTablet: body.overageTablet ? String(body.overageTablet) : null,
        overagePowder: body.overagePowder ? String(body.overagePowder) : null,
        overageStickPack: body.overageStickPack ? String(body.overageStickPack) : null,
        wastageCapsule: body.wastageCapsule ? String(body.wastageCapsule) : null,
        wastageTablet: body.wastageTablet ? String(body.wastageTablet) : null,
        wastagePowder: body.wastagePowder ? String(body.wastagePowder) : null,
        wastageStickPack: body.wastageStickPack ? String(body.wastageStickPack) : null,
        functionDesc: body.functionDesc || null,
        isEstimatedPrice: body.isEstimatedPrice ?? false,
        moqKg: body.moqKg ? String(body.moqKg) : null,
        leadTimeDays: body.leadTimeDays || null,
      })
      .returning();

    return NextResponse.json({ success: true, ingredient: ing });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
