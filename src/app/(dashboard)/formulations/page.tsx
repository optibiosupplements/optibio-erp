import { db } from "@/lib/db";
import { formulations, customers } from "@/lib/db/schema";
import { desc, eq } from "drizzle-orm";
import Link from "next/link";
import { FlaskConical, Plus } from "lucide-react";

export const dynamic = "force-dynamic";

const STATUS_COLORS: Record<string, string> = {
  Draft: "bg-blue-100 text-blue-700",
  "In Review": "bg-yellow-100 text-yellow-700",
  Locked: "bg-emerald-100 text-emerald-700",
};

export default async function FormulationsPage() {
  let rows: Array<{
    id: string;
    name: string;
    dosageForm: string;
    capsuleSize: string | null;
    capsulesPerServing: number;
    servingsPerContainer: number | null;
    status: string;
    customerName: string | null;
    createdAt: Date;
  }> = [];

  try {
    rows = await db
      .select({
        id: formulations.id,
        name: formulations.name,
        dosageForm: formulations.dosageForm,
        capsuleSize: formulations.capsuleSize,
        capsulesPerServing: formulations.capsulesPerServing,
        servingsPerContainer: formulations.servingsPerContainer,
        status: formulations.status,
        customerName: customers.companyName,
        createdAt: formulations.createdAt,
      })
      .from(formulations)
      .leftJoin(customers, eq(customers.id, formulations.customerId))
      .orderBy(desc(formulations.createdAt))
      .limit(100);
  } catch {}

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">The Lab</h1>
          <p className="text-xs text-slate-500 mt-0.5">{rows.length} formulation{rows.length !== 1 && "s"}</p>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-lg p-16 text-center shadow-sm">
          <FlaskConical className="h-12 w-12 text-slate-200 mx-auto mb-3" />
          <p className="text-sm text-slate-600 font-medium">No formulations yet.</p>
          <p className="text-xs text-slate-400 mt-1">Create an RFQ first, then submit it to R&amp;D from the Magic Box.</p>
          <Link
            href="/intake/new"
            className="inline-flex items-center gap-2 mt-4 px-4 py-2 bg-[#d10a11] hover:bg-[#a30a0f] text-white text-sm font-semibold rounded-md transition-colors"
          >
            <Plus className="h-4 w-4" /> New RFQ
          </Link>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-xs text-slate-600">
                <th className="text-left px-4 py-2 font-semibold">Name</th>
                <th className="text-left px-4 py-2 font-semibold">Format</th>
                <th className="text-left px-4 py-2 font-semibold">Sizing</th>
                <th className="text-left px-4 py-2 font-semibold">Customer</th>
                <th className="text-left px-4 py-2 font-semibold">Status</th>
                <th className="text-left px-4 py-2 font-semibold">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50/50">
                  <td className="px-4 py-2.5">
                    <Link href={`/formulations/${r.id}`} className="text-slate-900 hover:text-[#d10a11]">
                      {r.name}
                    </Link>
                  </td>
                  <td className="px-4 py-2.5 text-slate-700">{r.dosageForm}</td>
                  <td className="px-4 py-2.5 text-slate-600 text-xs">
                    {r.capsuleSize ? `Size ${r.capsuleSize} · ${r.capsulesPerServing} cap${r.capsulesPerServing !== 1 ? "s" : ""}/serving` : "—"}
                    {r.servingsPerContainer ? ` · ${r.servingsPerContainer}/bottle` : ""}
                  </td>
                  <td className="px-4 py-2.5 text-slate-700">{r.customerName ?? "—"}</td>
                  <td className="px-4 py-2.5">
                    <span className={`inline-block px-2 py-0.5 text-xs font-medium rounded-full ${STATUS_COLORS[r.status] ?? STATUS_COLORS.Draft}`}>
                      {r.status}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-slate-500 text-xs">{r.createdAt instanceof Date ? r.createdAt.toLocaleDateString() : new Date(r.createdAt).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
