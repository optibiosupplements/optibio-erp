import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { suppliers } from "@/lib/db/schema";
import { desc, count } from "drizzle-orm";

export const dynamic = "force-dynamic";

/** GET /api/suppliers — list all suppliers */
export async function GET() {
  try {
    const all = await db.select().from(suppliers).orderBy(desc(suppliers.createdAt)).limit(200);
    return NextResponse.json(all);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/** POST /api/suppliers — create new supplier */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (!body.companyName) {
      return NextResponse.json({ error: "companyName required" }, { status: 400 });
    }
    const [sup] = await db.insert(suppliers).values({
      companyName: body.companyName,
      contactName: body.contactName || null,
      email: body.email || null,
      phone: body.phone || null,
      paymentTerms: body.paymentTerms || null,
      notes: body.notes || null,
    }).returning();
    return NextResponse.json({ success: true, supplier: sup });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
