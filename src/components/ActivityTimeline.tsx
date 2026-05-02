import { db } from "@/lib/db";
import { activities } from "@/lib/db/schema";
import { desc, eq } from "drizzle-orm";
import { Activity, Mail, Phone, FileText, ShoppingCart, Truck, FileCheck, Clock } from "lucide-react";

const TYPE_ICONS: Record<string, typeof Activity> = {
  email: Mail,
  call: Phone,
  note: FileText,
  meeting: Activity,
  shipment: Truck,
  quote: FileText,
  order: ShoppingCart,
  coa: FileCheck,
};

interface Props {
  customerId?: string;
  leadId?: string;
  opportunityId?: string;
  limit?: number;
}

export async function ActivityTimeline({ customerId, leadId, opportunityId, limit = 15 }: Props) {
  let rows: Array<typeof activities.$inferSelect> = [];
  try {
    if (customerId) rows = await db.select().from(activities).where(eq(activities.customerId, customerId)).orderBy(desc(activities.createdAt)).limit(limit);
    else if (leadId) rows = await db.select().from(activities).where(eq(activities.leadId, leadId)).orderBy(desc(activities.createdAt)).limit(limit);
    else if (opportunityId) rows = await db.select().from(activities).where(eq(activities.opportunityId, opportunityId)).orderBy(desc(activities.createdAt)).limit(limit);
    else rows = await db.select().from(activities).orderBy(desc(activities.createdAt)).limit(limit);
  } catch {}

  if (rows.length === 0) {
    return (
      <div className="flex items-center gap-2 text-xs text-slate-400 italic">
        <Clock className="h-3.5 w-3.5" /> No activity recorded yet.
      </div>
    );
  }

  return (
    <ol className="space-y-2">
      {rows.map((a) => {
        const Icon = TYPE_ICONS[a.type] ?? Activity;
        return (
          <li key={a.id} className="flex gap-3">
            <div className="flex flex-col items-center">
              <div className="w-7 h-7 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center flex-shrink-0">
                <Icon className="h-3.5 w-3.5 text-slate-500" />
              </div>
              <div className="w-px flex-1 bg-slate-200 mt-1" />
            </div>
            <div className="flex-1 pb-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium text-slate-900">{a.subject}</p>
                <time className="text-xs text-slate-400 whitespace-nowrap">{new Date(a.createdAt).toLocaleString()}</time>
              </div>
              {a.description && <p className="text-xs text-slate-600 mt-0.5">{a.description}</p>}
              {a.completedAt && a.completedAt !== a.createdAt && (
                <p className="text-xs text-slate-400 mt-0.5">Completed {new Date(a.completedAt).toLocaleString()}</p>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
