"use client";

import { useState, useTransition } from "react";
import { Loader2, Play, Pause, CheckCircle2, AlertTriangle } from "lucide-react";

interface Heartbeat {
  id: string;
  name: string;
  label: string;
  description: string | null;
  scheduleCron: string;
  enabled: boolean;
  lastRunAt: string | null;
  lastRunStatus: string | null;
  lastRunOutput: string | null;
  totalRuns: number;
  totalActions: number;
}

const STATUS_COLORS: Record<string, string> = {
  ok: "bg-emerald-100 text-emerald-700",
  no_action: "bg-slate-100 text-slate-600",
  error: "bg-red-100 text-red-700",
};

export function HeartbeatList({ initial }: { initial: Heartbeat[] }) {
  const [hbs, setHbs] = useState(initial);
  const [pending, start] = useTransition();
  const [runningName, setRunningName] = useState<string | null>(null);

  function runNow(name: string) {
    setRunningName(name);
    start(async () => {
      try {
        const res = await fetch("/api/heartbeats", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name }),
        });
        const data = await res.json();
        if (data.success) {
          setHbs((prev) => prev.map((h) => (
            h.name === name
              ? {
                ...h,
                lastRunAt: new Date().toISOString(),
                lastRunStatus: data.result.status,
                lastRunOutput: data.result.output,
                totalRuns: h.totalRuns + 1,
                totalActions: h.totalActions + data.result.actions,
              }
              : h
          )));
        } else {
          alert(`Failed: ${data.error}`);
        }
      } finally {
        setRunningName(null);
      }
    });
  }

  function toggleEnabled(id: string, enabled: boolean) {
    start(async () => {
      const res = await fetch(`/api/heartbeats/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled }),
      });
      if (res.ok) {
        setHbs((prev) => prev.map((h) => (h.id === id ? { ...h, enabled } : h)));
      }
    });
  }

  return (
    <div className="space-y-3">
      {hbs.map((h) => (
        <article key={h.id} className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-1">
                <h2 className="text-sm font-semibold text-slate-900">{h.label}</h2>
                <code className="font-mono text-[11px] bg-slate-100 px-1.5 py-0.5 rounded text-slate-700">{h.scheduleCron}</code>
                <span className={`inline-block px-2 py-0.5 text-[10px] font-medium rounded-full ${h.enabled ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                  {h.enabled ? "● Enabled" : "○ Disabled"}
                </span>
              </div>
              {h.description && <p className="text-xs text-slate-600 mb-3">{h.description}</p>}

              <div className="grid grid-cols-4 gap-3 text-xs">
                <div>
                  <div className="text-slate-500 uppercase tracking-wide">Last Run</div>
                  <div className="text-slate-900 mt-0.5">{h.lastRunAt ? new Date(h.lastRunAt).toLocaleString() : "Never"}</div>
                </div>
                <div>
                  <div className="text-slate-500 uppercase tracking-wide">Last Status</div>
                  <div className="mt-0.5">
                    {h.lastRunStatus ? (
                      <span className={`inline-block px-1.5 py-0.5 text-[10px] font-medium rounded-full ${STATUS_COLORS[h.lastRunStatus] ?? STATUS_COLORS.no_action}`}>
                        {h.lastRunStatus === "ok" && <CheckCircle2 className="h-3 w-3 inline mr-0.5" />}
                        {h.lastRunStatus === "error" && <AlertTriangle className="h-3 w-3 inline mr-0.5" />}
                        {h.lastRunStatus}
                      </span>
                    ) : <span className="text-slate-400">—</span>}
                  </div>
                </div>
                <div>
                  <div className="text-slate-500 uppercase tracking-wide">Total Runs</div>
                  <div className="text-slate-900 mt-0.5 tabular-nums">{h.totalRuns}</div>
                </div>
                <div>
                  <div className="text-slate-500 uppercase tracking-wide">Total Actions</div>
                  <div className="text-slate-900 mt-0.5 tabular-nums">{h.totalActions}</div>
                </div>
              </div>

              {h.lastRunOutput && (
                <p className="mt-3 text-xs text-slate-700 bg-slate-50 border border-slate-200 rounded p-2 font-mono">
                  {h.lastRunOutput}
                </p>
              )}
            </div>

            <div className="flex flex-col gap-2">
              <button
                onClick={() => runNow(h.name)}
                disabled={pending && runningName === h.name}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#d10a11] hover:bg-[#a30a0f] disabled:opacity-50 text-white text-xs font-semibold rounded-md whitespace-nowrap"
              >
                {pending && runningName === h.name ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
                Run Now
              </button>
              <button
                onClick={() => toggleEnabled(h.id, !h.enabled)}
                disabled={pending}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-slate-300 hover:bg-slate-50 disabled:opacity-50 text-slate-700 text-xs font-medium rounded-md"
              >
                {h.enabled ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                {h.enabled ? "Disable" : "Enable"}
              </button>
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}
