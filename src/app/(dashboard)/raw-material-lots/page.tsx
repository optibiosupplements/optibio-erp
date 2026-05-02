import { db } from "@/lib/db";
import { rawMaterialLots, ingredients, suppliers } from "@/lib/db/schema";
import { desc, eq } from "drizzle-orm";
import Link from "next/link";
import { PackageOpen } from "lucide-react";

export const dynamic = "force-dynamic";

const STATUS_COLORS: Record<string, string> = {
  Quarantine: "bg-amber-100 text-amber-700",
  Approved: "bg-emerald-100 text-emerald-700",
  "In Use": "bg-blue-100 text-blue-700",
  Depleted: "bg-slate-100 text-slate-700",
  Rejected: "bg-red-100 text-red-700",
};

export default async function RawMaterialLotsPage() {
  let rows: Array<{
    id: string; lotNumber: string; quantityKg: string; receivedDate: string;
    expiryDate: string | null; status: string; costPerKgActual: string | null;
    ingredientName: string | null; rmId: string | null; supplierName: string | null;
  }> = [];

  try {
    rows = await db
      .select({
        id: rawMaterialLots.id,
        lotNumber: rawMaterialLots.lotNumber,
        quantityKg: rawMaterialLots.quantityKg,
        receivedDate: rawMaterialLots.receivedDate,
        expiryDate: rawMaterialLots.expiryDate,
        status: rawMaterialLots.status,
        costPerKgActual: rawMaterialLots.costPerKgActual,
        ingredientName: ingredients.name,
        rmId: ingredients.rmId,
        supplierName: suppliers.companyName,
      })
      .from(rawMaterialLots)
      .leftJoin(ingredients, eq(ingredients.id, rawMaterialLots.ingredientId))
      .leftJoin(suppliers, eq(suppliers.id, rawMaterialLots.supplierId))
      .orderBy(desc(rawMaterialLots.receivedDate))
      .limit(200);
  } catch {}

  const totalKg = rows.reduce((s, r) => s + parseFloat(r.quantityKg), 0);
  const totalSpend = rows.reduce((s, r) => s + parseFloat(r.quantityKg) * parseFloat(r.costPerKgActual ?? "0"), 0);

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <PackageOpen className="h-5 w-5 text-[#d10a11]" />
            Raw Material Lots
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            {rows.length} lot{rows.length !== 1 && "s"} · {totalKg.toLocaleString(undefined, { maximumFractionDigits: 2 })} kg total · ${totalSpend.toLocaleString(undefined, { maximumFractionDigits: 0 })} spend
          </p>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-lg p-16 text-center shadow-sm">
          <PackageOpen className="h-12 w-12 text-slate-200 mx-auto mb-3" />
          <p className="text-sm text-slate-600 font-medium">No raw material lots yet.</p>
          <p className="text-xs text-slate-400 mt-1">Register lots when they arrive from suppliers via API.</p>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-xs text-slate-600">
                <th className="text-left px-4 py-2 font-semibold">Lot #</th>
                <th className="text-left px-4 py-2 font-semibold">Ingredient</th>
                <th className="text-left px-4 py-2 font-semibold">Supplier</th>
                <th className="text-right px-4 py-2 font-semibold">Qty (kg)</th>
                <th className="text-right px-4 py-2 font-semibold">$/kg</th>
                <th className="text-left px-4 py-2 font-semibold">Received</th>
                <th className="text-left px-4 py-2 font-semibold">Expires</th>
                <th className="text-left px-4 py-2 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 tabular-nums">
              {rows.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50/50">
                  <td className="px-4 py-2.5">
                    <Link href={`/raw-material-lots/${r.id}`} className="font-mono font-semibold text-slate-900 hover:text-[#d10a11]">{r.lotNumber}</Link>
                  </td>
                  <td className="px-4 py-2.5 text-slate-700">{r.rmId ? `${r.rmId} · ${r.ingredientName}` : r.ingredientName ?? "—"}</td>
                  <td className="px-4 py-2.5 text-slate-700">{r.supplierName ?? "—"}</td>
                  <td className="px-4 py-2.5 text-right">{parseFloat(r.quantityKg).toFixed(2)}</td>
                  <td className="px-4 py-2.5 text-right">{r.costPerKgActual ? `$${parseFloat(r.costPerKgActual).toFixed(2)}` : "—"}</td>
                  <td className="px-4 py-2.5 text-slate-500 text-xs">{r.receivedDate}</td>
                  <td className="px-4 py-2.5 text-slate-500 text-xs">{r.expiryDate ?? "—"}</td>
                  <td className="px-4 py-2.5">
                    <span className={`inline-block px-2 py-0.5 text-xs font-medium rounded-full ${STATUS_COLORS[r.status] ?? STATUS_COLORS.Quarantine}`}>
                      {r.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
