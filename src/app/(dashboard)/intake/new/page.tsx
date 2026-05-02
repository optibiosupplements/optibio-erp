"use client";

/**
 * Magic Box — single-page workbench RFQ intake.
 *
 * Per the spec doc ("What should happen when the user clicks.docx"):
 * - User pastes raw text → clicks "Analyze & Auto-Fill" → RFQ created IMMEDIATELY
 *   (status=Draft, RFQ-YYMM-####), even if parsing fails. Never block the user.
 * - Greedy parser extracts ingredient lines (active vs inactive split).
 * - Format auto-detected (Capsule / Tablet / Powder). Stickpack / Gummy / Liquid /
 *   Softgel route to a non-blocking "format not supported" warning.
 * - Format selector lives BELOW the Magic Box. If detection fails, leave blank —
 *   do NOT default to Capsule.
 * - Customer / contact section is LAST and never gates submit.
 * - Submit-to-R&D requires only: format set + ≥1 active ingredient.
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, Save, Send, Loader2, Plus, Trash2, AlertTriangle, FileText, ChevronRight } from "lucide-react";
import { parseIngredients, ingredientsToRawText, type ParsedIngredient } from "@/domains/intake/ingredient-parser";
import { detectFormat, SUPPORTED_FORMATS, type SupportedFormat } from "@/domains/intake/format-detector";
import { suggestProjectName } from "@/domains/intake/id-generator";

type Format = SupportedFormat | "";

interface Customer {
  customerCompany: string;
  customerContact: string;
  customerEmail: string;
  customerPhone: string;
}

const EMPTY_CUSTOMER: Customer = {
  customerCompany: "",
  customerContact: "",
  customerEmail: "",
  customerPhone: "",
};

export default function MagicBoxPage() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [rawText, setRawText] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [rfqId, setRfqId] = useState<string | null>(null);
  const [rfqNumber, setRfqNumber] = useState<string | null>(null);

  const [ingredients, setIngredients] = useState<ParsedIngredient[]>([]);
  const [format, setFormat] = useState<Format>("");
  const [formatWarning, setFormatWarning] = useState<string | null>(null);
  const [parseHelper, setParseHelper] = useState<string | null>(null);

  const [productName, setProductName] = useState("");
  const [servingSize, setServingSize] = useState("");
  const [servingsPerContainer, setServingsPerContainer] = useState("");
  const [countPerBottle, setCountPerBottle] = useState("");
  const [packagingNotes, setPackagingNotes] = useState("");
  const [customer, setCustomer] = useState<Customer>(EMPTY_CUSTOMER);

  const activeCount = ingredients.filter((i) => i.isActive).length;
  const submitEnabled = !!format && activeCount >= 1;

  async function handleAnalyze() {
    if (!rawText.trim()) {
      setParseHelper("Paste a formula above and click Analyze.");
      return;
    }
    setAnalyzing(true);
    setParseHelper(null);

    // Step 1 — parse and detect format CLIENT-SIDE first so we can populate
    // immediately while the server creates the RFQ row.
    const parsed = parseIngredients(rawText);
    const detection = detectFormat(rawText);

    // Apply parser results immediately
    setIngredients(parsed);

    // Format: only auto-set if user hasn't already chosen one. If the detection
    // is unsupported (stickpack/gummy/etc.), surface the warning but do NOT
    // change the user's selection.
    if (!format && detection.isSupported && detection.format) {
      setFormat(detection.format as SupportedFormat);
    }
    setFormatWarning(detection.warning ?? null);

    // Suggest a product name from the first active ingredient
    if (!productName && parsed.length > 0) {
      const suggested = suggestProjectName(parsed.map((p) => ({ name: p.name, amount: p.amount, unit: p.unit })), detection.isSupported ? detection.format : null);
      setProductName(suggested);
    }

    // Step 2 — create the RFQ on the server. Don't block the UI on this; the
    // parsing already populated the form.
    try {
      const res = await fetch("/api/intake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "New",
          priority: "Normal",
          source: "MagicBox",
          dosageForm: detection.isSupported ? detection.format : null,
          formulaJson: parsed,
          internalNotes: rawText,
          productName: productName || (parsed.length ? suggestProjectName(parsed.map((p) => ({ name: p.name, amount: p.amount, unit: p.unit })), detection.isSupported ? detection.format : null) : null),
        }),
      });
      const data = await res.json();
      if (data.success) {
        setRfqId(data.rfqId);
        setRfqNumber(data.rfqNumber);
        if (parsed.length === 0) {
          setParseHelper(`Saved ${data.rfqNumber}. Add ingredients below — your text didn't parse cleanly.`);
        }
      } else {
        setParseHelper(`Couldn't save RFQ: ${data.error || "unknown error"}`);
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setParseHelper(`Couldn't reach server: ${msg}`);
    } finally {
      setAnalyzing(false);
    }
  }

  async function handleSave() {
    if (!rfqId) return;
    startTransition(async () => {
      const res = await fetch(`/api/intake/${rfqId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dosageForm: format || null,
          productName,
          servingSize: servingSize || null,
          servingsPerContainer: servingsPerContainer || null,
          countPerBottle: countPerBottle || null,
          formulaJson: ingredients,
          internalNotes: rawText,
          customerCompany: customer.customerCompany || null,
          customerContact: customer.customerContact || null,
          customerEmail: customer.customerEmail || null,
          customerPhone: customer.customerPhone || null,
          primaryPackaging: packagingNotes || null,
        }),
      });
      if (!res.ok) {
        const t = await res.text();
        alert(`Save failed: ${t}`);
      }
    });
  }

  async function handleSubmitToRD() {
    if (!rfqId || !submitEnabled) return;
    await handleSave();
    const res = await fetch(`/api/intake/${rfqId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "In Review" }),
    });
    if (res.ok) router.push(`/formulations/new?rfqId=${rfqId}`);
    else alert("Failed to submit to R&D.");
  }

  function addIngredientRow() {
    setIngredients((rows) => [
      ...rows,
      { id: `ing_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`, name: "", amount: "", unit: "mg", notes: "", isActive: true },
    ]);
  }

  function updateIngredient(id: string, patch: Partial<ParsedIngredient>) {
    setIngredients((rows) => rows.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  function removeIngredient(id: string) {
    setIngredients((rows) => rows.filter((r) => r.id !== id));
  }

  return (
    <div className="max-w-5xl mx-auto pb-24">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-[#d10a11]" />
            New RFQ
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">Paste a formula. We'll create the RFQ and parse the ingredients.</p>
        </div>
        {rfqNumber && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-md px-3 py-2 flex items-center gap-2">
            <FileText className="h-4 w-4 text-emerald-700" />
            <code className="font-mono text-sm font-semibold text-emerald-900">{rfqNumber}</code>
            <span className="text-xs text-emerald-700">created</span>
          </div>
        )}
      </div>

      {/* Magic Box */}
      <section className="bg-white border border-slate-200 rounded-lg p-5 mb-4 shadow-sm">
        <label htmlFor="magicbox" className="block text-xs font-semibold text-slate-700 uppercase tracking-wide mb-2">
          Quick Fill
        </label>
        <textarea
          id="magicbox"
          value={rawText}
          onChange={(e) => setRawText(e.target.value)}
          placeholder={`Paste a customer inquiry, a supplement facts panel, or just an ingredient list. Examples:

  Elderberry 10:1 500mg + Vit C 90mg + Vit D 1000 IU + Zinc 11mg

  Vitamin C 500mg
  Zinc 15mg
  Other Ingredients: Magnesium Stearate, Cellulose`}
          rows={6}
          className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm font-mono text-slate-900 focus:outline-none focus:border-[#d10a11] focus:ring-1 focus:ring-[#d10a11]/30 resize-y"
        />
        <div className="flex items-center justify-between mt-3">
          <p className="text-xs text-slate-500">{rawText.length} characters</p>
          <button
            onClick={handleAnalyze}
            disabled={analyzing}
            className="inline-flex items-center gap-2 px-4 py-2 bg-[#d10a11] hover:bg-[#a30a0f] disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-md transition-colors"
          >
            {analyzing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {rfqNumber ? "Re-analyze & Update" : "Analyze & Auto-Fill"}
          </button>
        </div>
        {parseHelper && (
          <div className="mt-3 text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-md px-3 py-2">{parseHelper}</div>
        )}
        {formatWarning && (
          <div className="mt-3 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-3 py-2 flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
            <span>{formatWarning}</span>
          </div>
        )}
      </section>

      {/* Product Format */}
      <section className="bg-white border border-slate-200 rounded-lg p-5 mb-4 shadow-sm">
        <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wide mb-2">
          Product Format <span className="text-[#d10a11]">*</span>
        </label>
        <div className="flex gap-2">
          {SUPPORTED_FORMATS.map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFormat(f)}
              className={`px-4 py-2 text-sm font-semibold rounded-md border transition-colors ${
                format === f
                  ? "bg-[#d10a11] border-[#d10a11] text-white"
                  : "bg-white border-slate-300 text-slate-700 hover:border-slate-400"
              }`}
            >
              {f.charAt(0) + f.slice(1).toLowerCase()}
            </button>
          ))}
        </div>
        {!format && (
          <p className="mt-2 text-xs text-slate-500">Required to submit to R&amp;D. Auto-detected from your pasted text when possible.</p>
        )}
      </section>

      {/* Product Requirements */}
      <section className="bg-white border border-slate-200 rounded-lg p-5 mb-4 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-800 mb-3">Product Requirements</h2>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Project Name" value={productName} onChange={setProductName} placeholder="e.g. Ascorbic Acid 500mg Capsules (auto-suggested)" />
          <Field label="Serving Size" value={servingSize} onChange={setServingSize} placeholder="e.g. 1 capsule" />
          <Field label="Servings / Container" value={servingsPerContainer} onChange={setServingsPerContainer} placeholder="e.g. 60" />
          <Field label="Count per Bottle" value={countPerBottle} onChange={setCountPerBottle} placeholder="e.g. 60" />
        </div>
      </section>

      {/* Formula */}
      <section className="bg-white border border-slate-200 rounded-lg p-5 mb-4 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-slate-800">
            Formula <span className="text-xs font-normal text-slate-500">({activeCount} active{activeCount !== 1 && "s"})</span>
          </h2>
          <button onClick={addIngredientRow} className="inline-flex items-center gap-1 text-xs text-[#d10a11] hover:text-[#a30a0f] font-medium">
            <Plus className="h-3.5 w-3.5" /> Add Line
          </button>
        </div>
        {ingredients.length === 0 ? (
          <div className="text-sm text-slate-500 text-center py-8 border border-dashed border-slate-200 rounded-md">
            No ingredients yet. Paste a formula above and click <strong>Analyze</strong>, or <button onClick={addIngredientRow} className="text-[#d10a11] underline">add one manually</button>.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-xs text-slate-600">
                  <th className="text-left px-2 py-2 font-medium w-8">A/I</th>
                  <th className="text-left px-2 py-2 font-medium">Ingredient</th>
                  <th className="text-right px-2 py-2 font-medium w-24">Amount</th>
                  <th className="text-left px-2 py-2 font-medium w-24">Unit</th>
                  <th className="text-left px-2 py-2 font-medium">Notes</th>
                  <th className="w-8"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {ingredients.map((ing) => (
                  <tr key={ing.id} className={ing.isActive ? "" : "bg-slate-50"}>
                    <td className="px-2 py-1.5">
                      <button
                        type="button"
                        onClick={() => updateIngredient(ing.id, { isActive: !ing.isActive })}
                        title={ing.isActive ? "Active ingredient — click to mark inactive" : "Inactive (excipient) — click to mark active"}
                        className={`w-7 h-7 rounded text-xs font-bold ${
                          ing.isActive ? "bg-emerald-100 text-emerald-800" : "bg-slate-200 text-slate-600"
                        }`}
                      >
                        {ing.isActive ? "A" : "I"}
                      </button>
                    </td>
                    <td className="px-2 py-1.5">
                      <input
                        value={ing.name}
                        onChange={(e) => updateIngredient(ing.id, { name: e.target.value })}
                        className="w-full px-2 py-1 border border-transparent hover:border-slate-200 focus:border-[#d10a11] focus:outline-none rounded text-sm"
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <input
                        value={ing.amount}
                        onChange={(e) => updateIngredient(ing.id, { amount: e.target.value })}
                        className="w-full px-2 py-1 border border-transparent hover:border-slate-200 focus:border-[#d10a11] focus:outline-none rounded text-sm text-right tabular-nums"
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <input
                        value={ing.unit}
                        onChange={(e) => updateIngredient(ing.id, { unit: e.target.value })}
                        className="w-full px-2 py-1 border border-transparent hover:border-slate-200 focus:border-[#d10a11] focus:outline-none rounded text-sm"
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <input
                        value={ing.notes}
                        onChange={(e) => updateIngredient(ing.id, { notes: e.target.value })}
                        placeholder="e.g. 10:1 extract"
                        className="w-full px-2 py-1 border border-transparent hover:border-slate-200 focus:border-[#d10a11] focus:outline-none rounded text-sm text-slate-600"
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <button onClick={() => removeIngredient(ing.id)} className="text-slate-400 hover:text-red-600">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Packaging */}
      <section className="bg-white border border-slate-200 rounded-lg p-5 mb-4 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-800 mb-3">Packaging</h2>
        <textarea
          value={packagingNotes}
          onChange={(e) => setPackagingNotes(e.target.value)}
          placeholder="e.g. PET amber 150cc, 38mm CR cap, induction seal, desiccant"
          rows={2}
          className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-[#d10a11] focus:ring-1 focus:ring-[#d10a11]/30"
        />
      </section>

      {/* Customer & Account (LAST — enrichment, not gating) */}
      <section className="bg-white border border-slate-200 rounded-lg p-5 mb-4 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-800 mb-1">Customer &amp; Account</h2>
        <p className="text-xs text-slate-500 mb-3">Optional. Not required to create or submit the RFQ.</p>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Company" value={customer.customerCompany} onChange={(v) => setCustomer({ ...customer, customerCompany: v })} placeholder="None" />
          <Field label="Contact Name" value={customer.customerContact} onChange={(v) => setCustomer({ ...customer, customerContact: v })} placeholder="None" />
          <Field label="Email" value={customer.customerEmail} onChange={(v) => setCustomer({ ...customer, customerEmail: v })} placeholder="None" />
          <Field label="Phone" value={customer.customerPhone} onChange={(v) => setCustomer({ ...customer, customerPhone: v })} placeholder="None" />
        </div>
      </section>

      {/* Sticky action bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 px-6 py-3 flex items-center justify-between z-10">
        <div className="flex items-center gap-3">
          {rfqNumber ? (
            <code className="font-mono text-xs text-slate-700">{rfqNumber}</code>
          ) : (
            <span className="text-xs text-slate-500">Click Analyze to create the RFQ.</span>
          )}
          {rfqNumber && (
            <span className="text-xs text-slate-500">
              {format ? `Format: ${format.charAt(0) + format.slice(1).toLowerCase()}` : "Format: not set"} · {activeCount} active{activeCount !== 1 && "s"}
            </span>
          )}
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleSave}
            disabled={!rfqId || pending}
            className="inline-flex items-center gap-2 px-4 py-2 border border-slate-300 text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium rounded-md transition-colors"
          >
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save Changes
          </button>
          <button
            onClick={handleSubmitToRD}
            disabled={!submitEnabled || pending}
            title={!submitEnabled ? "Set a format and add at least 1 ingredient to submit." : "Submit to R&D"}
            className="inline-flex items-center gap-2 px-4 py-2 bg-[#d10a11] hover:bg-[#a30a0f] disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-md transition-colors"
          >
            <Send className="h-4 w-4" />
            Submit to R&amp;D
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-600 uppercase tracking-wide mb-1">{label}</label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-[#d10a11] focus:ring-1 focus:ring-[#d10a11]/30"
      />
    </div>
  );
}
