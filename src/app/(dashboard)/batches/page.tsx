import { db } from "@/lib/db";
import { productionRuns, formulations, purchaseOrders } from "@/lib/db/schema";
import { desc, eq } from "drizzle-orm";
import Link from "next/link";
import { Factory } from "lucide-react";

export const dynamic = "force-dynamic";

const STATUS_COLORS: Record<string, string> = {
  Scheduled: "bg-slate-100 text-slate-700",
  Blending: "bg-yellow-100 text-yellow-700",
  Encapsulating: "bg-purple-100 text-purple-700",
  Packaging: "bg-blue-100 text-blue-700",
  Complete: "bg-emerald-100 text-emerald-700",
  "On Hold": "bg-amber-100 text-amber-700",
};

export default async function BatchesPage() {
  let rows: Array<{ id: string; batchNumber: string; targetBatchSize: number; actualBatchSize: number | null; status: string; startDate: string | null; completionDate: string | null; formulationName: string | null; poNumber: string | null }> = [];
  try {
    rows = await db
      .select({
        id: productionRuns.id,
        batchNumber: productionRuns.batchNumber,
        targetBatchSize: productionRuns.targetBatchSize,
        actualBatchSize: productionRuns.actualBatchSize,
        status: productionRuns.status,
        startDate: productionRuns.startDate,
        completionDate: productionRuns.completionDate,
        formulationName: formulations.name,
        poNumber: purchaseOrders.poNumber,
      })
      .from(productionRuns)
      .leftJoin(formulations, eq(formulations.id, productionRuns.formulationId))
      .leftJoin(purchaseOrders, eq(purchaseOrders.id, productionRuns.purchaseOrderId))
      .orderBy(desc(productionRuns.createdAt))
      .limit(100);
  } catch {}

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Production Runs</h1>
          <p className="text-xs text-slate-500 mt-0.5">{rows.length} batch{rows.length !== 1 && "es"}</p>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-lg p-16 text-center shadow-sm">
          <Factory className="h-12 w-12 text-slate-200 mx-auto mb-3" />
          <p className="text-sm text-slate-600 font-medium">No production runs yet.</p>
          <p className="text-xs text-slate-400 mt-1">Start one from a Purchase Order detail page.</p>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-xs text-slate-600">
                <th className="text-left px-4 py-2 font-semibold">Batch #</th>
                <th className="text-left px-4 py-2 font-semibold">Formulation</th>
                <th className="text-left px-4 py-2 font-semibold">From PO</th>
                <th className="text-right px-4 py-2 font-semibold">Target Size</th>
                <th className="text-right px-4 py-2 font-semibold">Actual</th>
                <th className="text-left px-4 py-2 font-semibold">Status</th>
                <th className="text-left px-4 py-2 font-semibold">Start</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 tabular-nums">
              {rows.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50/50">
                  <td className="px-4 py-2.5">
                    <Link href={`/batches/${r.id}`} className="font-mono font-semibold text-slate-900 hover:text-[#d10a11]">{r.batchNumber}</Link>
                  </td>
                  <td className="px-4 py-2.5 text-slate-700">{r.formulationName ?? "—"}</td>
                  <td className="px-4 py-2.5 text-slate-700 font-mono text-xs">{r.poNumber ?? "—"}</td>
                  <td className="px-4 py-2.5 text-right">{r.targetBatchSize.toLocaleString()}</td>
                  <td className="px-4 py-2.5 text-right">{r.actualBatchSize ? r.actualBatchSize.toLocaleString() : "—"}</td>
                  <td className="px-4 py-2.5">
                    <span className={`inline-block px-2 py-0.5 text-xs font-medium rounded-full ${STATUS_COLORS[r.status] ?? STATUS_COLORS.Scheduled}`}>
                      {r.status}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-slate-500 text-xs">{r.startDate ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
