import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ingredients } from "@/lib/db/schema";
import { ilike, or, sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim();

  if (!q || q.length < 2) {
    return NextResponse.json([]);
  }

  try {
    const results = await db
      .select({
        id: ingredients.id,
        rmId: ingredients.rmId,
        name: ingredients.name,
        category: ingredients.category,
        supplierName: ingredients.supplierName,
        costPerKg: ingredients.costPerKg,
        activeContentPct: ingredients.activeContentPct,
        baseOveragePct: ingredients.baseOveragePct,
        baseWastagePct: ingredients.baseWastagePct,
        overageCapsule: ingredients.overageCapsule,
        overageTablet: ingredients.overageTablet,
        wastageCapsule: ingredients.wastageCapsule,
        wastageTablet: ingredients.wastageTablet,
        isEstimatedPrice: ingredients.isEstimatedPrice,
        labelClaimActive: ingredients.labelClaimActive,
      })
      .from(ingredients)
      .where(
        or(
          ilike(ingredients.name, `%${q}%`),
          ilike(ingredients.rmId, `%${q}%`),
          ilike(ingredients.category, `%${q}%`)
        )
      )
      .limit(15);

    return NextResponse.json(results);
  } catch {
    return NextResponse.json([]);
  }
}
