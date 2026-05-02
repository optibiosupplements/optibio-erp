import { db } from "@/lib/db";
import { productionRuns, formulations, purchaseOrders, finishedProductLots } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import Link from "next/link";
import { Factory, ChevronLeft, FlaskConical } from "lucide-react";
import { notFound } from "next/navigation";
import { CreateLotButton, AdvanceStatusButtons } from "./actions";

export const dynamic = "force-dynamic";

const STATUS_COLORS: Record<string, string> = {
  Scheduled: "bg-slate-100 text-slate-700",
  Blending: "bg-yellow-100 text-yellow-700",
  Encapsulating: "bg-purple-100 text-purple-700",
  Packaging: "bg-blue-100 text-blue-700",
  Complete: "bg-emerald-100 text-emerald-700",
  "On Hold": "bg-amber-100 text-amber-700",
};

export default async function BatchDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [run] = await db.select().from(productionRuns).where(eq(productionRuns.id, id)).limit(1);
  if (!run) notFound();

  const [formulation] = run.formulationId ? await db.select().from(formulations).where(eq(formulations.id, run.formulationId)).limit(1) : [null];
  const [po] = run.purchaseOrderId ? await db.select().from(purchaseOrders).where(eq(purchaseOrders.id, run.purchaseOrderId)).limit(1) : [null];
  const lots = await db.select().from(finishedProductLots).where(eq(finishedProductLots.productionRunId, id));

  const canCreateLot = run.status === "Complete" && lots.length === 0;

  return (
    <div className="max-w-5xl mx-auto pb-12">
      <div className="mb-3">
        <Link href="/batches" className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700">
          <ChevronLeft className="h-3.5 w-3.5" /> Back to Batches
        </Link>
      </div>

      <div className="flex items-start justify-between mb-5">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Factory className="h-5 w-5 text-[#d10a11]" />
            <code className="font-mono text-base">{run.batchNumber}</code>
          </h1>
          <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
            <span className={`inline-block px-2 py-0.5 text-xs font-medium rounded-full ${STATUS_COLORS[run.status] ?? STATUS_COLORS.Scheduled}`}>
              {run.status}
            </span>
            {formulation && <span>· <Link href={`/formulations/${formulation.id}`} className="text-slate-700 hover:text-[#d10a11]"><FlaskConical className="h-3 w-3 inline mr-1" />{formulation.name}</Link></span>}
            {po && <span>· from <Link href={`/orders/${po.id}`} className="font-mono text-slate-700 hover:text-[#d10a11]">{po.poNumber}</Link></span>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <AdvanceStatusButtons batchId={id} currentStatus={run.status} targetBatchSize={run.targetBatchSize} actualBatchSize={run.actualBatchSize} />
          {canCreateLot && <CreateLotButton batchId={id} defaultUnits={run.actualBatchSize ?? Math.floor(run.targetBatchSize / (formulation?.capsulesPerServing ?? 1) / (formulation?.servingsPerContainer ?? 60))} />}
        </div>
      </div>

      <section className="bg-white border border-slate-200 rounded-lg p-5 mb-4 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-800 mb-3">Run Details</h2>
        <dl className="grid grid-cols-4 gap-y-3 gap-x-6 text-sm">
          <div>
            <dt className="text-xs text-slate-500 uppercase tracking-wide">Target Size (caps)</dt>
            <dd className="text-slate-900 mt-0.5 font-mono tabular-nums">{run.targetBatchSize.toLocaleString()}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500 uppercase tracking-wide">Actual</dt>
            <dd className="text-slate-900 mt-0.5 font-mono tabular-nums">{run.actualBatchSize?.toLocaleString() ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500 uppercase tracking-wide">Start</dt>
            <dd className="text-slate-900 mt-0.5">{run.startDate ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500 uppercase tracking-wide">Complete</dt>
            <dd className="text-slate-900 mt-0.5">{run.completionDate ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500 uppercase tracking-wide">Lead QC Analyst</dt>
            <dd className="text-slate-900 mt-0.5">{run.leadQcAnalyst ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500 uppercase tracking-wide">Release QA</dt>
            <dd className="text-slate-900 mt-0.5">{run.releaseQaManager ?? "—"}</dd>
          </div>
          <div className="col-span-2">
            <dt className="text-xs text-slate-500 uppercase tracking-wide">Manufacturing Site</dt>
            <dd className="text-slate-900 mt-0.5 text-xs">{run.manufacturingSite ?? "—"}</dd>
          </div>
          <div className="col-span-4">
            <dt className="text-xs text-slate-500 uppercase tracking-wide">Notes</dt>
            <dd className="text-slate-700 mt-0.5">{run.notes ?? "—"}</dd>
          </div>
        </dl>
      </section>

      {lots.length > 0 && (
        <section className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm">
          <h2 className="text-sm font-semibold text-slate-800 px-5 py-3 border-b border-slate-200 bg-slate-50">Finished Product Lot{lots.length > 1 && "s"}</h2>
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs text-slate-600">
              <tr>
                <th className="text-left px-4 py-2 font-medium">Lot #</th>
                <th className="text-right px-4 py-2 font-medium">Units</th>
                <th className="text-left px-4 py-2 font-medium">Mfg Date</th>
                <th className="text-left px-4 py-2 font-medium">Exp Date</th>
                <th className="text-left px-4 py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 tabular-nums">
              {lots.map((l) => (
                <tr key={l.id}>
                  <td className="px-4 py-2"><Link href={`/lots/${l.id}`} className="font-mono font-semibold text-slate-900 hover:text-[#d10a11]">{l.lotNumber}</Link></td>
                  <td className="px-4 py-2 text-right">{l.quantityUnits.toLocaleString()}</td>
                  <td className="px-4 py-2">{l.manufacturingDate}</td>
                  <td className="px-4 py-2">{l.expirationDate ?? "—"}</td>
                  <td className="px-4 py-2"><span className="inline-block px-2 py-0.5 text-xs font-medium rounded-full bg-slate-100 text-slate-700">{l.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}
