"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, DollarSign } from "lucide-react";

const METHODS = ["ACH", "Wire", "Check", "Credit Card", "Cash", "Other"] as const;

export function RecordPaymentButton({ invoiceId, balance }: { invoiceId: string; balance: number }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [amount, setAmount] = useState(balance.toFixed(2));
  const [method, setMethod] = useState<string>("ACH");
  const [reference, setReference] = useState("");
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0, 10));

  function record() {
    start(async () => {
      const res = await fetch("/api/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          invoiceId,
          amount: parseFloat(amount),
          method,
          reference: reference || undefined,
          paymentDate,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setOpen(false);
        router.refresh();
      } else {
        alert(`Failed: ${data.error}`);
      }
    });
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-md">
        <DollarSign className="h-4 w-4" /> Record Payment
      </button>
    );
  }

  return (
    <div className="bg-white border border-slate-200 rounded-md p-3 shadow-md w-72">
      <h3 className="text-sm font-semibold text-slate-800 mb-3">Record Payment</h3>
      <div className="space-y-2">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Amount</label>
          <input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} className="w-full border border-slate-300 rounded px-2 py-1.5 text-sm tabular-nums" />
          <p className="text-[11px] text-slate-500 mt-0.5">Balance due: ${balance.toFixed(2)}</p>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Method</label>
          <select value={method} onChange={(e) => setMethod(e.target.value)} className="w-full border border-slate-300 rounded px-2 py-1.5 text-sm">
            {METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Reference (check #, txn id)</label>
          <input value={reference} onChange={(e) => setReference(e.target.value)} className="w-full border border-slate-300 rounded px-2 py-1.5 text-sm font-mono" />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Payment Date</label>
          <input type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} className="w-full border border-slate-300 rounded px-2 py-1.5 text-sm" />
        </div>
      </div>
      <div className="flex gap-2 mt-3">
        <button onClick={record} disabled={pending || parseFloat(amount) <= 0} className="flex-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-semibold rounded">
          {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin inline" /> : "Record Payment"}
        </button>
        <button onClick={() => setOpen(false)} className="px-3 py-1.5 border border-slate-300 text-slate-700 text-xs rounded hover:bg-slate-50">Cancel</button>
      </div>
    </div>
  );
}
