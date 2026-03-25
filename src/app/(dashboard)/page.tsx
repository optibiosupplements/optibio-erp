import { db } from "@/lib/db";
import { quotes, leads, opportunities, ingredients } from "@/lib/db/schema";
import { count, desc, eq, sql, gte } from "drizzle-orm";
import { FileText, Users, TrendingUp, DollarSign, Plus, Search, Pill, ArrowRight } from "lucide-react";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  let quoteCount = 0;
  let leadCount = 0;
  let ingredientCount = 0;
  let quotesThisMonth = 0;
  let recentQuotes: any[] = [];

  try {
    const [qc] = await db.select({ value: count() }).from(quotes);
    quoteCount = qc.value;

    const [lc] = await db.select({ value: count() }).from(leads);
    leadCount = lc.value;

    const [ic] = await db.select({ value: count() }).from(ingredients);
    ingredientCount = ic.value;

    const firstOfMonth = new Date();
    firstOfMonth.setDate(1);
    firstOfMonth.setHours(0, 0, 0, 0);
    const [mc] = await db
      .select({ value: count() })
      .from(quotes)
      .where(gte(quotes.createdAt, firstOfMonth));
    quotesThisMonth = mc.value;

    recentQuotes = await db
      .select()
      .from(quotes)
      .orderBy(desc(quotes.createdAt))
      .limit(5);
  } catch {
    // DB not connected — show zeros
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-sm text-gray-500 mt-1">Welcome to Optibio ERP</p>
        </div>
        <div className="flex gap-3">
          <Link href="/quotes/new" className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#d10a11] text-white text-sm font-semibold rounded-xl hover:bg-[#a30a0f] transition-colors shadow-sm">
            <Plus className="h-4 w-4" /> New Quote
          </Link>
          <Link href="/ingredients" className="inline-flex items-center gap-2 px-4 py-2.5 bg-white text-gray-700 text-sm font-medium rounded-xl border border-gray-200 hover:bg-gray-50 transition-colors">
            <Search className="h-4 w-4" /> Search Ingredients
          </Link>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
        <MetricCard icon={FileText} label="Active Quotes" value={String(quoteCount)} color="blue" />
        <MetricCard icon={Users} label="New Leads" value={String(leadCount)} color="green" />
        <MetricCard icon={Pill} label="Ingredients" value={ingredientCount.toLocaleString()} color="purple" />
        <MetricCard icon={TrendingUp} label="Quotes This Month" value={String(quotesThisMonth)} color="orange" />
      </div>

      {/* Recent Quotes */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">Recent Quotes</h2>
          {recentQuotes.length > 0 && (
            <Link href="/quotes" className="text-sm text-[#d10a11] hover:underline font-medium inline-flex items-center gap-1">
              View all <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          )}
        </div>

        {recentQuotes.length === 0 ? (
          <div className="text-center py-14 px-6">
            <FileText className="h-12 w-12 text-gray-200 mx-auto mb-3" />
            <p className="text-gray-500 font-medium text-sm">No quotes yet.</p>
            <p className="text-gray-400 text-xs mt-1">Create your first quote to get started.</p>
            <Link href="/quotes/new" className="inline-flex items-center gap-2 mt-5 px-5 py-2.5 bg-[#d10a11] text-white text-sm font-semibold rounded-xl hover:bg-[#a30a0f] transition-colors">
              <Plus className="h-4 w-4" /> Create Quote
            </Link>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50">
                <th className="text-left px-6 py-3 font-semibold text-gray-500 text-xs uppercase tracking-wider">Quote #</th>
                <th className="text-left px-6 py-3 font-semibold text-gray-500 text-xs uppercase tracking-wider">Product</th>
                <th className="text-left px-6 py-3 font-semibold text-gray-500 text-xs uppercase tracking-wider">Customer</th>
                <th className="text-left px-6 py-3 font-semibold text-gray-500 text-xs uppercase tracking-wider">Status</th>
                <th className="text-left px-6 py-3 font-semibold text-gray-500 text-xs uppercase tracking-wider">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {recentQuotes.map((q) => {
                const meta = safeJSON(q.notes);
                const statusColor: Record<string, string> = {
                  Draft: "bg-gray-100 text-gray-700",
                  Sent: "bg-blue-100 text-blue-700",
                  Accepted: "bg-green-100 text-green-700",
                };
                return (
                  <tr key={q.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-6 py-3.5 font-mono font-semibold text-gray-900">{q.quoteNumber}</td>
                    <td className="px-6 py-3.5 text-gray-700">{meta.productName || "—"}</td>
                    <td className="px-6 py-3.5 text-gray-700">{meta.customerName || "—"}</td>
                    <td className="px-6 py-3.5">
                      <span className={`inline-block px-2.5 py-1 text-xs font-medium rounded-full ${statusColor[q.status] || statusColor.Draft}`}>
                        {q.status}
                      </span>
                    </td>
                    <td className="px-6 py-3.5 text-gray-500">
                      {new Date(q.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function MetricCard({ icon: Icon, label, value, color }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string; color: string }) {
  const colors: Record<string, string> = {
    blue: "bg-blue-50 text-blue-600",
    green: "bg-green-50 text-green-600",
    purple: "bg-purple-50 text-purple-600",
    orange: "bg-orange-50 text-orange-600",
  };
  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between mb-3">
        <div className={`p-2.5 rounded-xl ${colors[color]}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
      <p className="text-sm font-medium text-gray-500">{label}</p>
      <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
    </div>
  );
}

function safeJSON(str: string | null): any {
  if (!str) return {};
  try { return JSON.parse(str); } catch { return {}; }
}
