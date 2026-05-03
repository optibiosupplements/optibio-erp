import { db } from "@/lib/db";
import { appSettings } from "@/lib/db/schema";
import { Settings as SettingsIcon } from "lucide-react";
import { SettingsEditor } from "./editor";
import { getBudgetStatus } from "@/domains/agents/cost";
import { BudgetBadge } from "@/components/agents/BudgetBadge";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  let initial: Record<string, string> = {};
  try {
    const rows = await db.select().from(appSettings);
    for (const r of rows) initial[r.key] = r.value;
  } catch {}

  let budget: Awaited<ReturnType<typeof getBudgetStatus>> | null = null;
  try {
    budget = await getBudgetStatus();
  } catch {}

  return (
    <div className="max-w-5xl mx-auto pb-24">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <SettingsIcon className="h-5 w-5 text-[#d10a11]" />
            Settings
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Pricing tiers, manufacturing & packaging defaults, branding, and AI agent budget caps. Changes apply on next quote/agent call.
          </p>
        </div>
        {budget && <BudgetBadge status={budget} />}
      </div>

      <SettingsEditor initialValues={initial} />
    </div>
  );
}
