import { db } from "@/lib/db";
import { heartbeats } from "@/lib/db/schema";
import { desc } from "drizzle-orm";
import { Activity } from "lucide-react";
import { HeartbeatList } from "./list";
import { SEEDED_HEARTBEATS } from "@/domains/heartbeats/handlers";

export const dynamic = "force-dynamic";

export default async function HeartbeatsPage() {
  // Seed defaults on first visit
  let rows: Array<typeof heartbeats.$inferSelect> = [];
  try {
    rows = await db.select().from(heartbeats);
    const existing = new Set(rows.map((r) => r.name));
    const missing = SEEDED_HEARTBEATS.filter((s) => !existing.has(s.name));
    if (missing.length > 0) {
      await db.insert(heartbeats).values(missing.map((s) => ({
        name: s.name,
        label: s.label,
        description: s.description,
        scheduleCron: s.scheduleCron,
        enabled: true,
      })));
      rows = await db.select().from(heartbeats);
    }
    rows.sort((a, b) => a.label.localeCompare(b.label));
  } catch {}

  return (
    <div className="max-w-5xl mx-auto pb-12">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Activity className="h-5 w-5 text-[#d10a11]" />
            Heartbeats
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Autonomous tasks that fire on a cron schedule. Vercel Cron pings <code className="font-mono bg-slate-100 px-1 py-0.5 rounded text-[11px]">/api/heartbeats/run-due</code> hourly. Manual trigger available below.
          </p>
        </div>
      </div>

      <HeartbeatList
        initial={rows.map((r) => ({
          id: r.id,
          name: r.name,
          label: r.label,
          description: r.description,
          scheduleCron: r.scheduleCron,
          enabled: r.enabled,
          lastRunAt: r.lastRunAt ? new Date(r.lastRunAt).toISOString() : null,
          lastRunStatus: r.lastRunStatus,
          lastRunOutput: r.lastRunOutput,
          totalRuns: r.totalRuns,
          totalActions: r.totalActions,
        }))}
      />
    </div>
  );
}
