"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Loader2, ArrowLeft } from "lucide-react";

// For now, redirect to deals/new with the deal data loaded
// Full workbench reuse will come in the next iteration

export default function DealDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const [deal, setDeal] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/deals/${id}`)
      .then((r) => r.json())
      .then((d) => { if (!d.error) setDeal(d); })
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 text-gray-300 animate-spin" />
      </div>
    );
  }

  if (!deal) {
    return (
      <div className="text-center py-20">
        <p className="text-gray-500">Deal not found.</p>
        <button onClick={() => router.push("/deals")} className="mt-4 text-sm text-[#d10a11] hover:underline">← Back to Deals</button>
      </div>
    );
  }

  const meta = deal.formulaJson ? safeJSON(deal.formulaJson) : [];

  const STATUS_COLORS: Record<string, string> = {
    New: "bg-blue-100 text-blue-700",
    Formulating: "bg-purple-100 text-purple-700",
    Quoted: "bg-green-100 text-green-700",
    Sent: "bg-indigo-100 text-indigo-700",
    Accepted: "bg-emerald-100 text-emerald-700",
    Rejected: "bg-red-100 text-red-700",
  };

  return (
    <div className="max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push("/deals")} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-900">{deal.productName || "Untitled Deal"}</h1>
              <span className={`px-2.5 py-1 text-xs font-medium rounded-full ${STATUS_COLORS[deal.status] || STATUS_COLORS.New}`}>{deal.status}</span>
            </div>
            <p className="text-sm text-gray-500 font-mono">{deal.rfqNumber} · {deal.customerCompany || "No customer"}</p>
          </div>
        </div>
      </div>

      {/* Deal Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <InfoCard label="Product" items={[
          ["Name", deal.productName || "—"],
          ["Format", deal.dosageForm || "—"],
          ["Serving", `${deal.servingSize || "—"} per serving`],
          ["Count/Bottle", deal.countPerBottle || "—"],
          ["Flavor", deal.flavor || "—"],
        ]} />
        <InfoCard label="Customer" items={[
          ["Company", deal.customerCompany || "—"],
          ["Contact", deal.customerContact || "—"],
          ["Email", deal.customerEmail || "—"],
          ["Phone", deal.customerPhone || "—"],
          ["Source", deal.source || "—"],
        ]} />
        <InfoCard label="Manufacturing" items={[
          ["MOQ", deal.moq ? `${deal.moq} units` : "—"],
          ["Timeline", deal.targetTimeline || "—"],
          ["Priority", deal.priority || "Normal"],
          ["Packaging", deal.primaryPackaging || "—"],
          ["Label", deal.labelStatus || "—"],
        ]} />
      </div>

      {/* Formula */}
      {Array.isArray(meta) && meta.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm mb-6">
          <h2 className="text-sm font-semibold text-gray-900 mb-3">Formula ({meta.length} ingredients)</h2>
          <table className="w-full text-xs">
            <thead>
              <tr className="text-gray-500 font-medium border-b">
                <th className="text-left py-2">Ingredient</th>
                <th className="text-right py-2">Label Claim</th>
                <th className="text-right py-2">Cost/Kg</th>
                <th className="text-center py-2">In DB</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {meta.map((ing: any, i: number) => (
                <tr key={i}>
                  <td className="py-2 font-medium text-gray-900">{ing.name}</td>
                  <td className="py-2 text-right">{ing.labelClaimMg || ing.amount || "—"} mg</td>
                  <td className="py-2 text-right">${ing.costPerKg || "—"}</td>
                  <td className="py-2 text-center">
                    {ing.inDb || ing.dbMatch ? (
                      <span className="text-green-600 text-[10px]">✓</span>
                    ) : (
                      <span className="text-red-500 text-[10px]">✗</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Notes */}
      {(deal.internalNotes || deal.customerNotes) && (
        <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm mb-6">
          <h2 className="text-sm font-semibold text-gray-900 mb-3">Notes</h2>
          {deal.internalNotes && (
            <div className="mb-3">
              <p className="text-[10px] text-gray-500 uppercase font-medium">Internal</p>
              <p className="text-sm text-gray-700">{deal.internalNotes}</p>
            </div>
          )}
          {deal.customerNotes && (
            <div>
              <p className="text-[10px] text-gray-500 uppercase font-medium">Customer</p>
              <p className="text-sm text-gray-700">{deal.customerNotes}</p>
            </div>
          )}
        </div>
      )}

      {/* Timestamps */}
      <div className="text-xs text-gray-400">
        Created: {new Date(deal.createdAt).toLocaleString()} · Updated: {new Date(deal.updatedAt).toLocaleString()}
      </div>
    </div>
  );
}

function InfoCard({ label, items }: { label: string; items: [string, string][] }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">{label}</h3>
      <div className="space-y-2">
        {items.map(([k, v]) => (
          <div key={k} className="flex justify-between text-sm">
            <span className="text-gray-500">{k}</span>
            <span className="font-medium text-gray-900">{v}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function safeJSON(str: string): any[] {
  try { return JSON.parse(str); } catch { return []; }
}
