"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, FileCheck } from "lucide-react";

export function GenerateCoaButton({ lotId, hasCoa }: { lotId: string; hasCoa: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  function go() {
    start(async () => {
      const res = await fetch("/api/coas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lotId }),
      });
      const data = await res.json();
      if (data.success) router.push(`/coas/${data.coaId}`);
      else alert(`Failed: ${data.error}`);
    });
  }

  return (
    <button
      onClick={go}
      disabled={pending}
      className="inline-flex items-center gap-2 px-4 py-2 bg-[#d10a11] hover:bg-[#a30a0f] disabled:opacity-50 text-white text-sm font-semibold rounded-md transition-colors"
    >
      {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileCheck className="h-4 w-4" />}
      {hasCoa ? "Generate New COA Revision" : "Generate COA"}
    </button>
  );
}
