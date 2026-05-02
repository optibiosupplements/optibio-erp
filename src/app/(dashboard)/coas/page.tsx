import { db } from "@/lib/db";
import { finishedProductCoas, finishedProductLots } from "@/lib/db/schema";
import { desc, eq } from "drizzle-orm";
import Link from "next/link";
import { FileCheck } from "lucide-react";

export const dynamic = "force-dynamic";

const DISP_COLORS: Record<string, string> = {
  "Approved for Release": "bg-emerald-100 text-emerald-700",
  Quarantine: "bg-amber-100 text-amber-700",
  Reject: "bg-red-100 text-red-700",
};

export default async function CoasPage() {
  let rows: Array<{ id: string; coaNumber: string; revision: number; disposition: string; lotNumber: string | null; createdAt: Date }> = [];
  try {
    rows = await db
      .select({
        id: finishedProductCoas.id,
        coaNumber: finishedProductCoas.coaNumber,
        revision: finishedProductCoas.revision,
        disposition: finishedProductCoas.disposition,
        lotNumber: finishedProductLots.lotNumber,
        createdAt: finishedProductCoas.createdAt,
      })
      .from(finishedProductCoas)
      .leftJoin(finishedProductLots, eq(finishedProductLots.id, finishedProductCoas.finishedProductLotId))
      .orderBy(desc(finishedProductCoas.createdAt))
      .limit(100);
  } catch {}

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Certificates of Analysis</h1>
          <p className="text-xs text-slate-500 mt-0.5">{rows.length} COA{rows.length !== 1 && "s"}</p>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-lg p-16 text-center shadow-sm">
          <FileCheck className="h-12 w-12 text-slate-200 mx-auto mb-3" />
          <p className="text-sm text-slate-600 font-medium">No COAs yet.</p>
          <p className="text-xs text-slate-400 mt-1">Generate a COA from a Finished Product Lot detail page.</p>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-xs text-slate-600">
                <th className="text-left px-4 py-2 font-semibold">COA #</th>
                <th className="text-left px-4 py-2 font-semibold">Lot</th>
                <th className="text-left px-4 py-2 font-semibold">Rev</th>
                <th className="text-left px-4 py-2 font-semibold">Disposition</th>
                <th className="text-left px-4 py-2 font-semibold">Created</th>
                <th className="text-right px-4 py-2 font-semibold"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50/50">
                  <td className="px-4 py-2.5">
                    <Link href={`/coas/${r.id}`} className="font-mono font-semibold text-slate-900 hover:text-[#d10a11]">{r.coaNumber}</Link>
                  </td>
                  <td className="px-4 py-2.5 font-mono text-xs text-slate-700">{r.lotNumber ?? "—"}</td>
                  <td className="px-4 py-2.5 text-slate-700 tabular-nums">Rev {r.revision}</td>
                  <td className="px-4 py-2.5">
                    <span className={`inline-block px-2 py-0.5 text-xs font-medium rounded-full ${DISP_COLORS[r.disposition] ?? DISP_COLORS["Approved for Release"]}`}>
                      {r.disposition}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-slate-500 text-xs">{new Date(r.createdAt).toLocaleDateString()}</td>
                  <td className="px-4 py-2.5 text-right">
                    <a href={`/api/coas/${r.id}/xlsx`} className="text-xs text-[#d10a11] hover:text-[#a30a0f] underline">Download Excel</a>
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
