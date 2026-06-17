"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

const INPUT =
  "rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none transition focus:border-zinc-400 focus:ring-2 focus:ring-emerald-500/30";

export default function RegisterPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const username = form.get("username");
    const password = form.get("password");
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API}/api/v1/auth/register/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: AbortSignal.timeout(8000),
        body: JSON.stringify({ username, email: form.get("email"), password }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        // DRF returns {field: [messages]} — surface the first.
        setError(String(Object.values(data).flat()[0] ?? "Could not create the account."));
        return;
      }
      // Auto-login with the same credentials (register doesn't set cookies).
      const login = await fetch(`${API}/api/v1/auth/login/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        signal: AbortSignal.timeout(8000),
        body: JSON.stringify({ username, password }),
      });
      router.push(login.ok ? "/board" : "/login");
      router.refresh();
    } catch {
      setError("Could not reach the server.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-dvh items-center justify-center p-4">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-sm space-y-5 rounded-2xl border border-zinc-200/70 bg-white p-8 shadow-[0_20px_40px_-20px_rgba(24,24,27,0.12)]"
      >
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Create account</h1>
          <p className="text-sm text-zinc-500">Start organizing your work.</p>
        </div>
        <div className="flex flex-col gap-2">
          <label htmlFor="username" className="text-sm font-medium text-zinc-700">
            Username
          </label>
          <input id="username" name="username" required autoComplete="username" className={INPUT} />
        </div>
        <div className="flex flex-col gap-2">
          <label htmlFor="email" className="text-sm font-medium text-zinc-700">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            className={INPUT}
          />
        </div>
        <div className="flex flex-col gap-2">
          <label htmlFor="password" className="text-sm font-medium text-zinc-700">
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            className={INPUT}
          />
        </div>
        {error && <p className="text-sm text-rose-600">{error}</p>}
        <button
          disabled={loading}
          className="w-full rounded-lg bg-zinc-900 px-3 py-2.5 text-sm font-medium text-white transition hover:bg-zinc-800 active:scale-[0.98] disabled:opacity-50"
        >
          {loading ? "Creating…" : "Create account"}
        </button>
        <p className="text-center text-sm text-zinc-500">
          Have an account?{" "}
          <Link href="/login" className="font-medium text-zinc-900 hover:underline">
            Sign in
          </Link>
        </p>
      </form>
    </main>
  );
}
