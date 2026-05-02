import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { productionRuns } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const [run] = await db.select().from(productionRuns).where(eq(productionRuns.id, id)).limit(1);
    if (!run) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(run);
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}

const ALLOWED = ["status", "actualBatchSize", "startDate", "completionDate", "leadQcAnalyst", "releaseQaManager", "notes"] as const;

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const body = await req.json();
    const updates: Record<string, unknown> = { updatedAt: new Date() };
    for (const k of ALLOWED) {
      if (body[k] === undefined) continue;
      if (k === "actualBatchSize") {
        const n = parseInt(String(body[k]), 10);
        updates[k] = Number.isNaN(n) ? null : n;
      } else {
        updates[k] = body[k];
      }
    }
    const [updated] = await db.update(productionRuns).set(updates).where(eq(productionRuns.id, id)).returning();
    if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ success: true, productionRun: updated });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
