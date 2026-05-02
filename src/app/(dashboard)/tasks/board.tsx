"use client";

import { useState, useTransition } from "react";
import { Plus, Loader2, Trash2 } from "lucide-react";

interface Task {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  assignee: string | null;
  dueDate: string | null;
}

const STATUSES = ["Todo", "In Progress", "Blocked", "Done"] as const;
const PRIORITY_COLORS: Record<string, string> = {
  Low: "bg-slate-100 text-slate-600",
  Normal: "bg-blue-100 text-blue-700",
  High: "bg-amber-100 text-amber-700",
  Urgent: "bg-red-100 text-red-700",
};

export function TaskBoard({ initialTasks }: { initialTasks: Task[] }) {
  const [tasks, setTasks] = useState(initialTasks);
  const [pending, start] = useTransition();
  const [showForm, setShowForm] = useState(false);
  const [newTask, setNewTask] = useState({ title: "", priority: "Normal", assignee: "", dueDate: "" });

  function moveTask(id: string, status: string) {
    start(async () => {
      const res = await fetch(`/api/tasks/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, status } : t)));
      }
    });
  }

  function deleteTask(id: string) {
    start(async () => {
      const res = await fetch(`/api/tasks/${id}`, { method: "DELETE" });
      if (res.ok) setTasks((prev) => prev.filter((t) => t.id !== id));
    });
  }

  function createTask() {
    if (!newTask.title.trim()) return;
    start(async () => {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newTask.title,
          priority: newTask.priority,
          assignee: newTask.assignee || undefined,
          dueDate: newTask.dueDate || undefined,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setTasks((prev) => [
          { id: data.taskId, title: newTask.title, description: null, status: "Todo", priority: newTask.priority, assignee: newTask.assignee || null, dueDate: newTask.dueDate || null },
          ...prev,
        ]);
        setNewTask({ title: "", priority: "Normal", assignee: "", dueDate: "" });
        setShowForm(false);
      }
    });
  }

  return (
    <div>
      <div className="mb-4">
        {!showForm ? (
          <button onClick={() => setShowForm(true)} className="inline-flex items-center gap-2 px-4 py-2 bg-[#d10a11] hover:bg-[#a30a0f] text-white text-sm font-semibold rounded-md">
            <Plus className="h-4 w-4" /> New Task
          </button>
        ) : (
          <div className="bg-white border border-slate-200 rounded-lg p-3 shadow-sm">
            <div className="grid grid-cols-4 gap-3">
              <input
                value={newTask.title}
                onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                placeholder="Task title *"
                className="border border-slate-300 rounded px-3 py-1.5 text-sm col-span-2"
                autoFocus
                onKeyDown={(e) => e.key === "Enter" && createTask()}
              />
              <select value={newTask.priority} onChange={(e) => setNewTask({ ...newTask, priority: e.target.value })} className="border border-slate-300 rounded px-2 py-1.5 text-sm">
                <option value="Low">Low</option>
                <option value="Normal">Normal</option>
                <option value="High">High</option>
                <option value="Urgent">Urgent</option>
              </select>
              <input value={newTask.assignee} onChange={(e) => setNewTask({ ...newTask, assignee: e.target.value })} placeholder="Assignee" className="border border-slate-300 rounded px-2 py-1.5 text-sm" />
              <input type="date" value={newTask.dueDate} onChange={(e) => setNewTask({ ...newTask, dueDate: e.target.value })} className="border border-slate-300 rounded px-2 py-1.5 text-sm" />
              <div className="flex gap-2 col-span-3">
                <button onClick={createTask} disabled={pending || !newTask.title} className="flex-1 px-3 py-1.5 bg-[#d10a11] hover:bg-[#a30a0f] disabled:opacity-50 text-white text-sm font-semibold rounded">
                  {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin inline" /> : "Create"}
                </button>
                <button onClick={() => setShowForm(false)} className="px-3 py-1.5 border border-slate-300 text-slate-700 text-sm rounded">Cancel</button>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        {STATUSES.map((status) => {
          const cardTasks = tasks.filter((t) => t.status === status);
          return (
            <div key={status} className="bg-slate-50 rounded-lg p-2 min-h-[400px]">
              <div className="flex items-center justify-between mb-2 px-1">
                <h2 className="text-xs font-semibold text-slate-700 uppercase tracking-wide">{status}</h2>
                <span className="text-xs font-semibold text-slate-500 tabular-nums bg-white px-1.5 py-0.5 rounded">{cardTasks.length}</span>
              </div>
              <div className="space-y-1.5">
                {cardTasks.length === 0 ? (
                  <div className="text-xs text-slate-400 italic px-2 py-4 text-center">Empty</div>
                ) : (
                  cardTasks.map((t) => (
                    <div key={t.id} className="bg-white border border-slate-200 rounded p-2 group">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-medium text-slate-900 leading-tight">{t.title}</p>
                        <button onClick={() => deleteTask(t.id)} className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-600 transition-opacity">
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                      {t.assignee && <p className="text-xs text-slate-500 mt-1">{t.assignee}</p>}
                      <div className="flex items-center justify-between mt-2 gap-2">
                        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${PRIORITY_COLORS[t.priority] ?? PRIORITY_COLORS.Normal}`}>
                          {t.priority}
                        </span>
                        {t.dueDate && <span className="text-[10px] text-slate-500">{t.dueDate}</span>}
                      </div>
                      <div className="flex gap-1 mt-2">
                        {STATUSES.filter((s) => s !== status).map((nextStatus) => (
                          <button
                            key={nextStatus}
                            onClick={() => moveTask(t.id, nextStatus)}
                            disabled={pending}
                            className="flex-1 text-[10px] px-1 py-0.5 border border-slate-200 hover:border-slate-300 text-slate-600 rounded disabled:opacity-50"
                          >
                            → {nextStatus.split(" ")[0]}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
