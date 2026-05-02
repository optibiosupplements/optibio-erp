import { db } from "@/lib/db";
import { supplierPurchaseOrders, suppliers } from "@/lib/db/schema";
import { desc, eq } from "drizzle-orm";
import Link from "next/link";
import { ClipboardList, Plus } from "lucide-react";

export const dynamic = "force-dynamic";

const STATUS_COLORS: Record<string, string> = {
  Draft: "bg-slate-100 text-slate-700",
  Sent: "bg-blue-100 text-blue-700",
  Confirmed: "bg-purple-100 text-purple-700",
  Received: "bg-emerald-100 text-emerald-700",
  Cancelled: "bg-red-100 text-red-700",
};

export default async function SupplierPosPage() {
  let rows: Array<{
    id: string; spoNumber: string; status: string; orderDate: string;
    expectedDate: string | null; receivedDate: string | null;
    totalCost: string | null; supplierName: string | null;
  }> = [];

  try {
    rows = await db
      .select({
        id: supplierPurchaseOrders.id,
        spoNumber: supplierPurchaseOrders.spoNumber,
        status: supplierPurchaseOrders.status,
        orderDate: supplierPurchaseOrders.orderDate,
        expectedDate: supplierPurchaseOrders.expectedDate,
        receivedDate: supplierPurchaseOrders.receivedDate,
        totalCost: supplierPurchaseOrders.totalCost,
        supplierName: suppliers.companyName,
      })
      .from(supplierPurchaseOrders)
      .leftJoin(suppliers, eq(suppliers.id, supplierPurchaseOrders.supplierId))
      .orderBy(desc(supplierPurchaseOrders.createdAt))
      .limit(100);
  } catch {}

  const totalSpend = rows.reduce((s, r) => s + parseFloat(r.totalCost ?? "0"), 0);

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <ClipboardList className="h-5 w-5 text-[#d10a11]" />
            Supplier POs
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            {rows.length} outbound order{rows.length !== 1 && "s"} · ${totalSpend.toLocaleString(undefined, { maximumFractionDigits: 0 })} total committed
          </p>
        </div>
        <Link href="/suppliers" className="inline-flex items-center gap-2 px-4 py-2 border border-slate-300 hover:bg-slate-50 text-slate-700 text-sm font-medium rounded-md">
          <Plus className="h-4 w-4" /> New SPO from Supplier
        </Link>
      </div>

      {rows.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-lg p-16 text-center shadow-sm">
          <ClipboardList className="h-12 w-12 text-slate-200 mx-auto mb-3" />
          <p className="text-sm text-slate-600 font-medium">No supplier POs yet.</p>
          <p className="text-xs text-slate-400 mt-1">Issue a PO to a supplier to procure raw materials.</p>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-xs text-slate-600">
                <th className="text-left px-4 py-2 font-semibold">SPO #</th>
                <th className="text-left px-4 py-2 font-semibold">Supplier</th>
                <th className="text-left px-4 py-2 font-semibold">Order Date</th>
                <th className="text-left px-4 py-2 font-semibold">Expected</th>
                <th className="text-left px-4 py-2 font-semibold">Received</th>
                <th className="text-right px-4 py-2 font-semibold">Total</th>
                <th className="text-left px-4 py-2 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 tabular-nums">
              {rows.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50/50">
                  <td className="px-4 py-2.5">
                    <Link href={`/supplier-pos/${r.id}`} className="font-mono font-semibold text-slate-900 hover:text-[#d10a11]">{r.spoNumber}</Link>
                  </td>
                  <td className="px-4 py-2.5 text-slate-700">{r.supplierName ?? "—"}</td>
                  <td className="px-4 py-2.5 text-slate-600 text-xs">{r.orderDate}</td>
                  <td className="px-4 py-2.5 text-slate-600 text-xs">{r.expectedDate ?? "—"}</td>
                  <td className="px-4 py-2.5 text-slate-600 text-xs">{r.receivedDate ?? "—"}</td>
                  <td className="px-4 py-2.5 text-right font-semibold">${parseFloat(r.totalCost ?? "0").toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
                  <td className="px-4 py-2.5">
                    <span className={`inline-block px-2 py-0.5 text-xs font-medium rounded-full ${STATUS_COLORS[r.status] ?? STATUS_COLORS.Draft}`}>
                      {r.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
