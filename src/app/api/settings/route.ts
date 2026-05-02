/**
 * GET  /api/settings    — fetch all settings (returns key/value map)
 * POST /api/settings    — bulk upsert {key, value, category?, description?}[]
 */

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { appSettings } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const rows = await db.select().from(appSettings);
    const map: Record<string, { value: string; category: string; description: string | null }> = {};
    for (const r of rows) {
      map[r.key] = { value: r.value, category: r.category, description: r.description };
    }
    return NextResponse.json(map);
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const updates: Array<{ key: string; value: string; category?: string; description?: string }> =
      Array.isArray(body) ? body : Array.isArray(body.settings) ? body.settings : [];

    for (const u of updates) {
      if (!u.key) continue;
      await db
        .insert(appSettings)
        .values({
          key: u.key,
          value: String(u.value ?? ""),
          category: u.category ?? "general",
          description: u.description ?? null,
        })
        .onConflictDoUpdate({
          target: appSettings.key,
          set: { value: String(u.value ?? ""), updatedAt: new Date() },
        });
    }
    return NextResponse.json({ success: true, updated: updates.length });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
