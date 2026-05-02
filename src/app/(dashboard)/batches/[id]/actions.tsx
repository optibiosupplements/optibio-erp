"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Package, ArrowRight } from "lucide-react";

const NEXT_STATUS: Record<string, string | null> = {
  Scheduled: "Blending",
  Blending: "Encapsulating",
  Encapsulating: "Packaging",
  Packaging: "Complete",
  Complete: null,
  "On Hold": null,
};

export function AdvanceStatusButtons({ batchId, currentStatus, targetBatchSize, actualBatchSize }: { batchId: string; currentStatus: string; targetBatchSize: number; actualBatchSize: number | null }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const next = NEXT_STATUS[currentStatus];
  if (!next) return null;

  function advance() {
    start(async () => {
      const body: Record<string, unknown> = { status: next };
      if (next === "Complete" && !actualBatchSize) body.actualBatchSize = targetBatchSize;
      if (next === "Complete") body.completionDate = new Date().toISOString().slice(0, 10);
      if (currentStatus === "Scheduled") body.startDate = new Date().toISOString().slice(0, 10);
      const res = await fetch(`/api/batches/${batchId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) router.refresh();
      else alert("Failed to advance status");
    });
  }

  return (
    <button
      onClick={advance}
      disabled={pending}
      className="inline-flex items-center gap-1.5 px-3 py-2 border border-slate-300 hover:bg-slate-50 disabled:opacity-50 text-slate-700 text-xs font-medium rounded-md"
    >
      {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ArrowRight className="h-3.5 w-3.5" />}
      Advance to {next}
    </button>
  );
}

export function CreateLotButton({ batchId, defaultUnits }: { batchId: string; defaultUnits: number }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [units, setUnits] = useState(defaultUnits);
  const [productCode, setProductCode] = useState("");
  const [open, setOpen] = useState(false);

  function create() {
    start(async () => {
      const res = await fetch("/api/lots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productionRunId: batchId,
          quantityUnits: units,
          productCode: productCode || undefined,
        }),
      });
      const data = await res.json();
      if (data.success) router.push(`/lots/${data.lotId}`);
      else alert(`Failed: ${data.error}`);
    });
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 px-4 py-2 bg-[#d10a11] hover:bg-[#a30a0f] text-white text-sm font-semibold rounded-md"
      >
        <Package className="h-4 w-4" /> Create Finished Product Lot
      </button>
    );
  }

  return (
    <div className="bg-white border border-slate-200 rounded-md p-3 shadow-sm flex flex-col gap-2 w-72">
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">Bottles produced</label>
        <input type="number" value={units} onChange={(e) => setUnits(parseInt(e.target.value, 10) || 0)} className="w-full border border-slate-300 rounded px-2 py-1 text-sm" />
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">Product Code (optional)</label>
        <input value={productCode} onChange={(e) => setProductCode(e.target.value)} placeholder="e.g. NS-3318C" className="w-full border border-slate-300 rounded px-2 py-1 text-sm" />
      </div>
      <div className="flex gap-2 mt-1">
        <button onClick={create} disabled={pending || units <= 0} className="flex-1 px-3 py-1.5 bg-[#d10a11] hover:bg-[#a30a0f] disabled:opacity-50 text-white text-xs font-semibold rounded">
          {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin inline" /> : "Create Lot"}
        </button>
        <button onClick={() => setOpen(false)} className="px-3 py-1.5 border border-slate-300 text-slate-700 text-xs rounded hover:bg-slate-50">Cancel</button>
      </div>
    </div>
  );
}
