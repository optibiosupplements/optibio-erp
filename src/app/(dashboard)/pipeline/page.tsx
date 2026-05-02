import { db } from "@/lib/db";
import { rfqs, quotes, purchaseOrders, customers, formulations } from "@/lib/db/schema";
import { desc, eq, sql } from "drizzle-orm";
import Link from "next/link";
import { TrendingUp, Inbox, FlaskConical, FileText, ShoppingCart, Factory, Truck, CheckCircle2 } from "lucide-react";

export const dynamic = "force-dynamic";

interface Stage {
  key: string;
  label: string;
  icon: typeof Inbox;
  count: number;
  value: number;
  items: Array<{ id: string; primary: string; secondary: string; href: string; tag?: string }>;
}

export default async function PipelinePage() {
  const [rfqRows, formRows, quoteRows, poAccepted, poInProd, poShipped, poDelivered] = await Promise.all([
    db.select({ rfq: rfqs, customerName: customers.companyName })
      .from(rfqs)
      .leftJoin(customers, eq(customers.id, rfqs.customerId))
      .where(sql`${rfqs.status} IN ('New', 'In Review', 'Formulating')`)
      .orderBy(desc(rfqs.createdAt))
      .limit(50)
      .catch(() => []),
    db.select({ f: formulations, customerName: customers.companyName })
      .from(formulations)
      .leftJoin(customers, eq(customers.id, formulations.customerId))
      .where(sql`${formulations.status} IN ('Draft', 'In Review')`)
      .orderBy(desc(formulations.createdAt))
      .limit(50)
      .catch(() => []),
    db.select({ q: quotes, customerName: customers.companyName })
      .from(quotes)
      .leftJoin(customers, eq(customers.id, quotes.customerId))
      .where(sql`${quotes.status} IN ('Draft', 'Sent', 'Viewed')`)
      .orderBy(desc(quotes.createdAt))
      .limit(50)
      .catch(() => []),
    db.select({ po: purchaseOrders, customerName: customers.companyName })
      .from(purchaseOrders)
      .leftJoin(customers, eq(customers.id, purchaseOrders.customerId))
      .where(eq(purchaseOrders.status, "Accepted"))
      .orderBy(desc(purchaseOrders.createdAt))
      .limit(50)
      .catch(() => []),
    db.select({ po: purchaseOrders, customerName: customers.companyName })
      .from(purchaseOrders)
      .leftJoin(customers, eq(customers.id, purchaseOrders.customerId))
      .where(sql`${purchaseOrders.status} IN ('In Production', 'QC Hold', 'Released')`)
      .orderBy(desc(purchaseOrders.createdAt))
      .limit(50)
      .catch(() => []),
    db.select({ po: purchaseOrders, customerName: customers.companyName })
      .from(purchaseOrders)
      .leftJoin(customers, eq(customers.id, purchaseOrders.customerId))
      .where(eq(purchaseOrders.status, "Shipped"))
      .orderBy(desc(purchaseOrders.createdAt))
      .limit(50)
      .catch(() => []),
    db.select({ po: purchaseOrders, customerName: customers.companyName })
      .from(purchaseOrders)
      .leftJoin(customers, eq(customers.id, purchaseOrders.customerId))
      .where(sql`${purchaseOrders.status} IN ('Delivered', 'Closed')`)
      .orderBy(desc(purchaseOrders.createdAt))
      .limit(20)
      .catch(() => []),
  ]);

  const sumPo = (rows: typeof poAccepted) => rows.reduce((s, r) => s + parseFloat(r.po.totalValue), 0);

  const stages: Stage[] = [
    {
      key: "rfq", label: "RFQs", icon: Inbox, count: rfqRows.length, value: 0,
      items: rfqRows.map((r) => ({
        id: r.rfq.id,
        primary: r.rfq.productName ?? r.rfq.rfqNumber,
        secondary: r.customerName ?? r.rfq.customerCompany ?? "—",
        href: "/intake",
        tag: r.rfq.status,
      })),
    },
    {
      key: "lab", label: "The Lab", icon: FlaskConical, count: formRows.length, value: 0,
      items: formRows.map((r) => ({
        id: r.f.id,
        primary: r.f.name,
        secondary: r.customerName ?? "—",
        href: `/formulations/${r.f.id}`,
        tag: r.f.status,
      })),
    },
    {
      key: "quote", label: "Quotes Out", icon: FileText, count: quoteRows.length, value: 0,
      items: quoteRows.map((r) => ({
        id: r.q.id,
        primary: r.q.quoteNumber,
        secondary: r.customerName ?? "—",
        href: `/quotes/${r.q.id}`,
        tag: r.q.status,
      })),
    },
    {
      key: "accepted", label: "Accepted", icon: ShoppingCart, count: poAccepted.length, value: sumPo(poAccepted),
      items: poAccepted.map((r) => ({
        id: r.po.id,
        primary: r.po.poNumber,
        secondary: `${r.customerName ?? "—"} · ${r.po.tierQuantity.toLocaleString()} units`,
        href: `/orders/${r.po.id}`,
        tag: `$${parseFloat(r.po.totalValue).toLocaleString(undefined, { maximumFractionDigits: 0 })}`,
      })),
    },
    {
      key: "production", label: "In Production", icon: Factory, count: poInProd.length, value: sumPo(poInProd),
      items: poInProd.map((r) => ({
        id: r.po.id,
        primary: r.po.poNumber,
        secondary: r.customerName ?? "—",
        href: `/orders/${r.po.id}`,
        tag: r.po.status,
      })),
    },
    {
      key: "shipped", label: "Shipped", icon: Truck, count: poShipped.length, value: sumPo(poShipped),
      items: poShipped.map((r) => ({
        id: r.po.id, primary: r.po.poNumber, secondary: r.customerName ?? "—",
        href: `/orders/${r.po.id}`,
      })),
    },
    {
      key: "delivered", label: "Delivered", icon: CheckCircle2, count: poDelivered.length, value: sumPo(poDelivered),
      items: poDelivered.map((r) => ({
        id: r.po.id, primary: r.po.poNumber, secondary: r.customerName ?? "—",
        href: `/orders/${r.po.id}`,
      })),
    },
  ];

  const totalPipelineValue = stages.reduce((s, st) => s + st.value, 0);

  return (
    <div className="max-w-full pb-12">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-[#d10a11]" />
            Pipeline
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Total pipeline value: ${totalPipelineValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        {stages.map((stage) => {
          const Icon = stage.icon;
          return (
            <div key={stage.key} className="bg-slate-50 rounded-lg p-2 min-h-[400px]">
              <div className="flex items-center justify-between mb-2 px-1">
                <div className="flex items-center gap-1.5">
                  <Icon className="h-3.5 w-3.5 text-slate-500" />
                  <h2 className="text-xs font-semibold text-slate-700 uppercase tracking-wide">{stage.label}</h2>
                </div>
                <span className="text-xs font-semibold text-slate-500 tabular-nums bg-white px-1.5 py-0.5 rounded">{stage.count}</span>
              </div>
              {stage.value > 0 && (
                <div className="text-xs text-slate-500 mb-2 px-1 tabular-nums">
                  ${stage.value.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </div>
              )}
              <div className="space-y-1.5">
                {stage.items.length === 0 ? (
                  <div className="text-xs text-slate-400 italic px-2 py-4 text-center">Empty</div>
                ) : (
                  stage.items.slice(0, 12).map((item) => (
                    <Link
                      key={item.id}
                      href={item.href}
                      className="block bg-white border border-slate-200 hover:border-slate-300 hover:shadow-sm rounded p-2 transition-all"
                    >
                      <div className="text-xs font-mono font-semibold text-slate-900 truncate">{item.primary}</div>
                      <div className="text-[11px] text-slate-500 truncate mt-0.5">{item.secondary}</div>
                      {item.tag && (
                        <div className="text-[10px] text-slate-400 mt-1 truncate">{item.tag}</div>
                      )}
                    </Link>
                  ))
                )}
                {stage.items.length > 12 && (
                  <div className="text-[10px] text-slate-400 text-center pt-1">+{stage.items.length - 12} more</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
