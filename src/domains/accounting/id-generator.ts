/**
 * Accounting ID generators.
 *
 * INV-YYMM-####     invoices
 * PMT-YYMM-####     payments
 */

import { db } from "@/lib/db";
import { invoices, payments } from "@/lib/db/schema";
import { sql } from "drizzle-orm";

function ymPrefix(date = new Date()): string {
  const yy = String(date.getFullYear()).slice(-2);
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  return `${yy}${mm}`;
}

export async function generateInvoiceNumber(date = new Date()): Promise<string> {
  const prefix = `INV-${ymPrefix(date)}-`;
  let seq = 1;
  try {
    const rows = await db
      .select({ n: invoices.invoiceNumber })
      .from(invoices)
      .where(sql`${invoices.invoiceNumber} LIKE ${prefix + "%"}`)
      .orderBy(sql`${invoices.invoiceNumber} DESC`)
      .limit(1);
    if (rows[0]?.n) {
      const parsed = parseInt(rows[0].n.slice(prefix.length), 10);
      if (!Number.isNaN(parsed)) seq = parsed + 1;
    }
  } catch {
    seq = Math.floor(Math.random() * 9999) + 1;
  }
  return `${prefix}${String(seq).padStart(4, "0")}`;
}

export async function generatePaymentNumber(date = new Date()): Promise<string> {
  const prefix = `PMT-${ymPrefix(date)}-`;
  let seq = 1;
  try {
    const rows = await db
      .select({ n: payments.paymentNumber })
      .from(payments)
      .where(sql`${payments.paymentNumber} LIKE ${prefix + "%"}`)
      .orderBy(sql`${payments.paymentNumber} DESC`)
      .limit(1);
    if (rows[0]?.n) {
      const parsed = parseInt(rows[0].n.slice(prefix.length), 10);
      if (!Number.isNaN(parsed)) seq = parsed + 1;
    }
  } catch {
    seq = Math.floor(Math.random() * 9999) + 1;
  }
  return `${prefix}${String(seq).padStart(4, "0")}`;
}
