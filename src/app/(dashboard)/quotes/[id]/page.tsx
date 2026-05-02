import { db } from "@/lib/db";
import { quotes, quoteTiers, quoteLineItems, customers, formulations } from "@/lib/db/schema";
import { asc, eq } from "drizzle-orm";
import Link from "next/link";
import { FileSpreadsheet, FileText, ChevronLeft } from "lucide-react";
import { notFound } from "next/navigation";
import { AcceptQuoteButton } from "./accept-button";

export const dynamic = "force-dynamic";

const STATUS_COLORS: Record<string, string> = {
  Draft: "bg-blue-100 text-blue-700",
  Sent: "bg-indigo-100 text-indigo-700",
  Viewed: "bg-purple-100 text-purple-700",
  Accepted: "bg-emerald-100 text-emerald-700",
  Rejected: "bg-red-100 text-red-700",
  Expired: "bg-amber-100 text-amber-700",
};

function safeParseJSON(s: string | null): Record<string, unknown> {
  if (!s) return {};
  try {
    return JSON.parse(s);
  } catch {
    return {};
  }
}

export default async function QuoteDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const [q] = await db.select().from(quotes).where(eq(quotes.id, id)).limit(1);
  if (!q) notFound();

  const tiers = await db
    .select()
    .from(quoteTiers)
    .where(eq(quoteTiers.quoteId, id))
    .orderBy(asc(quoteTiers.tierQuantity));

  const firstTierLines = tiers.length > 0
    ? await db
        .select()
        .from(quoteLineItems)
        .where(eq(quoteLineItems.quoteTierId, tiers[0].id))
        .orderBy(asc(quoteLineItems.sortOrder))
    : [];

  const [customer] = q.customerId
    ? await db.select().from(customers).where(eq(customers.id, q.customerId)).limit(1)
    : [null];

  const [formulation] = q.formulationId
    ? await db.select().from(formulations).where(eq(formulations.id, q.formulationId)).limit(1)
    : [null];

  const meta = safeParseJSON(q.notes);

  return (
    <div className="max-w-6xl mx-auto pb-12">
      <div className="mb-3">
        <Link href="/quotes" className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700">
          <ChevronLeft className="h-3.5 w-3.5" /> Back to Quotes
        </Link>
      </div>

      <div className="flex items-start justify-between mb-5">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-[#d10a11]" />
            <code className="font-mono text-base">{q.quoteNumber}</code>
          </h1>
          <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
            <span className={`inline-block px-2 py-0.5 text-xs font-medium rounded-full ${STATUS_COLORS[q.status] ?? STATUS_COLORS.Draft}`}>
              {q.status}
            </span>
            {q.validUntil && <span>valid until {new Date(q.validUntil).toLocaleDateString()}</span>}
            {formulation && (
              <span>
                from <Link href={`/formulations/${formulation.id}`} className="text-slate-700 hover:text-[#d10a11]">{formulation.name}</Link>
              </span>
            )}
            {customer && <span>· {customer.companyName}</span>}
            {!customer && (meta.customerName as string) && <span>· {meta.customerName as string}</span>}
          </div>
        </div>
        <div className="flex gap-2 items-start">
          <AcceptQuoteButton
            quoteId={id}
            quoteStatus={q.status}
            tiers={tiers.map((t) => ({ tierQuantity: t.tierQuantity, pricePerUnit: parseFloat(t.pricePerUnit), marginPct: parseFloat(t.marginPct) }))}
          />
          <a
            href={`/api/quotes/${id}/xlsx`}
            className="inline-flex items-center gap-2 px-4 py-2 bg-[#d10a11] hover:bg-[#a30a0f] text-white text-sm font-semibold rounded-md"
          >
            <FileSpreadsheet className="h-4 w-4" /> Download Excel
          </a>
          <a
            href={`/api/quotes/${id}/pdf`}
            className="inline-flex items-center gap-2 px-4 py-2 border border-slate-300 hover:bg-slate-50 text-slate-700 text-sm font-medium rounded-md"
          >
            <FileText className="h-4 w-4" /> Download PDF
          </a>
        </div>
      </div>

      {/* Product summary */}
      <section className="bg-white border border-slate-200 rounded-lg p-5 mb-4 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-800 mb-3">Product</h2>
        <dl className="grid grid-cols-4 gap-y-3 gap-x-6 text-sm">
          <div>
            <dt className="text-xs text-slate-500 uppercase tracking-wide">Name</dt>
            <dd className="text-slate-900 mt-0.5">{(meta.productName as string) || formulation?.name || "—"}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500 uppercase tracking-wide">Format</dt>
            <dd className="text-slate-900 mt-0.5">{(meta.dosageForm as string) || formulation?.dosageForm || "—"}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500 uppercase tracking-wide">Serving</dt>
            <dd className="text-slate-900 mt-0.5">{(meta.servingSize as string) || "—"}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500 uppercase tracking-wide">Container</dt>
            <dd className="text-slate-900 mt-0.5">
              {(meta.containerCount as string) || formulation?.servingsPerContainer || "—"}
              {formulation?.servingsPerContainer ? "/bottle" : ""}
            </dd>
          </div>
        </dl>
      </section>

      {/* Tier prices */}
      <section className="bg-white border border-slate-200 rounded-lg overflow-hidden mb-4 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-800 px-5 py-3 border-b border-slate-200 bg-slate-50">Tiered Pricing</h2>
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs text-slate-600">
            <tr>
              <th className="text-right px-4 py-2 font-medium">Quantity</th>
              <th className="text-right px-4 py-2 font-medium">Margin %</th>
              <th className="text-right px-4 py-2 font-medium">RM</th>
              <th className="text-right px-4 py-2 font-medium">Mfg</th>
              <th className="text-right px-4 py-2 font-medium">Pkg</th>
              <th className="text-right px-4 py-2 font-medium">Overhead</th>
              <th className="text-right px-4 py-2 font-medium">COGS</th>
              <th className="text-right px-4 py-2 font-medium">Price / Unit</th>
              <th className="text-right px-4 py-2 font-medium">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 tabular-nums">
            {tiers.map((t) => (
              <tr key={t.id}>
                <td className="px-4 py-2 text-right font-medium">{t.tierQuantity.toLocaleString()}</td>
                <td className="px-4 py-2 text-right text-slate-600">{parseFloat(t.marginPct).toFixed(1)}%</td>
                <td className="px-4 py-2 text-right text-slate-600">${parseFloat(t.rawMaterialCost).toFixed(4)}</td>
                <td className="px-4 py-2 text-right text-slate-600">${parseFloat(t.manufacturingCost).toFixed(4)}</td>
                <td className="px-4 py-2 text-right text-slate-600">${parseFloat(t.packagingCost).toFixed(4)}</td>
                <td className="px-4 py-2 text-right text-slate-600">${parseFloat(t.overheadCost).toFixed(4)}</td>
                <td className="px-4 py-2 text-right font-medium text-slate-800">${parseFloat(t.cogsPerUnit).toFixed(4)}</td>
                <td className="px-4 py-2 text-right font-bold text-[#d10a11]">${parseFloat(t.pricePerUnit).toFixed(2)}</td>
                <td className="px-4 py-2 text-right text-slate-700">${parseFloat(t.totalBatchPrice).toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* Line items (first tier as canonical reference) */}
      {firstTierLines.length > 0 && (
        <section className="bg-white border border-slate-200 rounded-lg overflow-hidden mb-4 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-800 px-5 py-3 border-b border-slate-200 bg-slate-50">Line Items</h2>
          <table className="w-full text-xs">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="text-left px-4 py-2 font-medium">Type</th>
                <th className="text-left px-4 py-2 font-medium">Description</th>
                <th className="text-right px-4 py-2 font-medium">Qty (mg)</th>
                <th className="text-right px-4 py-2 font-medium">Cost / Kg</th>
                <th className="text-right px-4 py-2 font-medium">Cost</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {firstTierLines.map((li) => (
                <tr key={li.id}>
                  <td className="px-4 py-2 text-slate-600">{li.lineType}</td>
                  <td className="px-4 py-2 text-slate-900">{li.description}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{li.quantity ? parseFloat(li.quantity).toFixed(2) : "—"}</td>
                  <td className="px-4 py-2 text-right tabular-nums text-slate-600">{li.unitCost ? `$${parseFloat(li.unitCost).toFixed(2)}` : "—"}</td>
                  <td className="px-4 py-2 text-right tabular-nums font-mono">${parseFloat(li.totalCost).toFixed(4)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}
