/**
 * GET  /api/payments         — list (newest first)
 * POST /api/payments         — record payment against an invoice
 *
 * POST body:
 *   { invoiceId, amount, paymentDate, method, reference?, notes? }
 *
 * Side-effects:
 *   - Adds amount to invoices.amountPaid
 *   - If amountPaid >= totalAmount → status = Paid
 *   - Otherwise (amountPaid > 0)   → status = Partially Paid
 */

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { payments, invoices, activities } from "@/lib/db/schema";
import { desc, eq, sql } from "drizzle-orm";
import { generatePaymentNumber } from "@/domains/accounting/id-generator";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const rows = await db.select().from(payments).orderBy(desc(payments.createdAt)).limit(100);
    return NextResponse.json(rows);
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (!body.invoiceId) return NextResponse.json({ error: "invoiceId required" }, { status: 400 });
    if (!body.amount) return NextResponse.json({ error: "amount required" }, { status: 400 });
    if (!body.method) return NextResponse.json({ error: "method required" }, { status: 400 });

    const [invoice] = await db.select().from(invoices).where(eq(invoices.id, body.invoiceId)).limit(1);
    if (!invoice) return NextResponse.json({ error: "Invoice not found" }, { status: 404 });

    const paymentNumber = await generatePaymentNumber();
    const amount = parseFloat(String(body.amount));

    const [payment] = await db
      .insert(payments)
      .values({
        paymentNumber,
        invoiceId: invoice.id,
        customerId: invoice.customerId,
        amount: String(amount.toFixed(2)),
        paymentDate: body.paymentDate ?? new Date().toISOString().slice(0, 10),
        method: body.method,
        reference: body.reference ?? null,
        notes: body.notes ?? null,
      })
      .returning();

    // Update invoice amount paid + status
    const newAmountPaid = parseFloat(invoice.amountPaid ?? "0") + amount;
    const total = parseFloat(invoice.totalAmount);
    let newStatus = invoice.status;
    if (newAmountPaid >= total - 0.01) newStatus = "Paid";
    else if (newAmountPaid > 0) newStatus = "Partially Paid";

    await db.update(invoices)
      .set({ amountPaid: String(newAmountPaid.toFixed(2)), status: newStatus, updatedAt: new Date() })
      .where(eq(invoices.id, invoice.id));

    // Activity log
    if (invoice.customerId) {
      try {
        await db.insert(activities).values({
          customerId: invoice.customerId,
          type: "payment",
          subject: `Payment ${paymentNumber} received: $${amount.toFixed(2)}`,
          description: `Against invoice ${invoice.invoiceNumber}. Method: ${body.method}.${body.reference ? ` Ref: ${body.reference}` : ""}`,
          completedAt: new Date(),
        });
      } catch {}
    }

    return NextResponse.json({ success: true, paymentId: payment.id, paymentNumber, newInvoiceStatus: newStatus });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("Create payment error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
