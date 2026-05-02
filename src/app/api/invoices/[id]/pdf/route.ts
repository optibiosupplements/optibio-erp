/**
 * GET /api/invoices/[id]/pdf
 *
 * Branded invoice PDF for customer remittance.
 */

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { invoices, invoiceLineItems, customers, purchaseOrders } from "@/lib/db/schema";
import { eq, asc } from "drizzle-orm";
import { buildInvoicePdf } from "@/domains/pdf/invoice";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const [inv] = await db.select().from(invoices).where(eq(invoices.id, id)).limit(1);
    if (!inv) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const [customer] = inv.customerId
      ? await db.select().from(customers).where(eq(customers.id, inv.customerId)).limit(1)
      : [null];

    const [po] = inv.purchaseOrderId
      ? await db.select().from(purchaseOrders).where(eq(purchaseOrders.id, inv.purchaseOrderId)).limit(1)
      : [null];

    const lines = await db.select().from(invoiceLineItems).where(eq(invoiceLineItems.invoiceId, id)).orderBy(asc(invoiceLineItems.sortOrder));

    const buf = await buildInvoicePdf({
      invoiceNumber: inv.invoiceNumber,
      poNumber: po?.poNumber,
      customerPo: po?.customerPoNumber ?? undefined,
      customerName: customer?.companyName ?? "—",
      customerAddress: customer?.address ?? undefined,
      customerEmail: customer?.email ?? undefined,
      issueDate: inv.issueDate,
      dueDate: inv.dueDate,
      paymentTerms: inv.paymentTerms ?? "Net 30",
      lineItems: lines.map((l) => ({
        description: l.description,
        quantity: parseFloat(l.quantity),
        unitPrice: parseFloat(l.unitPrice),
        lineTotal: parseFloat(l.lineTotal),
      })),
      subtotal: parseFloat(inv.subtotal),
      taxAmount: parseFloat(inv.taxAmount ?? "0"),
      totalAmount: parseFloat(inv.totalAmount),
      amountPaid: parseFloat(inv.amountPaid ?? "0"),
      status: inv.status,
    });

    return new NextResponse(buf as BodyInit, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${inv.invoiceNumber}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("Invoice PDF error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
