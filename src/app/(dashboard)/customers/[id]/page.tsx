import { db } from "@/lib/db";
import {
  customers, rfqs, formulations, quotes, purchaseOrders,
  finishedProductLots, finishedProductCoas, opportunities, leads,
} from "@/lib/db/schema";
import { eq, desc, sql } from "drizzle-orm";
import Link from "next/link";
import { ChevronLeft, Users, Mail, Phone, MapPin, FileText, ShoppingCart, FlaskConical, FileCheck, TrendingUp } from "lucide-react";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

const PO_COLORS: Record<string, string> = {
  Pending: "bg-slate-100 text-slate-700",
  Accepted: "bg-blue-100 text-blue-700",
  "In Production": "bg-purple-100 text-purple-700",
  Released: "bg-emerald-100 text-emerald-700",
  Shipped: "bg-indigo-100 text-indigo-700",
  Delivered: "bg-green-100 text-green-700",
  Closed: "bg-slate-200 text-slate-800",
};

export default async function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [customer] = await db.select().from(customers).where(eq(customers.id, id)).limit(1);
  if (!customer) notFound();

  const [customerRfqs, customerQuotes, customerPos, customerLeads, customerOpps, totalRevenue] = await Promise.all([
    db.select().from(rfqs).where(eq(rfqs.customerId, id)).orderBy(desc(rfqs.createdAt)).limit(20),
    db.select().from(quotes).where(eq(quotes.customerId, id)).orderBy(desc(quotes.createdAt)).limit(20),
    db.select().from(purchaseOrders).where(eq(purchaseOrders.customerId, id)).orderBy(desc(purchaseOrders.createdAt)).limit(20),
    db.select().from(leads).where(eq(leads.customerId, id)).orderBy(desc(leads.createdAt)).limit(20),
    db.select().from(opportunities).where(eq(opportunities.customerId, id)).orderBy(desc(opportunities.createdAt)).limit(20),
    db.select({ s: sql<string>`COALESCE(SUM(${purchaseOrders.totalValue}), 0)::text` })
      .from(purchaseOrders)
      .where(sql`${purchaseOrders.customerId} = ${id} AND ${purchaseOrders.status} IN ('Delivered', 'Closed')`)
      .then((r) => parseFloat(r[0]?.s ?? "0") || 0)
      .catch(() => 0),
  ]);

  // Find COAs via lots → formulations → customers (indirect)
  const customerLots = customerPos.length > 0
    ? await db.select({ lot: finishedProductLots, coa: finishedProductCoas })
      .from(finishedProductLots)
      .leftJoin(finishedProductCoas, eq(finishedProductCoas.finishedProductLotId, finishedProductLots.id))
      .innerJoin(formulations, eq(formulations.id, finishedProductLots.formulationId))
      .where(eq(formulations.customerId, id))
      .orderBy(desc(finishedProductLots.createdAt))
      .limit(20)
      .catch(() => [])
    : [];

  const pipelineValue = customerPos
    .filter((p) => !["Closed", "Delivered"].includes(p.status))
    .reduce((sum, p) => sum + parseFloat(p.totalValue), 0);

  return (
    <div className="max-w-6xl mx-auto pb-12">
      <div className="mb-3">
        <Link href="/customers" className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700">
          <ChevronLeft className="h-3.5 w-3.5" /> Back to Customers
        </Link>
      </div>

      <div className="flex items-start justify-between mb-5">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Users className="h-5 w-5 text-[#d10a11]" />
            {customer.companyName}
          </h1>
          <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
            <span className={`inline-block px-2 py-0.5 text-xs font-medium rounded-full ${customer.tier === "Premium" ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-700"}`}>
              {customer.tier}
            </span>
            <span className={customer.isActive ? "text-emerald-700" : "text-red-700"}>
              {customer.isActive ? "● Active" : "○ Inactive"}
            </span>
            {customer.contactName && <span>· {customer.contactName}</span>}
          </div>
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-4 gap-3 mb-5">
        <div className="bg-white border border-slate-200 rounded-lg p-3 shadow-sm">
          <div className="text-2xl font-bold text-slate-900 tabular-nums">{customerRfqs.length}</div>
          <div className="text-xs text-slate-500">RFQs</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-lg p-3 shadow-sm">
          <div className="text-2xl font-bold text-slate-900 tabular-nums">{customerQuotes.length}</div>
          <div className="text-xs text-slate-500">Quotes</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-lg p-3 shadow-sm">
          <div className="text-2xl font-bold text-slate-900 tabular-nums">{customerPos.length}</div>
          <div className="text-xs text-slate-500">POs · ${pipelineValue.toLocaleString(undefined, { maximumFractionDigits: 0 })} pipeline</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-lg p-3 shadow-sm">
          <div className="text-2xl font-bold text-slate-900 tabular-nums">${totalRevenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
          <div className="text-xs text-slate-500">Lifetime revenue</div>
        </div>
      </div>

      {/* Contact card */}
      <section className="bg-white border border-slate-200 rounded-lg p-5 mb-4 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-800 mb-3">Contact</h2>
        <dl className="grid grid-cols-2 gap-y-2 gap-x-6 text-sm">
          {customer.email && (
            <div className="flex items-center gap-2"><Mail className="h-3.5 w-3.5 text-slate-400" /><a href={`mailto:${customer.email}`} className="text-slate-700 hover:text-[#d10a11]">{customer.email}</a></div>
          )}
          {customer.phone && (
            <div className="flex items-center gap-2"><Phone className="h-3.5 w-3.5 text-slate-400" /><a href={`tel:${customer.phone}`} className="text-slate-700 hover:text-[#d10a11]">{customer.phone}</a></div>
          )}
          {customer.address && (
            <div className="flex items-start gap-2 col-span-2"><MapPin className="h-3.5 w-3.5 text-slate-400 mt-0.5" /><span className="text-slate-700">{customer.address}</span></div>
          )}
          {customer.notes && (
            <div className="col-span-2 mt-2 text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded p-2">{customer.notes}</div>
          )}
        </dl>
      </section>

      {/* Two-column: POs + Quotes */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        <section className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-200 bg-slate-50">
            <h2 className="text-sm font-semibold text-slate-800 flex items-center gap-1.5"><ShoppingCart className="h-3.5 w-3.5 text-[#d10a11]" /> Purchase Orders</h2>
          </div>
          {customerPos.length === 0 ? <p className="px-4 py-6 text-xs text-slate-400">No POs yet.</p> : (
            <table className="w-full text-xs">
              <thead className="bg-slate-50 text-slate-500"><tr>
                <th className="text-left px-4 py-1.5 font-medium">PO #</th>
                <th className="text-right px-4 py-1.5 font-medium">Qty</th>
                <th className="text-right px-4 py-1.5 font-medium">Total</th>
                <th className="text-left px-4 py-1.5 font-medium">Status</th>
              </tr></thead>
              <tbody className="divide-y divide-slate-100 tabular-nums">
                {customerPos.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50/50">
                    <td className="px-4 py-1.5"><Link href={`/orders/${p.id}`} className="font-mono font-semibold text-slate-900 hover:text-[#d10a11]">{p.poNumber}</Link></td>
                    <td className="px-4 py-1.5 text-right">{p.tierQuantity.toLocaleString()}</td>
                    <td className="px-4 py-1.5 text-right">${parseFloat(p.totalValue).toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                    <td className="px-4 py-1.5"><span className={`inline-block px-2 py-0.5 text-[10px] font-medium rounded-full ${PO_COLORS[p.status] ?? PO_COLORS.Pending}`}>{p.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <section className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-200 bg-slate-50">
            <h2 className="text-sm font-semibold text-slate-800 flex items-center gap-1.5"><FileText className="h-3.5 w-3.5 text-[#d10a11]" /> Quotes</h2>
          </div>
          {customerQuotes.length === 0 ? <p className="px-4 py-6 text-xs text-slate-400">No quotes yet.</p> : (
            <table className="w-full text-xs">
              <thead className="bg-slate-50 text-slate-500"><tr>
                <th className="text-left px-4 py-1.5 font-medium">Quote #</th>
                <th className="text-left px-4 py-1.5 font-medium">Status</th>
                <th className="text-left px-4 py-1.5 font-medium">Created</th>
              </tr></thead>
              <tbody className="divide-y divide-slate-100">
                {customerQuotes.map((q) => (
                  <tr key={q.id} className="hover:bg-slate-50/50">
                    <td className="px-4 py-1.5"><Link href={`/quotes/${q.id}`} className="font-mono font-semibold text-slate-900 hover:text-[#d10a11]">{q.quoteNumber}</Link></td>
                    <td className="px-4 py-1.5 text-slate-700">{q.status}</td>
                    <td className="px-4 py-1.5 text-slate-400">{new Date(q.createdAt).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>

      {/* Lots + COAs */}
      {customerLots.length > 0 && (
        <section className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm mb-4">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-200 bg-slate-50">
            <h2 className="text-sm font-semibold text-slate-800 flex items-center gap-1.5"><FileCheck className="h-3.5 w-3.5 text-[#d10a11]" /> Lots &amp; COAs</h2>
          </div>
          <table className="w-full text-xs">
            <thead className="bg-slate-50 text-slate-500"><tr>
              <th className="text-left px-4 py-1.5 font-medium">Lot #</th>
              <th className="text-right px-4 py-1.5 font-medium">Bottles</th>
              <th className="text-left px-4 py-1.5 font-medium">Mfg Date</th>
              <th className="text-left px-4 py-1.5 font-medium">COA</th>
              <th className="w-24"></th>
            </tr></thead>
            <tbody className="divide-y divide-slate-100">
              {customerLots.map((row) => (
                <tr key={row.lot.id} className="hover:bg-slate-50/50">
                  <td className="px-4 py-1.5"><Link href={`/lots/${row.lot.id}`} className="font-mono font-semibold text-slate-900 hover:text-[#d10a11]">{row.lot.lotNumber}</Link></td>
                  <td className="px-4 py-1.5 text-right tabular-nums">{row.lot.quantityUnits.toLocaleString()}</td>
                  <td className="px-4 py-1.5 text-slate-600">{row.lot.manufacturingDate}</td>
                  <td className="px-4 py-1.5 font-mono text-xs">{row.coa?.coaNumber ?? "—"}</td>
                  <td className="px-4 py-1.5 text-right">
                    {row.coa && <a href={`/api/coas/${row.coa.id}/xlsx`} className="text-[10px] text-[#d10a11] hover:underline">Download COA</a>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {/* RFQs + Leads + Opportunities */}
      {(customerRfqs.length > 0 || customerLeads.length > 0 || customerOpps.length > 0) && (
        <section className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-800 mb-3 flex items-center gap-1.5"><TrendingUp className="h-3.5 w-3.5 text-[#d10a11]" /> CRM Activity</h2>
          <div className="grid grid-cols-3 gap-4 text-xs">
            <div>
              <div className="font-medium text-slate-700 mb-1">RFQs ({customerRfqs.length})</div>
              <ul className="space-y-1">
                {customerRfqs.slice(0, 5).map((r) => (
                  <li key={r.id}><Link href="/intake" className="text-slate-700 hover:text-[#d10a11]"><code className="font-mono">{r.rfqNumber}</code> · {r.status}</Link></li>
                ))}
              </ul>
            </div>
            <div>
              <div className="font-medium text-slate-700 mb-1">Leads ({customerLeads.length})</div>
              <ul className="space-y-1">
                {customerLeads.slice(0, 5).map((l) => <li key={l.id} className="text-slate-700">{l.title} · {l.nepqStage}</li>)}
                {customerLeads.length === 0 && <li className="text-slate-400">No leads.</li>}
              </ul>
            </div>
            <div>
              <div className="font-medium text-slate-700 mb-1">Opportunities ({customerOpps.length})</div>
              <ul className="space-y-1">
                {customerOpps.slice(0, 5).map((o) => <li key={o.id} className="text-slate-700">{o.title} · {o.stage}</li>)}
                {customerOpps.length === 0 && <li className="text-slate-400">No opportunities.</li>}
              </ul>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
