import { db } from "@/lib/db";
import { customers } from "@/lib/db/schema";
import { desc, count } from "drizzle-orm";
import { Users } from "lucide-react";
import Link from "next/link";

export const dynamic = "force-dynamic";

const TIER_COLORS: Record<string, string> = {
  Premium: "bg-purple-100 text-purple-700",
  Standard: "bg-blue-100 text-blue-700",
  Basic: "bg-gray-100 text-gray-700",
};

export default async function CustomersPage() {
  let allCustomers: any[] = [];
  let totalCount = 0;

  try {
    allCustomers = await db.select().from(customers).orderBy(desc(customers.createdAt)).limit(50);
    const [c] = await db.select({ value: count() }).from(customers);
    totalCount = c.value;
  } catch {}

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Customers</h1>
          <p className="text-sm text-gray-500 mt-1">
            {totalCount > 0 ? `${totalCount} customer${totalCount !== 1 ? "s" : ""}` : "No customers yet"}
          </p>
        </div>
      </div>

      {allCustomers.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-200 p-16 text-center shadow-sm">
          <Users className="h-14 w-14 text-gray-200 mx-auto mb-4" />
          <p className="text-gray-500 font-medium">No customers yet.</p>
          <p className="text-gray-400 text-sm mt-1">Customers will appear here when you save quotes.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-5 py-3.5 font-semibold text-gray-600">Company</th>
                <th className="text-left px-5 py-3.5 font-semibold text-gray-600">Contact</th>
                <th className="text-left px-5 py-3.5 font-semibold text-gray-600">Email</th>
                <th className="text-left px-5 py-3.5 font-semibold text-gray-600">Tier</th>
                <th className="text-center px-5 py-3.5 font-semibold text-gray-600">Active</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {allCustomers.map((c) => (
                <tr key={c.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-5 py-4 font-semibold text-gray-900">
                    <Link href={`/customers/${c.id}`} className="hover:text-[#d10a11]">{c.companyName}</Link>
                  </td>
                  <td className="px-5 py-4 text-gray-700">{c.contactName || "—"}</td>
                  <td className="px-5 py-4 text-gray-700">{c.email || "—"}</td>
                  <td className="px-5 py-4">
                    <span className={`inline-block px-2.5 py-1 text-xs font-medium rounded-full ${TIER_COLORS[c.tier] || TIER_COLORS.Standard}`}>{c.tier}</span>
                  </td>
                  <td className="px-5 py-4 text-center">
                    <span className={`inline-block w-2 h-2 rounded-full ${c.isActive ? "bg-green-500" : "bg-gray-300"}`} />
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
