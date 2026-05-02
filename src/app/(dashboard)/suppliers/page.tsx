"use client";

import { useState, useEffect } from "react";
import { Truck, Plus, Loader2 } from "lucide-react";
import Link from "next/link";

interface Supplier {
  id: string;
  companyName: string;
  contactName: string | null;
  email: string | null;
  phone: string | null;
  paymentTerms: string | null;
  isActive: boolean;
}

export default function SuppliersPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newSup, setNewSup] = useState({ companyName: "", contactName: "", email: "", phone: "", paymentTerms: "" });

  useEffect(() => {
    fetch("/api/suppliers").then((r) => r.json()).then(setSuppliers).finally(() => setLoading(false));
  }, []);

  const addSupplier = async () => {
    if (!newSup.companyName) return;
    setSaving(true);
    try {
      const res = await fetch("/api/suppliers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newSup),
      });
      const data = await res.json();
      if (data.success) {
        setSuppliers([data.supplier, ...suppliers]);
        setShowAdd(false);
        setNewSup({ companyName: "", contactName: "", email: "", phone: "", paymentTerms: "" });
      }
    } catch {} finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Suppliers</h1>
          <p className="text-sm text-gray-500 mt-1">{suppliers.length} supplier{suppliers.length !== 1 ? "s" : ""}</p>
        </div>
        <button onClick={() => setShowAdd(!showAdd)} className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#d10a11] text-white text-sm font-semibold rounded-xl hover:bg-[#a30a0f] transition-colors shadow-sm">
          <Plus className="h-4 w-4" /> Add Supplier
        </button>
      </div>

      {showAdd && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-5 mb-4">
          <h3 className="text-sm font-semibold text-green-800 mb-3">Add New Supplier</h3>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
            <input value={newSup.companyName} onChange={(e) => setNewSup({ ...newSup, companyName: e.target.value })} placeholder="Company Name *" className="input-field text-sm" />
            <input value={newSup.contactName} onChange={(e) => setNewSup({ ...newSup, contactName: e.target.value })} placeholder="Contact Name" className="input-field text-sm" />
            <input value={newSup.email} onChange={(e) => setNewSup({ ...newSup, email: e.target.value })} placeholder="Email" className="input-field text-sm" />
            <input value={newSup.phone} onChange={(e) => setNewSup({ ...newSup, phone: e.target.value })} placeholder="Phone" className="input-field text-sm" />
            <div className="flex gap-2">
              <input value={newSup.paymentTerms} onChange={(e) => setNewSup({ ...newSup, paymentTerms: e.target.value })} placeholder="Payment Terms" className="input-field text-sm flex-1" />
              <button onClick={addSupplier} disabled={saving} className="px-4 py-2 bg-green-600 text-white rounded-xl text-sm font-medium hover:bg-green-700 disabled:opacity-50 whitespace-nowrap">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center shadow-sm">
          <Loader2 className="h-8 w-8 text-gray-300 animate-spin mx-auto" />
        </div>
      ) : suppliers.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-200 p-16 text-center shadow-sm">
          <Truck className="h-14 w-14 text-gray-200 mx-auto mb-4" />
          <p className="text-gray-500 font-medium">No suppliers yet.</p>
          <p className="text-gray-400 text-sm mt-1">Add your first supplier to get started.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-5 py-3.5 font-semibold text-gray-600">Company</th>
                <th className="text-left px-5 py-3.5 font-semibold text-gray-600">Contact</th>
                <th className="text-left px-5 py-3.5 font-semibold text-gray-600">Email</th>
                <th className="text-left px-5 py-3.5 font-semibold text-gray-600">Phone</th>
                <th className="text-left px-5 py-3.5 font-semibold text-gray-600">Payment Terms</th>
                <th className="text-center px-5 py-3.5 font-semibold text-gray-600">Active</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {suppliers.map((s) => (
                <tr key={s.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-5 py-4 font-semibold text-gray-900">
                    <Link href={`/suppliers/${s.id}`} className="hover:text-[#d10a11]">{s.companyName}</Link>
                  </td>
                  <td className="px-5 py-4 text-gray-700">{s.contactName || "—"}</td>
                  <td className="px-5 py-4 text-gray-700">{s.email || "—"}</td>
                  <td className="px-5 py-4 text-gray-700">{s.phone || "—"}</td>
                  <td className="px-5 py-4 text-gray-600">{s.paymentTerms || "—"}</td>
                  <td className="px-5 py-4 text-center">
                    <span className={`inline-block w-2 h-2 rounded-full ${s.isActive ? "bg-green-500" : "bg-gray-300"}`} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
