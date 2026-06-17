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
  1: "bg-gray-100 text-gray-600",
  2: "bg-blue-100 text-blue-700",
  3: "bg-amber-100 text-amber-700",
  4: "bg-red-100 text-red-700",
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
      <header className="mb-6 flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Board</h1>
        <div className="flex gap-2">
          <button
            onClick={() => setCreatingProject(true)}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm font-medium hover:bg-gray-50"
          >
            + Project
          </button>
          <button
            onClick={() => setCreatingTask(true)}
            className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700"
          >
            + New task
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {COLUMNS.map((col) => {
          const colTasks = tasks.filter((t) => t.status === col.key);
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
              className={`rounded-lg p-3 transition ${
                dragOver === col.key ? "bg-gray-200 ring-2 ring-gray-400" : "bg-gray-100"
              }`}
            >
              <h2 className="mb-3 flex items-center justify-between text-sm font-semibold text-gray-700">
                {col.label}
                <span className="rounded-full bg-gray-200 px-2 text-xs">{colTasks.length}</span>
              </h2>
              <ul className="space-y-2">
                {colTasks.map((t) => (
                  <li
                    key={t.id}
                    draggable
                    onDragStart={(e) => e.dataTransfer.setData("text/plain", String(t.id))}
                  >
                    <button
                      onClick={() => setSelected(t)}
                      className="w-full cursor-grab rounded-md bg-white p-3 text-left shadow-sm transition hover:shadow active:cursor-grabbing"
                    >
                      <div className="font-medium">{t.title}</div>
                      <span
                        className={`mt-1 inline-block rounded px-1.5 py-0.5 text-xs ${PRIORITY_CLASS[t.priority]}`}
                      >
                        {priorityLabel(t.priority)}
                      </span>
                    </button>
                  </li>
                ))}
                {colTasks.length === 0 && (
                  <li className="px-1 text-xs text-gray-400">Drop tasks here</li>
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
      <dl className="space-y-4 text-sm">
        <Field label="Description">{task.description || "—"}</Field>
        <Field label="Priority">{priorityLabel(task.priority)}</Field>
        <Field label="Due date">{task.due_date ?? "—"}</Field>
        <Field label="Status">
          <select
            value={task.status}
            disabled={busy}
            onChange={(e) => setStatus(e.target.value as Task["status"])}
            className="rounded border border-gray-300 px-2 py-1 disabled:opacity-50"
          >
            {COLUMNS.map((c) => (
              <option key={c.key} value={c.key}>
                {c.label}
              </option>
            ))}
          </select>
        </Field>
      </dl>
      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      <button
        onClick={del}
        disabled={busy}
        className="mt-6 rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-500 disabled:opacity-50"
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
        <p className="text-sm text-gray-600">
          Create a project first (use the <strong>+ Project</strong> button).
        </p>
      ) : (
        <form onSubmit={onSubmit} className="space-y-3 text-sm">
          <input
            name="title"
            required
            placeholder="Title"
            className="w-full rounded border border-gray-300 px-2 py-1.5"
          />
          <textarea
            name="description"
            placeholder="Description"
            rows={3}
            className="w-full rounded border border-gray-300 px-2 py-1.5"
          />
          <label className="block">
            <span className="text-xs text-gray-500">Project</span>
            <select name="project" className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5">
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-xs text-gray-500">Priority</span>
            <select
              name="priority"
              defaultValue={2}
              className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5"
            >
              {PRIORITIES.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-xs text-gray-500">Due date</span>
            <input
              name="due_date"
              type="date"
              className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5"
            />
          </label>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            disabled={busy}
            className="w-full rounded-md bg-gray-900 px-3 py-2 font-medium text-white hover:bg-gray-700 disabled:opacity-50"
          >
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
      <form onSubmit={onSubmit} className="space-y-3 text-sm">
        <input
          name="name"
          required
          placeholder="Project name"
          className="w-full rounded border border-gray-300 px-2 py-1.5"
        />
        <textarea
          name="description"
          placeholder="Description"
          rows={3}
          className="w-full rounded border border-gray-300 px-2 py-1.5"
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          disabled={busy}
          className="w-full rounded-md bg-gray-900 px-3 py-2 font-medium text-white hover:bg-gray-700 disabled:opacity-50"
        >
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
      className="m-0 ml-auto h-dvh w-full max-w-md bg-white p-0 backdrop:bg-black/40"
    >
      <div className="flex h-full flex-col overflow-y-auto p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button
            type="button"
            onClick={() => ref.current?.close()}
            aria-label="Close"
            className="text-2xl leading-none text-gray-400 hover:text-gray-600"
          >
            ×
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
      <dt className="text-xs uppercase tracking-wide text-gray-400">{label}</dt>
      <dd className="mt-0.5 text-gray-900">{children}</dd>
    </div>
  );
}
