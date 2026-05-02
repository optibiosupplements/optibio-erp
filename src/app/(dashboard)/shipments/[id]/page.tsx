import { db } from "@/lib/db";
import { shipments, purchaseOrders, customers, finishedProductLots } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import Link from "next/link";
import { Truck, ChevronLeft, Package } from "lucide-react";
import { notFound } from "next/navigation";
import { ShipmentEditor } from "./editor";

export const dynamic = "force-dynamic";

const STATUS_COLORS: Record<string, string> = {
  Scheduled: "bg-slate-100 text-slate-700",
  "Picked Up": "bg-blue-100 text-blue-700",
  "In Transit": "bg-purple-100 text-purple-700",
  Delivered: "bg-emerald-100 text-emerald-700",
  Returned: "bg-red-100 text-red-700",
};

export default async function ShipmentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [s] = await db.select().from(shipments).where(eq(shipments.id, id)).limit(1);
  if (!s) notFound();

  const [po] = await db.select().from(purchaseOrders).where(eq(purchaseOrders.id, s.purchaseOrderId)).limit(1);
  const [customer] = po?.customerId ? await db.select().from(customers).where(eq(customers.id, po.customerId)).limit(1) : [null];
  const [lot] = s.finishedProductLotId ? await db.select().from(finishedProductLots).where(eq(finishedProductLots.id, s.finishedProductLotId)).limit(1) : [null];

  return (
    <div className="max-w-4xl mx-auto pb-12">
      <div className="mb-3">
        <Link href="/shipments" className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700">
          <ChevronLeft className="h-3.5 w-3.5" /> Back to Shipments
        </Link>
      </div>

      <div className="flex items-start justify-between mb-5">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Truck className="h-5 w-5 text-[#d10a11]" />
            Shipment
          </h1>
          <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
            <span className={`inline-block px-2 py-0.5 text-xs font-medium rounded-full ${STATUS_COLORS[s.status] ?? STATUS_COLORS.Scheduled}`}>{s.status}</span>
            {po && <span>· PO <Link href={`/orders/${po.id}`} className="font-mono text-slate-700 hover:text-[#d10a11]">{po.poNumber}</Link></span>}
            {customer && <span>· {customer.companyName}</span>}
            {lot && <span>· <Link href={`/lots/${lot.id}`} className="font-mono text-slate-700 hover:text-[#d10a11]"><Package className="h-3 w-3 inline mr-1" />{lot.lotNumber}</Link></span>}
          </div>
        </div>
      </div>

      <ShipmentEditor
        shipment={{
          id: s.id,
          quantityUnits: s.quantityUnits,
          carrier: s.carrier,
          trackingNumber: s.trackingNumber,
          shipDate: s.shipDate,
          deliveredDate: s.deliveredDate,
          status: s.status,
          notes: s.notes,
        }}
      />
    </div>
  );
}
