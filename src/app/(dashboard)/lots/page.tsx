import { db } from "@/lib/db";
import { finishedProductLots, formulations } from "@/lib/db/schema";
import { desc, eq } from "drizzle-orm";
import Link from "next/link";
import { Package } from "lucide-react";

export const dynamic = "force-dynamic";

const STATUS_COLORS: Record<string, string> = {
  "In QC": "bg-yellow-100 text-yellow-700",
  Released: "bg-emerald-100 text-emerald-700",
  Shipped: "bg-indigo-100 text-indigo-700",
  Recalled: "bg-red-100 text-red-700",
};

export default async function LotsPage() {
  let rows: Array<{ id: string; lotNumber: string; productCode: string | null; quantityUnits: number; manufacturingDate: string; expirationDate: string | null; status: string; formulationName: string | null }> = [];
  try {
    rows = await db
      .select({
        id: finishedProductLots.id,
        lotNumber: finishedProductLots.lotNumber,
        productCode: finishedProductLots.productCode,
        quantityUnits: finishedProductLots.quantityUnits,
        manufacturingDate: finishedProductLots.manufacturingDate,
        expirationDate: finishedProductLots.expirationDate,
        status: finishedProductLots.status,
        formulationName: formulations.name,
      })
      .from(finishedProductLots)
      .leftJoin(formulations, eq(formulations.id, finishedProductLots.formulationId))
      .orderBy(desc(finishedProductLots.createdAt))
      .limit(100);
  } catch {}

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Finished Product Lots</h1>
          <p className="text-xs text-slate-500 mt-0.5">{rows.length} lot{rows.length !== 1 && "s"}</p>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-lg p-16 text-center shadow-sm">
          <Package className="h-12 w-12 text-slate-200 mx-auto mb-3" />
          <p className="text-sm text-slate-600 font-medium">No finished product lots yet.</p>
          <p className="text-xs text-slate-400 mt-1">Complete a production run and create a lot from the batch detail page.</p>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-xs text-slate-600">
                <th className="text-left px-4 py-2 font-semibold">Lot #</th>
                <th className="text-left px-4 py-2 font-semibold">Product Code</th>
                <th className="text-left px-4 py-2 font-semibold">Formulation</th>
                <th className="text-right px-4 py-2 font-semibold">Bottles</th>
                <th className="text-left px-4 py-2 font-semibold">Mfg Date</th>
                <th className="text-left px-4 py-2 font-semibold">Exp Date</th>
                <th className="text-left px-4 py-2 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 tabular-nums">
              {rows.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50/50">
                  <td className="px-4 py-2.5">
                    <Link href={`/lots/${r.id}`} className="font-mono font-semibold text-slate-900 hover:text-[#d10a11]">{r.lotNumber}</Link>
                  </td>
                  <td className="px-4 py-2.5 font-mono text-xs text-slate-700">{r.productCode ?? "—"}</td>
                  <td className="px-4 py-2.5 text-slate-700">{r.formulationName ?? "—"}</td>
                  <td className="px-4 py-2.5 text-right">{r.quantityUnits.toLocaleString()}</td>
                  <td className="px-4 py-2.5 text-slate-600 text-xs">{r.manufacturingDate}</td>
                  <td className="px-4 py-2.5 text-slate-600 text-xs">{r.expirationDate ?? "—"}</td>
                  <td className="px-4 py-2.5">
                    <span className={`inline-block px-2 py-0.5 text-xs font-medium rounded-full ${STATUS_COLORS[r.status] ?? STATUS_COLORS["In QC"]}`}>
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
