"use client";

import { useState, useTransition } from "react";
import { Save, Loader2, CheckCircle2, AlertTriangle, DollarSign, Factory, Package, Building2, Wrench } from "lucide-react";

interface Field {
  key: string;
  label: string;
  hint?: string;
  type?: "number" | "text";
  prefix?: string;
  suffix?: string;
}

interface Section {
  title: string;
  icon: typeof DollarSign;
  fields: Field[];
}

const SECTIONS: Section[] = [
  {
    title: "Pricing Tiers",
    icon: DollarSign,
    fields: [
      { key: "pricing.tier1.quantity", label: "Tier 1 Quantity", type: "number", suffix: "units" },
      { key: "pricing.tier1.marginPct", label: "Tier 1 Margin", type: "number", suffix: "%" },
      { key: "pricing.tier2.quantity", label: "Tier 2 Quantity", type: "number", suffix: "units" },
      { key: "pricing.tier2.marginPct", label: "Tier 2 Margin", type: "number", suffix: "%" },
      { key: "pricing.tier3.quantity", label: "Tier 3 Quantity", type: "number", suffix: "units" },
      { key: "pricing.tier3.marginPct", label: "Tier 3 Margin", type: "number", suffix: "%" },
      { key: "pricing.overheadPct", label: "Overhead %", type: "number", suffix: "%" },
      { key: "pricing.labCostPerBatch", label: "Lab Cost / Batch", type: "number", prefix: "$" },
    ],
  },
  {
    title: "Manufacturing",
    icon: Factory,
    fields: [
      { key: "mfg.blendingLaborPerBottle", label: "Blending Labor / Bottle", type: "number", prefix: "$" },
      { key: "mfg.encapsulationLaborPerBottle", label: "Encapsulation Labor / Bottle", type: "number", prefix: "$" },
      { key: "mfg.productionWastePct", label: "Production Waste %", type: "number", suffix: "%" },
    ],
  },
  {
    title: "Packaging (60ct default)",
    icon: Package,
    fields: [
      { key: "pkg.bottleCost", label: "Bottle", type: "number", prefix: "$" },
      { key: "pkg.capCost", label: "Cap", type: "number", prefix: "$" },
      { key: "pkg.desiccantCost", label: "Desiccant", type: "number", prefix: "$" },
      { key: "pkg.sleeveCost", label: "Sleeve / Neckband", type: "number", prefix: "$" },
      { key: "pkg.labelCost", label: "Label", type: "number", prefix: "$" },
      { key: "pkg.cartonCostPerUnit", label: "Carton (per bottle)", type: "number", prefix: "$" },
      { key: "pkg.palletCostPerUnit", label: "Pallet (per bottle)", type: "number", prefix: "$" },
      { key: "pkg.packagingLaborPerUnit", label: "Packaging Labor (per bottle)", type: "number", prefix: "$" },
    ],
  },
  {
    title: "Branding",
    icon: Building2,
    fields: [
      { key: "brand.companyName", label: "Company Name" },
      { key: "brand.address", label: "Address" },
      { key: "brand.phone", label: "Phone" },
      { key: "brand.website", label: "Website" },
      { key: "brand.qcLab", label: "QC Lab Name" },
      { key: "brand.labAccreditation", label: "Lab Accreditation" },
    ],
  },
  {
    title: "Invoicing",
    icon: Wrench,
    fields: [
      { key: "app.dueDays", label: "Default Due Days", type: "number", suffix: "days" },
      { key: "app.taxRatePct", label: "Default Tax Rate", type: "number", suffix: "%" },
    ],
  },
];

export function SettingsEditor({ initialValues }: { initialValues: Record<string, string> }) {
  const [values, setValues] = useState(initialValues);
  const [original] = useState(initialValues);
  const [pending, start] = useTransition();
  const [savedAt, setSavedAt] = useState<Date | null>(null);

  const dirty = SECTIONS.flatMap((s) => s.fields).some((f) => values[f.key] !== original[f.key]);

  function save() {
    start(async () => {
      const updates = SECTIONS.flatMap((s) =>
        s.fields
          .filter((f) => values[f.key] !== original[f.key])
          .map((f) => ({
            key: f.key,
            value: values[f.key],
            category: s.title.toLowerCase().split(" ")[0],
          })),
      );
      if (updates.length === 0) return;
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings: updates }),
      });
      if (res.ok) {
        setSavedAt(new Date());
        // Persist as new "original" so further edits compare to the saved state
        Object.assign(original, values);
      } else {
        alert("Save failed");
      }
    });
  }

  return (
    <div className="space-y-4">
      {SECTIONS.map((section) => {
        const Icon = section.icon;
        return (
          <section key={section.title} className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-800 mb-3 flex items-center gap-1.5">
              <Icon className="h-3.5 w-3.5 text-[#d10a11]" /> {section.title}
            </h2>
            <div className="grid grid-cols-2 gap-x-4 gap-y-3">
              {section.fields.map((f) => (
                <div key={f.key}>
                  <label className="block text-xs font-medium text-slate-600 uppercase tracking-wide mb-1">{f.label}</label>
                  <div className="flex items-center gap-1">
                    {f.prefix && <span className="text-sm text-slate-500">{f.prefix}</span>}
                    <input
                      type={f.type ?? "text"}
                      value={values[f.key] ?? ""}
                      onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
                      className="flex-1 border border-slate-300 rounded-md px-2 py-1.5 text-sm tabular-nums"
                    />
                    {f.suffix && <span className="text-sm text-slate-500">{f.suffix}</span>}
                  </div>
                  {f.hint && <p className="text-[11px] text-slate-400 mt-0.5">{f.hint}</p>}
                </div>
              ))}
            </div>
          </section>
        );
      })}

      <div className="fixed bottom-0 left-52 right-0 bg-white border-t border-slate-200 px-6 py-3 flex items-center justify-between z-10 shadow-[0_-2px_8px_rgba(0,0,0,0.04)]">
        <div className="text-xs text-slate-600 flex items-center gap-3">
          {dirty ? (
            <span className="text-amber-700 flex items-center gap-1.5"><AlertTriangle className="h-3.5 w-3.5" /> Unsaved changes</span>
          ) : savedAt ? (
            <span className="text-emerald-700 flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5" /> Saved {savedAt.toLocaleTimeString()}</span>
          ) : (
            <span className="text-slate-500">All settings synced</span>
          )}
        </div>
        <button
          onClick={save}
          disabled={!dirty || pending}
          className="inline-flex items-center gap-2 px-4 py-2 bg-[#d10a11] hover:bg-[#a30a0f] disabled:opacity-50 text-white text-sm font-semibold rounded-md"
        >
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Save Changes
        </button>
      </div>
    </div>
  );
}
