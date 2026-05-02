/**
 * GET  /api/heartbeats     — list heartbeats. Seeds defaults on first call.
 * POST /api/heartbeats     — manually run a heartbeat: { name } → runs handler immediately
 */

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { heartbeats } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { HEARTBEAT_HANDLERS, SEEDED_HEARTBEATS } from "@/domains/heartbeats/handlers";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    // Ensure seeded heartbeats exist
    const existing = await db.select({ name: heartbeats.name }).from(heartbeats);
    const existingNames = new Set(existing.map((r) => r.name));
    const toSeed = SEEDED_HEARTBEATS.filter((s) => !existingNames.has(s.name));
    if (toSeed.length > 0) {
      await db.insert(heartbeats).values(toSeed.map((s) => ({
        name: s.name,
        label: s.label,
        description: s.description,
        scheduleCron: s.scheduleCron,
        enabled: true,
      })));
    }

    const rows = await db.select().from(heartbeats).orderBy(desc(heartbeats.createdAt));
    return NextResponse.json(rows);
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const name: string | undefined = body.name;
    if (!name) return NextResponse.json({ error: "name required" }, { status: 400 });

    const handler = HEARTBEAT_HANDLERS[name];
    if (!handler) return NextResponse.json({ error: `No handler for ${name}` }, { status: 404 });

    const startedAt = Date.now();
    const result = await handler();
    const durationMs = Date.now() - startedAt;

    await db.update(heartbeats).set({
      lastRunAt: new Date(),
      lastRunStatus: result.status,
      lastRunOutput: result.output,
      totalRuns: (await db.select({ c: heartbeats.totalRuns }).from(heartbeats).where(eq(heartbeats.name, name)).limit(1))[0]?.c ?? 0,
      totalActions: (await db.select({ c: heartbeats.totalActions }).from(heartbeats).where(eq(heartbeats.name, name)).limit(1))[0]?.c ?? 0,
      updatedAt: new Date(),
    }).where(eq(heartbeats.name, name));

    // Increment counts atomically
    await db.execute(`UPDATE heartbeats SET total_runs = total_runs + 1, total_actions = total_actions + ${result.actions} WHERE name = '${name.replace(/'/g, "''")}'`);

    return NextResponse.json({ success: true, name, result, durationMs });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
