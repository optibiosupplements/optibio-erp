/**
 * GET  /api/tasks       — list (newest first)
 * POST /api/tasks       — create a task
 */

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { tasks } from "@/lib/db/schema";
import { desc } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const rows = await db.select().from(tasks).orderBy(desc(tasks.createdAt)).limit(200);
    return NextResponse.json(rows);
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (!body.title) return NextResponse.json({ error: "title required" }, { status: 400 });

    const [t] = await db.insert(tasks).values({
      title: body.title,
      description: body.description ?? null,
      status: body.status ?? "Todo",
      priority: body.priority ?? "Normal",
      assignee: body.assignee ?? null,
      dueDate: body.dueDate ?? null,
      relatedTable: body.relatedTable ?? null,
      relatedId: body.relatedId ?? null,
      customerId: body.customerId ?? null,
    }).returning();
    return NextResponse.json({ success: true, taskId: t.id });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
