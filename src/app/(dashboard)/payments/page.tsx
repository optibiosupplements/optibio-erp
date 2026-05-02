import { db } from "@/lib/db";
import { payments, invoices, customers } from "@/lib/db/schema";
import { desc, eq } from "drizzle-orm";
import Link from "next/link";
import { DollarSign } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function PaymentsPage() {
  let rows: Array<{
    id: string; paymentNumber: string; amount: string; paymentDate: string;
    method: string; reference: string | null;
    invoiceNumber: string | null; customerName: string | null;
  }> = [];
  try {
    rows = await db
      .select({
        id: payments.id,
        paymentNumber: payments.paymentNumber,
        amount: payments.amount,
        paymentDate: payments.paymentDate,
        method: payments.method,
        reference: payments.reference,
        invoiceNumber: invoices.invoiceNumber,
        customerName: customers.companyName,
      })
      .from(payments)
      .leftJoin(invoices, eq(invoices.id, payments.invoiceId))
      .leftJoin(customers, eq(customers.id, payments.customerId))
      .orderBy(desc(payments.paymentDate))
      .limit(100);
  } catch {}

  const totalReceived = rows.reduce((s, r) => s + parseFloat(r.amount), 0);

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Payments</h1>
          <p className="text-xs text-slate-500 mt-0.5">{rows.length} payment{rows.length !== 1 && "s"} · ${totalReceived.toLocaleString(undefined, { maximumFractionDigits: 0 })} received</p>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-lg p-16 text-center shadow-sm">
          <DollarSign className="h-12 w-12 text-slate-200 mx-auto mb-3" />
          <p className="text-sm text-slate-600 font-medium">No payments recorded yet.</p>
          <p className="text-xs text-slate-400 mt-1">Record a payment from an invoice detail page.</p>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-xs text-slate-600">
                <th className="text-left px-4 py-2 font-semibold">Payment #</th>
                <th className="text-left px-4 py-2 font-semibold">Date</th>
                <th className="text-left px-4 py-2 font-semibold">Customer</th>
                <th className="text-left px-4 py-2 font-semibold">Invoice</th>
                <th className="text-left px-4 py-2 font-semibold">Method</th>
                <th className="text-left px-4 py-2 font-semibold">Reference</th>
                <th className="text-right px-4 py-2 font-semibold">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 tabular-nums">
              {rows.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50/50">
                  <td className="px-4 py-2.5 font-mono text-xs font-semibold">{r.paymentNumber}</td>
                  <td className="px-4 py-2.5 text-slate-700">{r.paymentDate}</td>
                  <td className="px-4 py-2.5 text-slate-700">{r.customerName ?? "—"}</td>
                  <td className="px-4 py-2.5 font-mono text-xs">{r.invoiceNumber ?? "—"}</td>
                  <td className="px-4 py-2.5 text-slate-700">{r.method}</td>
                  <td className="px-4 py-2.5 text-slate-500 text-xs font-mono">{r.reference ?? "—"}</td>
                  <td className="px-4 py-2.5 text-right font-semibold text-emerald-700">${parseFloat(r.amount).toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
