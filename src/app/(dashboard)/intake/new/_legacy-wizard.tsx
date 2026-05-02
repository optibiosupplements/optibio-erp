"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  FileUp, Upload, Loader2, Sparkles, Save, Check, ChevronRight, ChevronLeft,
  User, Package, FlaskConical, Shield, Factory, FileText, AlertTriangle,
} from "lucide-react";

const STEPS = [
  { id: 0, label: "Upload", icon: FileUp, desc: "Drop SFP or start fresh" },
  { id: 1, label: "Customer", icon: User, desc: "Customer information" },
  { id: 2, label: "Product", icon: FlaskConical, desc: "Product specification" },
  { id: 3, label: "Formula", icon: FlaskConical, desc: "Ingredients & dosages" },
  { id: 4, label: "Packaging", icon: Package, desc: "Container & labeling" },
  { id: 5, label: "Regulatory", icon: Shield, desc: "Certifications & compliance" },
  { id: 6, label: "Manufacturing", icon: Factory, desc: "MOQ, timeline, co-packer" },
  { id: 7, label: "Review", icon: FileText, desc: "Review & submit" },
];

interface FormData {
  // Customer
  customerCompany: string;
  customerContact: string;
  customerEmail: string;
  customerPhone: string;
  source: string;
  priority: string;
  // Product
  productName: string;
  dosageForm: string;
  servingSize: string;
  servingSizeUnit: string;
  servingsPerContainer: string;
  countPerBottle: string;
  flavor: string;
  targetRetailPrice: string;
  // Formula
  formulaJson: any[];
  otherIngredients: string;
  specialRequirements: string;
  // Packaging
  bulkOrPackaged: string;
  primaryPackaging: string;
  capsuleType: string;
  capsuleSize: string;
  secondaryPackaging: string;
  labelStatus: string;
  // Regulatory
  certifications: string[];
  targetMarkets: string;
  allergenStatement: string;
  claims: string;
  // Manufacturing
  moq: string;
  targetTimeline: string;
  coPackerPreference: string;
  // Notes
  internalNotes: string;
  customerNotes: string;
  deadline: string;
}

const INITIAL: FormData = {
  customerCompany: "", customerContact: "", customerEmail: "", customerPhone: "",
  source: "Email", priority: "Normal",
  productName: "", dosageForm: "Capsule", servingSize: "1", servingSizeUnit: "capsule",
  servingsPerContainer: "60", countPerBottle: "60", flavor: "", targetRetailPrice: "",
  formulaJson: [], otherIngredients: "", specialRequirements: "",
  bulkOrPackaged: "Packaged", primaryPackaging: "HDPE Bottle", capsuleType: "Veggie",
  capsuleSize: "0", secondaryPackaging: "", labelStatus: "Customer Provides",
  certifications: [], targetMarkets: "USA", allergenStatement: "", claims: "",
  moq: "2000", targetTimeline: "8-12 weeks", coPackerPreference: "",
  internalNotes: "", customerNotes: "", deadline: "",
};

export default function NewIntakePage() {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormData>(INITIAL);
  const [extracting, setExtracting] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedRfq, setSavedRfq] = useState<{ id: string; number: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const set = (field: keyof FormData, value: any) => setForm({ ...form, [field]: value });
  const next = () => setStep(Math.min(step + 1, STEPS.length - 1));
  const prev = () => setStep(Math.max(step - 1, 0));

  // AI Extraction
  const handleExtract = async (file: File) => {
    setExtracting(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/extract", { method: "POST", body: fd });
      const data = await res.json();
      if (data.success) {
        const ext = data.extracted;
        setForm((prev) => ({
          ...prev,
          productName: ext.productName || prev.productName,
          dosageForm: ext.dosageForm ? capitalize(ext.dosageForm) : prev.dosageForm,
          servingSize: ext.servingSize ? String(ext.servingSize) : prev.servingSize,
          servingSizeUnit: ext.servingSizeUnit || prev.servingSizeUnit,
          servingsPerContainer: ext.servingsPerContainer ? String(ext.servingsPerContainer) : prev.servingsPerContainer,
          countPerBottle: ext.servingsPerContainer ? String(ext.servingsPerContainer) : prev.countPerBottle,
          flavor: ext.flavor || prev.flavor,
          formulaJson: data.matchedIngredients || [],
          otherIngredients: (ext.otherIngredients || []).join(", "),
          allergenStatement: ext.allergenInfo || prev.allergenStatement,
        }));
        setStep(1); // Jump to customer info (product info auto-filled)
      }
    } catch {
    } finally {
      setExtracting(false);
    }
  };

  const onDrop = (e: React.DragEvent) => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files?.[0]; if (f) handleExtract(f); };
  const onFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => { const f = e.target.files?.[0]; if (f) handleExtract(f); };

  // Save
  const saveIntake = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/intake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          formulaJson: form.formulaJson,
          status: "In Review",
        }),
      });
      const data = await res.json();
      if (data.success) setSavedRfq({ id: data.rfqId, number: data.rfqNumber });
    } catch {
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-5xl">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">New RFQ Intake</h1>
        <p className="text-sm text-gray-500 mt-1">Complete product intake form — AI will auto-fill from uploaded supplement facts panels</p>
      </div>

      {/* Step Indicator */}
      <div className="flex items-center gap-1 mb-8 overflow-x-auto pb-2">
        {STEPS.map((s, i) => {
          const Icon = s.icon;
          const active = i === step;
          const done = i < step;
          return (
            <button
              key={s.id}
              onClick={() => setStep(i)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                active ? "bg-[#d10a11] text-white shadow-sm" : done ? "bg-green-50 text-green-700" : "bg-gray-50 text-gray-400 hover:bg-gray-100"
              }`}
            >
              {done ? <Check className="h-3.5 w-3.5" /> : <Icon className="h-3.5 w-3.5" />}
              {s.label}
            </button>
          );
        })}
      </div>

      {/* Step Content */}
      <div className="bg-white rounded-2xl border border-gray-200 p-8 shadow-sm min-h-[400px]">

        {/* Step 0: Upload */}
        {step === 0 && (
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Start with a Supplement Facts Panel</h2>
            <p className="text-sm text-gray-500 mb-6">Drop a PDF or image and AI will extract everything automatically. Or skip to fill in manually.</p>

            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={onDrop}
              onClick={() => !extracting && fileInputRef.current?.click()}
              className={`rounded-2xl border-2 border-dashed p-12 text-center cursor-pointer transition-all ${
                dragOver ? "border-[#d10a11] bg-red-50/50" : extracting ? "border-blue-300 bg-blue-50/30" : "border-gray-200 hover:border-gray-300"
              }`}
            >
              <input ref={fileInputRef} type="file" accept=".pdf,.png,.jpg,.jpeg" onChange={onFileSelect} className="hidden" />
              {extracting ? (
                <div className="flex flex-col items-center gap-3">
                  <Loader2 className="h-10 w-10 text-blue-500 animate-spin" />
                  <p className="text-sm font-semibold text-blue-700">AI is extracting the supplement facts panel...</p>
                  <p className="text-xs text-blue-500">Matching against 2,567 ingredients in our database</p>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-3">
                  <FileUp className="h-10 w-10 text-gray-300" />
                  <p className="text-sm font-semibold text-gray-700">Drop a Supplement Facts panel here</p>
                  <p className="text-xs text-gray-400">PDF, PNG, or JPG — AI extracts ingredients, dosages, and product info</p>
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 rounded-lg text-xs text-gray-500 mt-2">
                    <Upload className="h-3 w-3" /> Upload file
                  </span>
                </div>
              )}
            </div>

            <div className="flex justify-center mt-6">
              <button onClick={next} className="text-sm text-gray-500 hover:text-gray-700 underline">
                Skip — fill in manually
              </button>
            </div>
          </div>
        )}

        {/* Step 1: Customer */}
        {step === 1 && (
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-6">Customer Information</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <InputField label="Company Name *" value={form.customerCompany} onChange={(v) => set("customerCompany", v)} placeholder="BioSchwartz LLC" />
              <InputField label="Contact Name" value={form.customerContact} onChange={(v) => set("customerContact", v)} placeholder="John Smith" />
              <InputField label="Email *" value={form.customerEmail} onChange={(v) => set("customerEmail", v)} placeholder="john@bioschwartz.com" type="email" />
              <InputField label="Phone" value={form.customerPhone} onChange={(v) => set("customerPhone", v)} placeholder="(555) 123-4567" />
              <SelectField label="Source" value={form.source} onChange={(v) => set("source", v)} options={["Email", "Phone", "Website", "Referral", "Trade Show", "Other"]} />
              <SelectField label="Priority" value={form.priority} onChange={(v) => set("priority", v)} options={["Low", "Normal", "High", "Urgent"]} />
            </div>
          </div>
        )}

        {/* Step 2: Product */}
        {step === 2 && (
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-6">Product Specification</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <InputField label="Product Name *" value={form.productName} onChange={(v) => set("productName", v)} placeholder="Bariatric Probiotic & Digestive Enzymes" span={2} />
              <SelectField label="Dosage Form *" value={form.dosageForm} onChange={(v) => set("dosageForm", v)} options={["Capsule", "Tablet", "Powder", "Softgel", "Gummy", "Liquid"]} />
              <InputField label="Flavor" value={form.flavor} onChange={(v) => set("flavor", v)} placeholder="Cherry Strawberry" />
              <InputField label="Serving Size" value={form.servingSize} onChange={(v) => set("servingSize", v)} type="number" placeholder="1" />
              <SelectField label="Serving Unit" value={form.servingSizeUnit} onChange={(v) => set("servingSizeUnit", v)} options={["capsule", "tablet", "scoop", "packet", "softgel", "gummy"]} />
              <InputField label="Servings Per Container" value={form.servingsPerContainer} onChange={(v) => set("servingsPerContainer", v)} type="number" placeholder="60" />
              <InputField label="Count Per Bottle" value={form.countPerBottle} onChange={(v) => set("countPerBottle", v)} type="number" placeholder="60" />
              <InputField label="Target Retail Price ($)" value={form.targetRetailPrice} onChange={(v) => set("targetRetailPrice", v)} type="number" placeholder="29.99" />
            </div>
          </div>
        )}

        {/* Step 3: Formula */}
        {step === 3 && (
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Formula & Ingredients</h2>
            {form.formulaJson.length > 0 ? (
              <div>
                <p className="text-sm text-green-600 mb-4 font-medium">✓ {form.formulaJson.length} ingredients extracted by AI</p>
                <div className="bg-gray-50 rounded-xl p-4 mb-4 max-h-60 overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-gray-500 font-medium">
                        <th className="text-left pb-2">Ingredient</th>
                        <th className="text-right pb-2">Amount</th>
                        <th className="text-left pb-2 pl-2">Unit</th>
                        <th className="text-left pb-2 pl-2">DB Match</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {form.formulaJson.map((ing: any, i: number) => (
                        <tr key={i}>
                          <td className="py-1.5 font-medium text-gray-900">{ing.name}</td>
                          <td className="py-1.5 text-right">{ing.amount}</td>
                          <td className="py-1.5 pl-2 text-gray-500">{ing.unit}</td>
                          <td className="py-1.5 pl-2">
                            {ing.dbMatch ? (
                              <span className="text-green-600">✓ {ing.dbMatch.name?.substring(0, 30)}</span>
                            ) : (
                              <span className="text-amber-600">⚠ No match</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <p className="text-sm text-gray-500 mb-4">No ingredients extracted yet. You can add them manually or go back and upload a supplement facts panel.</p>
            )}
            <TextAreaField label="Other Ingredients" value={form.otherIngredients} onChange={(v) => set("otherIngredients", v)} placeholder="Mannitol, Xylitol, Croscarmellose Sodium, Natural Flavors..." />
            <div className="mt-4">
              <TextAreaField label="Special Requirements" value={form.specialRequirements} onChange={(v) => set("specialRequirements", v)} placeholder="e.g., Vegan capsule only, no artificial colors, fast-dissolving tablet..." />
            </div>
          </div>
        )}

        {/* Step 4: Packaging */}
        {step === 4 && (
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-6">Packaging & Labeling</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <SelectField label="Bulk or Packaged" value={form.bulkOrPackaged} onChange={(v) => set("bulkOrPackaged", v)} options={["Bulk", "Packaged"]} />
              <SelectField label="Primary Packaging" value={form.primaryPackaging} onChange={(v) => set("primaryPackaging", v)} options={["HDPE Bottle", "PET Bottle", "Glass Bottle", "Jar", "Stick Pack", "Gusset Bag", "Blister Pack"]} />
              {(form.dosageForm === "Capsule") && (
                <>
                  <SelectField label="Capsule Type" value={form.capsuleType} onChange={(v) => set("capsuleType", v)} options={["Veggie", "Gelatin", "Pullulan"]} />
                  <SelectField label="Capsule Size" value={form.capsuleSize} onChange={(v) => set("capsuleSize", v)} options={["3", "2", "1", "0", "00", "000"]} />
                </>
              )}
              <SelectField label="Secondary Packaging" value={form.secondaryPackaging} onChange={(v) => set("secondaryPackaging", v)} options={["None", "Carton Box", "Shrink Wrap", "Bundle Wrap"]} />
              <SelectField label="Label Status" value={form.labelStatus} onChange={(v) => set("labelStatus", v)} options={["Customer Provides", "Need Design", "Unlabeled"]} />
            </div>
          </div>
        )}

        {/* Step 5: Regulatory */}
        {step === 5 && (
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-6">Regulatory & Compliance</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">Certifications Required</label>
                <div className="flex flex-wrap gap-2">
                  {["cGMP", "NSF", "Organic", "Non-GMO", "Kosher", "Halal", "Vegan", "Gluten-Free"].map((cert) => (
                    <button
                      key={cert}
                      onClick={() => {
                        const certs = form.certifications.includes(cert)
                          ? form.certifications.filter((c) => c !== cert)
                          : [...form.certifications, cert];
                        set("certifications", certs);
                      }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                        form.certifications.includes(cert)
                          ? "bg-[#d10a11] text-white"
                          : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                      }`}
                    >
                      {cert}
                    </button>
                  ))}
                </div>
              </div>
              <InputField label="Target Markets" value={form.targetMarkets} onChange={(v) => set("targetMarkets", v)} placeholder="USA, Canada, EU" />
              <InputField label="Allergen Statement" value={form.allergenStatement} onChange={(v) => set("allergenStatement", v)} placeholder="Not manufactured with wheat, soy, gluten..." />
              <TextAreaField label="Structure/Function Claims" value={form.claims} onChange={(v) => set("claims", v)} placeholder="Supports digestive health..." />
            </div>
          </div>
        )}

        {/* Step 6: Manufacturing */}
        {step === 6 && (
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-6">Manufacturing & Timeline</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <InputField label="Minimum Order Quantity" value={form.moq} onChange={(v) => set("moq", v)} type="number" placeholder="2000" />
              <SelectField label="Target Timeline" value={form.targetTimeline} onChange={(v) => set("targetTimeline", v)} options={["4-6 weeks", "6-8 weeks", "8-12 weeks", "12+ weeks", "Rush (2-4 weeks)"]} />
              <InputField label="Co-Packer Preference" value={form.coPackerPreference} onChange={(v) => set("coPackerPreference", v)} placeholder="Any, or specific manufacturer..." />
              <InputField label="Deadline" value={form.deadline} onChange={(v) => set("deadline", v)} type="date" />
              <TextAreaField label="Internal Notes" value={form.internalNotes} onChange={(v) => set("internalNotes", v)} placeholder="Internal team notes..." />
              <TextAreaField label="Customer Notes" value={form.customerNotes} onChange={(v) => set("customerNotes", v)} placeholder="Notes from customer email..." />
            </div>
          </div>
        )}

        {/* Step 7: Review */}
        {step === 7 && (
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-6">Review & Submit</h2>
            <div className="space-y-4">
              <ReviewSection title="Customer" items={[
                ["Company", form.customerCompany], ["Contact", form.customerContact],
                ["Email", form.customerEmail], ["Source", form.source], ["Priority", form.priority],
              ]} />
              <ReviewSection title="Product" items={[
                ["Product", form.productName], ["Format", form.dosageForm], ["Flavor", form.flavor],
                ["Serving", `${form.servingSize} ${form.servingSizeUnit}`],
                ["Count/Bottle", form.countPerBottle], ["MOQ", form.moq],
              ]} />
              <ReviewSection title="Formula" items={[
                ["Active Ingredients", `${form.formulaJson.length} extracted`],
                ["Other Ingredients", form.otherIngredients || "—"],
                ["Special Requirements", form.specialRequirements || "—"],
              ]} />
              <ReviewSection title="Packaging" items={[
                ["Type", form.bulkOrPackaged], ["Container", form.primaryPackaging],
                ["Label", form.labelStatus],
              ]} />
              <ReviewSection title="Regulatory" items={[
                ["Certifications", form.certifications.join(", ") || "None"],
                ["Markets", form.targetMarkets], ["Allergens", form.allergenStatement || "—"],
              ]} />
            </div>

            {savedRfq ? (
              <div className="mt-6 flex items-center gap-3 px-5 py-4 bg-green-50 border border-green-200 rounded-xl">
                <Check className="h-5 w-5 text-green-600" />
                <div>
                  <p className="text-sm font-semibold text-green-800">RFQ created: {savedRfq.number}</p>
                  <div className="flex gap-3 mt-1">
                    <button onClick={() => router.push("/intake")} className="text-xs text-green-600 hover:underline">View all RFQs →</button>
                    <button onClick={() => router.push("/quotes/new")} className="text-xs text-green-600 hover:underline">Build Quote →</button>
                  </div>
                </div>
              </div>
            ) : (
              <button onClick={saveIntake} disabled={saving} className="mt-6 inline-flex items-center gap-2 px-6 py-3 bg-[#d10a11] text-white font-semibold rounded-xl hover:bg-[#a30a0f] transition-colors shadow-sm disabled:opacity-50">
                {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />}
                {saving ? "Saving..." : "Submit RFQ"}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="flex justify-between mt-6">
        <button onClick={prev} disabled={step === 0} className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 disabled:opacity-30 transition-colors">
          <ChevronLeft className="h-4 w-4" /> Back
        </button>
        {step < STEPS.length - 1 && (
          <button onClick={next} className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-gray-900 rounded-xl hover:bg-gray-800 transition-colors">
            Next <ChevronRight className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Sub-Components ─────────────────────────────────────────────────────

function InputField({ label, value, onChange, placeholder, type, span }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string; span?: number }) {
  return (
    <div className={span === 2 ? "col-span-2" : ""}>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <input type={type || "text"} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="input-field" />
    </div>
  );
}

function SelectField({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: string[] }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="input-field">
        {options.map((o: string) => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );
}

function TextAreaField({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div className="col-span-2">
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <textarea value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} rows={3} className="input-field resize-none" />
    </div>
  );
}

function ReviewSection({ title, items }: { title: string; items: [string, string][] }) {
  return (
    <div className="bg-gray-50 rounded-xl p-4">
      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">{title}</h3>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
        {items.map(([k, v]) => (
          <div key={k}>
            <p className="text-[10px] text-gray-400">{k}</p>
            <p className="text-sm font-medium text-gray-900">{v || "—"}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function capitalize(s: string) { return s.charAt(0).toUpperCase() + s.slice(1); }
