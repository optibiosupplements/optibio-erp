/**
 * RFQ ID generator. Format: RFQ-YYMM-#### (per-month sequence, 4-digit pad).
 *
 * The current `/api/intake/route.ts` uses RFQ-YYYYMMDD-NNN — to be migrated
 * to call this generator instead. The spec doc names the format YYMM-####.
 *
 * Sequence is queried from the `rfqs` table (max for current YYMM + 1).
 * Falls back to a random 4-digit if the DB query fails (so RFQ creation never
 * blocks the user).
 */

import { db } from "@/lib/db";
import { rfqs } from "@/lib/db/schema";
import { sql } from "drizzle-orm";

export function yearMonthPrefix(date = new Date()): string {
  const yy = String(date.getFullYear()).slice(-2);
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  return `${yy}${mm}`;
}

export async function generateRfqNumber(date = new Date()): Promise<string> {
  const ym = yearMonthPrefix(date);
  const prefix = `RFQ-${ym}-`;

  let seq = 1;
  try {
    // Pull the highest existing sequence for this month and add 1.
    const [row] = await db
      .select({ rfqNumber: rfqs.rfqNumber })
      .from(rfqs)
      .where(sql`${rfqs.rfqNumber} LIKE ${prefix + "%"}`)
      .orderBy(sql`${rfqs.rfqNumber} DESC`)
      .limit(1);

    if (row?.rfqNumber) {
      const tail = row.rfqNumber.slice(prefix.length);
      const parsed = parseInt(tail, 10);
      if (!Number.isNaN(parsed)) seq = parsed + 1;
    }
  } catch {
    // If the DB is unavailable, never block the user — fall back to a random
    // 4-digit suffix. Collisions are extremely unlikely for a one-operator app
    // and the unique constraint on rfq_number will surface any collision.
    seq = Math.floor(Math.random() * 9999) + 1;
  }

  return `${prefix}${String(seq).padStart(4, "0")}`;
}

export function suggestProjectName(parsed: { name: string; amount: string; unit: string }[], format: string | null): string {
  if (parsed.length === 0) return format ? `New ${format} Project` : "New Project";
  const first = parsed[0];
  const dose = first.amount && first.unit ? `${first.amount}${first.unit}` : first.amount;
  const fmt = format ? format.charAt(0) + format.slice(1).toLowerCase() + "s" : "Product";
  return [first.name, dose, fmt].filter(Boolean).join(" ").trim();
}
