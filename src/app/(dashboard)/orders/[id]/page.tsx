import { db } from "@/lib/db";
import { purchaseOrders, poLineItems, customers, formulations, quotes } from "@/lib/db/schema";
import { asc, eq } from "drizzle-orm";
import Link from "next/link";
import { ShoppingCart, ChevronLeft, FlaskConical, Factory } from "lucide-react";
import { notFound } from "next/navigation";
import { StartProductionRunButton } from "./actions";

export const dynamic = "force-dynamic";

const STATUS_COLORS: Record<string, string> = {
  Pending: "bg-slate-100 text-slate-700",
  Accepted: "bg-blue-100 text-blue-700",
  "In Production": "bg-purple-100 text-purple-700",
  "QC Hold": "bg-amber-100 text-amber-700",
  Released: "bg-emerald-100 text-emerald-700",
  Shipped: "bg-indigo-100 text-indigo-700",
  Delivered: "bg-green-100 text-green-700",
  Closed: "bg-slate-200 text-slate-800",
};

export default async function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [po] = await db.select().from(purchaseOrders).where(eq(purchaseOrders.id, id)).limit(1);
  if (!po) notFound();

  const [customer] = po.customerId ? await db.select().from(customers).where(eq(customers.id, po.customerId)).limit(1) : [null];
  const [quote] = po.acceptedQuoteId ? await db.select().from(quotes).where(eq(quotes.id, po.acceptedQuoteId)).limit(1) : [null];
  const lines = await db
    .select({ line: poLineItems, formulation: formulations })
    .from(poLineItems)
    .leftJoin(formulations, eq(formulations.id, poLineItems.formulationId))
    .where(eq(poLineItems.purchaseOrderId, id))
    .orderBy(asc(poLineItems.sortOrder));

  const canStartRun = po.status === "Accepted" && lines.length > 0;

  return (
    <div className="max-w-6xl mx-auto pb-12">
      <div className="mb-3">
        <Link href="/orders" className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700">
          <ChevronLeft className="h-3.5 w-3.5" /> Back to Orders
        </Link>
      </div>

      <div className="flex items-start justify-between mb-5">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <ShoppingCart className="h-5 w-5 text-[#d10a11]" />
            <code className="font-mono text-base">{po.poNumber}</code>
          </h1>
          <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
            <span className={`inline-block px-2 py-0.5 text-xs font-medium rounded-full ${STATUS_COLORS[po.status] ?? STATUS_COLORS.Pending}`}>
              {po.status}
            </span>
            {customer && <span>· {customer.companyName}</span>}
            {po.customerPoNumber && <span>· Customer PO: <code className="font-mono text-slate-700">{po.customerPoNumber}</code></span>}
            {quote && <span>· from <Link href={`/quotes/${quote.id}`} className="text-slate-700 hover:text-[#d10a11]">{quote.quoteNumber}</Link></span>}
          </div>
        </div>
        {canStartRun && (
          <StartProductionRunButton purchaseOrderId={po.id} targetBatchSize={po.tierQuantity} />
        )}
      </div>

      <section className="bg-white border border-slate-200 rounded-lg p-5 mb-4 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-800 mb-3">Order Details</h2>
        <dl className="grid grid-cols-4 gap-y-3 gap-x-6 text-sm">
          <div>
            <dt className="text-xs text-slate-500 uppercase tracking-wide">Quantity (units)</dt>
            <dd className="text-slate-900 mt-0.5 font-mono tabular-nums">{po.tierQuantity.toLocaleString()}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500 uppercase tracking-wide">Unit Price</dt>
            <dd className="text-slate-900 mt-0.5 font-mono tabular-nums">${parseFloat(po.unitPrice).toFixed(2)}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500 uppercase tracking-wide">Total</dt>
            <dd className="text-slate-900 mt-0.5 font-mono tabular-nums font-semibold">${parseFloat(po.totalValue).toLocaleString(undefined, { maximumFractionDigits: 0 })}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500 uppercase tracking-wide">Target Ship Date</dt>
            <dd className="text-slate-900 mt-0.5">{po.targetShipDate ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500 uppercase tracking-wide">Accepted</dt>
            <dd className="text-slate-900 mt-0.5">{po.acceptedAt ? new Date(po.acceptedAt).toLocaleDateString() : "—"}</dd>
          </div>
          <div className="col-span-3">
            <dt className="text-xs text-slate-500 uppercase tracking-wide">Notes</dt>
            <dd className="text-slate-700 mt-0.5">{po.notes ?? "—"}</dd>
          </div>
        </dl>
      </section>

      <section className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm">
        <h2 className="text-sm font-semibold text-slate-800 px-5 py-3 border-b border-slate-200 bg-slate-50">Line Items</h2>
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs text-slate-600">
            <tr>
              <th className="text-left px-4 py-2 font-medium">Formulation</th>
              <th className="text-right px-4 py-2 font-medium">Quantity</th>
              <th className="text-right px-4 py-2 font-medium">Unit Price</th>
              <th className="text-right px-4 py-2 font-medium">Line Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 tabular-nums">
            {lines.map((l) => (
              <tr key={l.line.id}>
                <td className="px-4 py-2 text-slate-900">
                  {l.formulation ? (
                    <Link href={`/formulations/${l.formulation.id}`} className="hover:text-[#d10a11] inline-flex items-center gap-1.5">
                      <FlaskConical className="h-3 w-3" />
                      {l.formulation.name}
                    </Link>
                  ) : "—"}
                </td>
                <td className="px-4 py-2 text-right">{l.line.quantity.toLocaleString()}</td>
                <td className="px-4 py-2 text-right">${parseFloat(l.line.unitPrice).toFixed(4)}</td>
                <td className="px-4 py-2 text-right font-semibold">${parseFloat(l.line.lineTotal).toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {!canStartRun && po.status !== "Accepted" && (
        <p className="text-xs text-slate-500 mt-4 flex items-center gap-1.5">
          <Factory className="h-3 w-3" /> Production run started — see <Link href="/batches" className="text-[#d10a11] underline">batches</Link>.
        </p>
      )}
    </div>
  );
}
