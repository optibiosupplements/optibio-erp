import { db } from "@/lib/db";
import { quotes } from "@/lib/db/schema";
import { desc } from "drizzle-orm";
import { FileText, Plus } from "lucide-react";
import Link from "next/link";

export const dynamic = "force-dynamic";

const STATUS_COLORS: Record<string, string> = {
  Draft: "bg-gray-100 text-gray-700",
  Sent: "bg-blue-100 text-blue-700",
  Viewed: "bg-purple-100 text-purple-700",
  Accepted: "bg-green-100 text-green-700",
  Rejected: "bg-red-100 text-red-700",
  Expired: "bg-amber-100 text-amber-700",
};

export default async function QuotesPage() {
  let allQuotes: any[] = [];

  try {
    allQuotes = await db
      .select()
      .from(quotes)
      .orderBy(desc(quotes.createdAt))
      .limit(50);
  } catch {
    // DB not connected
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Quotes</h1>
          <p className="text-sm text-gray-500 mt-1">
            {allQuotes.length > 0
              ? `${allQuotes.length} quote${allQuotes.length !== 1 ? "s" : ""}`
              : "No quotes yet"}
          </p>
        </div>
        <Link
          href="/quotes/new"
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#d10a11] text-white text-sm font-semibold rounded-xl hover:bg-[#a30a0f] transition-colors shadow-sm"
        >
          <Plus className="h-4 w-4" /> New Quote
        </Link>
      </div>

      {allQuotes.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-200 p-16 text-center shadow-sm">
          <FileText className="h-14 w-14 text-gray-200 mx-auto mb-4" />
          <p className="text-gray-500 font-medium">No quotes yet.</p>
          <p className="text-gray-400 text-sm mt-1">
            Build your first formulation and generate tiered pricing.
          </p>
          <Link
            href="/quotes/new"
            className="inline-flex items-center gap-2 mt-5 px-5 py-2.5 bg-[#d10a11] text-white text-sm font-semibold rounded-xl hover:bg-[#a30a0f] transition-colors"
          >
            <Plus className="h-4 w-4" /> Create Quote
          </Link>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-5 py-3.5 font-semibold text-gray-600">Quote #</th>
                <th className="text-left px-5 py-3.5 font-semibold text-gray-600">Product</th>
                <th className="text-left px-5 py-3.5 font-semibold text-gray-600">Customer</th>
                <th className="text-left px-5 py-3.5 font-semibold text-gray-600">Status</th>
                <th className="text-left px-5 py-3.5 font-semibold text-gray-600">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {allQuotes.map((q) => {
                const meta = safeParseJSON(q.notes);
                return (
                  <tr key={q.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-5 py-4">
                      <span className="font-mono font-semibold text-gray-900">{q.quoteNumber}</span>
                    </td>
                    <td className="px-5 py-4 text-gray-700">{meta.productName || "—"}</td>
                    <td className="px-5 py-4 text-gray-700">{meta.customerName || "—"}</td>
                    <td className="px-5 py-4">
                      <span className={`inline-block px-2.5 py-1 text-xs font-medium rounded-full ${STATUS_COLORS[q.status] || STATUS_COLORS.Draft}`}>
                        {q.status}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-gray-500">
                      {new Date(q.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function safeParseJSON(str: string | null): any {
  if (!str) return {};
  try { return JSON.parse(str); } catch { return {}; }
}
