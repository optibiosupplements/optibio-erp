import { db } from "@/lib/db";
import { suppliers, ingredients, rawMaterialLots } from "@/lib/db/schema";
import { eq, desc, sql } from "drizzle-orm";
import Link from "next/link";
import { ChevronLeft, Truck, Mail, Phone, Pill, Package } from "lucide-react";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

const LOT_COLORS: Record<string, string> = {
  Quarantine: "bg-amber-100 text-amber-700",
  Approved: "bg-emerald-100 text-emerald-700",
  "In Use": "bg-blue-100 text-blue-700",
  Depleted: "bg-slate-100 text-slate-700",
  Rejected: "bg-red-100 text-red-700",
};

export default async function SupplierDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [supplier] = await db.select().from(suppliers).where(eq(suppliers.id, id)).limit(1);
  if (!supplier) notFound();

  const [supIngredients, supLots, totalSpend] = await Promise.all([
    db.select().from(ingredients).where(eq(ingredients.supplierId, id)).orderBy(desc(ingredients.createdAt)).limit(50).catch(() => []),
    db.select().from(rawMaterialLots).where(eq(rawMaterialLots.supplierId, id)).orderBy(desc(rawMaterialLots.receivedDate)).limit(20).catch(() => []),
    db.select({ s: sql<string>`COALESCE(SUM(${rawMaterialLots.quantityKg} * ${rawMaterialLots.costPerKgActual}), 0)::text` })
      .from(rawMaterialLots)
      .where(eq(rawMaterialLots.supplierId, id))
      .then((r) => parseFloat(r[0]?.s ?? "0") || 0)
      .catch(() => 0),
  ]);

  const ingCount = await db.select({ c: sql<number>`COUNT(*)::int` }).from(ingredients).where(eq(ingredients.supplierId, id)).then((r) => Number(r[0]?.c ?? 0)).catch(() => 0);

  return (
    <div className="max-w-6xl mx-auto pb-12">
      <div className="mb-3">
        <Link href="/suppliers" className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700">
          <ChevronLeft className="h-3.5 w-3.5" /> Back to Suppliers
        </Link>
      </div>

      <div className="flex items-start justify-between mb-5">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Truck className="h-5 w-5 text-[#d10a11]" />
            {supplier.companyName}
          </h1>
          <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
            <span className={supplier.isActive ? "text-emerald-700" : "text-red-700"}>
              {supplier.isActive ? "● Active" : "○ Inactive"}
            </span>
            {supplier.contactName && <span>· {supplier.contactName}</span>}
            {supplier.paymentTerms && <span>· {supplier.paymentTerms}</span>}
          </div>
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        <div className="bg-white border border-slate-200 rounded-lg p-3 shadow-sm">
          <div className="text-2xl font-bold text-slate-900 tabular-nums">{ingCount}</div>
          <div className="text-xs text-slate-500">Ingredients sourced</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-lg p-3 shadow-sm">
          <div className="text-2xl font-bold text-slate-900 tabular-nums">{supLots.length}</div>
          <div className="text-xs text-slate-500">Raw material lots received</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-lg p-3 shadow-sm">
          <div className="text-2xl font-bold text-slate-900 tabular-nums">${totalSpend.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
          <div className="text-xs text-slate-500">Total spend (lots)</div>
        </div>
      </div>

      {/* Contact card */}
      <section className="bg-white border border-slate-200 rounded-lg p-5 mb-4 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-800 mb-3">Contact</h2>
        <dl className="grid grid-cols-2 gap-y-2 gap-x-6 text-sm">
          {supplier.email && (
            <div className="flex items-center gap-2"><Mail className="h-3.5 w-3.5 text-slate-400" /><a href={`mailto:${supplier.email}`} className="text-slate-700 hover:text-[#d10a11]">{supplier.email}</a></div>
          )}
          {supplier.phone && (
            <div className="flex items-center gap-2"><Phone className="h-3.5 w-3.5 text-slate-400" /><a href={`tel:${supplier.phone}`} className="text-slate-700 hover:text-[#d10a11]">{supplier.phone}</a></div>
          )}
          {supplier.notes && (
            <div className="col-span-2 mt-2 text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded p-2">{supplier.notes}</div>
          )}
        </dl>
      </section>

      {/* Ingredients sourced */}
      {supIngredients.length > 0 && (
        <section className="bg-white border border-slate-200 rounded-lg overflow-hidden mb-4 shadow-sm">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-200 bg-slate-50">
            <h2 className="text-sm font-semibold text-slate-800 flex items-center gap-1.5"><Pill className="h-3.5 w-3.5 text-[#d10a11]" /> Ingredients Sourced ({ingCount})</h2>
            <Link href={`/ingredients?supplierId=${id}`} className="text-xs text-[#d10a11] hover:text-[#a30a0f] font-medium">View all</Link>
          </div>
          <table className="w-full text-xs">
            <thead className="bg-slate-50 text-slate-500"><tr>
              <th className="text-left px-4 py-1.5 font-medium">RM #</th>
              <th className="text-left px-4 py-1.5 font-medium">Name</th>
              <th className="text-left px-4 py-1.5 font-medium">Category</th>
              <th className="text-right px-4 py-1.5 font-medium">$/kg</th>
              <th className="text-right px-4 py-1.5 font-medium">Active %</th>
            </tr></thead>
            <tbody className="divide-y divide-slate-100 tabular-nums">
              {supIngredients.slice(0, 20).map((ing) => (
                <tr key={ing.id} className="hover:bg-slate-50/50">
                  <td className="px-4 py-1.5 font-mono text-slate-700">{ing.rmId}</td>
                  <td className="px-4 py-1.5 text-slate-900"><Link href={`/ingredients/${ing.id}`} className="hover:text-[#d10a11]">{ing.name}</Link></td>
                  <td className="px-4 py-1.5 text-slate-600">{ing.category}</td>
                  <td className="px-4 py-1.5 text-right">${parseFloat(ing.costPerKg).toFixed(2)}</td>
                  <td className="px-4 py-1.5 text-right text-slate-600">{parseFloat(ing.activeContentPct).toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {/* Raw material lots */}
      {supLots.length > 0 && (
        <section className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-200 bg-slate-50">
            <h2 className="text-sm font-semibold text-slate-800 flex items-center gap-1.5"><Package className="h-3.5 w-3.5 text-[#d10a11]" /> Raw Material Lots</h2>
          </div>
          <table className="w-full text-xs">
            <thead className="bg-slate-50 text-slate-500"><tr>
              <th className="text-left px-4 py-1.5 font-medium">Lot #</th>
              <th className="text-right px-4 py-1.5 font-medium">Qty (kg)</th>
              <th className="text-right px-4 py-1.5 font-medium">$/kg</th>
              <th className="text-left px-4 py-1.5 font-medium">Received</th>
              <th className="text-left px-4 py-1.5 font-medium">Expires</th>
              <th className="text-left px-4 py-1.5 font-medium">Status</th>
            </tr></thead>
            <tbody className="divide-y divide-slate-100 tabular-nums">
              {supLots.map((lot) => (
                <tr key={lot.id} className="hover:bg-slate-50/50">
                  <td className="px-4 py-1.5 font-mono">{lot.lotNumber}</td>
                  <td className="px-4 py-1.5 text-right">{parseFloat(lot.quantityKg).toFixed(2)}</td>
                  <td className="px-4 py-1.5 text-right">{lot.costPerKgActual ? `$${parseFloat(lot.costPerKgActual).toFixed(2)}` : "—"}</td>
                  <td className="px-4 py-1.5 text-slate-600">{lot.receivedDate}</td>
                  <td className="px-4 py-1.5 text-slate-600">{lot.expiryDate ?? "—"}</td>
                  <td className="px-4 py-1.5"><span className={`inline-block px-2 py-0.5 text-[10px] font-medium rounded-full ${LOT_COLORS[lot.status] ?? LOT_COLORS.Quarantine}`}>{lot.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}
