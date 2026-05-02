import { db } from "@/lib/db";
import { shipments, purchaseOrders, customers, finishedProductLots } from "@/lib/db/schema";
import { desc, eq } from "drizzle-orm";
import Link from "next/link";
import { Truck } from "lucide-react";

export const dynamic = "force-dynamic";

const STATUS_COLORS: Record<string, string> = {
  Scheduled: "bg-slate-100 text-slate-700",
  "Picked Up": "bg-blue-100 text-blue-700",
  "In Transit": "bg-purple-100 text-purple-700",
  Delivered: "bg-emerald-100 text-emerald-700",
  Returned: "bg-red-100 text-red-700",
};

export default async function ShipmentsPage() {
  let rows: Array<{
    id: string; quantityUnits: number; carrier: string | null; trackingNumber: string | null;
    shipDate: string | null; deliveredDate: string | null; status: string;
    poNumber: string | null; customerName: string | null; lotNumber: string | null;
  }> = [];
  try {
    rows = await db
      .select({
        id: shipments.id,
        quantityUnits: shipments.quantityUnits,
        carrier: shipments.carrier,
        trackingNumber: shipments.trackingNumber,
        shipDate: shipments.shipDate,
        deliveredDate: shipments.deliveredDate,
        status: shipments.status,
        poNumber: purchaseOrders.poNumber,
        customerName: customers.companyName,
        lotNumber: finishedProductLots.lotNumber,
      })
      .from(shipments)
      .leftJoin(purchaseOrders, eq(purchaseOrders.id, shipments.purchaseOrderId))
      .leftJoin(customers, eq(customers.id, purchaseOrders.customerId))
      .leftJoin(finishedProductLots, eq(finishedProductLots.id, shipments.finishedProductLotId))
      .orderBy(desc(shipments.createdAt))
      .limit(100);
  } catch {}

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Shipments</h1>
          <p className="text-xs text-slate-500 mt-0.5">{rows.length} shipment{rows.length !== 1 && "s"}</p>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-lg p-16 text-center shadow-sm">
          <Truck className="h-12 w-12 text-slate-200 mx-auto mb-3" />
          <p className="text-sm text-slate-600 font-medium">No shipments yet.</p>
          <p className="text-xs text-slate-400 mt-1">Create one from a Purchase Order detail page.</p>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-xs text-slate-600">
                <th className="text-left px-4 py-2 font-semibold">PO</th>
                <th className="text-left px-4 py-2 font-semibold">Customer</th>
                <th className="text-left px-4 py-2 font-semibold">Lot</th>
                <th className="text-right px-4 py-2 font-semibold">Units</th>
                <th className="text-left px-4 py-2 font-semibold">Carrier</th>
                <th className="text-left px-4 py-2 font-semibold">Tracking</th>
                <th className="text-left px-4 py-2 font-semibold">Status</th>
                <th className="text-left px-4 py-2 font-semibold">Ship Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 tabular-nums">
              {rows.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50/50">
                  <td className="px-4 py-2.5 font-mono text-xs">
                    <Link href={`/shipments/${r.id}`} className="text-slate-900 hover:text-[#d10a11]">{r.poNumber ?? "—"}</Link>
                  </td>
                  <td className="px-4 py-2.5 text-slate-700">{r.customerName ?? "—"}</td>
                  <td className="px-4 py-2.5 font-mono text-xs text-slate-700">{r.lotNumber ?? "—"}</td>
                  <td className="px-4 py-2.5 text-right">{r.quantityUnits.toLocaleString()}</td>
                  <td className="px-4 py-2.5 text-slate-700">{r.carrier ?? "—"}</td>
                  <td className="px-4 py-2.5 font-mono text-xs text-slate-700">{r.trackingNumber ?? "—"}</td>
                  <td className="px-4 py-2.5">
                    <span className={`inline-block px-2 py-0.5 text-xs font-medium rounded-full ${STATUS_COLORS[r.status] ?? STATUS_COLORS.Scheduled}`}>
                      {r.status}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-slate-500 text-xs">{r.shipDate ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
