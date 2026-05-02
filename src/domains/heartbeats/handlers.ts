/**
 * Heartbeat handlers — autonomous tasks that fire on a schedule.
 *
 * Each handler:
 *   - Scans the DB for some condition
 *   - Creates follow-up tasks / activities / notifications when warranted
 *   - Returns { actions, output } describing what it did
 *
 * Handlers are intentionally idempotent — running them twice should not create
 * duplicate tasks for the same condition. Most use a "task with a known
 * relatedId" pattern: if a task already exists for that record, skip.
 */

import { db } from "@/lib/db";
import { rfqs, finishedProductLots, invoices, formulations, tasks, activities } from "@/lib/db/schema";
import { sql, eq, and, lte, gte } from "drizzle-orm";

export interface HandlerResult {
  actions: number;
  output: string;
  status: "ok" | "no_action" | "error";
}

// ─────────────────────────────────────────────────────────────────────────────

/** Find RFQs with status "New" or "In Review" that haven't been touched in 7 days. */
export async function idleRfqScan(): Promise<HandlerResult> {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  try {
    const idle = await db
      .select()
      .from(rfqs)
      .where(
        and(
          sql`${rfqs.status} IN ('New', 'In Review')`,
          lte(rfqs.updatedAt, sevenDaysAgo),
        ),
      )
      .limit(50);

    let created = 0;
    for (const rfq of idle) {
      // Skip if a follow-up task already exists for this RFQ
      const existing = await db
        .select({ id: tasks.id })
        .from(tasks)
        .where(and(eq(tasks.relatedTable, "rfqs"), eq(tasks.relatedId, rfq.id), sql`${tasks.status} != 'Done'`))
        .limit(1);
      if (existing.length > 0) continue;

      await db.insert(tasks).values({
        title: `Follow up: ${rfq.rfqNumber} idle ${Math.floor((Date.now() - new Date(rfq.updatedAt).getTime()) / (1000 * 60 * 60 * 24))} days`,
        description: `RFQ "${rfq.productName ?? rfq.rfqNumber}" (${rfq.customerCompany ?? "—"}) hasn't been touched. Reach out or close the lead.`,
        priority: "Normal",
        status: "Todo",
        relatedTable: "rfqs",
        relatedId: rfq.id,
        customerId: rfq.customerId ?? null,
      });
      created++;
    }
    return {
      actions: created,
      status: created > 0 ? "ok" : "no_action",
      output: `Scanned ${idle.length} idle RFQs, created ${created} follow-up task${created !== 1 ? "s" : ""}.`,
    };
  } catch (e: unknown) {
    return { actions: 0, status: "error", output: e instanceof Error ? e.message : String(e) };
  }
}

// ─────────────────────────────────────────────────────────────────────────────

/** Find finished product lots whose expiration_date is within 90 days. */
export async function expiringCoaCheck(): Promise<HandlerResult> {
  const ninetyDaysFromNow = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);
  try {
    const lots = await db
      .select()
      .from(finishedProductLots)
      .where(
        and(
          sql`${finishedProductLots.expirationDate} IS NOT NULL`,
          sql`${finishedProductLots.expirationDate}::date <= ${ninetyDaysFromNow.toISOString().slice(0, 10)}::date`,
          sql`${finishedProductLots.status} != 'Recalled'`,
        ),
      )
      .limit(50);

    let created = 0;
    for (const lot of lots) {
      const existing = await db
        .select({ id: tasks.id })
        .from(tasks)
        .where(and(eq(tasks.relatedTable, "finished_product_lots"), eq(tasks.relatedId, lot.id), sql`${tasks.status} != 'Done'`))
        .limit(1);
      if (existing.length > 0) continue;

      const daysToExp = lot.expirationDate
        ? Math.floor((new Date(lot.expirationDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
        : 0;

      await db.insert(tasks).values({
        title: `Lot ${lot.lotNumber} expires in ${daysToExp} days`,
        description: `${lot.quantityUnits} units of finished product. Plan recall, repackage, or markdown.`,
        priority: daysToExp < 30 ? "High" : "Normal",
        status: "Todo",
        relatedTable: "finished_product_lots",
        relatedId: lot.id,
      });
      created++;
    }
    return {
      actions: created,
      status: created > 0 ? "ok" : "no_action",
      output: `Scanned ${lots.length} lots expiring ≤90 days, created ${created} task${created !== 1 ? "s" : ""}.`,
    };
  } catch (e: unknown) {
    return { actions: 0, status: "error", output: e instanceof Error ? e.message : String(e) };
  }
}

// ─────────────────────────────────────────────────────────────────────────────

/** Find invoices past their due date with outstanding balance. */
export async function overdueInvoiceCheck(): Promise<HandlerResult> {
  const today = new Date().toISOString().slice(0, 10);
  try {
    const overdue = await db
      .select()
      .from(invoices)
      .where(
        and(
          sql`${invoices.dueDate}::date < ${today}::date`,
          sql`${invoices.status} NOT IN ('Paid', 'Void')`,
        ),
      )
      .limit(50);

    let created = 0;
    for (const inv of overdue) {
      const balance = parseFloat(inv.totalAmount) - parseFloat(inv.amountPaid ?? "0");
      if (balance <= 0.01) continue;

      const existing = await db
        .select({ id: tasks.id })
        .from(tasks)
        .where(and(eq(tasks.relatedTable, "invoices"), eq(tasks.relatedId, inv.id), sql`${tasks.status} != 'Done'`))
        .limit(1);
      if (existing.length > 0) continue;

      const daysOverdue = Math.floor((Date.now() - new Date(inv.dueDate).getTime()) / (1000 * 60 * 60 * 24));

      await db.insert(tasks).values({
        title: `Invoice ${inv.invoiceNumber} overdue ${daysOverdue}d — $${balance.toFixed(2)}`,
        description: `Customer balance outstanding past Net terms. Send reminder or escalate.`,
        priority: daysOverdue > 60 ? "Urgent" : daysOverdue > 30 ? "High" : "Normal",
        status: "Todo",
        relatedTable: "invoices",
        relatedId: inv.id,
        customerId: inv.customerId ?? null,
      });

      // Auto-mark invoice as Overdue
      if (inv.status !== "Overdue") {
        await db.update(invoices).set({ status: "Overdue", updatedAt: new Date() }).where(eq(invoices.id, inv.id));
      }
      created++;
    }
    return {
      actions: created,
      status: created > 0 ? "ok" : "no_action",
      output: `Scanned ${overdue.length} overdue invoices, created ${created} collections task${created !== 1 ? "s" : ""}.`,
    };
  } catch (e: unknown) {
    return { actions: 0, status: "error", output: e instanceof Error ? e.message : String(e) };
  }
}

// ─────────────────────────────────────────────────────────────────────────────

/** Activity-log a weekly summary of what shipped (for the operator). */
export async function weeklyActivitySummary(): Promise<HandlerResult> {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  try {
    const [rfqCount] = await db.select({ c: sql<number>`COUNT(*)::int` }).from(rfqs).where(gte(rfqs.createdAt, sevenDaysAgo));
    const [formCount] = await db.select({ c: sql<number>`COUNT(*)::int` }).from(formulations).where(gte(formulations.createdAt, sevenDaysAgo));

    const total = (rfqCount?.c ?? 0) + (formCount?.c ?? 0);
    if (total === 0) {
      return { actions: 0, status: "no_action", output: "No activity to summarize this week." };
    }

    await db.insert(activities).values({
      type: "summary",
      subject: `Weekly summary — ${rfqCount?.c ?? 0} RFQs, ${formCount?.c ?? 0} formulations`,
      description: `Past 7 days: ${rfqCount?.c ?? 0} new RFQs, ${formCount?.c ?? 0} new formulations entered The Lab. See /retro for full KPIs.`,
      completedAt: new Date(),
    });

    return {
      actions: 1,
      status: "ok",
      output: `Logged weekly summary: ${rfqCount?.c ?? 0} RFQs, ${formCount?.c ?? 0} formulations.`,
    };
  } catch (e: unknown) {
    return { actions: 0, status: "error", output: e instanceof Error ? e.message : String(e) };
  }
}

// ─────────────────────────────────────────────────────────────────────────────

export const HEARTBEAT_HANDLERS: Record<string, () => Promise<HandlerResult>> = {
  "idle-rfq-scan": idleRfqScan,
  "expiring-coa-check": expiringCoaCheck,
  "overdue-invoice-check": overdueInvoiceCheck,
  "weekly-activity-summary": weeklyActivitySummary,
};

export interface HeartbeatSeed {
  name: string;
  label: string;
  description: string;
  scheduleCron: string;
}

/** The set of heartbeats we ship out-of-the-box. Created on first /heartbeats visit if missing. */
export const SEEDED_HEARTBEATS: HeartbeatSeed[] = [
  {
    name: "idle-rfq-scan",
    label: "Idle RFQ Follow-Ups",
    description: "Find RFQs in 'New' or 'In Review' that haven't been touched in 7+ days. Creates a follow-up task per RFQ.",
    scheduleCron: "0 9 * * *",         // daily 9am
  },
  {
    name: "expiring-coa-check",
    label: "Expiring Lot Watch",
    description: "Flag finished product lots whose expiration date is within 90 days. Creates a task with priority based on days remaining.",
    scheduleCron: "0 10 * * *",         // daily 10am
  },
  {
    name: "overdue-invoice-check",
    label: "AR Collections",
    description: "Find invoices past due date with outstanding balance. Auto-marks as Overdue, creates a collections task.",
    scheduleCron: "0 11 * * *",         // daily 11am
  },
  {
    name: "weekly-activity-summary",
    label: "Weekly Activity Summary",
    description: "Logs a summary of new RFQs, formulations, and other key events from the past 7 days into the activity feed.",
    scheduleCron: "0 8 * * MON",        // Mondays 8am
  },
];
