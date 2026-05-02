import { db } from "@/lib/db";
import { ingredients, rawMaterialLots, lotMovements, suppliers } from "@/lib/db/schema";
import { sql, eq, desc } from "drizzle-orm";
import Link from "next/link";
import { Boxes, AlertTriangle } from "lucide-react";

export const dynamic = "force-dynamic";

interface InventoryRow {
  ingredientId: string;
  rmId: string;
  name: string;
  category: string;
  totalReceivedKg: number;
  totalConsumedKg: number;
  onHandKg: number;
  lotCount: number;
  primarySupplier: string | null;
  costPerKg: number;
  hasApprovedLot: boolean;
  hasQuarantineLot: boolean;
}

export default async function InventoryPage() {
  let rows: InventoryRow[] = [];
  try {
    // Aggregate received and consumed per ingredient
    const result = await db.execute<{
      ingredient_id: string; rm_id: string; name: string; category: string;
      cost_per_kg: string; supplier_name: string | null;
      total_received: string; total_consumed: string; lot_count: string;
      approved_count: string; quarantine_count: string;
    }>(sql`
      SELECT
        i.id as ingredient_id,
        i.rm_id,
        i.name,
        i.category,
        i.cost_per_kg::text,
        s.company_name as supplier_name,
        COALESCE(SUM(CASE WHEN m.movement_type = 'Receipt' THEN m.quantity_kg::numeric ELSE 0 END), 0)::text as total_received,
        COALESCE(SUM(CASE WHEN m.movement_type IN ('Issue to Production', 'Disposal') THEN m.quantity_kg::numeric ELSE 0 END), 0)::text as total_consumed,
        COUNT(DISTINCT l.id)::text as lot_count,
        COUNT(DISTINCT CASE WHEN l.status = 'Approved' THEN l.id END)::text as approved_count,
        COUNT(DISTINCT CASE WHEN l.status = 'Quarantine' THEN l.id END)::text as quarantine_count
      FROM ingredients i
      LEFT JOIN suppliers s ON s.id = i.supplier_id
      LEFT JOIN raw_material_lots l ON l.ingredient_id = i.id
      LEFT JOIN lot_movements m ON m.raw_material_lot_id = l.id
      WHERE EXISTS (SELECT 1 FROM raw_material_lots WHERE ingredient_id = i.id)
      GROUP BY i.id, i.rm_id, i.name, i.category, i.cost_per_kg, s.company_name
      ORDER BY i.name
      LIMIT 500
    `);

    const data = (result as unknown as { rows?: typeof result }).rows ?? (result as unknown as Array<{
      ingredient_id: string; rm_id: string; name: string; category: string;
      cost_per_kg: string; supplier_name: string | null;
      total_received: string; total_consumed: string; lot_count: string;
      approved_count: string; quarantine_count: string;
    }>);

    rows = (Array.isArray(data) ? data : []).map((r) => {
      const received = parseFloat(r.total_received) || 0;
      const consumed = parseFloat(r.total_consumed) || 0;
      return {
        ingredientId: r.ingredient_id,
        rmId: r.rm_id,
        name: r.name,
        category: r.category,
        totalReceivedKg: received,
        totalConsumedKg: consumed,
        onHandKg: received - consumed,
        lotCount: parseInt(r.lot_count, 10) || 0,
        primarySupplier: r.supplier_name,
        costPerKg: parseFloat(r.cost_per_kg) || 0,
        hasApprovedLot: parseInt(r.approved_count, 10) > 0,
        hasQuarantineLot: parseInt(r.quarantine_count, 10) > 0,
      };
    });
  } catch {}

  const totalValue = rows.reduce((s, r) => s + r.onHandKg * r.costPerKg, 0);
  const totalKg = rows.reduce((s, r) => s + r.onHandKg, 0);
  const lowStock = rows.filter((r) => r.onHandKg > 0 && r.onHandKg < 1).length;

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Boxes className="h-5 w-5 text-[#d10a11]" />
            Inventory
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            {rows.length} ingredient{rows.length !== 1 && "s"} with lot history · {totalKg.toLocaleString(undefined, { maximumFractionDigits: 1 })} kg on hand · ${totalValue.toLocaleString(undefined, { maximumFractionDigits: 0 })} inventory value
          </p>
        </div>
      </div>

      {lowStock > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4 flex items-center gap-2 text-sm">
          <AlertTriangle className="h-4 w-4 text-amber-700 flex-shrink-0" />
          <span className="text-amber-900"><strong>{lowStock}</strong> ingredient{lowStock !== 1 && "s"} below 1 kg on hand. Consider reordering.</span>
        </div>
      )}

      {rows.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-lg p-16 text-center shadow-sm">
          <Boxes className="h-12 w-12 text-slate-200 mx-auto mb-3" />
          <p className="text-sm text-slate-600 font-medium">No inventory yet.</p>
          <p className="text-xs text-slate-400 mt-1">Register raw material lots from Suppliers / supplier POs to start tracking.</p>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-xs text-slate-600">
                <th className="text-left px-4 py-2 font-semibold">RM #</th>
                <th className="text-left px-4 py-2 font-semibold">Ingredient</th>
                <th className="text-left px-4 py-2 font-semibold">Category</th>
                <th className="text-left px-4 py-2 font-semibold">Supplier</th>
                <th className="text-right px-4 py-2 font-semibold">On Hand (kg)</th>
                <th className="text-right px-4 py-2 font-semibold">Received</th>
                <th className="text-right px-4 py-2 font-semibold">Consumed</th>
                <th className="text-right px-4 py-2 font-semibold">Lots</th>
                <th className="text-right px-4 py-2 font-semibold">Value</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 tabular-nums">
              {rows.sort((a, b) => b.onHandKg - a.onHandKg).map((r) => {
                const isLow = r.onHandKg > 0 && r.onHandKg < 1;
                const isOut = r.onHandKg <= 0;
                return (
                  <tr key={r.ingredientId} className={`hover:bg-slate-50/50 ${isOut ? "opacity-60" : ""}`}>
                    <td className="px-4 py-2.5 font-mono text-xs text-slate-700">{r.rmId}</td>
                    <td className="px-4 py-2.5">
                      <Link href={`/ingredients/${r.ingredientId}`} className="text-slate-900 hover:text-[#d10a11]">{r.name}</Link>
                    </td>
                    <td className="px-4 py-2.5 text-slate-600">{r.category}</td>
                    <td className="px-4 py-2.5 text-slate-600 text-xs">{r.primarySupplier ?? "—"}</td>
                    <td className={`px-4 py-2.5 text-right font-medium ${isOut ? "text-red-700" : isLow ? "text-amber-700" : "text-slate-900"}`}>
                      {r.onHandKg.toFixed(2)}
                      {isLow && !isOut && <span className="ml-1 text-[10px] bg-amber-100 text-amber-800 px-1 rounded">LOW</span>}
                      {isOut && <span className="ml-1 text-[10px] bg-red-100 text-red-800 px-1 rounded">OUT</span>}
                    </td>
                    <td className="px-4 py-2.5 text-right text-slate-600">{r.totalReceivedKg.toFixed(2)}</td>
                    <td className="px-4 py-2.5 text-right text-slate-600">{r.totalConsumedKg.toFixed(2)}</td>
                    <td className="px-4 py-2.5 text-right text-slate-700">{r.lotCount}</td>
                    <td className="px-4 py-2.5 text-right text-slate-900">${(r.onHandKg * r.costPerKg).toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
