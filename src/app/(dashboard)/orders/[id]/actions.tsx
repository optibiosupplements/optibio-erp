"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Factory, Truck } from "lucide-react";

export function StartProductionRunButton({ purchaseOrderId, targetBatchSize }: { purchaseOrderId: string; targetBatchSize: number }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  function go() {
    start(async () => {
      const res = await fetch("/api/batches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ purchaseOrderId, targetBatchSize }),
      });
      const data = await res.json();
      if (data.success) router.push(`/batches/${data.productionRunId}`);
      else alert(`Failed: ${data.error}`);
    });
  }

  return (
    <button
      onClick={go}
      disabled={pending}
      className="inline-flex items-center gap-2 px-4 py-2 bg-[#d10a11] hover:bg-[#a30a0f] disabled:opacity-50 text-white text-sm font-semibold rounded-md transition-colors"
    >
      {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Factory className="h-4 w-4" />}
      Start Production Run
    </button>
  );
}

export function CreateShipmentButton({
  purchaseOrderId,
  defaultUnits,
  availableLots,
}: {
  purchaseOrderId: string;
  defaultUnits: number;
  availableLots: { id: string; lotNumber: string; quantityUnits: number }[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
  const [units, setUnits] = useState(defaultUnits);
  const [lotId, setLotId] = useState(availableLots[0]?.id ?? "");
  const [carrier, setCarrier] = useState("");
  const [tracking, setTracking] = useState("");

  function create() {
    start(async () => {
      const res = await fetch("/api/shipments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          purchaseOrderId,
          finishedProductLotId: lotId || undefined,
          quantityUnits: units,
          carrier: carrier || undefined,
          trackingNumber: tracking || undefined,
        }),
      });
      const data = await res.json();
      if (data.success) router.push(`/shipments/${data.shipmentId}`);
      else alert(`Failed: ${data.error}`);
    });
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 px-4 py-2 bg-[#d10a11] hover:bg-[#a30a0f] text-white text-sm font-semibold rounded-md"
      >
        <Truck className="h-4 w-4" /> Create Shipment
      </button>
    );
  }

  return (
    <div className="bg-white border border-slate-200 rounded-md p-3 shadow-md w-80">
      <h3 className="text-sm font-semibold text-slate-800 mb-3">Ship This Order</h3>
      <div className="space-y-2">
        {availableLots.length > 0 && (
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">From Lot</label>
            <select value={lotId} onChange={(e) => setLotId(e.target.value)} className="w-full border border-slate-300 rounded px-2 py-1.5 text-sm">
              {availableLots.map((l) => (
                <option key={l.id} value={l.id}>{l.lotNumber} ({l.quantityUnits.toLocaleString()} units available)</option>
              ))}
            </select>
          </div>
        )}
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Quantity (units)</label>
          <input type="number" value={units} onChange={(e) => setUnits(parseInt(e.target.value, 10) || 0)} className="w-full border border-slate-300 rounded px-2 py-1.5 text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Carrier</label>
          <input value={carrier} onChange={(e) => setCarrier(e.target.value)} placeholder="FedEx / UPS / Freight" className="w-full border border-slate-300 rounded px-2 py-1.5 text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Tracking #</label>
          <input value={tracking} onChange={(e) => setTracking(e.target.value)} placeholder="optional" className="w-full border border-slate-300 rounded px-2 py-1.5 text-sm font-mono" />
        </div>
      </div>
      <div className="flex gap-2 mt-3">
        <button onClick={create} disabled={pending || units <= 0} className="flex-1 px-3 py-1.5 bg-[#d10a11] hover:bg-[#a30a0f] disabled:opacity-50 text-white text-xs font-semibold rounded">
          {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin inline" /> : "Create Shipment"}
        </button>
        <button onClick={() => setOpen(false)} className="px-3 py-1.5 border border-slate-300 text-slate-700 text-xs rounded hover:bg-slate-50">Cancel</button>
      </div>
    </div>
  );
}
