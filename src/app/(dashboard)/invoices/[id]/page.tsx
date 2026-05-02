import { db } from "@/lib/db";
import { invoices, invoiceLineItems, customers, purchaseOrders, payments } from "@/lib/db/schema";
import { eq, asc, desc } from "drizzle-orm";
import Link from "next/link";
import { Receipt, ChevronLeft, ShoppingCart, FileText } from "lucide-react";
import { notFound } from "next/navigation";
import { RecordPaymentButton } from "./actions";

export const dynamic = "force-dynamic";

const STATUS_COLORS: Record<string, string> = {
  Draft: "bg-slate-100 text-slate-700",
  Sent: "bg-blue-100 text-blue-700",
  "Partially Paid": "bg-amber-100 text-amber-700",
  Paid: "bg-emerald-100 text-emerald-700",
  Overdue: "bg-red-100 text-red-700",
  Void: "bg-slate-200 text-slate-500",
};

export default async function InvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [inv] = await db.select().from(invoices).where(eq(invoices.id, id)).limit(1);
  if (!inv) notFound();

  const [customer] = inv.customerId ? await db.select().from(customers).where(eq(customers.id, inv.customerId)).limit(1) : [null];
  const [po] = inv.purchaseOrderId ? await db.select().from(purchaseOrders).where(eq(purchaseOrders.id, inv.purchaseOrderId)).limit(1) : [null];
  const lines = await db.select().from(invoiceLineItems).where(eq(invoiceLineItems.invoiceId, id)).orderBy(asc(invoiceLineItems.sortOrder));
  const invoicePayments = await db.select().from(payments).where(eq(payments.invoiceId, id)).orderBy(desc(payments.paymentDate));

  const balance = parseFloat(inv.totalAmount) - parseFloat(inv.amountPaid ?? "0");
  const isPaid = inv.status === "Paid";

  return (
    <div className="max-w-5xl mx-auto pb-12">
      <div className="mb-3">
        <Link href="/invoices" className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700">
          <ChevronLeft className="h-3.5 w-3.5" /> Back to Invoices
        </Link>
      </div>

      <div className="flex items-start justify-between mb-5">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Receipt className="h-5 w-5 text-[#d10a11]" />
            <code className="font-mono text-base">{inv.invoiceNumber}</code>
          </h1>
          <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
            <span className={`inline-block px-2 py-0.5 text-xs font-medium rounded-full ${STATUS_COLORS[inv.status] ?? STATUS_COLORS.Draft}`}>
              {inv.status}
            </span>
            {customer && <span>· <Link href={`/customers/${customer.id}`} className="text-slate-700 hover:text-[#d10a11]">{customer.companyName}</Link></span>}
            {po && <span>· PO <Link href={`/orders/${po.id}`} className="font-mono text-slate-700 hover:text-[#d10a11]">{po.poNumber}</Link></span>}
          </div>
        </div>
        <div className="flex gap-2 items-start">
          <a
            href={`/api/invoices/${id}/pdf`}
            target="_blank"
            className="inline-flex items-center gap-2 px-4 py-2 border border-slate-300 hover:bg-slate-50 text-slate-700 text-sm font-medium rounded-md"
          >
            <FileText className="h-4 w-4" /> Download PDF
          </a>
          {!isPaid && balance > 0 && (
            <RecordPaymentButton invoiceId={id} balance={balance} />
          )}
        </div>
      </div>

      <section className="bg-white border border-slate-200 rounded-lg p-5 mb-4 shadow-sm">
        <div className="grid grid-cols-4 gap-4 text-sm">
          <div>
            <dt className="text-xs text-slate-500 uppercase tracking-wide">Issue Date</dt>
            <dd className="text-slate-900 mt-0.5">{inv.issueDate}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500 uppercase tracking-wide">Due Date</dt>
            <dd className="text-slate-900 mt-0.5">{inv.dueDate}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500 uppercase tracking-wide">Payment Terms</dt>
            <dd className="text-slate-900 mt-0.5">{inv.paymentTerms ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500 uppercase tracking-wide">Balance Due</dt>
            <dd className={`mt-0.5 font-mono tabular-nums font-semibold ${balance > 0 ? "text-slate-900" : "text-emerald-700"}`}>
              ${balance.toLocaleString(undefined, { maximumFractionDigits: 2 })}
            </dd>
          </div>
        </div>
      </section>

      {/* Line items */}
      <section className="bg-white border border-slate-200 rounded-lg overflow-hidden mb-4 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-800 px-5 py-3 border-b border-slate-200 bg-slate-50">Line Items</h2>
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs text-slate-600">
            <tr>
              <th className="text-left px-4 py-2 font-medium">Description</th>
              <th className="text-right px-4 py-2 font-medium">Qty</th>
              <th className="text-right px-4 py-2 font-medium">Unit Price</th>
              <th className="text-right px-4 py-2 font-medium">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 tabular-nums">
            {lines.map((l) => (
              <tr key={l.id}>
                <td className="px-4 py-2 text-slate-900">{l.description}</td>
                <td className="px-4 py-2 text-right">{parseFloat(l.quantity).toLocaleString()}</td>
                <td className="px-4 py-2 text-right">${parseFloat(l.unitPrice).toFixed(4)}</td>
                <td className="px-4 py-2 text-right">${parseFloat(l.lineTotal).toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
              </tr>
            ))}
            <tr className="border-t-2 border-slate-200 font-medium">
              <td colSpan={3} className="px-4 py-2 text-right text-slate-700">Subtotal:</td>
              <td className="px-4 py-2 text-right">${parseFloat(inv.subtotal).toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
            </tr>
            {parseFloat(inv.taxAmount ?? "0") > 0 && (
              <tr className="font-medium">
                <td colSpan={3} className="px-4 py-2 text-right text-slate-700">Tax:</td>
                <td className="px-4 py-2 text-right">${parseFloat(inv.taxAmount ?? "0").toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
              </tr>
            )}
            <tr className="bg-slate-50 font-bold">
              <td colSpan={3} className="px-4 py-2 text-right text-slate-900">Total:</td>
              <td className="px-4 py-2 text-right text-slate-900">${parseFloat(inv.totalAmount).toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
            </tr>
          </tbody>
        </table>
      </section>

      {/* Payments */}
      {invoicePayments.length > 0 && (
        <section className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm">
          <h2 className="text-sm font-semibold text-slate-800 px-5 py-3 border-b border-slate-200 bg-slate-50">Payments ({invoicePayments.length})</h2>
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs text-slate-600">
              <tr>
                <th className="text-left px-4 py-2 font-medium">Payment #</th>
                <th className="text-left px-4 py-2 font-medium">Date</th>
                <th className="text-left px-4 py-2 font-medium">Method</th>
                <th className="text-left px-4 py-2 font-medium">Reference</th>
                <th className="text-right px-4 py-2 font-medium">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 tabular-nums">
              {invoicePayments.map((p) => (
                <tr key={p.id}>
                  <td className="px-4 py-2 font-mono text-xs">{p.paymentNumber}</td>
                  <td className="px-4 py-2 text-slate-700">{p.paymentDate}</td>
                  <td className="px-4 py-2 text-slate-700">{p.method}</td>
                  <td className="px-4 py-2 text-slate-500 text-xs font-mono">{p.reference ?? "—"}</td>
                  <td className="px-4 py-2 text-right font-medium text-emerald-700">${parseFloat(p.amount).toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}
