import { db } from "@/lib/db";
import { purchaseOrders, customers } from "@/lib/db/schema";
import { desc, eq } from "drizzle-orm";
import Link from "next/link";
import { ShoppingCart } from "lucide-react";

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

export default async function OrdersPage() {
  let rows: Array<{ id: string; poNumber: string; tierQuantity: number; unitPrice: string; totalValue: string; status: string; targetShipDate: string | null; customerName: string | null; createdAt: Date }> = [];
  try {
    rows = await db
      .select({
        id: purchaseOrders.id,
        poNumber: purchaseOrders.poNumber,
        tierQuantity: purchaseOrders.tierQuantity,
        unitPrice: purchaseOrders.unitPrice,
        totalValue: purchaseOrders.totalValue,
        status: purchaseOrders.status,
        targetShipDate: purchaseOrders.targetShipDate,
        customerName: customers.companyName,
        createdAt: purchaseOrders.createdAt,
      })
      .from(purchaseOrders)
      .leftJoin(customers, eq(customers.id, purchaseOrders.customerId))
      .orderBy(desc(purchaseOrders.createdAt))
      .limit(100);
  } catch {}

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Purchase Orders</h1>
          <p className="text-xs text-slate-500 mt-0.5">{rows.length} order{rows.length !== 1 && "s"}</p>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-lg p-16 text-center shadow-sm">
          <ShoppingCart className="h-12 w-12 text-slate-200 mx-auto mb-3" />
          <p className="text-sm text-slate-600 font-medium">No orders yet.</p>
          <p className="text-xs text-slate-400 mt-1">Accept a quote to create the first PO.</p>
          <Link href="/quotes" className="inline-flex items-center gap-2 mt-4 px-4 py-2 border border-slate-300 hover:bg-slate-50 text-slate-700 text-sm font-medium rounded-md">View Quotes</Link>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-xs text-slate-600">
                <th className="text-left px-4 py-2 font-semibold">PO #</th>
                <th className="text-left px-4 py-2 font-semibold">Customer</th>
                <th className="text-right px-4 py-2 font-semibold">Qty</th>
                <th className="text-right px-4 py-2 font-semibold">Unit Price</th>
                <th className="text-right px-4 py-2 font-semibold">Total</th>
                <th className="text-left px-4 py-2 font-semibold">Status</th>
                <th className="text-left px-4 py-2 font-semibold">Ship Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 tabular-nums">
              {rows.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50/50">
                  <td className="px-4 py-2.5">
                    <Link href={`/orders/${r.id}`} className="font-mono font-semibold text-slate-900 hover:text-[#d10a11]">{r.poNumber}</Link>
                  </td>
                  <td className="px-4 py-2.5 text-slate-700">{r.customerName ?? "—"}</td>
                  <td className="px-4 py-2.5 text-right">{r.tierQuantity.toLocaleString()}</td>
                  <td className="px-4 py-2.5 text-right">${parseFloat(r.unitPrice).toFixed(2)}</td>
                  <td className="px-4 py-2.5 text-right font-semibold">${parseFloat(r.totalValue).toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                  <td className="px-4 py-2.5">
                    <span className={`inline-block px-2 py-0.5 text-xs font-medium rounded-full ${STATUS_COLORS[r.status] ?? STATUS_COLORS.Pending}`}>
                      {r.status}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-slate-500 text-xs">{r.targetShipDate ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
