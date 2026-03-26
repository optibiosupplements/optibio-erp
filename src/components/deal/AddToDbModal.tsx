"use client";

import { useState } from "react";
import { X, Save, Loader2, Database } from "lucide-react";

interface AddToDbModalProps {
  ingredientName: string;
  suggestedCategory?: string;
  suggestedActiveContent?: number;
  onSave: (ingredient: any) => void;
  onClose: () => void;
}

export default function AddToDbModal({ ingredientName, suggestedCategory, suggestedActiveContent, onSave, onClose }: AddToDbModalProps) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    rmId: `RM-NEW-${Math.floor(Math.random() * 9000) + 1000}`,
    name: ingredientName,
    category: suggestedCategory || "Specialty Compounds",
    supplierName: "Unknown",
    costPerKg: "",
    activeContentPct: suggestedActiveContent ? String(suggestedActiveContent) : "100",
    baseOveragePct: "10",
    baseWastagePct: "3",
    isEstimatedPrice: true,
    labelClaimActive: true,
  });

  const set = (k: string, v: string | boolean) => setForm({ ...form, [k]: v });

  const handleSave = async () => {
    if (!form.name || !form.rmId) return;
    setSaving(true);
    try {
      const res = await fetch("/api/ingredients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (data.success) {
        onSave(data.ingredient);
      }
    } catch {} finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <Database className="h-5 w-5 text-[#d10a11]" />
            <h2 className="text-lg font-bold text-gray-900">Add to Ingredient Database</h2>
          </div>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 rounded">
            <X className="h-5 w-5" />
          </button>
        </div>

        <p className="text-sm text-gray-500 mb-4">
          <strong className="text-red-600">{ingredientName}</strong> was not found in the database. Add it now and it will be available for all future formulations.
        </p>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">RM ID</label>
            <input value={form.rmId} onChange={(e) => set("rmId", e.target.value)} className="input-field text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Category</label>
            <select value={form.category} onChange={(e) => set("category", e.target.value)} className="input-field text-sm">
              {["Botanicals", "Vitamins", "Minerals", "Amino Acids", "Probiotics", "Enzymes", "Proteins", "Specialty Compounds", "Excipients", "Flavors", "Sweeteners", "Colors", "Fatty Acids", "Oils", "Other"].map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div className="col-span-2">
            <label className="block text-xs font-medium text-gray-500 mb-1">Ingredient Name</label>
            <input value={form.name} onChange={(e) => set("name", e.target.value)} className="input-field text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Supplier</label>
            <input value={form.supplierName} onChange={(e) => set("supplierName", e.target.value)} className="input-field text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Cost/Kg ($) *</label>
            <input type="number" value={form.costPerKg} onChange={(e) => set("costPerKg", e.target.value)} placeholder="Enter cost" className="input-field text-sm border-red-200 bg-red-50/30" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Active Content %</label>
            <input type="number" value={form.activeContentPct} onChange={(e) => set("activeContentPct", e.target.value)} className="input-field text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Overage %</label>
            <input type="number" value={form.baseOveragePct} onChange={(e) => set("baseOveragePct", e.target.value)} className="input-field text-sm" />
          </div>
        </div>

        <div className="flex gap-3 mt-5">
          <button onClick={onClose} className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-600 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors">
            Cancel
          </button>
          <button onClick={handleSave} disabled={saving || !form.costPerKg} className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-[#d10a11] rounded-xl hover:bg-[#a30a0f] transition-colors disabled:opacity-50">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {saving ? "Saving..." : "Add to Database"}
          </button>
        </div>
      </div>
    </div>
  );
}
