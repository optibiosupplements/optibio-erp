"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { FileUp, Loader2, Plus } from "lucide-react";

export default function DropZoneLanding() {
  const router = useRouter();
  const [extracting, setExtracting] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    setExtracting(true);
    setError("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/extract", { method: "POST", body: fd });
      const data = await res.json();

      if (!data.success) {
        setError(data.error || "Extraction failed");
        setExtracting(false);
        return;
      }

      // Save extraction to sessionStorage and redirect to workspace
      sessionStorage.setItem("pendingExtraction", JSON.stringify({
        extracted: data.extracted,
        matchedIngredients: data.matchedIngredients,
        matchedExcipients: data.matchedExcipients,
        fileName: file.name,
      }));

      router.push("/quotes/new");
    } catch (err: any) {
      setError(err.message || "Extraction error");
      setExtracting(false);
    }
  };

  return (
    <div>
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files?.[0]; if (f) handleFile(f); }}
        onClick={() => !extracting && fileInputRef.current?.click()}
        className={`rounded-2xl border-2 border-dashed p-12 text-center cursor-pointer transition-all ${
          dragOver ? "border-[#d10a11] bg-red-50/50 scale-[1.005]" : extracting ? "border-blue-300 bg-blue-50/20" : "border-gray-200 hover:border-gray-400 hover:bg-white"
        }`}
      >
        <input ref={fileInputRef} type="file" accept=".pdf,.png,.jpg,.jpeg" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} className="hidden" />

        {extracting ? (
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="h-8 w-8 text-blue-500 animate-spin" />
            <p className="text-sm font-semibold text-blue-700">Extracting supplement facts...</p>
            <p className="text-xs text-blue-400">This takes 5-10 seconds</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <FileUp className="h-8 w-8 text-gray-300" />
            <p className="text-sm font-medium text-gray-600">Drop a Supplement Facts Panel to start a quote</p>
            <p className="text-xs text-gray-400">PDF, PNG, or JPG &middot; or <span className="text-[#d10a11] font-medium">click to browse</span></p>
          </div>
        )}
      </div>

      {error && (
        <div className="mt-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {/* Manual entry option */}
      <div className="mt-3 text-center">
        <button onClick={() => router.push("/quotes/new")} className="text-xs text-gray-400 hover:text-gray-600 inline-flex items-center gap-1">
          <Plus className="h-3 w-3" /> Or start a blank quote manually
        </button>
      </div>
    </div>
  );
}
