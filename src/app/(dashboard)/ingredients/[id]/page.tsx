"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { Save, ArrowLeft, Loader2, Trash2 } from "lucide-react";

const FIELDS: { key: string; label: string; type?: string; group: string; width?: string }[] = [
  // Identity
  { key: "rmId", label: "RM ID", group: "Identity" },
  { key: "name", label: "Ingredient Name", group: "Identity", width: "col-span-2" },
  { key: "scientificName", label: "Scientific Name", group: "Identity", width: "col-span-2" },
  { key: "category", label: "Category", group: "Identity" },
  { key: "subcategory", label: "Subcategory", group: "Identity" },
  { key: "functionDesc", label: "Function / Description", group: "Identity", width: "col-span-3" },

  // Supplier & Pricing
  { key: "supplierName", label: "Supplier Name", group: "Supplier & Pricing" },
  { key: "costPerKg", label: "Cost per Kg ($)", type: "number", group: "Supplier & Pricing" },
  { key: "isEstimatedPrice", label: "Estimated Price?", type: "checkbox", group: "Supplier & Pricing" },
  { key: "moqKg", label: "MOQ (Kg)", type: "number", group: "Supplier & Pricing" },
  { key: "leadTimeDays", label: "Lead Time (Days)", type: "number", group: "Supplier & Pricing" },

  // Potency & Content
  { key: "assayPercentage", label: "Assay %", type: "number", group: "Potency & Content" },
  { key: "activeContentPct", label: "Active Content %", type: "number", group: "Potency & Content" },
  { key: "activeSource", label: "Active Source", group: "Potency & Content" },
  { key: "labelClaimActive", label: "Label Claim Active?", type: "checkbox", group: "Potency & Content" },
  { key: "multiComponent", label: "Multi-Component?", type: "checkbox", group: "Potency & Content" },

  // Overage (by dosage form)
  { key: "baseOveragePct", label: "Base Overage %", type: "number", group: "Overage & Wastage" },
  { key: "overageCapsule", label: "Overage: Capsule %", type: "number", group: "Overage & Wastage" },
  { key: "overageTablet", label: "Overage: Tablet %", type: "number", group: "Overage & Wastage" },
  { key: "overagePowder", label: "Overage: Powder %", type: "number", group: "Overage & Wastage" },
  { key: "overageStickPack", label: "Overage: Stick Pack %", type: "number", group: "Overage & Wastage" },

  // Wastage (by dosage form)
  { key: "baseWastagePct", label: "Base Wastage %", type: "number", group: "Overage & Wastage" },
  { key: "wastageCapsule", label: "Wastage: Capsule %", type: "number", group: "Overage & Wastage" },
  { key: "wastageTablet", label: "Wastage: Tablet %", type: "number", group: "Overage & Wastage" },
  { key: "wastagePowder", label: "Wastage: Powder %", type: "number", group: "Overage & Wastage" },
  { key: "wastageStickPack", label: "Wastage: Stick Pack %", type: "number", group: "Overage & Wastage" },
];

const GROUPS = ["Identity", "Supplier & Pricing", "Potency & Content", "Overage & Wastage"];

export default function IngredientDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const [data, setData] = useState<Record<string, any> | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    fetch(`/api/ingredients/${id}`)
      .then((r) => r.json())
      .then((d) => { if (d.error) throw new Error(d.error); setData(d); })
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [id]);

  const handleSave = async () => {
    if (!data) return;
    setSaving(true);
    setSaved(false);
    try {
      const res = await fetch(`/api/ingredients/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const result = await res.json();
      if (result.success) setSaved(true);
    } catch {} finally {
      setSaving(false);
      setTimeout(() => setSaved(false), 3000);
    }
  };

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this ingredient? This cannot be undone.")) return;
    setDeleting(true);
    try {
      await fetch(`/api/ingredients/${id}`, { method: "DELETE" });
      router.push("/ingredients");
    } catch {} finally {
      setDeleting(false);
    }
  };

  const set = (key: string, value: any) => {
    if (!data) return;
    setData({ ...data, [key]: value });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 text-gray-300 animate-spin" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center py-20">
        <p className="text-gray-500">Ingredient not found.</p>
        <button onClick={() => router.push("/ingredients")} className="mt-4 text-sm text-[#d10a11] hover:underline">← Back to Ingredients</button>
      </div>
    );
  }

  return (
    <div className="max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push("/ingredients")} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{data.name}</h1>
            <p className="text-sm text-gray-500 font-mono">{data.rmId} · {data.category}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={handleDelete} disabled={deleting} className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-red-600 bg-red-50 rounded-xl hover:bg-red-100 transition-colors disabled:opacity-50">
            <Trash2 className="h-4 w-4" /> Delete
          </button>
          <button onClick={handleSave} disabled={saving} className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#d10a11] text-white text-sm font-semibold rounded-xl hover:bg-[#a30a0f] transition-colors shadow-sm disabled:opacity-50">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {saving ? "Saving..." : saved ? "✓ Saved" : "Save Changes"}
          </button>
        </div>
      </div>

      {/* Field Groups */}
      {GROUPS.map((group) => {
        const groupFields = FIELDS.filter((f) => f.group === group);
        return (
          <div key={group} className="bg-white rounded-2xl border border-gray-200 p-6 mb-4 shadow-sm">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">{group}</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {groupFields.map((field) => (
                <div key={field.key} className={field.width || ""}>
                  <label className="block text-xs font-medium text-gray-500 mb-1">{field.label}</label>
                  {field.type === "checkbox" ? (
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={!!data[field.key]}
                        onChange={(e) => set(field.key, e.target.checked)}
                        className="h-4 w-4 rounded border-gray-300 text-[#d10a11] focus:ring-[#d10a11]"
                      />
                      <span className="text-sm text-gray-700">{data[field.key] ? "Yes" : "No"}</span>
                    </label>
                  ) : (
                    <input
                      type={field.type || "text"}
                      step={field.type === "number" ? "any" : undefined}
                      value={data[field.key] ?? ""}
                      onChange={(e) => set(field.key, field.type === "number" ? e.target.value : e.target.value)}
                      className="input-field"
                    />
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
