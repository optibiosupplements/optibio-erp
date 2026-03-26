"use client";

import { FileDown, Save, Loader2, Send } from "lucide-react";

interface CostSummaryProps {
  dealNumber: string;
  status: string;
  rmCost: number;
  mfgCost: number;
  pkgCost: number;
  overheadCost: number;
  cogs: number;
  tiers: { quantity: number; marginPct: number; price: number; total: number }[];
  ingredientCount: number;
  fillMg: number;
  hasEstimated: boolean;
  saving: boolean;
  onSave: () => void;
  onGeneratePdf?: () => void;
}

const STATUS_COLORS: Record<string, string> = {
  New: "bg-blue-100 text-blue-700",
  Formulating: "bg-purple-100 text-purple-700",
  Quoted: "bg-green-100 text-green-700",
  Sent: "bg-indigo-100 text-indigo-700",
  Accepted: "bg-emerald-100 text-emerald-700",
  Rejected: "bg-red-100 text-red-700",
};

export default function CostSummaryPanel({
  dealNumber,
  status,
  rmCost,
  mfgCost,
  pkgCost,
  overheadCost,
  cogs,
  tiers,
  ingredientCount,
  fillMg,
  hasEstimated,
  saving,
  onSave,
  onGeneratePdf,
}: CostSummaryProps) {
  return (
    <div className="sticky top-6 space-y-4">
      {/* Deal Header */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-mono font-semibold text-gray-500">{dealNumber || "New Deal"}</p>
          <span className={`px-2.5 py-1 text-[10px] font-semibold rounded-full ${STATUS_COLORS[status] || STATUS_COLORS.New}`}>
            {status}
          </span>
        </div>
        <div className="flex gap-4 text-xs text-gray-500">
          <span>{ingredientCount} ingredients</span>
          <span>{fillMg > 0 ? `${fillMg.toFixed(0)}mg fill` : "—"}</span>
        </div>
      </div>

      {/* Cost Breakdown */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Cost / Bottle</h3>
        <div className="space-y-2 text-sm">
          <CostRow label="Raw Materials" value={rmCost} />
          <CostRow label="Manufacturing" value={mfgCost} />
          <CostRow label="Packaging" value={pkgCost} />
          <CostRow label="Overhead (15%)" value={overheadCost} muted />
          <div className="border-t pt-2 mt-2">
            <CostRow label="COGS" value={cogs} bold />
          </div>
        </div>
      </div>

      {/* Tiered Pricing */}
      {cogs > 0 && (
        <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Tiered Pricing</h3>
          <div className="space-y-3">
            {tiers.map((tier, i) => (
              <div key={tier.quantity} className={`p-3 rounded-xl border ${i === 1 ? "border-[#d10a11] bg-red-50/30" : "border-gray-100"}`}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-bold text-gray-900">{tier.quantity.toLocaleString()}</span>
                  {i === 1 && <span className="text-[9px] font-bold text-[#d10a11] uppercase">Best Value</span>}
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-500">{tier.marginPct}% margin</span>
                  <span className="font-mono font-bold text-gray-900">${tier.price.toFixed(2)}/btl</span>
                </div>
                <div className="text-right text-[10px] text-gray-400 mt-0.5">
                  ${tier.total.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })} total
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Estimated Warning */}
      {hasEstimated && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
          <p className="text-[10px] font-semibold text-amber-700">⚠ Some prices are estimated</p>
          <p className="text-[10px] text-amber-600 mt-0.5">Verify with suppliers before sending.</p>
        </div>
      )}

      {/* Actions */}
      <div className="space-y-2">
        <button
          onClick={onSave}
          disabled={saving}
          className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 bg-[#d10a11] text-white font-semibold rounded-xl hover:bg-[#a30a0f] transition-colors shadow-sm disabled:opacity-50 text-sm"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {saving ? "Saving..." : "Save Deal"}
        </button>

        {cogs > 0 && onGeneratePdf && (
          <button
            onClick={onGeneratePdf}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-gray-900 text-white font-medium rounded-xl hover:bg-gray-800 transition-colors text-sm"
          >
            <FileDown className="h-4 w-4" /> Generate PDF Quote
          </button>
        )}
      </div>
    </div>
  );
}

function CostRow({ label, value, bold, muted }: { label: string; value: number; bold?: boolean; muted?: boolean }) {
  return (
    <div className="flex justify-between">
      <span className={`${muted ? "text-gray-400" : "text-gray-600"} ${bold ? "font-semibold" : ""}`}>{label}</span>
      <span className={`font-mono ${bold ? "font-bold text-[#d10a11]" : ""} ${muted ? "text-gray-400" : ""}`}>
        ${value.toFixed(value >= 1 ? 2 : 4)}
      </span>
    </div>
  );
}
