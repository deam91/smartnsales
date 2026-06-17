"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export type Task = {
  id: number;
  title: string;
  description: string;
  status: "todo" | "in_progress" | "done";
  priority: number;
  due_date: string | null;
  assigned_to: number | null;
  project: number;
};
export type Project = { id: number; name: string };

const COLUMNS: { key: Task["status"]; label: string }[] = [
  { key: "todo", label: "To Do" },
  { key: "in_progress", label: "In Progress" },
  { key: "done", label: "Done" },
];
const PRIORITIES = [
  { value: 1, label: "Low" },
  { value: 2, label: "Medium" },
  { value: 3, label: "High" },
  { value: 4, label: "Urgent" },
];
const PRIORITY_CLASS: Record<number, string> = {
  1: "bg-zinc-100 text-zinc-500",
  2: "bg-sky-50 text-sky-700",
  3: "bg-amber-50 text-amber-700",
  4: "bg-rose-50 text-rose-700",
};
const priorityLabel = (v: number) => PRIORITIES.find((p) => p.value === v)?.label ?? "—";

async function patchTask(id: number, body: object): Promise<Task> {
  const res = await fetch(`${API}/api/tasks/${id}/`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error("Update failed");
  return res.json();
}

const INPUT =
  "w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none transition focus:border-zinc-400 focus:ring-2 focus:ring-emerald-500/30";
const PRIMARY_BTN =
  "rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-800 active:scale-[0.98] disabled:opacity-50";

export function Board({
  initialTasks,
  initialProjects,
}: {
  initialTasks: Task[];
  initialProjects: Project[];
}) {
  const [tasks, setTasks] = useState(initialTasks);
  const [projects, setProjects] = useState(initialProjects);
  const [selected, setSelected] = useState<Task | null>(null);
  const [creatingTask, setCreatingTask] = useState(false);
  const [creatingProject, setCreatingProject] = useState(false);
  const [dragOver, setDragOver] = useState<Task["status"] | null>(null);

  function upsert(task: Task) {
    setTasks((prev) => {
      const i = prev.findIndex((t) => t.id === task.id);
      if (i === -1) return [task, ...prev];
      const next = [...prev];
      next[i] = task;
      return next;
    });
  }

  // Drag-and-drop move: optimistic, reverted if the PATCH fails.
  async function move(taskId: number, status: Task["status"]) {
    const task = tasks.find((t) => t.id === taskId);
    if (!task || task.status === status) return;
    upsert({ ...task, status });
    try {
      upsert(await patchTask(taskId, { status }));
    } catch {
      upsert(task);
    }
  }

  return (
    <div className="mx-auto max-w-6xl p-4 sm:p-6">
      <header className="mb-8 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Board</h1>
          <p className="text-sm text-zinc-500">Drag a card between columns to move it.</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setCreatingProject(true)}
            className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 active:scale-[0.98]"
          >
            New project
          </button>
          <button onClick={() => setCreatingTask(true)} className={PRIMARY_BTN}>
            New task
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {COLUMNS.map((col) => {
          const colTasks = tasks.filter((t) => t.status === col.key);
          const active = dragOver === col.key;
          return (
            <section
              key={col.key}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(col.key);
              }}
              onDragLeave={() => setDragOver((s) => (s === col.key ? null : s))}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(null);
                const id = Number(e.dataTransfer.getData("text/plain"));
                if (id) move(id, col.key);
              }}
              className={`rounded-2xl border p-3 transition ${
                active
                  ? "border-emerald-400/60 bg-emerald-50/50 ring-2 ring-emerald-500/30"
                  : "border-zinc-200/70 bg-zinc-100/60"
              }`}
            >
              <h2 className="mb-3 flex items-center justify-between px-1 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                {col.label}
                <span className="rounded-full bg-white px-2 py-0.5 text-zinc-400 tabular-nums">
                  {colTasks.length}
                </span>
              </h2>
              <ul className="space-y-2">
                {colTasks.map((t, i) => (
                  <li
                    key={t.id}
                    draggable
                    onDragStart={(e) => e.dataTransfer.setData("text/plain", String(t.id))}
                    className="animate-rise"
                    style={{ animationDelay: `${i * 50}ms` }}
                  >
                    <button
                      onClick={() => setSelected(t)}
                      className="w-full cursor-grab rounded-xl border border-zinc-200/80 bg-white p-3 text-left shadow-[0_1px_2px_rgba(24,24,27,0.04)] transition hover:-translate-y-px hover:shadow-[0_8px_20px_-8px_rgba(24,24,27,0.15)] active:translate-y-0 active:scale-[0.99] active:cursor-grabbing"
                    >
                      <div className="text-sm font-medium text-zinc-900">{t.title}</div>
                      <span
                        className={`mt-2 inline-block rounded-md px-1.5 py-0.5 text-xs font-medium ${PRIORITY_CLASS[t.priority]}`}
                      >
                        {priorityLabel(t.priority)}
                      </span>
                    </button>
                  </li>
                ))}
                {colTasks.length === 0 && (
                  <li className="rounded-xl border border-dashed border-zinc-200 px-3 py-6 text-center text-xs text-zinc-400">
                    Drop tasks here
                  </li>
                )}
              </ul>
            </section>
          );
        })}
      </div>

      {selected && (
        <TaskDetail
          task={selected}
          onClose={() => setSelected(null)}
          onChange={(t) => {
            upsert(t);
            setSelected(t);
          }}
          onDelete={(id) => {
            setTasks((prev) => prev.filter((t) => t.id !== id));
            setSelected(null);
          }}
        />
      )}
      {creatingTask && (
        <TaskForm
          projects={projects}
          onClose={() => setCreatingTask(false)}
          onCreated={(t) => {
            upsert(t);
            setCreatingTask(false);
          }}
        />
      )}
      {creatingProject && (
        <ProjectForm
          onClose={() => setCreatingProject(false)}
          onCreated={(p) => {
            setProjects((prev) => [...prev, p]);
            setCreatingProject(false);
          }}
        />
      )}
    </div>
  );
}

function TaskDetail({
  task,
  onClose,
  onChange,
  onDelete,
}: {
  task: Task;
  onClose: () => void;
  onChange: (t: Task) => void;
  onDelete: (id: number) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function setStatus(status: Task["status"]) {
    setBusy(true);
    setError("");
    try {
      onChange(await patchTask(task.id, { status }));
    } catch {
      setError("Could not update status.");
    } finally {
      setBusy(false);
    }
  }

  async function del() {
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`${API}/api/tasks/${task.id}/`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok && res.status !== 204) throw new Error();
      onDelete(task.id);
    } catch {
      setError("Could not delete task.");
      setBusy(false);
    }
  }

  return (
    <Slideover title={task.title} onClose={onClose}>
      <dl className="space-y-5 text-sm">
        <Field label="Description">{task.description || "—"}</Field>
        <Field label="Priority">{priorityLabel(task.priority)}</Field>
        <Field label="Due date">{task.due_date ?? "—"}</Field>
        <Field label="Status">
          <select
            value={task.status}
            disabled={busy}
            onChange={(e) => setStatus(e.target.value as Task["status"])}
            className="rounded-lg border border-zinc-200 px-2 py-1.5 text-sm outline-none transition focus:ring-2 focus:ring-emerald-500/30 disabled:opacity-50"
          >
            {COLUMNS.map((c) => (
              <option key={c.key} value={c.key}>
                {c.label}
              </option>
            ))}
          </select>
        </Field>
      </dl>
      {error && <p className="mt-3 text-sm text-rose-600">{error}</p>}
      <button
        onClick={del}
        disabled={busy}
        className="mt-8 rounded-lg border border-rose-200 px-3 py-1.5 text-sm font-medium text-rose-600 transition hover:bg-rose-50 active:scale-[0.98] disabled:opacity-50"
      >
        Delete task
      </button>
    </Slideover>
  );
}

function TaskForm({
  projects,
  onClose,
  onCreated,
}: {
  projects: Project[];
  onClose: () => void;
  onCreated: (t: Task) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`${API}/api/tasks/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          title: fd.get("title"),
          description: fd.get("description"),
          priority: Number(fd.get("priority")),
          due_date: fd.get("due_date") || null,
          project: Number(fd.get("project")),
        }),
      });
      if (!res.ok) throw new Error("Could not create task.");
      onCreated(await res.json());
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <Slideover title="New task" onClose={onClose}>
      {projects.length === 0 ? (
        <p className="text-sm text-zinc-600">
          Create a project first (use the <strong>New project</strong> button).
        </p>
      ) : (
        <form onSubmit={onSubmit} className="space-y-4 text-sm">
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-zinc-700">Title</label>
            <input name="title" required className={INPUT} />
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-zinc-700">Description</label>
            <textarea name="description" rows={3} className={INPUT} />
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-zinc-700">Project</label>
            <select name="project" className={INPUT}>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-zinc-700">Priority</label>
            <select name="priority" defaultValue={2} className={INPUT}>
              {PRIORITIES.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-zinc-700">Due date</label>
            <input name="due_date" type="date" className={INPUT} />
          </div>
          {error && <p className="text-sm text-rose-600">{error}</p>}
          <button disabled={busy} className={`w-full ${PRIMARY_BTN}`}>
            {busy ? "Creating…" : "Create task"}
          </button>
        </form>
      )}
    </Slideover>
  );
}

function ProjectForm({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (p: Project) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`${API}/api/projects/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name: fd.get("name"),
          description: fd.get("description"),
        }),
      });
      if (!res.ok) throw new Error("Could not create project.");
      onCreated(await res.json());
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <Slideover title="New project" onClose={onClose}>
      <form onSubmit={onSubmit} className="space-y-4 text-sm">
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-zinc-700">Name</label>
          <input name="name" required className={INPUT} />
        </div>
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-zinc-700">Description</label>
          <textarea name="description" rows={3} className={INPUT} />
        </div>
        {error && <p className="text-sm text-rose-600">{error}</p>}
        <button disabled={busy} className={`w-full ${PRIMARY_BTN}`}>
          {busy ? "Creating…" : "Create project"}
        </button>
      </form>
    </Slideover>
  );
}

// Native <dialog> slide-over: showModal() gives focus-trap + Esc + top layer for
// free. closedby="any" isn't Baseline (no Safari), so light-dismiss uses the
// backdrop-click fallback (target === the dialog element).
function Slideover({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    ref.current?.showModal();
  }, []);

  return (
    <dialog
      ref={ref}
      aria-label={title}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) ref.current?.close();
      }}
      className="m-0 ml-auto h-dvh w-full max-w-md rounded-l-2xl bg-white p-0 shadow-2xl backdrop:bg-zinc-900/40 backdrop:backdrop-blur-sm"
    >
      <div className="flex h-full flex-col overflow-y-auto p-6">
        <div className="mb-6 flex items-start justify-between gap-4">
          <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
          <button
            type="button"
            onClick={() => ref.current?.close()}
            aria-label="Close"
            className="-m-1 rounded-md p-1 text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-700"
          >
            <svg viewBox="0 0 16 16" fill="none" className="h-4 w-4" aria-hidden="true">
              <path
                d="M4 4l8 8M12 4l-8 8"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>
        {children}
      </div>
    </dialog>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-zinc-400">{label}</dt>
      <dd className="mt-1 text-zinc-900">{children}</dd>
    </div>
  );
}
