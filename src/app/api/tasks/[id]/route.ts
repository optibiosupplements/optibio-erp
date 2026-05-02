import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { tasks } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

const ALLOWED = ["title", "description", "status", "priority", "assignee", "dueDate"] as const;

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const body = await req.json();
    const updates: Record<string, unknown> = { updatedAt: new Date() };
    for (const k of ALLOWED) if (body[k] !== undefined) updates[k] = body[k];
    if (body.status === "Done") updates.completedAt = new Date();
    const [updated] = await db.update(tasks).set(updates).where(eq(tasks.id, id)).returning();
    if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ success: true, task: updated });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    await db.delete(tasks).where(eq(tasks.id, id));
    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
