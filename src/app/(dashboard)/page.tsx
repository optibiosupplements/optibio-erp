import { db } from "@/lib/db";
import { rfqs, ingredients } from "@/lib/db/schema";
import { count, desc, gte } from "drizzle-orm";
import { FileText, Pill, TrendingUp, Plus, Search, ArrowRight, ClipboardList } from "lucide-react";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  let dealCount = 0;
  let ingredientCount = 0;
  let dealsThisMonth = 0;
  let recentDeals: any[] = [];

  try {
    const [dc] = await db.select({ value: count() }).from(rfqs);
    dealCount = dc.value;

    const [ic] = await db.select({ value: count() }).from(ingredients);
    ingredientCount = ic.value;

    const firstOfMonth = new Date();
    firstOfMonth.setDate(1);
    firstOfMonth.setHours(0, 0, 0, 0);
    const [mc] = await db.select({ value: count() }).from(rfqs).where(gte(rfqs.createdAt, firstOfMonth));
    dealsThisMonth = mc.value;

    recentDeals = await db.select().from(rfqs).orderBy(desc(rfqs.createdAt)).limit(5);
  } catch {}

  const STATUS_COLORS: Record<string, string> = {
    New: "bg-blue-100 text-blue-700",
    Formulating: "bg-purple-100 text-purple-700",
    Quoted: "bg-green-100 text-green-700",
    Sent: "bg-indigo-100 text-indigo-700",
    Accepted: "bg-emerald-100 text-emerald-700",
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-sm text-gray-500 mt-1">Welcome to Optibio ERP</p>
        </div>
        <Link href="/ingredients" className="inline-flex items-center gap-2 px-4 py-2.5 bg-white text-gray-700 text-sm font-medium rounded-xl border border-gray-200 hover:bg-gray-50 transition-colors">
          <Search className="h-4 w-4" /> Search Ingredients
        </Link>
      </div>

      {/* Hero CTA */}
      <div className="bg-gradient-to-r from-[#1a1a2e] to-[#2d2d44] rounded-2xl p-8 mb-8 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold mb-2">Start a New Deal</h2>
            <p className="text-white/70 text-sm max-w-md">
              Drop a supplement facts panel and let AI extract everything — ingredients, dosages, and product info. Build your quote in minutes, not hours.
            </p>
          </div>
          <Link href="/deals/new" className="inline-flex items-center gap-2 px-6 py-3 bg-[#d10a11] text-white font-semibold rounded-xl hover:bg-[#a30a0f] transition-colors shadow-lg shrink-0">
            <Plus className="h-5 w-5" /> New Deal
          </Link>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
        <MetricCard icon={ClipboardList} label="Active Deals" value={String(dealCount)} color="blue" />
        <MetricCard icon={TrendingUp} label="Deals This Month" value={String(dealsThisMonth)} color="green" />
        <MetricCard icon={Pill} label="Ingredients" value={ingredientCount.toLocaleString()} color="purple" />
        <MetricCard icon={FileText} label="Pending Quotes" value="0" color="orange" />
      </div>

      {/* Recent Deals */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">Recent Deals</h2>
          {recentDeals.length > 0 && (
            <Link href="/deals" className="text-sm text-[#d10a11] hover:underline font-medium inline-flex items-center gap-1">
              View all <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          )}
        </div>

        {recentDeals.length === 0 ? (
          <div className="text-center py-14 px-6">
            <ClipboardList className="h-12 w-12 text-gray-200 mx-auto mb-3" />
            <p className="text-gray-500 font-medium text-sm">No deals yet.</p>
            <p className="text-gray-400 text-xs mt-1">Use the banner above to start your first deal.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50">
                <th className="text-left px-6 py-3 font-semibold text-gray-500 text-xs uppercase tracking-wider">Deal #</th>
                <th className="text-left px-6 py-3 font-semibold text-gray-500 text-xs uppercase tracking-wider">Product</th>
                <th className="text-left px-6 py-3 font-semibold text-gray-500 text-xs uppercase tracking-wider">Customer</th>
                <th className="text-left px-6 py-3 font-semibold text-gray-500 text-xs uppercase tracking-wider">Status</th>
                <th className="text-left px-6 py-3 font-semibold text-gray-500 text-xs uppercase tracking-wider">Date</th>
                <th className="text-right px-6 py-3 font-semibold text-gray-500 text-xs uppercase tracking-wider">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {recentDeals.map((d) => (
                <tr key={d.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-6 py-3.5 font-mono font-semibold text-gray-900">{d.rfqNumber}</td>
                  <td className="px-6 py-3.5 text-gray-700">{d.productName || "—"}</td>
                  <td className="px-6 py-3.5 text-gray-700">{d.customerCompany || "—"}</td>
                  <td className="px-6 py-3.5">
                    <span className={`inline-block px-2.5 py-1 text-xs font-medium rounded-full ${STATUS_COLORS[d.status] || STATUS_COLORS.New}`}>{d.status}</span>
                  </td>
                  <td className="px-6 py-3.5 text-gray-500">{new Date(d.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</td>
                  <td className="px-6 py-3.5 text-right">
                    <Link href={`/deals/${d.id}`} className="text-xs text-[#d10a11] font-medium hover:underline">Open →</Link>
                  </td>
                </tr>
              ))}
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
      <div className={`p-2.5 rounded-xl ${colors[color]} w-fit mb-3`}>
        <Icon className="h-5 w-5" />
      </div>
      <p className="text-sm font-medium text-gray-500">{label}</p>
      <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
    </div>
  );
}
