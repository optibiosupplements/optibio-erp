import { db } from "@/lib/db";
import { ingredients } from "@/lib/db/schema";
import { count } from "drizzle-orm";
import { Pill } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function IngredientsPage() {
  let ingredientList: any[] = [];
  let totalCount = 0;

  try {
    ingredientList = await db
      .select({
        id: ingredients.id,
        rmId: ingredients.rmId,
        name: ingredients.name,
        category: ingredients.category,
        supplierName: ingredients.supplierName,
        costPerKg: ingredients.costPerKg,
        activeContentPct: ingredients.activeContentPct,
        isEstimatedPrice: ingredients.isEstimatedPrice,
      })
      .from(ingredients)
      .limit(50);

    const [{ value }] = await db.select({ value: count() }).from(ingredients);
    totalCount = value;
  } catch {
    // DB not connected yet — show empty state
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Ingredient Database</h1>
          <p className="text-sm text-gray-500 mt-1">
            {totalCount > 0 ? `${totalCount.toLocaleString()} ingredients` : "Connect database to load ingredients"}
          </p>
        </div>
      </div>

      {ingredientList.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <Pill className="h-12 w-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">No ingredients loaded yet.</p>
          <p className="text-gray-400 text-xs mt-1">
            Connect your database and run the seed script to load 2,567 ingredients.
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-4 py-3 font-medium text-gray-600">RM ID</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Name</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Category</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Supplier</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">Cost/Kg</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">Active %</th>
                <th className="text-center px-4 py-3 font-medium text-gray-600">Est.</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {ingredientList.map((ing) => (
                <tr key={ing.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs text-gray-500">{ing.rmId}</td>
                  <td className="px-4 py-3 font-medium text-gray-900">{ing.name}</td>
                  <td className="px-4 py-3 text-gray-600">{ing.category}</td>
                  <td className="px-4 py-3 text-gray-600">{ing.supplierName}</td>
                  <td className="px-4 py-3 text-right text-gray-900">
                    ${Number(ing.costPerKg).toFixed(2)}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-900">
                    {Number(ing.activeContentPct).toFixed(1)}%
                  </td>
                  <td className="px-4 py-3 text-center">
                    {ing.isEstimatedPrice && (
                      <span className="inline-block px-2 py-0.5 bg-amber-100 text-amber-700 text-xs rounded-full">
                        Est.
                      </span>
                    )}
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
