"use client";

/**
 * COA editor — fill in test results, sign, release.
 *
 * QC workflow:
 *   1. Open a freshly-generated COA. Test rows show "TBD" results.
 *   2. Fill in actual result strings + status per row.
 *   3. For potency rows, optionally enter % of label claim.
 *   4. Capture signatures: QC Analyst, QC Manager, QA Release (name + date).
 *   5. Pick disposition (default: Approved for Release).
 *   6. Click Save → PATCH /api/coas/[id] persists everything.
 *
 * Once disposition is non-Quarantine and all 3 signatures are filled, the COA
 * is considered "released". The xlsx download will then carry full results.
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Save, FileSpreadsheet, AlertTriangle, CheckCircle2 } from "lucide-react";

interface TestRow {
  id: string;
  category: string;
  testName: string;
  specification: string;
  result: string;
  pctOfLabelClaim: string | null;
  method: string;
  status: string;
  sortOrder: number;
}

interface CoaShape {
  id: string;
  coaNumber: string;
  disposition: string;
  qcAnalyst: string | null;
  qcAnalystSignatureDate: string | null;
  qcManager: string | null;
  qcManagerSignatureDate: string | null;
  qaRelease: string | null;
  qaReleaseSignatureDate: string | null;
  labSampleId: string | null;
  notes: string | null;
}

const STATUS_COLOR: Record<string, string> = {
  Pass: "text-emerald-700 bg-emerald-50 border-emerald-200",
  Fail: "text-red-700 bg-red-50 border-red-200",
  OOS: "text-amber-700 bg-amber-50 border-amber-200",
};

const DISPOSITIONS = ["Approved for Release", "Quarantine", "Reject"] as const;
const STATUSES = ["Pass", "Fail", "OOS"] as const;

export function CoaEditor({ coa: initialCoa, tests: initialTests }: { coa: CoaShape; tests: TestRow[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [coa, setCoa] = useState(initialCoa);
  const [tests, setTests] = useState(initialTests);
  const [dirty, setDirty] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);

  function updateTest(id: string, patch: Partial<TestRow>) {
    setTests((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
    setDirty(true);
  }

  function updateCoa(patch: Partial<CoaShape>) {
    setCoa((prev) => ({ ...prev, ...patch }));
    setDirty(true);
  }

  async function save() {
    start(async () => {
      const res = await fetch(`/api/coas/${coa.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          disposition: coa.disposition,
          qcAnalyst: coa.qcAnalyst || null,
          qcAnalystSignatureDate: coa.qcAnalystSignatureDate || null,
          qcManager: coa.qcManager || null,
          qcManagerSignatureDate: coa.qcManagerSignatureDate || null,
          qaRelease: coa.qaRelease || null,
          qaReleaseSignatureDate: coa.qaReleaseSignatureDate || null,
          labSampleId: coa.labSampleId || null,
          notes: coa.notes || null,
          tests: tests.map((t) => ({
            id: t.id,
            result: t.result,
            status: t.status,
            pctOfLabelClaim: t.pctOfLabelClaim ? parseFloat(t.pctOfLabelClaim) : null,
          })),
        }),
      });
      if (res.ok) {
        setDirty(false);
        setSavedAt(new Date());
        router.refresh();
      } else {
        const data = await res.json().catch(() => ({}));
        alert(`Save failed: ${data.error || res.status}`);
      }
    });
  }

  const tbdCount = tests.filter((t) => t.result === "TBD" || !t.result.trim()).length;
  const failCount = tests.filter((t) => t.status === "Fail" || t.status === "OOS").length;
  const isReadyToRelease = tbdCount === 0 && coa.qcAnalyst && coa.qcManager && coa.qaRelease;

  const physical = tests.filter((t) => t.category === "Physical").sort((a, b) => a.sortOrder - b.sortOrder);
  const potency = tests.filter((t) => t.category === "Potency").sort((a, b) => a.sortOrder - b.sortOrder);
  const microbial = tests.filter((t) => t.category === "Microbial").sort((a, b) => a.sortOrder - b.sortOrder);
  const heavyMetals = tests.filter((t) => t.category === "Heavy Metal").sort((a, b) => a.sortOrder - b.sortOrder);

  return (
    <div className="space-y-4">
      {/* Status banner */}
      {tbdCount > 0 && (
        <div className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-4 py-2 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 flex-shrink-0" />
          <span><strong>{tbdCount} test{tbdCount !== 1 && "s"}</strong> still showing "TBD". Fill in actual results below before signing release.</span>
        </div>
      )}
      {failCount > 0 && (
        <div className="text-xs text-red-800 bg-red-50 border border-red-200 rounded-md px-4 py-2 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 flex-shrink-0" />
          <span><strong>{failCount} test{failCount !== 1 && "s"}</strong> marked Fail or OOS. Disposition should not be "Approved for Release".</span>
        </div>
      )}
      {tbdCount === 0 && failCount === 0 && coa.disposition === "Approved for Release" && (
        <div className="text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-md px-4 py-2 flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
          <span>All tests pass. Ready to sign and release.</span>
        </div>
      )}

      {/* Disposition + lab info */}
      <section className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-800 mb-3">Disposition &amp; Lab Info</h2>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 uppercase tracking-wide mb-1">Disposition</label>
            <select
              value={coa.disposition}
              onChange={(e) => updateCoa({ disposition: e.target.value })}
              className="w-full border border-slate-300 rounded-md px-2 py-1.5 text-sm"
            >
              {DISPOSITIONS.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          <div className="col-span-2">
            <label className="block text-xs font-medium text-slate-600 uppercase tracking-wide mb-1">Lab Sample ID</label>
            <input
              value={coa.labSampleId ?? ""}
              onChange={(e) => updateCoa({ labSampleId: e.target.value })}
              placeholder="e.g. QC-2508-231-FP"
              className="w-full border border-slate-300 rounded-md px-2 py-1.5 text-sm font-mono"
            />
          </div>
        </div>
      </section>

      {/* Test results */}
      {[
        { title: "Physical Specifications", rows: physical, hasPctLc: false },
        { title: "Potency Analysis — Per Serving (21 CFR 101.9(g)(4)(i))", rows: potency, hasPctLc: true },
        { title: "Microbial Analysis", rows: microbial, hasPctLc: false },
        { title: "Heavy Metal Analysis (Per Daily Dose)", rows: heavyMetals, hasPctLc: false },
      ].map(
        (section) =>
          section.rows.length > 0 && (
            <section key={section.title} className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm">
              <h2 className="text-sm font-semibold text-slate-800 px-5 py-3 border-b border-slate-200 bg-slate-50">{section.title}</h2>
              <table className="w-full text-xs">
                <thead className="bg-slate-50 text-slate-500">
                  <tr>
                    <th className="text-left px-4 py-2 font-medium w-1/4">Test</th>
                    <th className="text-left px-4 py-2 font-medium w-1/4">Specification</th>
                    <th className="text-left px-4 py-2 font-medium w-1/6">Result</th>
                    {section.hasPctLc && <th className="text-right px-4 py-2 font-medium w-16">% LC</th>}
                    <th className="text-left px-4 py-2 font-medium w-24">Method</th>
                    <th className="text-left px-4 py-2 font-medium w-24">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {section.rows.map((t) => (
                    <tr key={t.id}>
                      <td className="px-4 py-1.5 text-slate-900">{t.testName}</td>
                      <td className="px-4 py-1.5 text-slate-700">{t.specification}</td>
                      <td className="px-4 py-1.5">
                        <input
                          value={t.result}
                          onChange={(e) => updateTest(t.id, { result: e.target.value })}
                          placeholder="TBD"
                          className={`w-full border rounded px-2 py-1 text-xs ${t.result === "TBD" || !t.result.trim() ? "border-amber-300 bg-amber-50/50" : "border-slate-200"}`}
                        />
                      </td>
                      {section.hasPctLc && (
                        <td className="px-4 py-1.5">
                          <input
                            type="number"
                            step="0.1"
                            value={t.pctOfLabelClaim ?? ""}
                            onChange={(e) => updateTest(t.id, { pctOfLabelClaim: e.target.value || null })}
                            placeholder="%"
                            className="w-full border border-slate-200 rounded px-2 py-1 text-xs text-right tabular-nums"
                          />
                        </td>
                      )}
                      <td className="px-4 py-1.5 text-slate-600">{t.method}</td>
                      <td className="px-4 py-1.5">
                        <select
                          value={t.status}
                          onChange={(e) => updateTest(t.id, { status: e.target.value })}
                          className={`w-full border rounded px-2 py-1 text-xs font-semibold ${STATUS_COLOR[t.status] ?? "border-slate-200"}`}
                        >
                          {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          ),
      )}

      {/* Signatures */}
      <section className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-800 mb-3">Approval Signatures</h2>
        <div className="grid grid-cols-3 gap-4">
          <SignatureField
            label="QC Analyst"
            name={coa.qcAnalyst ?? ""}
            date={coa.qcAnalystSignatureDate ?? ""}
            onChangeName={(v) => updateCoa({ qcAnalyst: v })}
            onChangeDate={(v) => updateCoa({ qcAnalystSignatureDate: v })}
          />
          <SignatureField
            label="QC Manager / Reviewer"
            name={coa.qcManager ?? ""}
            date={coa.qcManagerSignatureDate ?? ""}
            onChangeName={(v) => updateCoa({ qcManager: v })}
            onChangeDate={(v) => updateCoa({ qcManagerSignatureDate: v })}
          />
          <SignatureField
            label="QA Release Authorization"
            name={coa.qaRelease ?? ""}
            date={coa.qaReleaseSignatureDate ?? ""}
            onChangeName={(v) => updateCoa({ qaRelease: v })}
            onChangeDate={(v) => updateCoa({ qaReleaseSignatureDate: v })}
          />
        </div>
      </section>

      {/* Notes */}
      <section className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm">
        <label className="block text-sm font-semibold text-slate-800 mb-2">Internal Notes</label>
        <textarea
          value={coa.notes ?? ""}
          onChange={(e) => updateCoa({ notes: e.target.value })}
          placeholder="Optional. Private to QC team — does not appear on customer COA."
          rows={2}
          className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
        />
      </section>

      {/* Sticky save bar */}
      <div className="fixed bottom-0 left-52 right-0 bg-white border-t border-slate-200 px-6 py-3 flex items-center justify-between z-10 shadow-[0_-2px_8px_rgba(0,0,0,0.04)]">
        <div className="text-xs text-slate-600 flex items-center gap-3">
          {dirty ? (
            <span className="text-amber-700 flex items-center gap-1.5"><AlertTriangle className="h-3.5 w-3.5" /> Unsaved changes</span>
          ) : savedAt ? (
            <span className="text-emerald-700 flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5" /> Saved {savedAt.toLocaleTimeString()}</span>
          ) : (
            <span className="text-slate-500">No changes yet</span>
          )}
          {isReadyToRelease && coa.disposition === "Approved for Release" && (
            <span className="text-emerald-700 font-medium">· Ready for release</span>
          )}
        </div>
        <div className="flex gap-2">
          <a
            href={`/api/coas/${coa.id}/xlsx`}
            className="inline-flex items-center gap-2 px-4 py-2 border border-slate-300 hover:bg-slate-50 text-slate-700 text-sm font-medium rounded-md"
          >
            <FileSpreadsheet className="h-4 w-4" /> Download Excel
          </a>
          <button
            onClick={save}
            disabled={!dirty || pending}
            className="inline-flex items-center gap-2 px-4 py-2 bg-[#d10a11] hover:bg-[#a30a0f] disabled:opacity-50 text-white text-sm font-semibold rounded-md transition-colors"
          >
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}

function SignatureField({
  label,
  name,
  date,
  onChangeName,
  onChangeDate,
}: {
  label: string;
  name: string;
  date: string;
  onChangeName: (v: string) => void;
  onChangeDate: (v: string) => void;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-600 uppercase tracking-wide mb-1">{label}</label>
      <input
        value={name}
        onChange={(e) => onChangeName(e.target.value)}
        placeholder="Printed name"
        className="w-full border border-slate-300 rounded-md px-2 py-1.5 text-sm mb-1"
      />
      <input
        type="date"
        value={date}
        onChange={(e) => onChangeDate(e.target.value)}
        className="w-full border border-slate-300 rounded-md px-2 py-1.5 text-sm"
      />
    </div>
  );
}
