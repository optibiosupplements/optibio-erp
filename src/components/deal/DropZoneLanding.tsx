"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { FileUp, Loader2, Plus, Type, Send } from "lucide-react";

export default function DropZoneLanding() {
  const router = useRouter();
  const [extracting, setExtracting] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState("");
  const [mode, setMode] = useState<"drop" | "text">("drop");
  const [textInput, setTextInput] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    setExtracting(true);
    setError("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/extract", { method: "POST", body: fd });
      const data = await res.json();
      if (!data.success) { setError(data.error || "Extraction failed"); setExtracting(false); return; }
      sessionStorage.setItem("pendingExtraction", JSON.stringify({
        extracted: data.extracted, matchedIngredients: data.matchedIngredients,
        matchedExcipients: data.matchedExcipients, fileName: file.name,
      }));
      router.push("/quotes/new");
    } catch (err: any) { setError(err.message || "Extraction error"); setExtracting(false); }
  };

  const handleText = async () => {
    if (!textInput.trim()) return;
    setExtracting(true);
    setError("");
    try {
      const fd = new FormData();
      fd.append("text", textInput.trim());
      const res = await fetch("/api/extract", { method: "POST", body: fd });
      const data = await res.json();
      if (!data.success) { setError(data.error || "Extraction failed"); setExtracting(false); return; }
      sessionStorage.setItem("pendingExtraction", JSON.stringify({
        extracted: data.extracted, matchedIngredients: data.matchedIngredients,
        matchedExcipients: data.matchedExcipients, fileName: "Manual entry",
      }));
      router.push("/quotes/new");
    } catch (err: any) { setError(err.message || "Extraction error"); setExtracting(false); }
  };

  return (
    <div>
      {/* Mode Toggle */}
      <div className="flex items-center justify-center gap-1 mb-4">
        <button onClick={() => setMode("drop")}
          className={`px-4 py-1.5 rounded-lg text-xs font-medium transition-colors ${mode === "drop" ? "bg-[#d10a11] text-white" : "bg-gray-100 text-gray-500 hover:bg-gray-200"}`}>
          <FileUp className="h-3 w-3 inline mr-1" /> Upload File
        </button>
        <button onClick={() => setMode("text")}
          className={`px-4 py-1.5 rounded-lg text-xs font-medium transition-colors ${mode === "text" ? "bg-[#d10a11] text-white" : "bg-gray-100 text-gray-500 hover:bg-gray-200"}`}>
          <Type className="h-3 w-3 inline mr-1" /> Type / Paste
        </button>
      </div>

      {mode === "drop" ? (
        /* File Drop Zone */
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
      ) : (
        /* Text Input */
        <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
          <p className="text-xs text-gray-500 mb-3">
            Type or paste the supplement facts — ingredient names, amounts, dosage form, serving size.
            You can also just describe the formula in plain English and the AI will figure it out.
          </p>
          <textarea
            value={textInput}
            onChange={(e) => setTextInput(e.target.value)}
            rows={8}
            placeholder={"Example:\nBariatric Probiotic & Digestive Enzymes\nFast-dissolving tablet, 60 count, 1 tablet per serving\nCherry Strawberry flavor\n\nActive Ingredients:\nBacillus coagulans 33mg (5 Billion CFU)\nDigeZyme Digestive Enzyme Complex 50mg\n\nOther Ingredients: Mannitol, Xylitol, Croscarmellose Sodium, Natural Flavors, Magnesium Stearate, Citric Acid, Organic Inulin, Stevia Leaf Extract, Natural Color"}
            className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-red-100 focus:border-[#d10a11] resize-none font-mono"
          />
          <div className="flex items-center justify-between mt-3">
            <p className="text-[10px] text-gray-400">The AI will extract product info, ingredients, and amounts from whatever you type.</p>
            <button
              onClick={handleText}
              disabled={!textInput.trim() || extracting}
              className="inline-flex items-center gap-2 px-5 py-2 bg-[#d10a11] text-white font-semibold rounded-xl hover:bg-[#a30a0f] disabled:opacity-50 text-sm transition-colors"
            >
              {extracting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              {extracting ? "Processing..." : "Build Quote"}
            </button>
          </div>
        </div>
      )}

      {error && (
        <div className="mt-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {/* Manual blank quote */}
      <div className="mt-3 text-center">
        <button onClick={() => router.push("/quotes/new")} className="text-xs text-gray-400 hover:text-gray-600 inline-flex items-center gap-1">
          <Plus className="h-3 w-3" /> Or start a blank quote manually
        </button>
      </div>
    </div>
  );
}
