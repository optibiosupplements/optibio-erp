import { FileText, Users, TrendingUp, DollarSign, Plus, Search } from "lucide-react";
import Link from "next/link";

export default function DashboardPage() {
  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-sm text-gray-500 mt-1">Welcome to Optibio ERP</p>
        </div>
        <div className="flex gap-3">
          <Link
            href="/quotes/new"
            className="inline-flex items-center gap-2 px-4 py-2 bg-[#d10a11] text-white text-sm font-medium rounded-lg hover:bg-[#a30a0f] transition-colors"
          >
            <Plus className="h-4 w-4" /> New Quote
          </Link>
          <Link
            href="/ingredients"
            className="inline-flex items-center gap-2 px-4 py-2 bg-white text-gray-700 text-sm font-medium rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
          >
            <Search className="h-4 w-4" /> Search Ingredients
          </Link>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <MetricCard icon={FileText} label="Active Quotes" value="0" trend="" color="blue" />
        <MetricCard icon={Users} label="New Leads" value="0" trend="" color="green" />
        <MetricCard icon={DollarSign} label="Pipeline Value" value="$0" trend="" color="purple" />
        <MetricCard icon={TrendingUp} label="Quotes This Month" value="0" trend="" color="orange" />
      </div>

      {/* Recent Quotes */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent Quotes</h2>
        <div className="text-center py-12">
          <FileText className="h-12 w-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 text-sm">No quotes yet.</p>
          <p className="text-gray-400 text-xs mt-1">Create your first quote to get started.</p>
          <Link
            href="/quotes/new"
            className="inline-flex items-center gap-2 mt-4 px-4 py-2 bg-[#d10a11] text-white text-sm font-medium rounded-lg hover:bg-[#a30a0f] transition-colors"
          >
            <Plus className="h-4 w-4" /> Create Quote
          </Link>
        </div>
      </div>
    </div>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
  trend,
  color,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  trend: string;
  color: string;
}) {
  const colorMap: Record<string, string> = {
    blue: "bg-blue-50 text-blue-600",
    green: "bg-green-50 text-green-600",
    purple: "bg-purple-50 text-purple-600",
    orange: "bg-orange-50 text-orange-600",
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-3">
        <div className={`p-2 rounded-lg ${colorMap[color]}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
      <p className="text-sm font-medium text-gray-500">{label}</p>
      <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
      {trend && <p className="text-xs text-gray-400 mt-1">{trend}</p>}
    </div>
  );
}
