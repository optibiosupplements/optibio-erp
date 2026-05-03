"use client";

/**
 * /formulations/new?rfqId=... — Bench Formulation Workbench
 *
 * Pipeline:
 *   1. Load the source RFQ (fetched on mount)
 *   2. Parse out actives from RFQ.formulaJson
 *   3. Match each active against the seeded ingredient DB (best fuzzy match)
 *      → user confirms / picks an alternative
 *   4. Run capsule-sizer + excipient-calculator on the actives (deterministic)
 *   5. Optionally call /api/danny for narrative recommendation
 *   6. Save → POST /api/formulations creates Formulation + lines, links RFQ
 */

import { Suspense, useEffect, useMemo, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, Sparkles, Save, FlaskConical, AlertTriangle, Search, Bot } from "lucide-react";
import { sizeCapsule } from "@/domains/formulation/capsule-sizer";
import { calculateExcipients, determineComplexity } from "@/domains/formulation/excipient-calculator";

interface RfqLite {
  id: string;
  rfqNumber: string;
  productName: string | null;
  dosageForm: string | null;
  servingsPerContainer: number | null;
  formulaJson: string | null;
  customerId: string | null;
}

interface ParsedFormula {
  id: string;
  name: string;
  amount: string;
  unit: string;
  notes?: string;
  isActive: boolean;
}

interface IngredientMatch {
  id: string;
  rmId: string;
  name: string;
  category: string;
  costPerKg: string;
  activeContentPct: string;
  baseOveragePct: string | null;
  baseWastagePct: string | null;
  overageCapsule: string | null;
  overageTablet: string | null;
  overagePowder: string | null;
}

interface FormulationLine {
  key: string;
  rawName: string;
  match: IngredientMatch | null;
  searching: boolean;
  searchResults: IngredientMatch[];
  labelClaimMg: number;
  unit: string;
  notes: string;
  // overrideable
  overagePct: number;
  wastagePct: number;
}

const KNOWN_UNIT_RE = /^(mg|g|kg|mcg|µg|ug|iu)$/i;
const IU_TO_MG: Record<string, number> = {
  // best-effort approximations — fine for sizing, refined per ingredient at quote time
  "vitamin d": 0.000025,
  "vit d": 0.000025,
  "vitamin d3": 0.000025,
  "d3": 0.000025,
  "vitamin e": 0.00067,
  "vit e": 0.00067,
};

function toMg(amount: number, unit: string, name: string): number {
  const u = unit.toLowerCase().trim();
  if (u === "mg") return amount;
  if (u === "g") return amount * 1000;
  if (u === "kg") return amount * 1_000_000;
  if (u === "mcg" || u === "ug" || u === "µg") return amount / 1000;
  if (u === "iu") {
    const key = Object.keys(IU_TO_MG).find((k) => name.toLowerCase().includes(k));
    if (key) return amount * IU_TO_MG[key];
    return amount * 0.000025; // safe default
  }
  return amount; // unknown unit — treat as mg
}

export default function FormulationWorkbenchPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-[60vh]"><Loader2 className="h-6 w-6 animate-spin text-slate-400" /></div>}>
      <Workbench />
    </Suspense>
  );
}

function Workbench() {
  const router = useRouter();
  const params = useSearchParams();
  const rfqId = params.get("rfqId");

  const [rfq, setRfq] = useState<RfqLite | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [lines, setLines] = useState<FormulationLine[]>([]);
  const [dosageForm, setDosageForm] = useState<"CAPSULE" | "TABLET" | "POWDER" | "">("");
  const [capsuleShell, setCapsuleShell] = useState<"Gelatin" | "HPMC">("Gelatin");
  const [servingsPerContainer, setServingsPerContainer] = useState("60");

  const [dannyReply, setDannyReply] = useState<string>("");
  const [dannyLoading, setDannyLoading] = useState(false);

  const [pending, startTransition] = useTransition();

  // Load RFQ on mount
  useEffect(() => {
    if (!rfqId) {
      setLoading(false);
      setError("No rfqId in URL — open this page from the Magic Box submit step.");
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/intake/${rfqId}`);
        if (!res.ok) throw new Error(`RFQ ${rfqId} not found`);
        const data = await res.json();
        if (cancelled) return;
        setRfq(data);
        setDosageForm((data.dosageForm as "CAPSULE" | "TABLET" | "POWDER") ?? "");
        if (data.servingsPerContainer) setServingsPerContainer(String(data.servingsPerContainer));

        // Parse formulaJson and seed lines
        const parsed: ParsedFormula[] = data.formulaJson ? JSON.parse(data.formulaJson) : [];
        const actives = parsed.filter((p) => p.isActive);
        const seeded: FormulationLine[] = actives.map((p, idx) => ({
          key: `line_${idx}_${p.id ?? Math.random().toString(36).slice(2, 9)}`,
          rawName: p.name,
          match: null,
          searching: false,
          searchResults: [],
          labelClaimMg: toMg(parseFloat(p.amount) || 0, p.unit, p.name),
          unit: "mg",
          notes: p.notes ?? "",
          overagePct: 10,
          wastagePct: 3,
        }));
        setLines(seeded);

        // Auto-search each line against ingredient DB
        for (const line of seeded) await autoMatch(line.key, line.rawName);
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        if (!cancelled) setError(msg);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rfqId]);

  async function autoMatch(key: string, name: string) {
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, searching: true } : l)));
    try {
      const cleaned = name.replace(/[®™©]/g, "").trim();
      const res = await fetch(`/api/ingredients/search?q=${encodeURIComponent(cleaned)}&limit=5`);
      if (!res.ok) throw new Error("search failed");
      const matches = (await res.json()) as IngredientMatch[];
      setLines((prev) =>
        prev.map((l) =>
          l.key === key
            ? {
                ...l,
                searching: false,
                searchResults: matches,
                match: matches[0] ?? null,
                overagePct: pickOverage(matches[0], dosageForm),
                wastagePct: pickWastage(matches[0], dosageForm),
              }
            : l,
        ),
      );
    } catch {
      setLines((prev) => prev.map((l) => (l.key === key ? { ...l, searching: false } : l)));
    }
  }

  function pickOverage(m: IngredientMatch | null | undefined, form: string): number {
    if (!m) return 10;
    if (form === "CAPSULE" && m.overageCapsule) return parseFloat(m.overageCapsule);
    if (form === "TABLET" && m.overageTablet) return parseFloat(m.overageTablet);
    if (form === "POWDER" && m.overagePowder) return parseFloat(m.overagePowder);
    if (m.baseOveragePct) return parseFloat(m.baseOveragePct);
    return 10;
  }
  function pickWastage(m: IngredientMatch | null | undefined, form: string): number {
    if (!m) return 3;
    if (m.baseWastagePct) return parseFloat(m.baseWastagePct);
    return 3;
  }

  // Deterministic calculations — pure, run on every render
  const calc = useMemo(() => {
    const totalActiveMg = lines.reduce((sum, l) => sum + (Number.isFinite(l.labelClaimMg) ? l.labelClaimMg : 0), 0);

    if (dosageForm !== "CAPSULE" || totalActiveMg <= 0) {
      return { totalActiveMg, sizing: null, excipients: null };
    }

    // Apply +18% provisional excipient allowance for Phase 1 sizing
    const planFill = totalActiveMg * 1.18;
    const sizing = sizeCapsule(planFill);

    let excipients = null;
    if (sizing.feasible) {
      const targetFillMgPerServing = sizing.totalMgPerCapsule * sizing.capsulesPerServing;
      const complexity = determineComplexity(lines.length, false, false);
      excipients = calculateExcipients(totalActiveMg, targetFillMgPerServing, complexity);
    }
    return { totalActiveMg, sizing, excipients };
  }, [lines, dosageForm]);

  async function askDanny() {
    if (lines.length === 0 || !dosageForm) return;
    setDannyLoading(true);
    setDannyReply("");
    try {
      // Pass the deterministic formula so Danny enriches rather than recomputes.
      // If the API fails, the deterministic sizing/excipient table still renders.
      const precomputed = calc.sizing
        ? {
            totalActiveMg: calc.totalActiveMg,
            capsuleSize: calc.sizing.capsuleSize,
            capsulesPerServing: calc.sizing.capsulesPerServing,
            totalMgPerCapsule: calc.sizing.totalMgPerCapsule,
            fillPercentage: calc.sizing.fillPercentage,
            feasible: calc.sizing.feasible,
            warnings: calc.sizing.warnings,
            excipients: calc.excipients ?? undefined,
          }
        : undefined;

      const res = await fetch("/api/danny", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          actives: lines.map((l) => ({ name: l.rawName, amount: l.labelClaimMg, unit: "mg", notes: l.notes })),
          dosageForm,
          capsuleShell,
          servingsPerContainer: parseInt(servingsPerContainer, 10) || undefined,
          precomputed,
        }),
      });
      const data = await res.json();
      if (res.status === 429) {
        setDannyReply(`AI commentary unavailable: ${data.error}. The deterministic formula above is unaffected.`);
      } else if (data.success) {
        setDannyReply(data.reply);
      } else {
        setDannyReply(`AI commentary unavailable: ${data.error ?? "unknown error"}. The deterministic formula above is unaffected.`);
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setDannyReply(`Error: ${msg}`);
    } finally {
      setDannyLoading(false);
    }
  }

  function updateLine(key: string, patch: Partial<FormulationLine>) {
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  }

  async function save() {
    if (!rfq) return;
    if (!dosageForm) return alert("Pick a dosage form first.");
    if (lines.length === 0) return alert("Add at least one ingredient.");

    const productName = rfq.productName ?? `Formulation for ${rfq.rfqNumber}`;
    const ingredientsPayload = lines.map((l) => ({
      ingredientId: l.match?.id ?? undefined,
      name: l.match?.name ?? l.rawName,
      labelClaimMg: l.labelClaimMg,
      activeContentPct: l.match ? parseFloat(l.match.activeContentPct) : 100,
      overagePct: l.overagePct,
      wastagePct: l.wastagePct,
      costPerKg: l.match ? parseFloat(l.match.costPerKg) : 0,
      isExcipient: false,
    }));

    // Add excipients if we computed them
    if (calc.excipients?.excipients) {
      for (const e of calc.excipients.excipients) {
        ingredientsPayload.push({
          ingredientId: undefined,
          name: e.name,
          labelClaimMg: e.mg,
          activeContentPct: 100,
          overagePct: 0,
          wastagePct: 0,
          costPerKg: 0,
          isExcipient: true,
        });
      }
    }

    startTransition(async () => {
      try {
        const res = await fetch("/api/formulations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: productName,
            customerId: rfq.customerId ?? undefined,
            rfqId: rfq.id,
            dosageForm: capitalize(dosageForm),
            capsuleSize: calc.sizing?.feasible ? calc.sizing.capsuleSize : null,
            capsulesPerServing: calc.sizing?.feasible ? calc.sizing.capsulesPerServing : 1,
            servingsPerContainer: parseInt(servingsPerContainer, 10) || null,
            totalFillMg: calc.sizing?.feasible ? calc.sizing.totalMgPerServing : null,
            fillPercentage: calc.sizing?.feasible ? calc.sizing.fillPercentage : null,
            excipientComplexity: calc.excipients ? determineComplexity(lines.length, false, false) : "standard",
            status: "Draft",
            notes: dannyReply || null,
            ingredients: ingredientsPayload,
          }),
        });
        const data = await res.json();
        if (data.success) router.push(`/formulations/${data.formulationId}`);
        else alert(`Save failed: ${data.error}`);
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        alert(`Save failed: ${msg}`);
      }
    });
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
      </div>
    );
  }

  if (error || !rfq) {
    return (
      <div className="max-w-3xl mx-auto bg-amber-50 border border-amber-200 rounded-md p-5">
        <div className="flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-700 flex-shrink-0 mt-0.5" />
          <div>
            <h2 className="text-sm font-semibold text-amber-900">Cannot start formulation</h2>
            <p className="text-xs text-amber-800 mt-1">{error ?? "RFQ not found"}</p>
          </div>
        </div>
      </div>
    );
  }

  const submitDisabled = !dosageForm || lines.length === 0 || !calc.sizing?.feasible;

  return (
    <div className="max-w-6xl mx-auto pb-24">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <FlaskConical className="h-5 w-5 text-[#d10a11]" />
            Bench Formulation
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Source: <code className="font-mono">{rfq.rfqNumber}</code> · {rfq.productName ?? "—"}
          </p>
        </div>
      </div>

      {/* Format & shell */}
      <section className="bg-white border border-slate-200 rounded-lg p-5 mb-4 shadow-sm">
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wide mb-2">Dosage Form</label>
            <div className="flex gap-2">
              {(["CAPSULE", "TABLET", "POWDER"] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setDosageForm(f)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-md border transition-colors ${
                    dosageForm === f ? "bg-[#d10a11] border-[#d10a11] text-white" : "bg-white border-slate-300 text-slate-700"
                  }`}
                >
                  {capitalize(f)}
                </button>
              ))}
            </div>
          </div>
          {dosageForm === "CAPSULE" && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wide mb-2">Capsule Shell</label>
              <div className="flex gap-2">
                {(["Gelatin", "HPMC"] as const).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setCapsuleShell(s)}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-md border ${
                      capsuleShell === s ? "bg-slate-800 border-slate-800 text-white" : "bg-white border-slate-300 text-slate-700"
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wide mb-2">Servings / Container</label>
            <input
              value={servingsPerContainer}
              onChange={(e) => setServingsPerContainer(e.target.value)}
              className="w-full border border-slate-300 rounded-md px-3 py-1.5 text-sm"
            />
          </div>
        </div>
      </section>

      {/* Ingredient lines */}
      <section className="bg-white border border-slate-200 rounded-lg p-5 mb-4 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-800 mb-3">Active Ingredients ({lines.length})</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600">
                <th className="text-left px-2 py-2 font-medium">Source</th>
                <th className="text-left px-2 py-2 font-medium">Matched Ingredient</th>
                <th className="text-right px-2 py-2 font-medium w-24">Label Claim mg</th>
                <th className="text-right px-2 py-2 font-medium w-20">Active %</th>
                <th className="text-right px-2 py-2 font-medium w-20">Overage %</th>
                <th className="text-right px-2 py-2 font-medium w-20">Wastage %</th>
                <th className="text-right px-2 py-2 font-medium w-20">$/Kg</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {lines.map((line) => (
                <tr key={line.key}>
                  <td className="px-2 py-1.5 text-slate-900">{line.rawName}</td>
                  <td className="px-2 py-1.5">
                    {line.searching ? (
                      <span className="text-slate-400 inline-flex items-center gap-1"><Search className="h-3 w-3" /> searching…</span>
                    ) : line.match ? (
                      <select
                        value={line.match.id}
                        onChange={(e) => {
                          const next = line.searchResults.find((m) => m.id === e.target.value);
                          if (next) {
                            updateLine(line.key, { match: next, overagePct: pickOverage(next, dosageForm), wastagePct: pickWastage(next, dosageForm) });
                          }
                        }}
                        className="w-full border border-slate-200 rounded px-2 py-1 text-xs"
                      >
                        {line.searchResults.map((m) => (
                          <option key={m.id} value={m.id}>{m.rmId} · {m.name} · ${m.costPerKg}/kg</option>
                        ))}
                      </select>
                    ) : (
                      <span className="text-amber-700 text-xs">No match — will be saved as ad-hoc.</span>
                    )}
                  </td>
                  <td className="px-2 py-1.5 text-right tabular-nums">
                    <input
                      type="number"
                      value={line.labelClaimMg}
                      onChange={(e) => updateLine(line.key, { labelClaimMg: parseFloat(e.target.value) || 0 })}
                      className="w-20 text-right border border-transparent hover:border-slate-200 focus:border-[#d10a11] focus:outline-none rounded px-1 py-0.5 tabular-nums"
                    />
                  </td>
                  <td className="px-2 py-1.5 text-right tabular-nums text-slate-600">{line.match?.activeContentPct ?? "—"}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums">
                    <input
                      type="number"
                      value={line.overagePct}
                      onChange={(e) => updateLine(line.key, { overagePct: parseFloat(e.target.value) || 0 })}
                      className="w-14 text-right border border-transparent hover:border-slate-200 focus:border-[#d10a11] focus:outline-none rounded px-1 py-0.5"
                    />
                  </td>
                  <td className="px-2 py-1.5 text-right tabular-nums">
                    <input
                      type="number"
                      value={line.wastagePct}
                      onChange={(e) => updateLine(line.key, { wastagePct: parseFloat(e.target.value) || 0 })}
                      className="w-14 text-right border border-transparent hover:border-slate-200 focus:border-[#d10a11] focus:outline-none rounded px-1 py-0.5"
                    />
                  </td>
                  <td className="px-2 py-1.5 text-right tabular-nums text-slate-700">{line.match ? `$${line.match.costPerKg}` : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Sizing & Excipients */}
      <section className="grid grid-cols-2 gap-4 mb-4">
        <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-800 mb-3">Phase 1 — Capsule Sizing</h2>
          {dosageForm !== "CAPSULE" ? (
            <p className="text-xs text-slate-500">Sizing only applies to capsule formats.</p>
          ) : !calc.sizing ? (
            <p className="text-xs text-slate-500">Add ingredients to size.</p>
          ) : !calc.sizing.feasible ? (
            <div className="bg-red-50 border border-red-200 rounded p-3 text-xs text-red-800">
              <strong>Not feasible:</strong> {calc.sizing.recommendation}
            </div>
          ) : (
            <dl className="grid grid-cols-2 gap-y-2 gap-x-4 text-sm">
              <dt className="text-slate-500 text-xs">Total Active</dt>
              <dd className="text-slate-900 font-mono tabular-nums">{calc.totalActiveMg.toFixed(1)} mg</dd>
              <dt className="text-slate-500 text-xs">Capsule Size</dt>
              <dd className="text-slate-900 font-semibold">{calc.sizing.capsuleSize}</dd>
              <dt className="text-slate-500 text-xs">Capsules / Serving</dt>
              <dd className="text-slate-900">{calc.sizing.capsulesPerServing}</dd>
              <dt className="text-slate-500 text-xs">Fill / Capsule</dt>
              <dd className="text-slate-900 font-mono tabular-nums">{calc.sizing.totalMgPerCapsule.toFixed(1)} mg</dd>
              <dt className="text-slate-500 text-xs">Fill %</dt>
              <dd className="text-slate-900 font-mono tabular-nums">{calc.sizing.fillPercentage.toFixed(1)}%</dd>
              <dt className="text-slate-500 text-xs">Shell</dt>
              <dd className="text-slate-900">{capsuleShell}</dd>
            </dl>
          )}
          {calc.sizing?.warnings && calc.sizing.warnings.length > 0 && (
            <div className="mt-3 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded p-2">
              {calc.sizing.warnings.join(" ")}
            </div>
          )}
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-800 mb-3">Phase 2 — Excipients</h2>
          {!calc.excipients ? (
            <p className="text-xs text-slate-500">Run sizing first.</p>
          ) : !calc.excipients.feasible ? (
            <div className="bg-red-50 border border-red-200 rounded p-3 text-xs text-red-800">
              <strong>Not feasible:</strong> {calc.excipients.reason}
            </div>
          ) : (
            <table className="w-full text-xs">
              <thead className="text-slate-500">
                <tr><th className="text-left pb-1">Ingredient</th><th className="text-right pb-1">mg</th><th className="text-right pb-1">%</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {calc.excipients.excipients.map((e, i) => (
                  <tr key={i}>
                    <td className="py-1 text-slate-700">{e.name}</td>
                    <td className="py-1 text-right tabular-nums">{e.mg.toFixed(1)}</td>
                    <td className="py-1 text-right tabular-nums text-slate-500">{e.pct.toFixed(2)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      {/* Danny narrative */}
      <section className="bg-white border border-slate-200 rounded-lg p-5 mb-4 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
            <Bot className="h-4 w-4 text-[#d10a11]" /> Danny — Bench Formulator
          </h2>
          <button
            onClick={askDanny}
            disabled={dannyLoading || lines.length === 0 || !dosageForm}
            className="inline-flex items-center gap-2 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-white text-xs font-medium rounded-md"
          >
            {dannyLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
            Ask Danny
          </button>
        </div>
        {dannyLoading ? (
          <p className="text-xs text-slate-500">Danny is thinking…</p>
        ) : dannyReply ? (
          <div className="text-sm text-slate-800 whitespace-pre-wrap font-mono leading-relaxed bg-slate-50 border border-slate-200 rounded-md p-4 max-h-[500px] overflow-y-auto">
            {dannyReply}
          </div>
        ) : (
          <p className="text-xs text-slate-500">Click "Ask Danny" for a GMP bench formulation review.</p>
        )}
      </section>

      {/* Sticky save bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 px-6 py-3 flex items-center justify-between z-10">
        <div className="text-xs text-slate-500">
          Linking to RFQ <code className="font-mono">{rfq.rfqNumber}</code>. Saving will set its status to <span className="font-medium text-slate-700">Formulating</span>.
        </div>
        <button
          onClick={save}
          disabled={submitDisabled || pending}
          title={submitDisabled ? "Add ingredients and confirm a feasible capsule size to save." : "Save formulation"}
          className="inline-flex items-center gap-2 px-4 py-2 bg-[#d10a11] hover:bg-[#a30a0f] disabled:opacity-50 text-white text-sm font-semibold rounded-md transition-colors"
        >
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Save Formulation
        </button>
      </div>
    </div>
  );
}

function capitalize(s: string): string {
  return s.charAt(0) + s.slice(1).toLowerCase();
}
