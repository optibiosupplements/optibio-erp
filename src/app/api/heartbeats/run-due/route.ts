/**
 * GET /api/heartbeats/run-due
 *
 * Vercel Cron entry point. Walks every enabled heartbeat, checks whether its
 * scheduled cron expression matches "now" (within the current 5-minute
 * window), and runs the handler if so.
 *
 * Cron parsing is intentionally simple — supports "minute hour day-of-month
 * month day-of-week" with `*`, single integer, or comma-separated lists.
 * Sufficient for the seeded handlers ("0 9 * * *", "0 8 * * MON", etc.).
 *
 * Triggered by vercel.json cron: every hour at minute 0.
 */

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { heartbeats } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { HEARTBEAT_HANDLERS } from "@/domains/heartbeats/handlers";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const DOW_MAP: Record<string, number> = {
  SUN: 0, MON: 1, TUE: 2, WED: 3, THU: 4, FRI: 5, SAT: 6,
};

function matchesField(value: number, field: string): boolean {
  if (field === "*") return true;
  return field.split(",").map((part) => {
    const trimmed = part.trim().toUpperCase();
    if (DOW_MAP[trimmed] !== undefined) return DOW_MAP[trimmed];
    return parseInt(trimmed, 10);
  }).some((n) => !Number.isNaN(n) && n === value);
}

function isCronDueAt(cron: string, now: Date): boolean {
  const parts = cron.trim().split(/\s+/);
  if (parts.length !== 5) return false;
  const [minute, hour, dayOfMonth, month, dayOfWeek] = parts;
  const m = now.getMinutes();
  const h = now.getHours();
  const dom = now.getDate();
  const mon = now.getMonth() + 1;
  const dow = now.getDay();
  return (
    matchesField(m, minute) &&
    matchesField(h, hour) &&
    matchesField(dom, dayOfMonth) &&
    matchesField(mon, month) &&
    matchesField(dow, dayOfWeek)
  );
}

export async function GET(request: Request) {
  // Optional: protect with CRON_SECRET via Authorization header
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const now = new Date();
  const ranNames: string[] = [];
  const skipped: string[] = [];
  const errors: Array<{ name: string; error: string }> = [];

  try {
    const allHbs = await db.select().from(heartbeats);
    for (const hb of allHbs) {
      if (!hb.enabled) {
        skipped.push(hb.name);
        continue;
      }
      // Match by hour-bucket — Vercel cron fires hourly so we accept
      // anything matching the current hour even if the minute is off.
      const dueByMinute = isCronDueAt(hb.scheduleCron, now);
      if (!dueByMinute) {
        // Try: rewrite "0 H * * *" → "* H * * *" to allow hourly cadence
        const partsRelaxed = hb.scheduleCron.replace(/^\S+/, "*");
        const dueByHour = isCronDueAt(partsRelaxed, now);
        if (!dueByHour) {
          skipped.push(hb.name);
          continue;
        }
      }

      const handler = HEARTBEAT_HANDLERS[hb.name];
      if (!handler) {
        skipped.push(`${hb.name} (no handler)`);
        continue;
      }

      try {
        const result = await handler();
        await db.update(heartbeats).set({
          lastRunAt: new Date(),
          lastRunStatus: result.status,
          lastRunOutput: result.output,
          updatedAt: new Date(),
        }).where(eq(heartbeats.id, hb.id));
        await db.execute(`UPDATE heartbeats SET total_runs = total_runs + 1, total_actions = total_actions + ${result.actions} WHERE id = '${hb.id}'`);
        ranNames.push(`${hb.name} (${result.actions} actions)`);
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        errors.push({ name: hb.name, error: msg });
      }
    }

    return NextResponse.json({
      success: true,
      now: now.toISOString(),
      ran: ranNames,
      skipped: skipped.length,
      errors,
    });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
