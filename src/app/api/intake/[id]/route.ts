import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { rfqs } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

/** GET /api/intake/[id] — fetch single RFQ */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    const [rfq] = await db.select().from(rfqs).where(eq(rfqs.id, id)).limit(1);
    if (!rfq) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(rfq);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

const ALLOWED_FIELDS = [
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
] as const;

const NUMERIC_FIELDS = new Set(["servingSize", "servingsPerContainer", "countPerBottle", "moq"]);

/** PATCH /api/intake/[id] — update RFQ */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    const body = await request.json();
    const updates: Record<string, unknown> = {};

    for (const key of ALLOWED_FIELDS) {
      if (body[key] === undefined) continue;
      if (body[key] === null || body[key] === "") {
        updates[key] = null;
        continue;
      }
      if (key === "formulaJson" && typeof body[key] !== "string") {
        updates[key] = JSON.stringify(body[key]);
      } else if (NUMERIC_FIELDS.has(key)) {
        const n = parseInt(String(body[key]), 10);
        updates[key] = Number.isNaN(n) ? null : n;
      } else {
        updates[key] = body[key];
      }
    }

    updates.updatedAt = new Date();

    const [updated] = await db.update(rfqs).set(updates).where(eq(rfqs.id, id)).returning();
    if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });

    return NextResponse.json({ success: true, rfq: updated });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/** DELETE /api/intake/[id] — delete RFQ */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    const [deleted] = await db.delete(rfqs).where(eq(rfqs.id, id)).returning();
    if (!deleted) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
