import { db } from "@/lib/db";
import { rfqs } from "@/lib/db/schema";
import { desc, count } from "drizzle-orm";
import { FileText, Plus } from "lucide-react";
import Link from "next/link";

export const dynamic = "force-dynamic";

const STATUS_COLORS: Record<string, string> = {
  New: "bg-blue-100 text-blue-700",
  "In Review": "bg-yellow-100 text-yellow-700",
  Formulating: "bg-purple-100 text-purple-700",
  Quoted: "bg-green-100 text-green-700",
  Sent: "bg-indigo-100 text-indigo-700",
  Accepted: "bg-emerald-100 text-emerald-700",
  Rejected: "bg-red-100 text-red-700",
};

export default async function DealsPage() {
  let deals: any[] = [];
  let totalCount = 0;

  try {
    deals = await db.select().from(rfqs).orderBy(desc(rfqs.createdAt)).limit(100);
    const [c] = await db.select({ value: count() }).from(rfqs);
    totalCount = c.value;
  } catch {}

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Deals</h1>
          <p className="text-sm text-gray-500 mt-1">{totalCount} deal{totalCount !== 1 ? "s" : ""}</p>
        </div>
        <Link href="/deals/new" className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#d10a11] text-white text-sm font-semibold rounded-xl hover:bg-[#a30a0f] transition-colors shadow-sm">
          <Plus className="h-4 w-4" /> New Deal
        </Link>
      </div>

      {deals.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-200 p-16 text-center shadow-sm">
          <FileText className="h-14 w-14 text-gray-200 mx-auto mb-4" />
          <p className="text-gray-500 font-medium">No deals yet.</p>
          <p className="text-gray-400 text-sm mt-1">Drop a supplement facts panel to start your first deal.</p>
          <Link href="/deals/new" className="inline-flex items-center gap-2 mt-5 px-5 py-2.5 bg-[#d10a11] text-white text-sm font-semibold rounded-xl hover:bg-[#a30a0f] transition-colors">
            <Plus className="h-4 w-4" /> New Deal
          </Link>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-5 py-3.5 font-semibold text-gray-600">Deal #</th>
                <th className="text-left px-5 py-3.5 font-semibold text-gray-600">Product</th>
                <th className="text-left px-5 py-3.5 font-semibold text-gray-600">Customer</th>
                <th className="text-left px-5 py-3.5 font-semibold text-gray-600">Format</th>
                <th className="text-left px-5 py-3.5 font-semibold text-gray-600">Status</th>
                <th className="text-left px-5 py-3.5 font-semibold text-gray-600">Created</th>
                <th className="text-right px-5 py-3.5 font-semibold text-gray-600">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {deals.map((d) => (
                <tr key={d.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-5 py-4 font-mono font-semibold text-gray-900">{d.rfqNumber}</td>
                  <td className="px-5 py-4 text-gray-700">{d.productName || "—"}</td>
                  <td className="px-5 py-4 text-gray-700">{d.customerCompany || "—"}</td>
                  <td className="px-5 py-4 text-gray-600 capitalize">{d.dosageForm || "—"}</td>
                  <td className="px-5 py-4">
                    <span className={`inline-block px-2.5 py-1 text-xs font-medium rounded-full ${STATUS_COLORS[d.status] || STATUS_COLORS.New}`}>{d.status}</span>
                  </td>
                  <td className="px-5 py-4 text-gray-500">{new Date(d.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</td>
                  <td className="px-5 py-4 text-right">
                    <Link href={`/deals/${d.id}`} className="text-xs text-[#d10a11] font-medium hover:underline">
                      Open →
                    </Link>
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
