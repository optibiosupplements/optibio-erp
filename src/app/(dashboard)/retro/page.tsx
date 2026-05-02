import { db } from "@/lib/db";
import {
  rfqs, formulations, quotes, purchaseOrders, productionRuns,
  finishedProductLots, finishedProductCoas, invoices, payments, shipments, customers,
} from "@/lib/db/schema";
import { sql, gte, desc, and } from "drizzle-orm";
import Link from "next/link";
import { TrendingUp, Sparkles, ChevronRight } from "lucide-react";

export const dynamic = "force-dynamic";

interface KPI {
  label: string;
  thisWeek: number;
  lastWeek: number;
  delta: number;
  deltaPct: number;
  fmt?: "money" | "count";
}

async function safeCount(query: Promise<{ c: number }[]>): Promise<number> {
  try { return Number((await query)[0]?.c ?? 0); } catch { return 0; }
}

async function safeSum(query: Promise<{ s: string | null }[]>): Promise<number> {
  try { return parseFloat((await query)[0]?.s ?? "0") || 0; } catch { return 0; }
}

export default async function RetroPage() {
  const today = new Date();
  const sevenDaysAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
  const fourteenDaysAgo = new Date(today.getTime() - 14 * 24 * 60 * 60 * 1000);

  const [
    rfqsThisWk, rfqsLastWk,
    quotesThisWk, quotesLastWk,
    posThisWk, posLastWk,
    posValueThisWk, posValueLastWk,
    batchesThisWk, batchesLastWk,
    coasThisWk, coasLastWk,
    invoicedThisWk, invoicedLastWk,
    paymentsReceivedThisWk, paymentsReceivedLastWk,
    shipmentsThisWk, shipmentsLastWk,
    newCustomersThisWk, newCustomersLastWk,
  ] = await Promise.all([
    safeCount(db.select({ c: sql<number>`COUNT(*)::int` }).from(rfqs).where(gte(rfqs.createdAt, sevenDaysAgo))),
    safeCount(db.select({ c: sql<number>`COUNT(*)::int` }).from(rfqs).where(and(gte(rfqs.createdAt, fourteenDaysAgo), sql`${rfqs.createdAt} < ${sevenDaysAgo}`))),
    safeCount(db.select({ c: sql<number>`COUNT(*)::int` }).from(quotes).where(gte(quotes.createdAt, sevenDaysAgo))),
    safeCount(db.select({ c: sql<number>`COUNT(*)::int` }).from(quotes).where(and(gte(quotes.createdAt, fourteenDaysAgo), sql`${quotes.createdAt} < ${sevenDaysAgo}`))),
    safeCount(db.select({ c: sql<number>`COUNT(*)::int` }).from(purchaseOrders).where(gte(purchaseOrders.createdAt, sevenDaysAgo))),
    safeCount(db.select({ c: sql<number>`COUNT(*)::int` }).from(purchaseOrders).where(and(gte(purchaseOrders.createdAt, fourteenDaysAgo), sql`${purchaseOrders.createdAt} < ${sevenDaysAgo}`))),
    safeSum(db.select({ s: sql<string>`COALESCE(SUM(${purchaseOrders.totalValue}), 0)::text` }).from(purchaseOrders).where(gte(purchaseOrders.createdAt, sevenDaysAgo))),
    safeSum(db.select({ s: sql<string>`COALESCE(SUM(${purchaseOrders.totalValue}), 0)::text` }).from(purchaseOrders).where(and(gte(purchaseOrders.createdAt, fourteenDaysAgo), sql`${purchaseOrders.createdAt} < ${sevenDaysAgo}`))),
    safeCount(db.select({ c: sql<number>`COUNT(*)::int` }).from(productionRuns).where(gte(productionRuns.createdAt, sevenDaysAgo))),
    safeCount(db.select({ c: sql<number>`COUNT(*)::int` }).from(productionRuns).where(and(gte(productionRuns.createdAt, fourteenDaysAgo), sql`${productionRuns.createdAt} < ${sevenDaysAgo}`))),
    safeCount(db.select({ c: sql<number>`COUNT(*)::int` }).from(finishedProductCoas).where(gte(finishedProductCoas.createdAt, sevenDaysAgo))),
    safeCount(db.select({ c: sql<number>`COUNT(*)::int` }).from(finishedProductCoas).where(and(gte(finishedProductCoas.createdAt, fourteenDaysAgo), sql`${finishedProductCoas.createdAt} < ${sevenDaysAgo}`))),
    safeSum(db.select({ s: sql<string>`COALESCE(SUM(${invoices.totalAmount}), 0)::text` }).from(invoices).where(gte(invoices.createdAt, sevenDaysAgo))),
    safeSum(db.select({ s: sql<string>`COALESCE(SUM(${invoices.totalAmount}), 0)::text` }).from(invoices).where(and(gte(invoices.createdAt, fourteenDaysAgo), sql`${invoices.createdAt} < ${sevenDaysAgo}`))),
    safeSum(db.select({ s: sql<string>`COALESCE(SUM(${payments.amount}), 0)::text` }).from(payments).where(gte(payments.createdAt, sevenDaysAgo))),
    safeSum(db.select({ s: sql<string>`COALESCE(SUM(${payments.amount}), 0)::text` }).from(payments).where(and(gte(payments.createdAt, fourteenDaysAgo), sql`${payments.createdAt} < ${sevenDaysAgo}`))),
    safeCount(db.select({ c: sql<number>`COUNT(*)::int` }).from(shipments).where(gte(shipments.createdAt, sevenDaysAgo))),
    safeCount(db.select({ c: sql<number>`COUNT(*)::int` }).from(shipments).where(and(gte(shipments.createdAt, fourteenDaysAgo), sql`${shipments.createdAt} < ${sevenDaysAgo}`))),
    safeCount(db.select({ c: sql<number>`COUNT(*)::int` }).from(customers).where(gte(customers.createdAt, sevenDaysAgo))),
    safeCount(db.select({ c: sql<number>`COUNT(*)::int` }).from(customers).where(and(gte(customers.createdAt, fourteenDaysAgo), sql`${customers.createdAt} < ${sevenDaysAgo}`))),
  ]);

  const kpis: KPI[] = [
    { label: "New RFQs", thisWeek: rfqsThisWk, lastWeek: rfqsLastWk, delta: rfqsThisWk - rfqsLastWk, deltaPct: pct(rfqsThisWk, rfqsLastWk), fmt: "count" },
    { label: "New Quotes", thisWeek: quotesThisWk, lastWeek: quotesLastWk, delta: quotesThisWk - quotesLastWk, deltaPct: pct(quotesThisWk, quotesLastWk), fmt: "count" },
    { label: "POs Booked", thisWeek: posThisWk, lastWeek: posLastWk, delta: posThisWk - posLastWk, deltaPct: pct(posThisWk, posLastWk), fmt: "count" },
    { label: "PO Value", thisWeek: posValueThisWk, lastWeek: posValueLastWk, delta: posValueThisWk - posValueLastWk, deltaPct: pct(posValueThisWk, posValueLastWk), fmt: "money" },
    { label: "Batches Started", thisWeek: batchesThisWk, lastWeek: batchesLastWk, delta: batchesThisWk - batchesLastWk, deltaPct: pct(batchesThisWk, batchesLastWk), fmt: "count" },
    { label: "COAs Issued", thisWeek: coasThisWk, lastWeek: coasLastWk, delta: coasThisWk - coasLastWk, deltaPct: pct(coasThisWk, coasLastWk), fmt: "count" },
    { label: "Invoiced", thisWeek: invoicedThisWk, lastWeek: invoicedLastWk, delta: invoicedThisWk - invoicedLastWk, deltaPct: pct(invoicedThisWk, invoicedLastWk), fmt: "money" },
    { label: "Cash Received", thisWeek: paymentsReceivedThisWk, lastWeek: paymentsReceivedLastWk, delta: paymentsReceivedThisWk - paymentsReceivedLastWk, deltaPct: pct(paymentsReceivedThisWk, paymentsReceivedLastWk), fmt: "money" },
    { label: "Shipments", thisWeek: shipmentsThisWk, lastWeek: shipmentsLastWk, delta: shipmentsThisWk - shipmentsLastWk, deltaPct: pct(shipmentsThisWk, shipmentsLastWk), fmt: "count" },
    { label: "New Customers", thisWeek: newCustomersThisWk, lastWeek: newCustomersLastWk, delta: newCustomersThisWk - newCustomersLastWk, deltaPct: pct(newCustomersThisWk, newCustomersLastWk), fmt: "count" },
  ];

  const wins = kpis.filter((k) => k.delta > 0);
  const drops = kpis.filter((k) => k.delta < 0);

  return (
    <div className="max-w-6xl mx-auto pb-12">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-[#d10a11]" />
            Weekly Retrospective
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            {sevenDaysAgo.toISOString().slice(0, 10)} → {today.toISOString().slice(0, 10)}
          </p>
        </div>
      </div>

      {/* KPI grid */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        {kpis.map((kpi) => (
          <div key={kpi.label} className="bg-white border border-slate-200 rounded-lg p-3 shadow-sm">
            <div className="text-2xl font-bold text-slate-900 tabular-nums">
              {kpi.fmt === "money"
                ? `$${kpi.thisWeek.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
                : kpi.thisWeek.toLocaleString()}
            </div>
            <div className="text-xs text-slate-500 mt-0.5">{kpi.label}</div>
            <div className="mt-1.5 text-xs flex items-center gap-1 tabular-nums">
              {kpi.delta > 0 && <span className="text-emerald-700">▲ {kpi.fmt === "money" ? `$${kpi.delta.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : kpi.delta}</span>}
              {kpi.delta < 0 && <span className="text-red-700">▼ {kpi.fmt === "money" ? `$${Math.abs(kpi.delta).toLocaleString(undefined, { maximumFractionDigits: 0 })}` : Math.abs(kpi.delta)}</span>}
              {kpi.delta === 0 && <span className="text-slate-400">unchanged</span>}
              {kpi.lastWeek > 0 && kpi.delta !== 0 && <span className="text-slate-400">({kpi.deltaPct > 0 ? "+" : ""}{kpi.deltaPct.toFixed(0)}%)</span>}
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">vs last week: {kpi.fmt === "money" ? `$${kpi.lastWeek.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : kpi.lastWeek.toLocaleString()}</div>
          </div>
        ))}
      </div>

      {/* Wins + Drops */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <section className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-emerald-700 mb-3 flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5" /> Wins ({wins.length})
          </h2>
          {wins.length === 0 ? (
            <p className="text-xs text-slate-400 italic">No improvements this week.</p>
          ) : (
            <ul className="space-y-1.5 text-sm">
              {wins.sort((a, b) => b.deltaPct - a.deltaPct).map((w) => (
                <li key={w.label} className="flex items-center justify-between">
                  <span className="text-slate-700">{w.label}</span>
                  <span className="text-emerald-700 font-medium tabular-nums">
                    +{w.fmt === "money" ? `$${w.delta.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : w.delta}
                    {w.lastWeek > 0 && <span className="text-emerald-600 text-xs ml-1">({w.deltaPct > 0 ? "+" : ""}{w.deltaPct.toFixed(0)}%)</span>}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-red-700 mb-3 flex items-center gap-1.5">
            <ChevronRight className="h-3.5 w-3.5 rotate-90" /> Drops ({drops.length})
          </h2>
          {drops.length === 0 ? (
            <p className="text-xs text-slate-400 italic">Nothing dropped this week. 🎉</p>
          ) : (
            <ul className="space-y-1.5 text-sm">
              {drops.sort((a, b) => a.deltaPct - b.deltaPct).map((d) => (
                <li key={d.label} className="flex items-center justify-between">
                  <span className="text-slate-700">{d.label}</span>
                  <span className="text-red-700 font-medium tabular-nums">
                    {d.fmt === "money" ? `-$${Math.abs(d.delta).toLocaleString(undefined, { maximumFractionDigits: 0 })}` : d.delta}
                    {d.lastWeek > 0 && <span className="text-red-600 text-xs ml-1">({d.deltaPct.toFixed(0)}%)</span>}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* Reflection prompts */}
      <section className="bg-slate-50 border border-slate-200 rounded-lg p-5">
        <h2 className="text-sm font-semibold text-slate-800 mb-3">Reflection Prompts (per gstack ETHOS)</h2>
        <ul className="space-y-2 text-sm text-slate-700">
          <li>• What's one thing you discovered this week that surprised you? Add to <Link href="/learnings" className="text-[#d10a11] hover:underline">/learnings</Link>.</li>
          <li>• What process improvement would have saved 5+ minutes if it'd been in place Monday?</li>
          <li>• Did any SME panel get skipped on a feature? (See <code className="font-mono text-xs bg-white px-1 py-0.5 rounded">docs/SME-PANELS.md</code>.)</li>
          <li>• Which customer had the most touches this week? Are they getting routine follow-up?</li>
          <li>• What's the smallest experiment you could ship next week to test a hypothesis?</li>
        </ul>
      </section>
    </div>
  );
}

function pct(now: number, prev: number): number {
  if (prev === 0) return now > 0 ? 100 : 0;
  return ((now - prev) / prev) * 100;
}
