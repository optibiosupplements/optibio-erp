import { db } from "@/lib/db";
import { rfqs } from "@/lib/db/schema";
import { desc } from "drizzle-orm";
import Link from "next/link";
import { FileText, ArrowRight, Plus } from "lucide-react";
import DropZoneLanding from "@/components/deal/DropZoneLanding";

export const dynamic = "force-dynamic";

const STATUS_COLORS: Record<string, string> = {
  New: "bg-blue-100 text-blue-700",
  Formulating: "bg-purple-100 text-purple-700",
  Quoted: "bg-green-100 text-green-700",
  Sent: "bg-indigo-100 text-indigo-700",
  Accepted: "bg-emerald-100 text-emerald-700",
  Rejected: "bg-red-100 text-red-700",
};

export default async function HomePage() {
  let recentQuotes: any[] = [];
  try {
    recentQuotes = await db.select().from(rfqs).orderBy(desc(rfqs.createdAt)).limit(20);
  } catch {}

  return (
    <div className="max-w-5xl mx-auto">
      {/* Drop Zone */}
      <DropZoneLanding />

      {/* Recent Quotes */}
      <div className="mt-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Recent Quotes</h2>
        </div>

        {recentQuotes.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-2xl border border-gray-200">
            <FileText className="h-10 w-10 text-gray-200 mx-auto mb-3" />
            <p className="text-sm text-gray-400">No quotes yet. Drop a supplement facts panel above to start.</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-xs text-gray-500 font-medium uppercase tracking-wider">
                  <th className="text-left px-5 py-3">Quote #</th>
                  <th className="text-left px-5 py-3">Product</th>
                  <th className="text-left px-5 py-3">Customer</th>
                  <th className="text-left px-5 py-3">Status</th>
                  <th className="text-left px-5 py-3">Date</th>
                  <th className="w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {recentQuotes.map((q) => (
                  <tr key={q.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-5 py-3 font-mono font-semibold text-gray-900 text-xs">{q.rfqNumber}</td>
                    <td className="px-5 py-3 text-gray-700">{q.productName || "—"}</td>
                    <td className="px-5 py-3 text-gray-500">{q.customerCompany || "—"}</td>
                    <td className="px-5 py-3">
                      <span className={`inline-block px-2 py-0.5 text-[10px] font-semibold rounded-full ${STATUS_COLORS[q.status] || STATUS_COLORS.New}`}>{q.status}</span>
                    </td>
                    <td className="px-5 py-3 text-gray-400 text-xs">{new Date(q.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</td>
                    <td className="px-5 py-3">
                      <Link href={`/quotes/${q.id}`} className="text-[#d10a11] hover:underline text-xs font-medium">Open</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
