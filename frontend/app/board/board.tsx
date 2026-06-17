"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

import { friendlyError, useToast } from "../toast";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export type Task = {
  id: number;
  title: string;
  description: string;
  status: "todo" | "in_progress" | "done";
  priority: number;
  due_date: string | null;
  assigned_to: number | null;
  assignee_name: string | null;
  project: number;
};
export type Project = { id: number; name: string; owner: number };
type UserOption = { id: number; username: string; name: string };
export type BoardInit = Record<Task["status"], { tasks: Task[]; hasMore: boolean }>;

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

type Filters = { priority: string; project: string };

// All client calls go through here: same-origin base, cookies, and an 8s
// timeout (native AbortSignal) so a hung backend rejects instead of hanging.
const REQUEST_TIMEOUT_MS = 8000;
function clientFetch(path: string, init: RequestInit = {}): Promise<Response> {
  return fetch(`${API}${path}`, {
    credentials: "include",
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    ...init,
  });
}

function tasksQuery(status: Task["status"], page: number, filters: Filters): string {
  const p = new URLSearchParams({ status, page: String(page) });
  if (filters.priority) p.set("priority", filters.priority);
  if (filters.project) p.set("project", filters.project);
  return `/api/tasks/?${p.toString()}`;
}

async function patchTask(id: number, body: object): Promise<Task> {
  const res = await clientFetch(`/api/tasks/${id}/`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error("Update failed");
  return res.json();
}

const INPUT =
  "w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none transition focus:border-zinc-400 focus:ring-2 focus:ring-emerald-500/30";
const FILTER =
  "rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-sm text-zinc-700 outline-none transition focus:ring-2 focus:ring-emerald-500/30";
const PRIMARY_BTN =
  "rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-800 active:scale-[0.98] disabled:opacity-50";

export function Board({
  initial,
  initialProjects,
  currentUserId,
}: {
  initial: BoardInit;
  initialProjects: Project[];
  currentUserId: number | null;
}) {
  const [tasks, setTasks] = useState<Task[]>(() => [
    ...initial.todo.tasks,
    ...initial.in_progress.tasks,
    ...initial.done.tasks,
  ]);
  const [projects, setProjects] = useState(initialProjects);
  const [page, setPage] = useState<Record<Task["status"], number>>({
    todo: 1,
    in_progress: 1,
    done: 1,
  });
  const [hasMore, setHasMore] = useState<Record<Task["status"], boolean>>({
    todo: initial.todo.hasMore,
    in_progress: initial.in_progress.hasMore,
    done: initial.done.hasMore,
  });
  const loadingRef = useRef<Record<Task["status"], boolean>>({
    todo: false,
    in_progress: false,
    done: false,
  });

  const [selected, setSelected] = useState<Task | null>(null);
  const [addStatus, setAddStatus] = useState<Task["status"] | null>(null);
  const [creatingProject, setCreatingProject] = useState(false);
  const [dragOver, setDragOver] = useState<Task["status"] | null>(null);
  const [filters, setFilters] = useState<Filters>({ priority: "", project: "" });
  const router = useRouter();
  const toast = useToast();
  const [loggingOut, setLoggingOut] = useState(false);

  async function logout() {
    setLoggingOut(true);
    try {
      const res = await clientFetch("/api/auth/logout/", { method: "POST" });
      if (!res.ok) throw new Error();
      // Only leave once the server confirmed it cleared/blacklisted the token.
      router.push("/login");
      router.refresh();
    } catch (err) {
      toast(friendlyError(err, "Could not log out. Try again."), "error");
      setLoggingOut(false);
    }
  }

  // New/edited/moved task: prepend if new, replace in place otherwise.
  function upsert(task: Task) {
    setTasks((prev) => {
      const i = prev.findIndex((t) => t.id === task.id);
      if (i === -1) return [task, ...prev];
      const next = [...prev];
      next[i] = task;
      return next;
    });
  }

  const loadMore = useCallback(
    async (status: Task["status"]) => {
      if (loadingRef.current[status] || !hasMore[status]) return;
      loadingRef.current[status] = true;
      const next = page[status] + 1;
      try {
        const res = await clientFetch(tasksQuery(status, next, filters));
        if (!res.ok) return;
        const data = await res.json();
        setTasks((prev) => {
          const ids = new Set(prev.map((t) => t.id));
          return [...prev, ...data.results.filter((t: Task) => !ids.has(t.id))];
        });
        setPage((p) => ({ ...p, [status]: next }));
        setHasMore((h) => ({ ...h, [status]: Boolean(data.next) }));
      } catch {
        // timeout/network — sentinel re-triggers on the next scroll
      } finally {
        loadingRef.current[status] = false;
      }
    },
    [page, hasMore, filters],
  );

  // Re-fetch page 1 of every column when a filter changes (skip first mount —
  // SSR already provided the unfiltered first page).
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    let cancelled = false;
    (async () => {
      const cols = await Promise.all(
        COLUMNS.map(async (c) => {
          const data = await clientFetch(tasksQuery(c.key, 1, filters))
            .then((res) => (res.ok ? res.json() : { results: [], next: null }))
            .catch(() => ({ results: [], next: null })); // timeout/network → empty
          return { key: c.key, results: data.results as Task[], hasMore: Boolean(data.next) };
        }),
      );
      if (cancelled) return;
      setTasks(cols.flatMap((c) => c.results));
      setPage({ todo: 1, in_progress: 1, done: 1 });
      setHasMore(
        Object.fromEntries(cols.map((c) => [c.key, c.hasMore])) as Record<
          Task["status"],
          boolean
        >,
      );
    })();
    return () => {
      cancelled = true;
    };
  }, [filters]);

  // Drag-and-drop move: optimistic, reverted if the PATCH fails.
  async function move(taskId: number, status: Task["status"]) {
    const task = tasks.find((t) => t.id === taskId);
    if (!task || task.status === status) return;
    upsert({ ...task, status });
    try {
      upsert(await patchTask(taskId, { status }));
    } catch (err) {
      upsert(task); // revert
      toast(friendlyError(err, "Couldn't move the task."), "error");
    }
  }

  return (
    <div className="mx-auto max-w-6xl p-4 sm:p-6">
      <header className="mb-6 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Board</h1>
          <p className="text-sm text-zinc-500">Drag a card between columns to move it.</p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/dashboard"
            className="rounded-lg px-3 py-2 text-sm font-medium text-zinc-600 transition hover:bg-zinc-100 hover:text-zinc-900"
          >
            Dashboard
          </Link>
          <button
            onClick={() => setCreatingProject(true)}
            className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 active:scale-[0.98]"
          >
            New project
          </button>
          <button
            onClick={logout}
            disabled={loggingOut}
            className="rounded-lg px-3 py-2 text-sm font-medium text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-900 active:scale-[0.98] disabled:opacity-50"
          >
            {loggingOut ? "Logging out…" : "Log out"}
          </button>
        </div>
      </header>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <select
          aria-label="Filter by priority"
          value={filters.priority}
          onChange={(e) => setFilters((f) => ({ ...f, priority: e.target.value }))}
          className={FILTER}
        >
          <option value="">All priorities</option>
          {PRIORITIES.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </select>
        <select
          aria-label="Filter by project"
          value={filters.project}
          onChange={(e) => setFilters((f) => ({ ...f, project: e.target.value }))}
          className={FILTER}
        >
          <option value="">All projects</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        {(filters.priority || filters.project) && (
          <button
            onClick={() => setFilters({ priority: "", project: "" })}
            className="text-sm text-zinc-500 transition hover:text-zinc-800"
          >
            Clear
          </button>
        )}
      </div>

      {/* Mobile: horizontal swipe carousel (scroll-snap). Desktop: 3-col grid. */}
      <div className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2 md:grid md:grid-cols-3 md:overflow-visible md:pb-0">
        {COLUMNS.map((col) => (
          <Column
            key={col.key}
            status={col.key}
            label={col.label}
            tasks={tasks.filter((t) => t.status === col.key)}
            hasMore={hasMore[col.key]}
            dragOver={dragOver === col.key}
            onLoadMore={loadMore}
            onSelect={setSelected}
            onAdd={() => setAddStatus(col.key)}
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
          />
        ))}
      </div>

      {selected && (
        <TaskDetail
          task={selected}
          canAssign={
            currentUserId != null &&
            projects.find((p) => p.id === selected.project)?.owner === currentUserId
          }
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
      {addStatus && (
        <TaskForm
          status={addStatus}
          projects={projects}
          onClose={() => setAddStatus(null)}
          onCreated={(t) => {
            upsert(t);
            setAddStatus(null);
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

function Column({
  status,
  label,
  tasks,
  hasMore,
  dragOver,
  onLoadMore,
  onSelect,
  onAdd,
  onDragOver,
  onDragLeave,
  onDrop,
}: {
  status: Task["status"];
  label: string;
  tasks: Task[];
  hasMore: boolean;
  dragOver: boolean;
  onLoadMore: (status: Task["status"]) => void;
  onSelect: (t: Task) => void;
  onAdd: () => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLLIElement>(null);

  // Load the next page when the bottom sentinel scrolls into the column's view.
  useEffect(() => {
    if (!hasMore) return;
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) onLoadMore(status);
      },
      { root: scrollRef.current, rootMargin: "150px" },
    );
    obs.observe(sentinel);
    return () => obs.disconnect();
  }, [hasMore, status, onLoadMore]);

  return (
    <section
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      className={`group flex max-h-[calc(100dvh-11rem)] w-[85vw] shrink-0 snap-center flex-col rounded-2xl border p-3 transition md:w-auto md:shrink ${
        dragOver
          ? "border-emerald-400/60 bg-emerald-50/50 ring-2 ring-emerald-500/30"
          : "border-zinc-200/70 bg-zinc-100/60"
      }`}
    >
      <h2 className="mb-3 flex items-center justify-between px-1 text-xs font-semibold uppercase tracking-wide text-zinc-500">
        {label}
        <span className="rounded-full bg-white px-2 py-0.5 text-zinc-400 tabular-nums">
          {tasks.length}
        </span>
      </h2>
      <div ref={scrollRef} className="scroll-stylish -mr-1 min-h-0 flex-1 overflow-y-auto pr-1">
        <ul className="space-y-2">
          {tasks.map((t, i) => (
            <li
              key={t.id}
              draggable
              onDragStart={(e) => e.dataTransfer.setData("text/plain", String(t.id))}
              className="animate-rise"
              style={{ animationDelay: `${Math.min(i, 12) * 40}ms` }}
            >
              <button
                onClick={() => onSelect(t)}
                className="w-full cursor-grab rounded-xl border border-zinc-200/80 bg-white p-3 text-left shadow-[0_1px_2px_rgba(24,24,27,0.04)] transition hover:-translate-y-px hover:shadow-[0_8px_20px_-8px_rgba(24,24,27,0.15)] active:translate-y-0 active:scale-[0.99] active:cursor-grabbing"
              >
                <div className="text-sm font-medium text-zinc-900">{t.title}</div>
                <div className="mt-2 flex items-center justify-between gap-2">
                  <span
                    className={`inline-block rounded-md px-1.5 py-0.5 text-xs font-medium ${PRIORITY_CLASS[t.priority]}`}
                  >
                    {priorityLabel(t.priority)}
                  </span>
                  {t.assignee_name && (
                    <span className="truncate text-xs text-zinc-400">{t.assignee_name}</span>
                  )}
                </div>
              </button>
            </li>
          ))}
          {hasMore && (
            <li ref={sentinelRef} className="py-3 text-center text-xs text-zinc-400">
              Loading…
            </li>
          )}
          {!hasMore && tasks.length === 0 && (
            <li className="rounded-xl border border-dashed border-zinc-200 px-3 py-6 text-center text-xs text-zinc-400">
              Drop tasks here
            </li>
          )}
        </ul>
      </div>
      <button
        onClick={onAdd}
        className="mt-2 w-full rounded-lg px-3 py-2 text-center text-sm font-medium text-zinc-500 opacity-100 transition hover:bg-white hover:text-zinc-900 md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100"
      >
        + Add task
      </button>
    </section>
  );
}

function TaskDetail({
  task,
  canAssign,
  onClose,
  onChange,
  onDelete,
}: {
  task: Task;
  canAssign: boolean;
  onClose: () => void;
  onChange: (t: Task) => void;
  onDelete: (id: number) => void;
}) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);

  async function setStatus(status: Task["status"]) {
    onChange({ ...task, status }); // instant; sync below
    try {
      onChange(await patchTask(task.id, { status }));
    } catch (err) {
      onChange(task); // revert
      toast(friendlyError(err, "Couldn't update the status."), "error");
    }
  }

  async function setAssignee(userId: number | null) {
    try {
      const updated = await patchTask(task.id, { assigned_to: userId });
      onChange(updated);
      toast(
        updated.assignee_name
          ? `Assigned to ${updated.assignee_name}`
          : "Assignee removed",
        "success",
      );
    } catch (err) {
      toast(friendlyError(err, "Couldn't update the assignee."), "error");
    }
  }

  async function del() {
    setBusy(true);
    try {
      const res = await clientFetch(`/api/tasks/${task.id}/`, { method: "DELETE" });
      if (!res.ok && res.status !== 204) throw new Error();
      onDelete(task.id);
      toast("Task deleted", "success");
    } catch (err) {
      toast(friendlyError(err, "Couldn't delete the task."), "error");
      setBusy(false);
      setConfirming(false);
    }
  }

  return (
    <Slideover title={task.title} onClose={onClose}>
      <dl className="space-y-5 text-sm">
        <Field label="Description">{task.description || "—"}</Field>
        <Field label="Priority">{priorityLabel(task.priority)}</Field>
        <Field label="Due date">{task.due_date ?? "—"}</Field>
        <Field label="Assignee">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-zinc-900">
                {task.assignee_name ?? "Unassigned"}
              </span>
              {canAssign && task.assigned_to != null && (
                <button
                  type="button"
                  onClick={() => setAssignee(null)}
                  className="text-xs text-zinc-400 transition hover:text-rose-600"
                >
                  Remove
                </button>
              )}
            </div>
            {canAssign && <AssigneePicker onSelect={(u) => setAssignee(u.id)} />}
          </div>
        </Field>
        <Field label="Status">
          <select
            value={task.status}
            onChange={(e) => setStatus(e.target.value as Task["status"])}
            className="rounded-lg border border-zinc-200 px-2 py-1.5 text-sm outline-none transition focus:ring-2 focus:ring-emerald-500/30"
          >
            {COLUMNS.map((c) => (
              <option key={c.key} value={c.key}>
                {c.label}
              </option>
            ))}
          </select>
        </Field>
      </dl>
      <button
        onClick={() => setConfirming(true)}
        className="mt-8 rounded-lg border border-rose-200 px-3 py-1.5 text-sm font-medium text-rose-600 transition hover:bg-rose-50 active:scale-[0.98]"
      >
        Delete task
      </button>
      {confirming && (
        <ConfirmDialog
          title="Delete task?"
          message={`"${task.title}" will be permanently deleted.`}
          confirmLabel="Delete"
          busy={busy}
          onConfirm={del}
          onCancel={() => setConfirming(false)}
        />
      )}
    </Slideover>
  );
}

// Accessible combobox: debounced username search, "@" prefix, keyboard nav.
export function AssigneePicker({ onSelect }: { onSelect: (u: UserOption) => void }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<UserOption[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const listId = "assignee-listbox";

  useEffect(() => {
    const term = query.trim();
    if (!term) {
      setResults([]);
      setOpen(false);
      return;
    }
    // Throttle: only fire 250ms after typing stops.
    const handle = setTimeout(async () => {
      try {
        const res = await clientFetch(
          `/api/auth/users/?search=${encodeURIComponent(term)}`,
        );
        if (!res.ok) return;
        const data = await res.json();
        setResults(data.results as UserOption[]);
        setOpen(true);
        setActive(-1);
      } catch {
        /* transient network error — user can retype */
      }
    }, 250);
    return () => clearTimeout(handle);
  }, [query]);

  function choose(u: UserOption) {
    onSelect(u);
    setQuery("");
    setResults([]);
    setOpen(false);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (!open || results.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => (a + 1) % results.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => (a - 1 + results.length) % results.length);
    } else if (e.key === "Enter" && active >= 0) {
      e.preventDefault();
      choose(results[active]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div className="relative">
      <input
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-label="Assign to a teammate"
        aria-activedescendant={active >= 0 ? `assignee-opt-${active}` : undefined}
        placeholder="Search teammates by name"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={onKeyDown}
        className="w-full rounded-lg border border-zinc-200 px-2 py-1.5 text-sm outline-none transition focus:ring-2 focus:ring-emerald-500/30"
      />
      {open && results.length > 0 && (
        <ul
          id={listId}
          role="listbox"
          className="scroll-stylish absolute z-10 mt-1 max-h-48 w-full overflow-y-auto rounded-lg border border-zinc-200 bg-white py-1 shadow-lg"
        >
          {results.map((u, i) => (
            <li
              key={u.id}
              id={`assignee-opt-${i}`}
              role="option"
              aria-selected={i === active}
              onMouseDown={(e) => {
                e.preventDefault(); // keep input focus / fire before blur
                choose(u);
              }}
              onMouseEnter={() => setActive(i)}
              className={`cursor-pointer px-3 py-1.5 text-sm ${
                i === active ? "bg-emerald-50 text-emerald-800" : "text-zinc-700"
              }`}
            >
              {u.name}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function TaskForm({
  status,
  projects,
  onClose,
  onCreated,
}: {
  status: Task["status"];
  projects: Project[];
  onClose: () => void;
  onCreated: (t: Task) => void;
}) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setBusy(true);
    try {
      const res = await clientFetch("/api/tasks/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: fd.get("title"),
          description: fd.get("description"),
          status,
          priority: Number(fd.get("priority")),
          due_date: fd.get("due_date") || null,
          project: Number(fd.get("project")),
        }),
      });
      if (!res.ok) throw new Error();
      onCreated(await res.json());
      toast("Task created", "success");
    } catch (err) {
      toast(friendlyError(err, "Could not create the task."), "error");
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
            <input
              name="title"
              required
              minLength={3}
              maxLength={200}
              className={INPUT}
            />
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
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setBusy(true);
    try {
      const res = await clientFetch("/api/projects/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: fd.get("name"),
          description: fd.get("description"),
        }),
      });
      if (!res.ok) throw new Error();
      onCreated(await res.json());
      toast("Project created", "success");
    } catch (err) {
      toast(friendlyError(err, "Could not create the project."), "error");
      setBusy(false);
    }
  }

  return (
    <Slideover title="New project" onClose={onClose}>
      <form onSubmit={onSubmit} className="space-y-4 text-sm">
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-zinc-700">Name</label>
          <input name="name" required maxLength={200} className={INPUT} />
        </div>
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-zinc-700">Description</label>
          <textarea name="description" rows={3} className={INPUT} />
        </div>
        <button disabled={busy} className={`w-full ${PRIMARY_BTN}`}>
          {busy ? "Creating…" : "Create project"}
        </button>
      </form>
    </Slideover>
  );
}

// Centered confirmation modal (native <dialog>: focus-trap + Esc for free).
function ConfirmDialog({
  title,
  message,
  confirmLabel,
  busy,
  onConfirm,
  onCancel,
}: {
  title: string;
  message: string;
  confirmLabel: string;
  busy: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    ref.current?.showModal();
  }, []);

  return (
    <dialog
      ref={ref}
      aria-label={title}
      onClose={onCancel}
      onClick={(e) => {
        if (e.target === ref.current) ref.current?.close();
      }}
      className="m-auto w-[calc(100%-2rem)] max-w-sm rounded-2xl bg-white p-6 shadow-2xl backdrop:bg-zinc-900/40 backdrop:backdrop-blur-sm"
    >
      <h2 className="text-base font-semibold tracking-tight">{title}</h2>
      <p className="mt-2 text-sm text-zinc-600">{message}</p>
      <div className="mt-6 flex justify-end gap-2">
        <button
          type="button"
          onClick={() => ref.current?.close()}
          className="rounded-lg border border-zinc-200 px-3 py-1.5 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 active:scale-[0.98]"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={busy}
          className="rounded-lg bg-rose-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-rose-500 active:scale-[0.98] disabled:opacity-50"
        >
          {busy ? "Deleting…" : confirmLabel}
        </button>
      </div>
    </dialog>
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
      className="m-0 ml-auto h-dvh max-h-dvh w-full max-w-md rounded-l-2xl bg-white p-0 shadow-2xl backdrop:bg-zinc-900/40 backdrop:backdrop-blur-sm"
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
