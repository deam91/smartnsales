import { redirect } from "next/navigation";

import { apiGetAll } from "@/lib/api";
import { Board, type Project, type Task } from "./board";

// Server component: loads every task + project (following pagination) already
// authenticated, so the board renders fully on first paint — no client spinner.
export default async function BoardPage() {
  const tasks = await apiGetAll("/api/tasks/");
  if (tasks.status === 401) redirect("/login");
  if (!tasks.ok) throw new Error("Failed to load tasks."); // → error.tsx

  const projects = await apiGetAll("/api/projects/");

  return (
    <Board
      initialTasks={tasks.results as Task[]}
      initialProjects={projects.results as Project[]}
    />
  );
}
