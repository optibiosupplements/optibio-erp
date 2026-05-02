"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, ShoppingCart } from "lucide-react";

interface TierOption {
  tierQuantity: number;
  pricePerUnit: number;
  marginPct: number;
}

export function AcceptQuoteButton({ quoteId, quoteStatus, tiers }: { quoteId: string; quoteStatus: string; tiers: TierOption[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [tierIdx, setTierIdx] = useState(0);
  const [customerPo, setCustomerPo] = useState("");
  const [shipDate, setShipDate] = useState("");

  if (quoteStatus !== "Draft" && quoteStatus !== "Sent" && quoteStatus !== "Viewed") return null;
  if (tiers.length === 0) return null;

  function accept() {
    const tier = tiers[tierIdx];
    start(async () => {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          acceptedQuoteId: quoteId,
          tierQuantity: tier.tierQuantity,
          unitPrice: tier.pricePerUnit,
          customerPoNumber: customerPo || undefined,
          targetShipDate: shipDate || undefined,
        }),
      });
      const data = await res.json();
      if (data.success) router.push(`/orders/${data.purchaseOrderId}`);
      else alert(`Failed: ${data.error}`);
    });
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-md"
      >
        <ShoppingCart className="h-4 w-4" /> Accept Quote
      </button>
    );
  }

  return (
    <div className="bg-white border border-slate-200 rounded-md p-4 shadow-md w-80">
      <h3 className="text-sm font-semibold text-slate-800 mb-3">Accept Quote</h3>
      <div className="space-y-3">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Which tier?</label>
          <select value={tierIdx} onChange={(e) => setTierIdx(parseInt(e.target.value, 10))} className="w-full border border-slate-300 rounded px-2 py-1.5 text-sm">
            {tiers.map((t, i) => (
              <option key={i} value={i}>
                {t.tierQuantity.toLocaleString()} units @ ${t.pricePerUnit.toFixed(2)}/unit
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Customer PO # (optional)</label>
          <input value={customerPo} onChange={(e) => setCustomerPo(e.target.value)} placeholder="e.g. ASH-2025-014" className="w-full border border-slate-300 rounded px-2 py-1.5 text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Target Ship Date (optional)</label>
          <input type="date" value={shipDate} onChange={(e) => setShipDate(e.target.value)} className="w-full border border-slate-300 rounded px-2 py-1.5 text-sm" />
        </div>
      </div>
      <div className="flex gap-2 mt-4">
        <button onClick={accept} disabled={pending} className="flex-1 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-sm font-semibold rounded">
          {pending ? <Loader2 className="h-4 w-4 animate-spin inline" /> : "Create Purchase Order"}
        </button>
        <button onClick={() => setOpen(false)} className="px-3 py-2 border border-slate-300 text-slate-700 text-sm rounded hover:bg-slate-50">Cancel</button>
      </div>
    </div>
  );
}
