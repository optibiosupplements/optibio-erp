import { db } from "@/lib/db";
import {
  rfqs, formulations, quotes, purchaseOrders, productionRuns,
  finishedProductLots, finishedProductCoas, invoices,
} from "@/lib/db/schema";
import { sql, eq } from "drizzle-orm";
import Link from "next/link";

interface Stage {
  key: string;
  label: string;
  href: string;
  count: number;
  value?: number;
}

async function safeCount(query: Promise<{ c: number }[]>): Promise<number> {
  try { return Number((await query)[0]?.c ?? 0); } catch { return 0; }
}

async function safeSum(query: Promise<{ s: string | null }[]>): Promise<number> {
  try { return parseFloat((await query)[0]?.s ?? "0") || 0; } catch { return 0; }
}

export async function BusinessFlowChart() {
  const [
    openRfqs, formulationsInProgress, quoteStaged, openPos, openPosValue,
    runsInProgress, lotsInQc, releasedCoas, unpaidInvoices, unpaidInvoicesValue,
  ] = await Promise.all([
    safeCount(db.select({ c: sql<number>`COUNT(*)::int` }).from(rfqs).where(sql`${rfqs.status} IN ('New', 'In Review', 'Formulating')`)),
    safeCount(db.select({ c: sql<number>`COUNT(*)::int` }).from(formulations).where(sql`${formulations.status} IN ('Draft', 'In Review')`)),
    safeCount(db.select({ c: sql<number>`COUNT(*)::int` }).from(quotes).where(sql`${quotes.status} IN ('Draft', 'Sent', 'Viewed')`)),
    safeCount(db.select({ c: sql<number>`COUNT(*)::int` }).from(purchaseOrders).where(sql`${purchaseOrders.status} NOT IN ('Closed', 'Delivered')`)),
    safeSum(db.select({ s: sql<string>`COALESCE(SUM(${purchaseOrders.totalValue}), 0)::text` }).from(purchaseOrders).where(sql`${purchaseOrders.status} NOT IN ('Closed', 'Delivered')`)),
    safeCount(db.select({ c: sql<number>`COUNT(*)::int` }).from(productionRuns).where(sql`${productionRuns.status} NOT IN ('Complete', 'On Hold')`)),
    safeCount(db.select({ c: sql<number>`COUNT(*)::int` }).from(finishedProductLots).where(eq(finishedProductLots.status, "In QC"))),
    safeCount(db.select({ c: sql<number>`COUNT(*)::int` }).from(finishedProductCoas).where(eq(finishedProductCoas.disposition, "Approved for Release"))),
    safeCount(db.select({ c: sql<number>`COUNT(*)::int` }).from(invoices).where(sql`${invoices.status} IN ('Sent', 'Partially Paid', 'Overdue')`)),
    safeSum(db.select({ s: sql<string>`COALESCE(SUM(${invoices.totalAmount} - ${invoices.amountPaid}), 0)::text` }).from(invoices).where(sql`${invoices.status} IN ('Sent', 'Partially Paid', 'Overdue')`)),
  ]);

  const stages: Stage[] = [
    { key: "rfq", label: "RFQs", href: "/intake", count: openRfqs },
    { key: "lab", label: "Lab", href: "/formulations", count: formulationsInProgress },
    { key: "quote", label: "Quotes", href: "/quotes", count: quoteStaged },
    { key: "po", label: "Orders", href: "/orders", count: openPos, value: openPosValue },
    { key: "prod", label: "Production", href: "/batches", count: runsInProgress },
    { key: "qc", label: "QC", href: "/lots", count: lotsInQc },
    { key: "coa", label: "COAs", href: "/coas", count: releasedCoas },
    { key: "ar", label: "Unpaid AR", href: "/invoices", count: unpaidInvoices, value: unpaidInvoicesValue },
  ];

  return (
    <section className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-slate-800">Business Flow</h2>
        <span className="text-xs text-slate-400">RFQ → Production → AR</span>
      </div>

      <div className="overflow-x-auto pb-2">
        <div className="flex items-stretch gap-1 min-w-max">
          {stages.map((stage, i) => (
            <div key={stage.key} className="flex items-center">
              <Link
                href={stage.href}
                className="flex flex-col items-center justify-center min-w-[80px] px-3 py-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 hover:border-slate-300 rounded-md transition-colors group"
              >
                <div className={`text-2xl font-bold tabular-nums ${stage.count === 0 ? "text-slate-300" : "text-slate-900 group-hover:text-[#d10a11]"}`}>
                  {stage.count}
                </div>
                <div className="text-[11px] text-slate-600 mt-0.5">{stage.label}</div>
                {stage.value !== undefined && stage.value > 0 && (
                  <div className="text-[10px] text-slate-400 mt-0.5 tabular-nums">${stage.value.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                )}
              </Link>
              {i < stages.length - 1 && (
                <svg className="w-5 h-3 text-slate-300 mx-0.5 flex-shrink-0" viewBox="0 0 20 12" fill="currentColor" aria-hidden="true">
                  <path d="M0 6 L14 6 M14 6 L11 3 M14 6 L11 9" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
