/**
 * GET  /api/invoices         — list (newest first)
 * POST /api/invoices         — create from PO (auto-bills the PO total + tax)
 *
 * POST body:
 *   { purchaseOrderId, paymentTerms?, taxRatePct? (default 0), dueDays? (default 30) }
 *
 * Builds:
 *   - one line per po_line_item
 *   - subtotal = sum of line totals
 *   - tax = subtotal × taxRatePct/100
 *   - totalAmount = subtotal + tax
 *   - dueDate = issueDate + dueDays
 */

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { invoices, invoiceLineItems, purchaseOrders, poLineItems, formulations } from "@/lib/db/schema";
import { desc, eq, asc } from "drizzle-orm";
import { generateInvoiceNumber } from "@/domains/accounting/id-generator";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const rows = await db.select().from(invoices).orderBy(desc(invoices.createdAt)).limit(100);
    return NextResponse.json(rows);
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (!body.purchaseOrderId) return NextResponse.json({ error: "purchaseOrderId required" }, { status: 400 });

    const [po] = await db.select().from(purchaseOrders).where(eq(purchaseOrders.id, body.purchaseOrderId)).limit(1);
    if (!po) return NextResponse.json({ error: "PO not found" }, { status: 404 });

    const lines = await db
      .select({ line: poLineItems, formulation: formulations })
      .from(poLineItems)
      .leftJoin(formulations, eq(formulations.id, poLineItems.formulationId))
      .where(eq(poLineItems.purchaseOrderId, po.id))
      .orderBy(asc(poLineItems.sortOrder));

    const issueDate = new Date();
    const dueDays = parseInt(String(body.dueDays ?? 30), 10);
    const dueDate = new Date(issueDate);
    dueDate.setDate(dueDate.getDate() + dueDays);

    const subtotal = lines.reduce((s, l) => s + parseFloat(l.line.lineTotal), 0);
    const taxRatePct = parseFloat(String(body.taxRatePct ?? 0)) || 0;
    const taxAmount = subtotal * (taxRatePct / 100);
    const totalAmount = subtotal + taxAmount;

    const invoiceNumber = await generateInvoiceNumber();

    const [invoice] = await db
      .insert(invoices)
      .values({
        invoiceNumber,
        customerId: po.customerId,
        purchaseOrderId: po.id,
        issueDate: issueDate.toISOString().slice(0, 10),
        dueDate: dueDate.toISOString().slice(0, 10),
        subtotal: String(subtotal.toFixed(2)),
        taxAmount: String(taxAmount.toFixed(2)),
        totalAmount: String(totalAmount.toFixed(2)),
        amountPaid: "0",
        status: "Draft",
        paymentTerms: body.paymentTerms ?? `Net ${dueDays}`,
        notes: body.notes ?? null,
      })
      .returning();

    if (lines.length > 0) {
      const lineRows = lines.map((l, idx) => ({
        invoiceId: invoice.id,
        description: `${l.formulation?.name ?? "Product"} — PO ${po.poNumber}`,
        quantity: String(l.line.quantity),
        unitPrice: l.line.unitPrice,
        lineTotal: l.line.lineTotal,
        sortOrder: idx,
      }));
      await db.insert(invoiceLineItems).values(lineRows);
    }

    return NextResponse.json({ success: true, invoiceId: invoice.id, invoiceNumber });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("Create invoice error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
