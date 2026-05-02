import { db } from "@/lib/db";
import {
  rfqs, formulations, quotes, purchaseOrders, productionRuns,
  finishedProductLots, finishedProductCoas, customers,
} from "@/lib/db/schema";
import { desc, eq, sql, and } from "drizzle-orm";
import Link from "next/link";
import {
  Inbox, FlaskConical, FileText, ShoppingCart, Factory, Package, FileCheck,
  TrendingUp, Plus, ArrowRight,
} from "lucide-react";
import { BusinessFlowChart } from "@/components/BusinessFlowChart";

export const dynamic = "force-dynamic";

interface KPI {
  label: string;
  value: string | number;
  href: string;
  icon: typeof Inbox;
  color: string;
  sub?: string;
}

const RFQ_STATUS_COLORS: Record<string, string> = {
  New: "bg-blue-100 text-blue-700",
  "In Review": "bg-yellow-100 text-yellow-700",
  Formulating: "bg-purple-100 text-purple-700",
  Quoted: "bg-green-100 text-green-700",
  Sent: "bg-indigo-100 text-indigo-700",
  Accepted: "bg-emerald-100 text-emerald-700",
  Rejected: "bg-red-100 text-red-700",
};

const PO_STATUS_COLORS: Record<string, string> = {
  Pending: "bg-slate-100 text-slate-700",
  Accepted: "bg-blue-100 text-blue-700",
  "In Production": "bg-purple-100 text-purple-700",
  "QC Hold": "bg-amber-100 text-amber-700",
  Released: "bg-emerald-100 text-emerald-700",
  Shipped: "bg-indigo-100 text-indigo-700",
  Delivered: "bg-green-100 text-green-700",
  Closed: "bg-slate-200 text-slate-800",
};

async function safeCount<T extends number | bigint>(query: Promise<{ c: T }[]>): Promise<number> {
  try {
    const r = await query;
    return Number(r[0]?.c ?? 0);
  } catch {
    return 0;
  }
}

async function safeSum(query: Promise<{ s: string | null }[]>): Promise<number> {
  try {
    const r = await query;
    return parseFloat(r[0]?.s ?? "0") || 0;
  } catch {
    return 0;
  }
}

export default async function HomePage() {
  // KPIs in parallel
  const [
    openRfqs, formulationsInProgress, quoteStaged, openPos, openPosValue,
    runsInProgress, lotsInQc, coasReleased, recentRfqs, recentPos,
  ] = await Promise.all([
    safeCount(db.select({ c: sql<number>`COUNT(*)::int` }).from(rfqs).where(sql`${rfqs.status} IN ('New', 'In Review', 'Formulating')`)),
    safeCount(db.select({ c: sql<number>`COUNT(*)::int` }).from(formulations).where(sql`${formulations.status} IN ('Draft', 'In Review')`)),
    safeCount(db.select({ c: sql<number>`COUNT(*)::int` }).from(quotes).where(sql`${quotes.status} IN ('Draft', 'Sent', 'Viewed')`)),
    safeCount(db.select({ c: sql<number>`COUNT(*)::int` }).from(purchaseOrders).where(sql`${purchaseOrders.status} NOT IN ('Closed', 'Delivered')`)),
    safeSum(db.select({ s: sql<string>`COALESCE(SUM(${purchaseOrders.totalValue}), 0)::text` }).from(purchaseOrders).where(sql`${purchaseOrders.status} NOT IN ('Closed', 'Delivered')`)),
    safeCount(db.select({ c: sql<number>`COUNT(*)::int` }).from(productionRuns).where(sql`${productionRuns.status} NOT IN ('Complete', 'On Hold')`)),
    safeCount(db.select({ c: sql<number>`COUNT(*)::int` }).from(finishedProductLots).where(eq(finishedProductLots.status, "In QC"))),
    safeCount(db.select({ c: sql<number>`COUNT(*)::int` }).from(finishedProductCoas).where(eq(finishedProductCoas.disposition, "Approved for Release"))),
    db.select({ rfq: rfqs, customerName: customers.companyName })
      .from(rfqs)
      .leftJoin(customers, eq(customers.id, rfqs.customerId))
      .orderBy(desc(rfqs.createdAt))
      .limit(8)
      .catch(() => []),
    db.select({ po: purchaseOrders, customerName: customers.companyName })
      .from(purchaseOrders)
      .leftJoin(customers, eq(customers.id, purchaseOrders.customerId))
      .orderBy(desc(purchaseOrders.createdAt))
      .limit(5)
      .catch(() => []),
  ]);

  const kpis: KPI[] = [
    { label: "Open RFQs", value: openRfqs, href: "/intake", icon: Inbox, color: "blue", sub: "New + In Review + Formulating" },
    { label: "In The Lab", value: formulationsInProgress, href: "/formulations", icon: FlaskConical, color: "purple", sub: "Draft + In Review formulations" },
    { label: "Quotes Out", value: quoteStaged, href: "/quotes", icon: FileText, color: "indigo", sub: "Draft + Sent + Viewed" },
    { label: "Open Orders", value: openPos, href: "/orders", icon: ShoppingCart, color: "emerald", sub: openPosValue > 0 ? `$${openPosValue.toLocaleString(undefined, { maximumFractionDigits: 0 })} pipeline` : "" },
    { label: "Production", value: runsInProgress, href: "/batches", icon: Factory, color: "amber", sub: "Active batches" },
    { label: "Lots in QC", value: lotsInQc, href: "/lots", icon: Package, color: "yellow", sub: "Awaiting release" },
    { label: "Released COAs", value: coasReleased, href: "/coas", icon: FileCheck, color: "green", sub: "All-time" },
  ];

  return (
    <div className="max-w-7xl mx-auto pb-12">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Command Center</h1>
          <p className="text-xs text-slate-500 mt-1">Overview of every active deal, batch, and document.</p>
        </div>
        <div className="flex gap-2">
          <Link href="/intake/new" className="inline-flex items-center gap-2 px-4 py-2 bg-[#d10a11] hover:bg-[#a30a0f] text-white text-sm font-semibold rounded-md transition-colors">
            <Plus className="h-4 w-4" /> New RFQ
          </Link>
        </div>
      </div>

      {/* Business Flow chart */}
      <div className="mb-4">
        <BusinessFlowChart />
      </div>

      {/* KPI grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {kpis.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <Link
              key={kpi.label}
              href={kpi.href}
              className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm hover:border-slate-300 hover:shadow transition-all group"
            >
              <div className="flex items-start justify-between mb-2">
                <Icon className={`h-4 w-4 text-${kpi.color}-600`} />
                <ArrowRight className="h-3.5 w-3.5 text-slate-300 group-hover:text-slate-500 transition-colors" />
              </div>
              <div className="text-2xl font-bold text-slate-900 tabular-nums">{kpi.value}</div>
              <div className="text-xs font-medium text-slate-700 mt-0.5">{kpi.label}</div>
              {kpi.sub && <div className="text-[10px] text-slate-400 mt-0.5 truncate">{kpi.sub}</div>}
            </Link>
          );
        })}
      </div>

      {/* Two-column main */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Recent RFQs */}
        <section className="lg:col-span-2 bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-200 bg-slate-50">
            <h2 className="text-sm font-semibold text-slate-800">Recent RFQs</h2>
            <Link href="/intake" className="text-xs text-[#d10a11] hover:text-[#a30a0f] font-medium">View all</Link>
          </div>
          {recentRfqs.length === 0 ? (
            <div className="text-center py-12">
              <Inbox className="h-8 w-8 text-slate-200 mx-auto mb-2" />
              <p className="text-xs text-slate-400">No RFQs yet. <Link href="/intake/new" className="text-[#d10a11] hover:underline">Create one</Link>.</p>
            </div>
          ) : (
            <table className="w-full text-xs">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  <th className="text-left px-4 py-1.5 font-medium">RFQ #</th>
                  <th className="text-left px-4 py-1.5 font-medium">Product</th>
                  <th className="text-left px-4 py-1.5 font-medium">Customer</th>
                  <th className="text-left px-4 py-1.5 font-medium">Status</th>
                  <th className="text-left px-4 py-1.5 font-medium">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {recentRfqs.map((row) => (
                  <tr key={row.rfq.id} className="hover:bg-slate-50/50">
                    <td className="px-4 py-1.5">
                      <Link href={`/intake`} className="font-mono font-semibold text-slate-900 hover:text-[#d10a11]">{row.rfq.rfqNumber}</Link>
                    </td>
                    <td className="px-4 py-1.5 text-slate-700">{row.rfq.productName || "—"}</td>
                    <td className="px-4 py-1.5 text-slate-600">{row.customerName || row.rfq.customerCompany || "—"}</td>
                    <td className="px-4 py-1.5">
                      <span className={`inline-block px-2 py-0.5 text-[10px] font-medium rounded-full ${RFQ_STATUS_COLORS[row.rfq.status] ?? RFQ_STATUS_COLORS.New}`}>
                        {row.rfq.status}
                      </span>
                    </td>
                    <td className="px-4 py-1.5 text-slate-400">{new Date(row.rfq.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        {/* Sales pipeline */}
        <section className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-200 bg-slate-50">
            <h2 className="text-sm font-semibold text-slate-800 flex items-center gap-1.5">
              <TrendingUp className="h-3.5 w-3.5 text-[#d10a11]" /> Active Orders
            </h2>
            <Link href="/orders" className="text-xs text-[#d10a11] hover:text-[#a30a0f] font-medium">View all</Link>
          </div>
          {recentPos.length === 0 ? (
            <div className="text-center py-12">
              <ShoppingCart className="h-8 w-8 text-slate-200 mx-auto mb-2" />
              <p className="text-xs text-slate-400">No orders yet.</p>
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {recentPos.map((row) => (
                <li key={row.po.id} className="px-4 py-2 hover:bg-slate-50/50 transition-colors">
                  <Link href={`/orders/${row.po.id}`} className="block">
                    <div className="flex items-center justify-between">
                      <code className="font-mono font-semibold text-xs text-slate-900">{row.po.poNumber}</code>
                      <span className={`inline-block px-1.5 py-0.5 text-[10px] font-medium rounded-full ${PO_STATUS_COLORS[row.po.status] ?? PO_STATUS_COLORS.Pending}`}>
                        {row.po.status}
                      </span>
                    </div>
                    <div className="text-xs text-slate-600 mt-0.5">{row.customerName || "—"}</div>
                    <div className="text-xs text-slate-400 mt-0.5 tabular-nums">
                      {row.po.tierQuantity.toLocaleString()} units · ${parseFloat(row.po.totalValue).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* Quick actions */}
      <section className="mt-6 bg-white border border-slate-200 rounded-lg p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-800 mb-3">Quick Actions</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {[
            { href: "/intake/new", label: "New RFQ", icon: Inbox },
            { href: "/formulations", label: "The Lab", icon: FlaskConical },
            { href: "/quotes", label: "Quotes", icon: FileText },
            { href: "/orders", label: "Orders", icon: ShoppingCart },
            { href: "/batches", label: "Production", icon: Factory },
            { href: "/lots", label: "Finished Lots", icon: Package },
            { href: "/coas", label: "COAs", icon: FileCheck },
            { href: "/customers", label: "Customers", icon: TrendingUp },
          ].map((q) => {
            const Icon = q.icon;
            return (
              <Link
                key={q.href}
                href={q.href}
                className="flex items-center gap-2 px-3 py-2 border border-slate-200 hover:border-slate-300 hover:bg-slate-50 rounded-md text-sm font-medium text-slate-700 transition-colors"
              >
                <Icon className="h-4 w-4 text-slate-400" />
                {q.label}
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}
