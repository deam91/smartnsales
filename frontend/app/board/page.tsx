import { redirect } from "next/navigation";

import { apiGet } from "@/lib/api";
import { Board } from "./board";

// Server component: loads tasks + projects already-authenticated, so the board
// renders with data on first paint (no client-side spinner for initial load).
export default async function BoardPage() {
  const [tasksRes, projectsRes] = await Promise.all([
    apiGet("/api/tasks/"),
    apiGet("/api/projects/"),
  ]);

  if (tasksRes.status === 401) redirect("/login");
  if (!tasksRes.ok) throw new Error("Failed to load tasks."); // → error.tsx

  // ponytail: shows the first page (PAGE_SIZE=20). Add infinite scroll / a
  // column-scoped fetch when a board routinely exceeds that.
  const tasks = (await tasksRes.json()).results;
  const projects = projectsRes.ok ? (await projectsRes.json()).results : [];

  return <Board initialTasks={tasks} initialProjects={projects} />;
}
