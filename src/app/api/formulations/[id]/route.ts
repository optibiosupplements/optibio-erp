/**
 * GET  /api/formulations/[id]   — fetch formulation + child ingredient lines
 * PATCH /api/formulations/[id]  — partial update
 * DELETE /api/formulations/[id] — delete formulation (cascades to lines)
 */

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { formulations, formulationIngredients } from "@/lib/db/schema";
import { eq, asc } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const [f] = await db.select().from(formulations).where(eq(formulations.id, id)).limit(1);
    if (!f) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const lines = await db
      .select()
      .from(formulationIngredients)
      .where(eq(formulationIngredients.formulationId, id))
      .orderBy(asc(formulationIngredients.sortOrder));
    return NextResponse.json({ formulation: f, ingredients: lines });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

const ALLOWED_FIELDS = [
  "name", "customerId", "dosageForm", "capsuleSize", "capsulesPerServing",
  "servingsPerContainer", "batchSize", "totalFillMg", "fillPercentage",
  "excipientComplexity", "version", "status", "notes",
] as const;

const NUMERIC_INTS = new Set(["capsulesPerServing", "servingsPerContainer", "batchSize", "version"]);

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const body = await req.json();
    const updates: Record<string, unknown> = {};
    for (const k of ALLOWED_FIELDS) {
      if (body[k] === undefined) continue;
      if (NUMERIC_INTS.has(k)) {
        const n = parseInt(String(body[k]), 10);
        updates[k] = Number.isNaN(n) ? null : n;
      } else if (k === "totalFillMg" || k === "fillPercentage") {
        updates[k] = body[k] != null ? String(body[k]) : null;
      } else {
        updates[k] = body[k];
      }
    }
    updates.updatedAt = new Date();

    const [updated] = await db.update(formulations).set(updates).where(eq(formulations.id, id)).returning();
    if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ success: true, formulation: updated });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const [deleted] = await db.delete(formulations).where(eq(formulations.id, id)).returning();
    if (!deleted) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
