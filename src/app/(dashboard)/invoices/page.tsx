import { db } from "@/lib/db";
import { invoices, customers } from "@/lib/db/schema";
import { desc, eq, sql } from "drizzle-orm";
import Link from "next/link";
import { Receipt, AlertCircle } from "lucide-react";

export const dynamic = "force-dynamic";

const STATUS_COLORS: Record<string, string> = {
  Draft: "bg-slate-100 text-slate-700",
  Sent: "bg-blue-100 text-blue-700",
  "Partially Paid": "bg-amber-100 text-amber-700",
  Paid: "bg-emerald-100 text-emerald-700",
  Overdue: "bg-red-100 text-red-700",
  Void: "bg-slate-200 text-slate-500",
};

export default async function InvoicesPage() {
  let rows: Array<{
    id: string; invoiceNumber: string; issueDate: string; dueDate: string;
    totalAmount: string; amountPaid: string | null; status: string;
    customerName: string | null;
  }> = [];

  // KPI: AR aging buckets
  let ar = { current: 0, b30: 0, b60: 0, b90: 0, total: 0 };
  try {
    rows = await db
      .select({
        id: invoices.id,
        invoiceNumber: invoices.invoiceNumber,
        issueDate: invoices.issueDate,
        dueDate: invoices.dueDate,
        totalAmount: invoices.totalAmount,
        amountPaid: invoices.amountPaid,
        status: invoices.status,
        customerName: customers.companyName,
      })
      .from(invoices)
      .leftJoin(customers, eq(customers.id, invoices.customerId))
      .orderBy(desc(invoices.createdAt))
      .limit(100);

    // Compute AR aging from unpaid invoices
    const today = new Date();
    for (const inv of rows) {
      if (inv.status === "Paid" || inv.status === "Void") continue;
      const due = new Date(inv.dueDate);
      const daysOverdue = Math.floor((today.getTime() - due.getTime()) / (1000 * 60 * 60 * 24));
      const balance = parseFloat(inv.totalAmount) - parseFloat(inv.amountPaid ?? "0");
      ar.total += balance;
      if (daysOverdue <= 0) ar.current += balance;
      else if (daysOverdue <= 30) ar.b30 += balance;
      else if (daysOverdue <= 60) ar.b60 += balance;
      else ar.b90 += balance;
    }
  } catch {}

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Invoices</h1>
          <p className="text-xs text-slate-500 mt-0.5">{rows.length} invoice{rows.length !== 1 && "s"}</p>
        </div>
      </div>

      {/* AR Aging */}
      {ar.total > 0 && (
        <div className="grid grid-cols-5 gap-3 mb-5">
          <div className="bg-white border border-slate-200 rounded-lg p-3 shadow-sm">
            <div className="text-2xl font-bold text-slate-900 tabular-nums">${ar.total.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
            <div className="text-xs text-slate-500">AR Outstanding</div>
          </div>
          <div className="bg-white border border-slate-200 rounded-lg p-3 shadow-sm">
            <div className="text-xl font-bold text-emerald-700 tabular-nums">${ar.current.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
            <div className="text-xs text-slate-500">Current</div>
          </div>
          <div className="bg-white border border-slate-200 rounded-lg p-3 shadow-sm">
            <div className="text-xl font-bold text-amber-700 tabular-nums">${ar.b30.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
            <div className="text-xs text-slate-500">1–30 days</div>
          </div>
          <div className="bg-white border border-slate-200 rounded-lg p-3 shadow-sm">
            <div className="text-xl font-bold text-orange-700 tabular-nums">${ar.b60.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
            <div className="text-xs text-slate-500">31–60 days</div>
          </div>
          <div className="bg-white border border-slate-200 rounded-lg p-3 shadow-sm">
            <div className="text-xl font-bold text-red-700 tabular-nums">${ar.b90.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
            <div className="text-xs text-slate-500 flex items-center gap-1">{ar.b90 > 0 && <AlertCircle className="h-3 w-3" />} 60+ days</div>
          </div>
        </div>
      )}

      {rows.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-lg p-16 text-center shadow-sm">
          <Receipt className="h-12 w-12 text-slate-200 mx-auto mb-3" />
          <p className="text-sm text-slate-600 font-medium">No invoices yet.</p>
          <p className="text-xs text-slate-400 mt-1">Create one from a Purchase Order detail page.</p>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-xs text-slate-600">
                <th className="text-left px-4 py-2 font-semibold">Invoice #</th>
                <th className="text-left px-4 py-2 font-semibold">Customer</th>
                <th className="text-left px-4 py-2 font-semibold">Issue</th>
                <th className="text-left px-4 py-2 font-semibold">Due</th>
                <th className="text-right px-4 py-2 font-semibold">Total</th>
                <th className="text-right px-4 py-2 font-semibold">Paid</th>
                <th className="text-right px-4 py-2 font-semibold">Balance</th>
                <th className="text-left px-4 py-2 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 tabular-nums">
              {rows.map((r) => {
                const balance = parseFloat(r.totalAmount) - parseFloat(r.amountPaid ?? "0");
                return (
                  <tr key={r.id} className="hover:bg-slate-50/50">
                    <td className="px-4 py-2.5">
                      <Link href={`/invoices/${r.id}`} className="font-mono font-semibold text-slate-900 hover:text-[#d10a11]">{r.invoiceNumber}</Link>
                    </td>
                    <td className="px-4 py-2.5 text-slate-700">{r.customerName ?? "—"}</td>
                    <td className="px-4 py-2.5 text-slate-600 text-xs">{r.issueDate}</td>
                    <td className="px-4 py-2.5 text-slate-600 text-xs">{r.dueDate}</td>
                    <td className="px-4 py-2.5 text-right font-semibold">${parseFloat(r.totalAmount).toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
                    <td className="px-4 py-2.5 text-right text-emerald-700">${parseFloat(r.amountPaid ?? "0").toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
                    <td className="px-4 py-2.5 text-right text-slate-900">${balance.toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
                    <td className="px-4 py-2.5">
                      <span className={`inline-block px-2 py-0.5 text-xs font-medium rounded-full ${STATUS_COLORS[r.status] ?? STATUS_COLORS.Draft}`}>
                        {r.status}
                      </span>
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
