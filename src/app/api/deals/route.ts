import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { rfqs } from "@/lib/db/schema";
import { desc, count } from "drizzle-orm";

export const dynamic = "force-dynamic";

function generateDealNumber(): string {
  const now = new Date();
  const date = now.toISOString().slice(0, 10).replace(/-/g, "");
  const seq = String(Math.floor(Math.random() * 999) + 1).padStart(3, "0");
  return `RFQ-${date}-${seq}`;
}

/** GET /api/deals — list all deals */
export async function GET() {
  try {
    const all = await db.select().from(rfqs).orderBy(desc(rfqs.createdAt)).limit(100);
    return NextResponse.json(all);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/** POST /api/deals — create new deal */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const rfqNumber = generateDealNumber();

    const [deal] = await db
      .insert(rfqs)
      .values({
        rfqNumber,
        status: body.status || "New",
        priority: body.priority || "Normal",
        source: body.source || "Email",
        customerCompany: body.customerCompany || null,
        customerContact: body.customerContact || null,
        customerEmail: body.customerEmail || null,
        customerPhone: body.customerPhone || null,
        productName: body.productName || null,
        dosageForm: body.dosageForm || null,
        servingSize: body.servingSize ? parseInt(body.servingSize) : null,
        servingSizeUnit: body.servingSizeUnit || null,
        servingsPerContainer: body.servingsPerContainer ? parseInt(body.servingsPerContainer) : null,
        countPerBottle: body.countPerBottle ? parseInt(body.countPerBottle) : null,
        flavor: body.flavor || null,
        formulaJson: body.formulaJson ? JSON.stringify(body.formulaJson) : null,
        otherIngredients: body.otherIngredients || null,
        specialRequirements: body.specialRequirements || null,
        bulkOrPackaged: body.bulkOrPackaged || "Packaged",
        primaryPackaging: body.primaryPackaging || null,
        capsuleType: body.capsuleType || null,
        capsuleSize: body.capsuleSize || null,
        labelStatus: body.labelStatus || null,
        certifications: body.certifications || null,
        targetMarkets: body.targetMarkets || null,
        allergenStatement: body.allergenStatement || null,
        claims: body.claims || null,
        moq: body.moq ? parseInt(body.moq) : null,
        targetTimeline: body.targetTimeline || null,
        internalNotes: body.internalNotes || null,
        customerNotes: body.customerNotes || null,
      })
      .returning();

    return NextResponse.json({ success: true, deal });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
