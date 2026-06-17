import Link from "next/link";
import { redirect } from "next/navigation";

import { apiGet } from "@/lib/api";

type Dashboard = {
  projects: number;
  tasks: { todo: number; in_progress: number; done: number };
  overdue: number;
  due_this_week: number;
};

// Server component: stats load already authenticated, so the page paints with
// data (no client spinner).
export default async function DashboardPage() {
  const res = await apiGet("/api/v1/dashboard/");
  if (res.status === 401) redirect("/login");
  if (!res.ok) throw new Error("Failed to load the dashboard."); // → error.tsx
  const d: Dashboard = await res.json();

  const stats = [
    { label: "Projects", value: d.projects },
    { label: "To Do", value: d.tasks.todo },
    { label: "In Progress", value: d.tasks.in_progress },
    { label: "Done", value: d.tasks.done },
    { label: "Overdue", value: d.overdue, tone: "danger" as const },
    { label: "Due this week", value: d.due_this_week, tone: "warn" as const },
  ];

  return (
    <main className="mx-auto max-w-5xl p-4 sm:p-6">
      <header className="mb-8 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-sm text-zinc-500">Your projects and tasks at a glance.</p>
        </div>
        <Link
          href="/board"
          className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50"
        >
          Board
        </Link>
      </header>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
        {stats.map((s) => {
          const active = "value" in s && s.value > 0;
          const tone =
            s.tone === "danger" && active
              ? "border-rose-200 bg-rose-50"
              : s.tone === "warn" && active
                ? "border-amber-200 bg-amber-50"
                : "border-zinc-200/70 bg-white";
          return (
            <div key={s.label} className={`rounded-2xl border p-6 ${tone}`}>
              <div className="text-3xl font-semibold tabular-nums tracking-tight">
                {s.value}
              </div>
              <div className="mt-1 text-sm text-zinc-500">{s.label}</div>
            </div>
          );
        })}
      </div>
    </main>
  );
}
