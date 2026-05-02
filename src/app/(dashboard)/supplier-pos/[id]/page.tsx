import { db } from "@/lib/db";
import { supplierPurchaseOrders, supplierPoLineItems, suppliers, ingredients } from "@/lib/db/schema";
import { eq, asc } from "drizzle-orm";
import Link from "next/link";
import { ClipboardList, ChevronLeft } from "lucide-react";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

const STATUS_COLORS: Record<string, string> = {
  Draft: "bg-slate-100 text-slate-700",
  Sent: "bg-blue-100 text-blue-700",
  Confirmed: "bg-purple-100 text-purple-700",
  Received: "bg-emerald-100 text-emerald-700",
  Cancelled: "bg-red-100 text-red-700",
};

export default async function SupplierPoDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [spo] = await db.select().from(supplierPurchaseOrders).where(eq(supplierPurchaseOrders.id, id)).limit(1);
  if (!spo) notFound();

  const [supplier] = await db.select().from(suppliers).where(eq(suppliers.id, spo.supplierId)).limit(1);
  const lines = await db
    .select({ line: supplierPoLineItems, ing: ingredients })
    .from(supplierPoLineItems)
    .leftJoin(ingredients, eq(ingredients.id, supplierPoLineItems.ingredientId))
    .where(eq(supplierPoLineItems.supplierPoId, id))
    .orderBy(asc(supplierPoLineItems.sortOrder));

  return (
    <div className="max-w-5xl mx-auto pb-12">
      <div className="mb-3">
        <Link href="/supplier-pos" className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700">
          <ChevronLeft className="h-3.5 w-3.5" /> Back to Supplier POs
        </Link>
      </div>

      <div className="flex items-start justify-between mb-5">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <ClipboardList className="h-5 w-5 text-[#d10a11]" />
            <code className="font-mono text-base">{spo.spoNumber}</code>
          </h1>
          <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
            <span className={`inline-block px-2 py-0.5 text-xs font-medium rounded-full ${STATUS_COLORS[spo.status] ?? STATUS_COLORS.Draft}`}>
              {spo.status}
            </span>
            {supplier && <span>· <Link href={`/suppliers/${supplier.id}`} className="text-slate-700 hover:text-[#d10a11]">{supplier.companyName}</Link></span>}
          </div>
        </div>
      </div>

      <section className="bg-white border border-slate-200 rounded-lg p-5 mb-4 shadow-sm">
        <div className="grid grid-cols-4 gap-4 text-sm">
          <div>
            <dt className="text-xs text-slate-500 uppercase tracking-wide">Order Date</dt>
            <dd className="text-slate-900 mt-0.5">{spo.orderDate}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500 uppercase tracking-wide">Expected</dt>
            <dd className="text-slate-900 mt-0.5">{spo.expectedDate ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500 uppercase tracking-wide">Received</dt>
            <dd className="text-slate-900 mt-0.5">{spo.receivedDate ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500 uppercase tracking-wide">Payment Terms</dt>
            <dd className="text-slate-900 mt-0.5">{spo.paymentTerms ?? "—"}</dd>
          </div>
          <div className="col-span-2">
            <dt className="text-xs text-slate-500 uppercase tracking-wide">Shipping Terms</dt>
            <dd className="text-slate-900 mt-0.5">{spo.shippingTerms ?? "—"}</dd>
          </div>
          <div className="col-span-2">
            <dt className="text-xs text-slate-500 uppercase tracking-wide">Total Cost</dt>
            <dd className="text-slate-900 mt-0.5 font-mono tabular-nums font-semibold">${parseFloat(spo.totalCost ?? "0").toLocaleString(undefined, { maximumFractionDigits: 2 })}</dd>
          </div>
        </div>
        {spo.notes && <p className="text-xs text-slate-600 mt-3 bg-slate-50 border border-slate-200 rounded p-2">{spo.notes}</p>}
      </section>

      <section className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm">
        <h2 className="text-sm font-semibold text-slate-800 px-5 py-3 border-b border-slate-200 bg-slate-50">Line Items</h2>
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs text-slate-600">
            <tr>
              <th className="text-left px-4 py-2 font-medium">Ingredient</th>
              <th className="text-left px-4 py-2 font-medium">Description</th>
              <th className="text-right px-4 py-2 font-medium">Qty (kg)</th>
              <th className="text-right px-4 py-2 font-medium">Received (kg)</th>
              <th className="text-right px-4 py-2 font-medium">$/kg</th>
              <th className="text-right px-4 py-2 font-medium">Line Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 tabular-nums">
            {lines.map((l) => (
              <tr key={l.line.id}>
                <td className="px-4 py-2 text-slate-900">{l.ing ? `${l.ing.rmId} · ${l.ing.name}` : "—"}</td>
                <td className="px-4 py-2 text-slate-700">{l.line.description}</td>
                <td className="px-4 py-2 text-right">{parseFloat(l.line.quantityKg).toFixed(2)}</td>
                <td className="px-4 py-2 text-right text-emerald-700">{parseFloat(l.line.receivedQuantityKg ?? "0").toFixed(2)}</td>
                <td className="px-4 py-2 text-right">${parseFloat(l.line.unitPrice).toFixed(2)}</td>
                <td className="px-4 py-2 text-right font-semibold">${parseFloat(l.line.lineTotal).toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
