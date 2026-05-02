import { db } from "@/lib/db";
import { formulations, formulationIngredients, ingredients, customers, rfqs } from "@/lib/db/schema";
import { asc, eq } from "drizzle-orm";
import Link from "next/link";
import { FlaskConical, FileDown, ChevronLeft } from "lucide-react";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

const STATUS_COLORS: Record<string, string> = {
  Draft: "bg-blue-100 text-blue-700",
  "In Review": "bg-yellow-100 text-yellow-700",
  Locked: "bg-emerald-100 text-emerald-700",
};

export default async function FormulationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const [f] = await db.select().from(formulations).where(eq(formulations.id, id)).limit(1);
  if (!f) notFound();

  const lines = await db
    .select({
      line: formulationIngredients,
      ingredient: ingredients,
    })
    .from(formulationIngredients)
    .leftJoin(ingredients, eq(ingredients.id, formulationIngredients.ingredientId))
    .where(eq(formulationIngredients.formulationId, id))
    .orderBy(asc(formulationIngredients.sortOrder));

  const [customer] = f.customerId
    ? await db.select().from(customers).where(eq(customers.id, f.customerId)).limit(1)
    : [null];

  const [linkedRfq] = await db.select({ rfqNumber: rfqs.rfqNumber, id: rfqs.id }).from(rfqs).where(eq(rfqs.formulationId, id)).limit(1);

  const actives = lines.filter((l) => !l.line.isExcipient);
  const excipients = lines.filter((l) => l.line.isExcipient);
  const totalRmCost = lines.reduce((sum, l) => sum + parseFloat(l.line.lineCost), 0);

  return (
    <div className="max-w-5xl mx-auto pb-12">
      <div className="mb-4">
        <Link href="/formulations" className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700">
          <ChevronLeft className="h-3.5 w-3.5" /> Back to The Lab
        </Link>
      </div>

      <div className="flex items-start justify-between mb-5">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <FlaskConical className="h-5 w-5 text-[#d10a11]" />
            {f.name}
          </h1>
          <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
            <span className={`inline-block px-2 py-0.5 text-xs font-medium rounded-full ${STATUS_COLORS[f.status] ?? STATUS_COLORS.Draft}`}>
              {f.status}
            </span>
            {linkedRfq && (
              <span>
                from <Link href={`/intake`} className="font-mono text-slate-700 hover:text-[#d10a11]">{linkedRfq.rfqNumber}</Link>
              </span>
            )}
            {customer && <span>· {customer.companyName}</span>}
          </div>
        </div>
        <Link
          href={`/quotes/new?formulationId=${id}`}
          className="inline-flex items-center gap-2 px-4 py-2 bg-[#d10a11] hover:bg-[#a30a0f] text-white text-sm font-semibold rounded-md"
        >
          <FileDown className="h-4 w-4" /> Generate Quote
        </Link>
      </div>

      {/* Sizing summary */}
      <section className="bg-white border border-slate-200 rounded-lg p-5 mb-4 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-800 mb-3">Bench Specs</h2>
        <dl className="grid grid-cols-4 gap-y-3 gap-x-6 text-sm">
          <div>
            <dt className="text-xs text-slate-500 uppercase tracking-wide">Format</dt>
            <dd className="text-slate-900 mt-0.5">{f.dosageForm}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500 uppercase tracking-wide">Capsule Size</dt>
            <dd className="text-slate-900 font-semibold mt-0.5">{f.capsuleSize ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500 uppercase tracking-wide">Caps/Serving</dt>
            <dd className="text-slate-900 mt-0.5">{f.capsulesPerServing}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500 uppercase tracking-wide">Servings/Bottle</dt>
            <dd className="text-slate-900 mt-0.5">{f.servingsPerContainer ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500 uppercase tracking-wide">Total Fill</dt>
            <dd className="text-slate-900 font-mono tabular-nums mt-0.5">{f.totalFillMg ? `${parseFloat(f.totalFillMg).toFixed(1)} mg` : "—"}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500 uppercase tracking-wide">Fill %</dt>
            <dd className="text-slate-900 font-mono tabular-nums mt-0.5">{f.fillPercentage ? `${parseFloat(f.fillPercentage).toFixed(1)}%` : "—"}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500 uppercase tracking-wide">Complexity</dt>
            <dd className="text-slate-900 mt-0.5">{f.excipientComplexity}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500 uppercase tracking-wide">RM Cost / Unit</dt>
            <dd className="text-slate-900 font-mono tabular-nums mt-0.5">${totalRmCost.toFixed(4)}</dd>
          </div>
        </dl>
      </section>

      {/* Actives */}
      <section className="bg-white border border-slate-200 rounded-lg overflow-hidden mb-4 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-800 px-5 py-3 border-b border-slate-200 bg-slate-50">Active Ingredients ({actives.length})</h2>
        <table className="w-full text-xs">
          <thead className="text-slate-500 bg-slate-50">
            <tr>
              <th className="text-left px-4 py-2 font-medium">RM #</th>
              <th className="text-left px-4 py-2 font-medium">Ingredient</th>
              <th className="text-right px-4 py-2 font-medium">Label Claim</th>
              <th className="text-right px-4 py-2 font-medium">Active %</th>
              <th className="text-right px-4 py-2 font-medium">Adjusted</th>
              <th className="text-right px-4 py-2 font-medium">Overage %</th>
              <th className="text-right px-4 py-2 font-medium">Final mg</th>
              <th className="text-right px-4 py-2 font-medium">$/Kg</th>
              <th className="text-right px-4 py-2 font-medium">Cost</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {actives.map((l) => (
              <tr key={l.line.id}>
                <td className="px-4 py-2 font-mono text-slate-700">{l.ingredient?.rmId ?? "—"}</td>
                <td className="px-4 py-2 text-slate-900">{l.ingredient?.name ?? "Ad-hoc ingredient"}</td>
                <td className="px-4 py-2 text-right tabular-nums">{parseFloat(l.line.labelClaimMg).toFixed(2)} mg</td>
                <td className="px-4 py-2 text-right tabular-nums text-slate-600">{parseFloat(l.line.activeContentPct).toFixed(1)}%</td>
                <td className="px-4 py-2 text-right tabular-nums">{parseFloat(l.line.adjustedMg).toFixed(2)}</td>
                <td className="px-4 py-2 text-right tabular-nums text-slate-600">{parseFloat(l.line.overagePct).toFixed(1)}%</td>
                <td className="px-4 py-2 text-right tabular-nums font-medium">{parseFloat(l.line.finalMg).toFixed(2)}</td>
                <td className="px-4 py-2 text-right tabular-nums text-slate-700">${parseFloat(l.line.costPerKg).toFixed(2)}</td>
                <td className="px-4 py-2 text-right tabular-nums font-mono">${parseFloat(l.line.lineCost).toFixed(4)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* Excipients */}
      {excipients.length > 0 && (
        <section className="bg-white border border-slate-200 rounded-lg overflow-hidden mb-4 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-800 px-5 py-3 border-b border-slate-200 bg-slate-50">Excipients ({excipients.length})</h2>
          <table className="w-full text-xs">
            <thead className="text-slate-500 bg-slate-50">
              <tr>
                <th className="text-left px-4 py-2 font-medium">Ingredient</th>
                <th className="text-right px-4 py-2 font-medium">mg / serving</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {excipients.map((l) => (
                <tr key={l.line.id}>
                  <td className="px-4 py-2 text-slate-900">{l.ingredient?.name ?? "—"}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{parseFloat(l.line.finalMg).toFixed(2)} mg</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {/* Danny notes */}
      {f.notes && (
        <section className="bg-white border border-slate-200 rounded-lg p-5 mb-4 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-800 mb-3">Bench Notes</h2>
          <pre className="text-xs text-slate-700 whitespace-pre-wrap font-mono leading-relaxed bg-slate-50 border border-slate-200 rounded-md p-4 max-h-[500px] overflow-y-auto">{f.notes}</pre>
        </section>
      )}
    </div>
  );
}
