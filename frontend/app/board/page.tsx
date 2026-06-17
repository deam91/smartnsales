import { redirect } from "next/navigation";

import { apiGet, apiGetAll } from "@/lib/api";
import { Board, type BoardInit, type Project } from "./board";

const STATUSES = ["todo", "in_progress", "done"] as const;

// Server component: loads the first page of each column already authenticated,
// so the board paints with data; columns lazy-load further pages on scroll.
export default async function BoardPage() {
  const responses = await Promise.all(
    STATUSES.map((s) => apiGet(`/api/tasks/?status=${s}&page=1`)),
  );
  if (responses[0].status === 401) redirect("/login");
  if (responses.some((r) => !r.ok)) throw new Error("Failed to load tasks."); // → error.tsx

  const pages = await Promise.all(responses.map((r) => r.json()));
  const initial = {} as BoardInit;
  STATUSES.forEach((s, i) => {
    initial[s] = { tasks: pages[i].results, hasMore: Boolean(pages[i].next) };
  });

  const projects = await apiGetAll("/api/projects/");
  return <Board initial={initial} initialProjects={projects.results as Project[]} />;
}
