"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Pill, Plus, Search, Pencil, Save, X, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";

interface Ingredient {
  id: string;
  rmId: string;
  name: string;
  category: string;
  supplierName: string | null;
  costPerKg: string;
  activeContentPct: string;
  isEstimatedPrice: boolean;
  [key: string]: any;
}

export default function IngredientsClient({
  ingredients,
  totalCount,
  currentPage,
  perPage,
  query,
}: {
  ingredients: Ingredient[];
  totalCount: number;
  currentPage: number;
  perPage: number;
  query: string;
}) {
  const router = useRouter();
  const [search, setSearch] = useState(query);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [newIng, setNewIng] = useState({ rmId: "", name: "", category: "Other", supplierName: "", costPerKg: "", activeContentPct: "100" });
  const [addSaving, setAddSaving] = useState(false);

  const totalPages = Math.ceil(totalCount / perPage);

  const doSearch = () => {
    const params = new URLSearchParams();
    if (search) params.set("q", search);
    router.push(`/ingredients?${params.toString()}`);
  };

  const startEdit = (ing: Ingredient) => {
    setEditingId(ing.id);
    setEditValues({
      costPerKg: ing.costPerKg,
      activeContentPct: ing.activeContentPct,
      supplierName: ing.supplierName || "",
      category: ing.category,
    });
  };

  const saveEdit = async (id: string) => {
    setSaving(true);
    try {
      await fetch(`/api/ingredients/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editValues),
      });
      setEditingId(null);
      router.refresh();
    } catch {} finally {
      setSaving(false);
    }
  };

  const addIngredient = async () => {
    if (!newIng.rmId || !newIng.name) return;
    setAddSaving(true);
    try {
      await fetch("/api/ingredients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newIng),
      });
      setShowAdd(false);
      setNewIng({ rmId: "", name: "", category: "Other", supplierName: "", costPerKg: "", activeContentPct: "100" });
      router.refresh();
    } catch {} finally {
      setAddSaving(false);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Ingredient Database</h1>
          <p className="text-sm text-gray-500 mt-1">{totalCount.toLocaleString()} ingredients</p>
        </div>
        <button onClick={() => setShowAdd(!showAdd)} className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#d10a11] text-white text-sm font-semibold rounded-xl hover:bg-[#a30a0f] transition-colors shadow-sm">
          <Plus className="h-4 w-4" /> Add Ingredient
        </button>
      </div>

      {/* Search */}
      <div className="flex gap-2 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && doSearch()}
            placeholder="Search by name, RM ID, category, or supplier..."
            className="input-field pl-10"
          />
        </div>
        <button onClick={doSearch} className="px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-xl hover:bg-gray-800 transition-colors">
          Search
        </button>
      </div>

      {/* Add Ingredient Form */}
      {showAdd && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-4">
          <h3 className="text-sm font-semibold text-green-800 mb-3">Add New Ingredient</h3>
          <div className="grid grid-cols-6 gap-2">
            <input value={newIng.rmId} onChange={(e) => setNewIng({ ...newIng, rmId: e.target.value })} placeholder="RM ID *" className="input-field text-xs" />
            <input value={newIng.name} onChange={(e) => setNewIng({ ...newIng, name: e.target.value })} placeholder="Ingredient Name *" className="input-field text-xs col-span-2" />
            <input value={newIng.category} onChange={(e) => setNewIng({ ...newIng, category: e.target.value })} placeholder="Category" className="input-field text-xs" />
            <input value={newIng.supplierName} onChange={(e) => setNewIng({ ...newIng, supplierName: e.target.value })} placeholder="Supplier" className="input-field text-xs" />
            <div className="flex gap-1">
              <input value={newIng.costPerKg} onChange={(e) => setNewIng({ ...newIng, costPerKg: e.target.value })} placeholder="$/Kg" className="input-field text-xs flex-1" />
              <button onClick={addIngredient} disabled={addSaving} className="px-3 py-1 bg-green-600 text-white rounded-lg text-xs font-medium hover:bg-green-700 disabled:opacity-50">
                {addSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : "Add"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Table */}
      {ingredients.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center shadow-sm">
          <Pill className="h-12 w-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">{query ? "No ingredients match your search." : "No ingredients loaded."}</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs">RM ID</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs">Name</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs">Category</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs">Supplier</th>
                <th className="text-right px-4 py-3 font-semibold text-gray-600 text-xs">Cost/Kg</th>
                <th className="text-right px-4 py-3 font-semibold text-gray-600 text-xs">Active %</th>
                <th className="text-center px-4 py-3 font-semibold text-gray-600 text-xs">Est.</th>
                <th className="text-center px-4 py-3 font-semibold text-gray-600 text-xs w-16">Edit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {ingredients.map((ing) => (
                <tr key={ing.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs text-gray-500">{ing.rmId}</td>
                  <td className="px-4 py-3 font-medium text-gray-900 text-sm">{ing.name}</td>

                  {editingId === ing.id ? (
                    <>
                      <td className="px-4 py-2">
                        <input value={editValues.category} onChange={(e) => setEditValues({ ...editValues, category: e.target.value })} className="input-field text-xs py-1" />
                      </td>
                      <td className="px-4 py-2">
                        <input value={editValues.supplierName} onChange={(e) => setEditValues({ ...editValues, supplierName: e.target.value })} className="input-field text-xs py-1" />
                      </td>
                      <td className="px-4 py-2">
                        <input type="number" value={editValues.costPerKg} onChange={(e) => setEditValues({ ...editValues, costPerKg: e.target.value })} className="input-field text-xs py-1 text-right" />
                      </td>
                      <td className="px-4 py-2">
                        <input type="number" value={editValues.activeContentPct} onChange={(e) => setEditValues({ ...editValues, activeContentPct: e.target.value })} className="input-field text-xs py-1 text-right" />
                      </td>
                      <td></td>
                      <td className="px-4 py-2 text-center">
                        <div className="flex gap-1 justify-center">
                          <button onClick={() => saveEdit(ing.id)} disabled={saving} className="p-1 text-green-600 hover:bg-green-50 rounded">
                            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                          </button>
                          <button onClick={() => setEditingId(null)} className="p-1 text-gray-400 hover:bg-gray-100 rounded">
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="px-4 py-3 text-gray-600">{ing.category}</td>
                      <td className="px-4 py-3 text-gray-600">{ing.supplierName || "—"}</td>
                      <td className="px-4 py-3 text-right text-gray-900 font-mono">${Number(ing.costPerKg).toFixed(2)}</td>
                      <td className="px-4 py-3 text-right text-gray-900">{Number(ing.activeContentPct).toFixed(1)}%</td>
                      <td className="px-4 py-3 text-center">
                        {ing.isEstimatedPrice && <span className="inline-block px-2 py-0.5 bg-amber-100 text-amber-700 text-[10px] rounded-full font-medium">Est.</span>}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button onClick={() => startEdit(ing)} className="p-1 text-gray-300 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors">
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-5 py-3 border-t border-gray-200 bg-gray-50">
              <p className="text-xs text-gray-500">
                Showing {((currentPage - 1) * perPage) + 1}–{Math.min(currentPage * perPage, totalCount)} of {totalCount.toLocaleString()}
              </p>
              <div className="flex gap-1">
                <button
                  onClick={() => router.push(`/ingredients?q=${search}&page=${currentPage - 1}`)}
                  disabled={currentPage <= 1}
                  className="p-1.5 text-gray-500 hover:bg-gray-200 rounded disabled:opacity-30 transition-colors"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <span className="px-3 py-1 text-xs font-medium text-gray-700">Page {currentPage} of {totalPages}</span>
                <button
                  onClick={() => router.push(`/ingredients?q=${search}&page=${currentPage + 1}`)}
                  disabled={currentPage >= totalPages}
                  className="p-1.5 text-gray-500 hover:bg-gray-200 rounded disabled:opacity-30 transition-colors"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
