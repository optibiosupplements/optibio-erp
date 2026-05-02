/**
 * Phase 2 ID generators — per-month sequenced.
 *
 * PO-YYMM-####    purchase orders
 * B-YYMM-####     production-run batches
 * YYMM-NNN        finished-product lots (matches canonical 2508-231 format)
 * COA-{prodCode}-{lot}    COA numbers, matching COA-NS3318C-2508-231
 *
 * All sequence-resets every month. DB queries use prefix LIKE on the unique
 * column. Falls back to a random suffix if the DB query fails so creation
 * never blocks the user.
 */

import { db } from "@/lib/db";
import { purchaseOrders, productionRuns, finishedProductLots, finishedProductCoas } from "@/lib/db/schema";
import { sql } from "drizzle-orm";

function ymPrefix(date = new Date()): string {
  const yy = String(date.getFullYear()).slice(-2);
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  return `${yy}${mm}`;
}

function fallback(padTo: number): number {
  return Math.floor(Math.random() * Math.pow(10, padTo)) + 1;
}

export async function generatePoNumber(date = new Date()): Promise<string> {
  const prefix = `PO-${ymPrefix(date)}-`;
  let seq = 1;
  try {
    const rows = await db
      .select({ n: purchaseOrders.poNumber })
      .from(purchaseOrders)
      .where(sql`${purchaseOrders.poNumber} LIKE ${prefix + "%"}`)
      .orderBy(sql`${purchaseOrders.poNumber} DESC`)
      .limit(1);
    if (rows[0]?.n) {
      const parsed = parseInt(rows[0].n.slice(prefix.length), 10);
      if (!Number.isNaN(parsed)) seq = parsed + 1;
    }
  } catch {
    seq = fallback(4);
  }
  return `${prefix}${String(seq).padStart(4, "0")}`;
}

export async function generateBatchNumber(date = new Date()): Promise<string> {
  const prefix = `B-${ymPrefix(date)}-`;
  let seq = 1;
  try {
    const rows = await db
      .select({ n: productionRuns.batchNumber })
      .from(productionRuns)
      .where(sql`${productionRuns.batchNumber} LIKE ${prefix + "%"}`)
      .orderBy(sql`${productionRuns.batchNumber} DESC`)
      .limit(1);
    if (rows[0]?.n) {
      const parsed = parseInt(rows[0].n.slice(prefix.length), 10);
      if (!Number.isNaN(parsed)) seq = parsed + 1;
    }
  } catch {
    seq = fallback(4);
  }
  return `${prefix}${String(seq).padStart(4, "0")}`;
}

/**
 * Lot numbers follow the canonical YYMM-NNN format (e.g. 2508-231).
 * Sequence resets monthly. Three-digit pad.
 */
export async function generateLotNumber(date = new Date()): Promise<string> {
  const ym = ymPrefix(date);
  let seq = 1;
  try {
    const rows = await db
      .select({ n: finishedProductLots.lotNumber })
      .from(finishedProductLots)
      .where(sql`${finishedProductLots.lotNumber} LIKE ${ym + "-%"}`)
      .orderBy(sql`${finishedProductLots.lotNumber} DESC`)
      .limit(1);
    if (rows[0]?.n) {
      const tail = rows[0].n.slice(ym.length + 1);
      const parsed = parseInt(tail, 10);
      if (!Number.isNaN(parsed)) seq = parsed + 1;
    }
  } catch {
    seq = Math.floor(Math.random() * 999) + 1;
  }
  return `${ym}-${String(seq).padStart(3, "0")}`;
}

/**
 * COA numbers reference the product code + lot number, e.g. COA-NS3318C-2508-231.
 */
export async function generateCoaNumber(productCode: string, lotNumber: string): Promise<string> {
  const base = `COA-${productCode || "NS-XXXX"}-${lotNumber}`;
  // If a COA with this base already exists (revision > 0), append revision suffix.
  try {
    const rows = await db
      .select({ n: finishedProductCoas.coaNumber, rev: finishedProductCoas.revision })
      .from(finishedProductCoas)
      .where(sql`${finishedProductCoas.coaNumber} LIKE ${base + "%"}`)
      .orderBy(sql`${finishedProductCoas.revision} DESC`)
      .limit(1);
    if (rows[0]) {
      return `${base}-Rev${(rows[0].rev ?? 0) + 1}`;
    }
  } catch {}
  return base;
}
