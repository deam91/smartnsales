"use client";

import { useState } from "react";

// Client component: re-fetches the backend from the browser (exercises CORS).
export function HealthStatus({ initial }: { initial: string }) {
  const [status, setStatus] = useState(initial);
  const [loading, setLoading] = useState(false);

  async function refresh() {
    setLoading(true);
    const base = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
    try {
      const res = await fetch(`${base}/api/health/`, { cache: "no-store" });
      const next = res.ok
        ? ((await res.json()) as { status: string }).status
        : `error: HTTP ${res.status}`;
      setStatus(next);
    } catch (err) {
      setStatus(`unreachable: ${(err as Error).message}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center gap-3">
      <span className="text-sm text-gray-600">
        Backend health: <strong className="text-gray-900">{status}</strong>
      </span>
      <button
        onClick={refresh}
        disabled={loading}
        className="rounded-md bg-gray-900 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-gray-700 disabled:opacity-50"
      >
        {loading ? "Checking…" : "Refresh (client)"}
      </button>
    </div>
  );
}
