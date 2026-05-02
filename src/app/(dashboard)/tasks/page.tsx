import { db } from "@/lib/db";
import { tasks } from "@/lib/db/schema";
import { desc, sql } from "drizzle-orm";
import { CheckSquare } from "lucide-react";
import { TaskBoard } from "./board";

export const dynamic = "force-dynamic";

export default async function TasksPage() {
  const allTasks = await db.select().from(tasks).orderBy(desc(tasks.createdAt)).limit(200).catch(() => []);

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <CheckSquare className="h-5 w-5 text-[#d10a11]" />
            Tasks
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">{allTasks.length} task{allTasks.length !== 1 && "s"}</p>
        </div>
      </div>

      <TaskBoard initialTasks={allTasks.map((t) => ({
        id: t.id,
        title: t.title,
        description: t.description,
        status: t.status,
        priority: t.priority,
        assignee: t.assignee,
        dueDate: t.dueDate,
      }))} />
    </div>
  );
}
