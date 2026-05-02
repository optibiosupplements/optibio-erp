"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Factory } from "lucide-react";

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
