"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Save } from "lucide-react";

interface ShipmentForm {
  id: string;
  quantityUnits: number;
  carrier: string | null;
  trackingNumber: string | null;
  shipDate: string | null;
  deliveredDate: string | null;
  status: string;
  notes: string | null;
}

const STATUSES = ["Scheduled", "Picked Up", "In Transit", "Delivered", "Returned"] as const;

export function ShipmentEditor({ shipment: initial }: { shipment: ShipmentForm }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [s, setS] = useState(initial);
  const [dirty, setDirty] = useState(false);

  function update(patch: Partial<ShipmentForm>) {
    setS((prev) => ({ ...prev, ...patch }));
    setDirty(true);
  }

  function save() {
    start(async () => {
      const res = await fetch(`/api/shipments/${s.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: s.status,
          carrier: s.carrier,
          trackingNumber: s.trackingNumber,
          shipDate: s.shipDate,
          deliveredDate: s.deliveredDate,
          notes: s.notes,
        }),
      });
      if (res.ok) {
        setDirty(false);
        router.refresh();
      } else {
        alert("Save failed");
      }
    });
  }

  return (
    <section className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm">
      <h2 className="text-sm font-semibold text-slate-800 mb-4">Tracking Details</h2>
      <div className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <label className="block text-xs font-medium text-slate-600 uppercase tracking-wide mb-1">Status</label>
          <select value={s.status} onChange={(e) => update({ status: e.target.value })} className="w-full border border-slate-300 rounded-md px-2 py-1.5 text-sm">
            {STATUSES.map((st) => <option key={st} value={st}>{st}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 uppercase tracking-wide mb-1">Carrier</label>
          <input value={s.carrier ?? ""} onChange={(e) => update({ carrier: e.target.value || null })} placeholder="FedEx / UPS / Freight" className="w-full border border-slate-300 rounded-md px-2 py-1.5 text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 uppercase tracking-wide mb-1">Tracking Number</label>
          <input value={s.trackingNumber ?? ""} onChange={(e) => update({ trackingNumber: e.target.value || null })} className="w-full border border-slate-300 rounded-md px-2 py-1.5 text-sm font-mono" />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 uppercase tracking-wide mb-1">Quantity (units)</label>
          <input value={s.quantityUnits} disabled className="w-full border border-slate-200 bg-slate-50 rounded-md px-2 py-1.5 text-sm tabular-nums" />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 uppercase tracking-wide mb-1">Ship Date</label>
          <input type="date" value={s.shipDate ?? ""} onChange={(e) => update({ shipDate: e.target.value || null })} className="w-full border border-slate-300 rounded-md px-2 py-1.5 text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 uppercase tracking-wide mb-1">Delivered Date</label>
          <input type="date" value={s.deliveredDate ?? ""} onChange={(e) => update({ deliveredDate: e.target.value || null })} className="w-full border border-slate-300 rounded-md px-2 py-1.5 text-sm" />
        </div>
        <div className="col-span-2">
          <label className="block text-xs font-medium text-slate-600 uppercase tracking-wide mb-1">Notes</label>
          <textarea value={s.notes ?? ""} onChange={(e) => update({ notes: e.target.value || null })} rows={2} className="w-full border border-slate-300 rounded-md px-2 py-1.5 text-sm" />
        </div>
      </div>
      <div className="mt-4 flex justify-end">
        <button
          onClick={save}
          disabled={!dirty || pending}
          className="inline-flex items-center gap-2 px-4 py-2 bg-[#d10a11] hover:bg-[#a30a0f] disabled:opacity-50 text-white text-sm font-semibold rounded-md"
        >
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Save
        </button>
      </div>
    </section>
  );
}
