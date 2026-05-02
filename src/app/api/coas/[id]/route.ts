import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { finishedProductCoas, coaTestResults } from "@/lib/db/schema";
import { eq, asc } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const [coa] = await db.select().from(finishedProductCoas).where(eq(finishedProductCoas.id, id)).limit(1);
    if (!coa) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const tests = await db
      .select()
      .from(coaTestResults)
      .where(eq(coaTestResults.coaId, id))
      .orderBy(asc(coaTestResults.sortOrder));
    return NextResponse.json({ coa, tests });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}

const ALLOWED_COA = [
  "disposition", "qcAnalyst", "qcAnalystSignatureDate", "qcManager", "qcManagerSignatureDate",
  "qaRelease", "qaReleaseSignatureDate", "labSampleId", "pdfUrl", "notes",
] as const;

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const body = await req.json();
    const coaUpdates: Record<string, unknown> = {};
    for (const k of ALLOWED_COA) if (body[k] !== undefined) coaUpdates[k] = body[k];

    if (Object.keys(coaUpdates).length > 0) {
      const [updated] = await db.update(finishedProductCoas).set(coaUpdates).where(eq(finishedProductCoas.id, id)).returning();
      if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Optionally update test results in bulk: { tests: [{ id, result, status, pctOfLabelClaim }, ...] }
    if (Array.isArray(body.tests)) {
      for (const t of body.tests) {
        if (!t.id) continue;
        const u: Record<string, unknown> = {};
        if (t.result !== undefined) u.result = t.result;
        if (t.status !== undefined) u.status = t.status;
        if (t.pctOfLabelClaim !== undefined) u.pctOfLabelClaim = String(t.pctOfLabelClaim);
        if (Object.keys(u).length > 0) {
          await db.update(coaTestResults).set(u).where(eq(coaTestResults.id, t.id));
        }
      }
    }

    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
