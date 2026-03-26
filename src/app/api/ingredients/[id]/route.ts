import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ingredients } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

/** GET /api/ingredients/[id] — get single ingredient */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const [ing] = await db.select().from(ingredients).where(eq(ingredients.id, id)).limit(1);
    if (!ing) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(ing);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/** PATCH /api/ingredients/[id] — update ingredient */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const body = await request.json();

    // Build update object — only include fields that were sent
    const updates: Record<string, any> = {};
    const allowedFields = [
      "name", "scientificName", "category", "subcategory",
      "supplierName", "costPerKg", "assayPercentage", "activeContentPct",
      "activeSource", "labelClaimActive", "multiComponent",
      "baseOveragePct", "baseWastagePct",
      "overageCapsule", "overageTablet", "overagePowder", "overageStickPack",
      "wastageCapsule", "wastageTablet", "wastagePowder", "wastageStickPack",
      "functionDesc", "isEstimatedPrice", "moqKg", "leadTimeDays",
    ];

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updates[field] = body[field];
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
    }

    // Update timestamp
    updates.updatedAt = new Date();

    const [updated] = await db
      .update(ingredients)
      .set(updates)
      .where(eq(ingredients.id, id))
      .returning();

    if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });

    return NextResponse.json({ success: true, ingredient: updated });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/** DELETE /api/ingredients/[id] — delete ingredient */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const [deleted] = await db.delete(ingredients).where(eq(ingredients.id, id)).returning();
    if (!deleted) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
