import { db } from "@/lib/db";
import { finishedProductLots, formulations, productionRuns, finishedProductCoas } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import Link from "next/link";
import { Package, ChevronLeft, FlaskConical, Factory, FileCheck } from "lucide-react";
import { notFound } from "next/navigation";
import { GenerateCoaButton } from "./actions";

export const dynamic = "force-dynamic";

const STATUS_COLORS: Record<string, string> = {
  "In QC": "bg-yellow-100 text-yellow-700",
  Released: "bg-emerald-100 text-emerald-700",
  Shipped: "bg-indigo-100 text-indigo-700",
  Recalled: "bg-red-100 text-red-700",
};

export default async function LotDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [lot] = await db.select().from(finishedProductLots).where(eq(finishedProductLots.id, id)).limit(1);
  if (!lot) notFound();

  const [formulation] = await db.select().from(formulations).where(eq(formulations.id, lot.formulationId)).limit(1);
  const [run] = lot.productionRunId ? await db.select().from(productionRuns).where(eq(productionRuns.id, lot.productionRunId)).limit(1) : [null];
  const coas = await db.select().from(finishedProductCoas).where(eq(finishedProductCoas.finishedProductLotId, id)).orderBy(desc(finishedProductCoas.createdAt));

  return (
    <div className="max-w-5xl mx-auto pb-12">
      <div className="mb-3">
        <Link href="/lots" className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700">
          <ChevronLeft className="h-3.5 w-3.5" /> Back to Lots
        </Link>
      </div>

      <div className="flex items-start justify-between mb-5">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Package className="h-5 w-5 text-[#d10a11]" />
            <code className="font-mono text-base">{lot.lotNumber}</code>
          </h1>
          <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
            <span className={`inline-block px-2 py-0.5 text-xs font-medium rounded-full ${STATUS_COLORS[lot.status] ?? STATUS_COLORS["In QC"]}`}>
              {lot.status}
            </span>
            {lot.productCode && <span>· <code className="font-mono text-slate-700">{lot.productCode}</code></span>}
            {formulation && <span>· <Link href={`/formulations/${formulation.id}`} className="text-slate-700 hover:text-[#d10a11]"><FlaskConical className="h-3 w-3 inline mr-1" />{formulation.name}</Link></span>}
            {run && <span>· from <Link href={`/batches/${run.id}`} className="font-mono text-slate-700 hover:text-[#d10a11]"><Factory className="h-3 w-3 inline mr-0.5" />{run.batchNumber}</Link></span>}
          </div>
        </div>
        <GenerateCoaButton lotId={id} hasCoa={coas.length > 0} />
      </div>

      <section className="bg-white border border-slate-200 rounded-lg p-5 mb-4 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-800 mb-3">Lot Details</h2>
        <dl className="grid grid-cols-4 gap-y-3 gap-x-6 text-sm">
          <div>
            <dt className="text-xs text-slate-500 uppercase tracking-wide">Bottles</dt>
            <dd className="text-slate-900 mt-0.5 font-mono tabular-nums">{lot.quantityUnits.toLocaleString()}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500 uppercase tracking-wide">Manufacturing Date</dt>
            <dd className="text-slate-900 mt-0.5">{lot.manufacturingDate}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500 uppercase tracking-wide">Expiration Date</dt>
            <dd className="text-slate-900 mt-0.5">{lot.expirationDate ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500 uppercase tracking-wide">Stability Protocol</dt>
            <dd className="text-slate-900 mt-0.5 font-mono text-xs">{lot.stabilityProtocol ?? "—"}</dd>
          </div>
          <div className="col-span-4">
            <dt className="text-xs text-slate-500 uppercase tracking-wide">Notes</dt>
            <dd className="text-slate-700 mt-0.5">{lot.notes ?? "—"}</dd>
          </div>
        </dl>
      </section>

      {coas.length > 0 && (
        <section className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm">
          <h2 className="text-sm font-semibold text-slate-800 px-5 py-3 border-b border-slate-200 bg-slate-50">Certificate{coas.length > 1 && "s"} of Analysis</h2>
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs text-slate-600">
              <tr>
                <th className="text-left px-4 py-2 font-medium">COA #</th>
                <th className="text-left px-4 py-2 font-medium">Disposition</th>
                <th className="text-left px-4 py-2 font-medium">Rev</th>
                <th className="text-left px-4 py-2 font-medium">Released By</th>
                <th className="text-left px-4 py-2 font-medium">Created</th>
                <th className="text-right px-4 py-2 font-medium"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {coas.map((c) => (
                <tr key={c.id}>
                  <td className="px-4 py-2"><Link href={`/coas/${c.id}`} className="font-mono font-semibold text-slate-900 hover:text-[#d10a11]"><FileCheck className="h-3 w-3 inline mr-1" />{c.coaNumber}</Link></td>
                  <td className="px-4 py-2 text-slate-700">{c.disposition}</td>
                  <td className="px-4 py-2 text-slate-700">{c.revision}</td>
                  <td className="px-4 py-2 text-slate-700">{c.qaRelease ?? "—"}</td>
                  <td className="px-4 py-2 text-slate-500 text-xs">{new Date(c.createdAt).toLocaleDateString()}</td>
                  <td className="px-4 py-2 text-right">
                    <a href={`/api/coas/${c.id}/xlsx`} className="text-xs text-[#d10a11] hover:text-[#a30a0f] underline">Download Excel</a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}
