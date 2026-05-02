import { db } from "@/lib/db";
import { finishedProductCoas, coaTestResults, finishedProductLots, formulations } from "@/lib/db/schema";
import { eq, asc } from "drizzle-orm";
import Link from "next/link";
import { FileCheck, ChevronLeft, FileSpreadsheet, Package } from "lucide-react";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

const DISP_COLORS: Record<string, string> = {
  "Approved for Release": "bg-emerald-100 text-emerald-700",
  Quarantine: "bg-amber-100 text-amber-700",
  Reject: "bg-red-100 text-red-700",
};

const STATUS_COLOR: Record<string, string> = {
  Pass: "text-emerald-700",
  Fail: "text-red-700",
  OOS: "text-amber-700",
};

export default async function CoaDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [coa] = await db.select().from(finishedProductCoas).where(eq(finishedProductCoas.id, id)).limit(1);
  if (!coa) notFound();

  const [lot] = await db.select().from(finishedProductLots).where(eq(finishedProductLots.id, coa.finishedProductLotId)).limit(1);
  const [formulation] = lot ? await db.select().from(formulations).where(eq(formulations.id, lot.formulationId)).limit(1) : [null];
  const tests = await db.select().from(coaTestResults).where(eq(coaTestResults.coaId, id)).orderBy(asc(coaTestResults.sortOrder));

  const physical = tests.filter((t) => t.category === "Physical");
  const potency = tests.filter((t) => t.category === "Potency");
  const microbial = tests.filter((t) => t.category === "Microbial");
  const heavyMetals = tests.filter((t) => t.category === "Heavy Metal");

  return (
    <div className="max-w-6xl mx-auto pb-12">
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
            {lot && <span>· <Link href={`/lots/${lot.id}`} className="font-mono text-slate-700 hover:text-[#d10a11]"><Package className="h-3 w-3 inline mr-1" />{lot.lotNumber}</Link></span>}
            {formulation && <span>· {formulation.name}</span>}
          </div>
        </div>
        <a
          href={`/api/coas/${id}/xlsx`}
          className="inline-flex items-center gap-2 px-4 py-2 bg-[#d10a11] hover:bg-[#a30a0f] text-white text-sm font-semibold rounded-md"
        >
          <FileSpreadsheet className="h-4 w-4" /> Download Excel
        </a>
      </div>

      <section className="bg-white border border-slate-200 rounded-lg p-5 mb-4 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-800 mb-3">Approval Signatures</h2>
        <dl className="grid grid-cols-3 gap-y-3 gap-x-6 text-sm">
          <div>
            <dt className="text-xs text-slate-500 uppercase tracking-wide">QC Analyst</dt>
            <dd className="text-slate-900 mt-0.5">{coa.qcAnalyst ?? "—"}</dd>
            <dd className="text-xs text-slate-500">{coa.qcAnalystSignatureDate ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500 uppercase tracking-wide">QC Manager</dt>
            <dd className="text-slate-900 mt-0.5">{coa.qcManager ?? "—"}</dd>
            <dd className="text-xs text-slate-500">{coa.qcManagerSignatureDate ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500 uppercase tracking-wide">QA Release</dt>
            <dd className="text-slate-900 mt-0.5">{coa.qaRelease ?? "—"}</dd>
            <dd className="text-xs text-slate-500">{coa.qaReleaseSignatureDate ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500 uppercase tracking-wide">Lab Sample ID</dt>
            <dd className="text-slate-900 mt-0.5 font-mono text-xs">{coa.labSampleId ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500 uppercase tracking-wide">Testing Lab</dt>
            <dd className="text-slate-900 mt-0.5 text-xs">{coa.testingLab ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500 uppercase tracking-wide">Accreditation</dt>
            <dd className="text-slate-900 mt-0.5 text-xs">{coa.labAccreditation ?? "—"}</dd>
          </div>
        </dl>
      </section>

      {[
        { title: "Physical Specifications", rows: physical, cols: ["Test", "Specification", "Result", "Method", "Status"] },
        { title: `Potency Analysis — Per Serving (21 CFR 101.9(g)(4)(i))`, rows: potency, cols: ["Dietary Ingredient", "Specification Range", "Result", "% LC", "Method", "Status"] },
        { title: "Microbial Analysis", rows: microbial, cols: ["Test", "Specification", "Result", "Method", "Status"] },
        { title: "Heavy Metal Analysis (Per Daily Dose)", rows: heavyMetals, cols: ["Metal", "Specification", "Result", "Method", "Status"] },
      ].map((section) => section.rows.length > 0 && (
        <section key={section.title} className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm mb-4">
          <h2 className="text-sm font-semibold text-slate-800 px-5 py-3 border-b border-slate-200 bg-slate-50">{section.title}</h2>
          <table className="w-full text-xs">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                {section.cols.map((c) => <th key={c} className="text-left px-4 py-2 font-medium">{c}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {section.rows.map((t) => (
                <tr key={t.id}>
                  <td className="px-4 py-2 text-slate-900">{t.testName}</td>
                  <td className="px-4 py-2 text-slate-700">{t.specification}</td>
                  <td className="px-4 py-2 text-slate-900 font-medium">{t.result}</td>
                  {section.title.startsWith("Potency") && <td className="px-4 py-2 text-slate-600 tabular-nums">{t.pctOfLabelClaim ? `${parseFloat(t.pctOfLabelClaim).toFixed(1)}%` : "—"}</td>}
                  <td className="px-4 py-2 text-slate-600">{t.method}</td>
                  <td className={`px-4 py-2 font-semibold ${STATUS_COLOR[t.status] ?? "text-slate-700"}`}>{t.status === "Pass" ? "✓ PASS" : t.status === "Fail" ? "✗ FAIL" : t.status === "OOS" ? "⚠ OOS" : t.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ))}

      {tests.some((t) => t.result === "TBD") && (
        <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-3 py-2 mt-4">
          ⚠ This COA has tests showing TBD — fill in actual results via the API (PATCH `/api/coas/{coa.id}` with a `tests` array) before signing release.
        </p>
      )}
    </div>
  );
}
