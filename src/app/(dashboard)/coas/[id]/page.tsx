import { db } from "@/lib/db";
import { finishedProductCoas, coaTestResults, finishedProductLots, formulations } from "@/lib/db/schema";
import { eq, asc } from "drizzle-orm";
import Link from "next/link";
import { FileCheck, ChevronLeft, Package } from "lucide-react";
import { notFound } from "next/navigation";
import { CoaEditor } from "./editor";

export const dynamic = "force-dynamic";

const DISP_COLORS: Record<string, string> = {
  "Approved for Release": "bg-emerald-100 text-emerald-700",
  Quarantine: "bg-amber-100 text-amber-700",
  Reject: "bg-red-100 text-red-700",
};

export default async function CoaDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [coa] = await db.select().from(finishedProductCoas).where(eq(finishedProductCoas.id, id)).limit(1);
  if (!coa) notFound();

  const [lot] = await db.select().from(finishedProductLots).where(eq(finishedProductLots.id, coa.finishedProductLotId)).limit(1);
  const [formulation] = lot ? await db.select().from(formulations).where(eq(formulations.id, lot.formulationId)).limit(1) : [null];
  const tests = await db.select().from(coaTestResults).where(eq(coaTestResults.coaId, id)).orderBy(asc(coaTestResults.sortOrder));

  return (
    <div className="max-w-6xl mx-auto pb-24">
      <div className="mb-3">
        <Link href="/coas" className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700">
          <ChevronLeft className="h-3.5 w-3.5" /> Back to COAs
        </Link>
      </div>

      <div className="flex items-start justify-between mb-5">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <FileCheck className="h-5 w-5 text-[#d10a11]" />
            <code className="font-mono text-base">{coa.coaNumber}</code>
          </h1>
          <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
            <span className={`inline-block px-2 py-0.5 text-xs font-medium rounded-full ${DISP_COLORS[coa.disposition] ?? DISP_COLORS["Approved for Release"]}`}>
              {coa.disposition}
            </span>
            <span>Rev {coa.revision}</span>
            {lot && (
              <span>
                · <Link href={`/lots/${lot.id}`} className="font-mono text-slate-700 hover:text-[#d10a11]">
                  <Package className="h-3 w-3 inline mr-1" />{lot.lotNumber}
                </Link>
              </span>
            )}
            {formulation && <span>· {formulation.name}</span>}
            {lot && (
              <>
                <span>· Mfg: {lot.manufacturingDate}</span>
                {lot.expirationDate && <span>· Exp: {lot.expirationDate}</span>}
              </>
            )}
          </div>
        </div>
      </div>

      <CoaEditor
        coa={{
          id: coa.id,
          coaNumber: coa.coaNumber,
          disposition: coa.disposition,
          qcAnalyst: coa.qcAnalyst,
          qcAnalystSignatureDate: coa.qcAnalystSignatureDate,
          qcManager: coa.qcManager,
          qcManagerSignatureDate: coa.qcManagerSignatureDate,
          qaRelease: coa.qaRelease,
          qaReleaseSignatureDate: coa.qaReleaseSignatureDate,
          labSampleId: coa.labSampleId,
          notes: coa.notes,
        }}
        tests={tests.map((t) => ({
          id: t.id,
          category: t.category,
          testName: t.testName,
          specification: t.specification,
          result: t.result,
          pctOfLabelClaim: t.pctOfLabelClaim,
          method: t.method,
          status: t.status,
          sortOrder: t.sortOrder,
        }))}
      />
    </div>
  );
}
