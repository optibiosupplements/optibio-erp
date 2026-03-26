import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { rfqs } from "@/lib/db/schema";
import { desc, count } from "drizzle-orm";

export const dynamic = "force-dynamic";

function generateRfqNumber(): string {
  const now = new Date();
  const date = now.toISOString().slice(0, 10).replace(/-/g, "");
  const seq = String(Math.floor(Math.random() * 999) + 1).padStart(3, "0");
  return `RFQ-${date}-${seq}`;
}

/** GET /api/intake — list all RFQs */
export async function GET() {
  try {
    const all = await db.select().from(rfqs).orderBy(desc(rfqs.createdAt)).limit(100);
    return NextResponse.json(all);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/** POST /api/intake — create a new RFQ */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const rfqNumber = generateRfqNumber();

    const [rfq] = await db
      .insert(rfqs)
      .values({
        rfqNumber,
        status: body.status || "New",
        priority: body.priority || "Normal",
        source: body.source || "Email",
        customerCompany: body.customerCompany,
        customerContact: body.customerContact,
        customerEmail: body.customerEmail,
        customerPhone: body.customerPhone,
        productName: body.productName,
        dosageForm: body.dosageForm,
        servingSize: body.servingSize ? parseInt(body.servingSize) : null,
        servingSizeUnit: body.servingSizeUnit,
        servingsPerContainer: body.servingsPerContainer ? parseInt(body.servingsPerContainer) : null,
        countPerBottle: body.countPerBottle ? parseInt(body.countPerBottle) : null,
        flavor: body.flavor,
        targetRetailPrice: body.targetRetailPrice || null,
        formulaJson: body.formulaJson ? JSON.stringify(body.formulaJson) : null,
        otherIngredients: body.otherIngredients,
        specialRequirements: body.specialRequirements,
        bulkOrPackaged: body.bulkOrPackaged || "Packaged",
        primaryPackaging: body.primaryPackaging,
        capsuleType: body.capsuleType,
        capsuleSize: body.capsuleSize,
        secondaryPackaging: body.secondaryPackaging,
        labelStatus: body.labelStatus,
        certifications: body.certifications,
        targetMarkets: body.targetMarkets,
        allergenStatement: body.allergenStatement,
        claims: body.claims,
        moq: body.moq ? parseInt(body.moq) : null,
        targetTimeline: body.targetTimeline,
        coPackerPreference: body.coPackerPreference,
        attachmentUrls: body.attachmentUrls,
        internalNotes: body.internalNotes,
        customerNotes: body.customerNotes,
        deadline: body.deadline || null,
        assignedTo: body.assignedTo,
      })
      .returning();

    return NextResponse.json({
      success: true,
      rfqId: rfq.id,
      rfqNumber,
    });
  } catch (error: any) {
    console.error("Create RFQ error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
