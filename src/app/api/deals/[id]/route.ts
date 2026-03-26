import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { rfqs } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

/** GET /api/deals/[id] — fetch single deal */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const [deal] = await db.select().from(rfqs).where(eq(rfqs.id, id)).limit(1);
    if (!deal) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(deal);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/** PATCH /api/deals/[id] — update deal */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const body = await request.json();
    const updates: Record<string, any> = {};

    // Allow updating any rfq field
    const allowed = [
      "status", "priority", "source",
      "customerCompany", "customerContact", "customerEmail", "customerPhone",
      "productName", "dosageForm", "servingSize", "servingSizeUnit",
      "servingsPerContainer", "countPerBottle", "flavor", "targetRetailPrice",
      "formulaJson", "otherIngredients", "specialRequirements",
      "bulkOrPackaged", "primaryPackaging", "capsuleType", "capsuleSize",
      "secondaryPackaging", "labelStatus",
      "certifications", "targetMarkets", "allergenStatement", "claims",
      "moq", "targetTimeline", "coPackerPreference",
      "internalNotes", "customerNotes", "deadline", "assignedTo",
      "formulationId", "quoteId",
    ];

    for (const key of allowed) {
      if (body[key] !== undefined) {
        if (key === "formulaJson" && typeof body[key] !== "string") {
          updates[key] = JSON.stringify(body[key]);
        } else {
          updates[key] = body[key];
        }
      }
    }

    updates.updatedAt = new Date();

    const [updated] = await db.update(rfqs).set(updates).where(eq(rfqs.id, id)).returning();
    if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });

    return NextResponse.json({ success: true, deal: updated });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/** DELETE /api/deals/[id] — delete deal */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const [deleted] = await db.delete(rfqs).where(eq(rfqs.id, id)).returning();
    if (!deleted) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
