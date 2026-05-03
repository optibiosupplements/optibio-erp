import { Bot, AlertTriangle } from "lucide-react";
import type { BudgetStatus } from "@/domains/agents/cost";

export function BudgetBadge({ status, compact = false }: { status: BudgetStatus; compact?: boolean }) {
  const dailyPct = status.dailyCapUsd > 0 ? (status.todayUsd / status.dailyCapUsd) * 100 : 0;
  const exceeded = status.dailyExceeded || status.monthlyExceeded;
  const warn = !exceeded && dailyPct >= 75;

  const tone = exceeded
    ? "bg-red-50 border-red-200 text-red-700"
    : warn
      ? "bg-amber-50 border-amber-200 text-amber-700"
      : "bg-slate-50 border-slate-200 text-slate-700";

  if (compact) {
    return (
      <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md border text-xs font-medium tabular-nums ${tone}`}>
        {exceeded ? <AlertTriangle className="h-3 w-3" /> : <Bot className="h-3 w-3" />}
        ${status.todayUsd.toFixed(2)} / ${status.dailyCapUsd.toFixed(0)}
      </span>
    );
  }

  return (
    <div className={`inline-flex flex-col px-3 py-2 rounded-md border text-xs ${tone}`}>
      <div className="flex items-center gap-1.5 font-medium">
        {exceeded ? <AlertTriangle className="h-3.5 w-3.5" /> : <Bot className="h-3.5 w-3.5" />}
        Agent spend today
      </div>
      <div className="mt-1 flex items-baseline gap-2 tabular-nums">
        <span className="text-base font-semibold">${status.todayUsd.toFixed(4)}</span>
        <span className="text-slate-500">/ ${status.dailyCapUsd.toFixed(2)} cap</span>
      </div>
      <div className="text-[11px] text-slate-500 tabular-nums">
        Month: ${status.monthUsd.toFixed(2)} / ${status.monthlyCapUsd.toFixed(0)}
      </div>
    </div>
  );
}
