import { HealthStatus } from "./health-status";

// Server component: initial fetch happens on the server, over the docker network.
async function getHealth(): Promise<string> {
  const base = process.env.API_URL ?? "http://backend:8000";
  try {
    const res = await fetch(`${base}/api/health/`, { cache: "no-store" });
    if (!res.ok) return `error: HTTP ${res.status}`;
    return ((await res.json()) as { status: string }).status;
  } catch (err) {
    return `unreachable: ${(err as Error).message}`;
  }
}

export default async function Home() {
  const initial = await getHealth();
  return (
    <main className="flex min-h-screen items-center justify-center p-8">
      <div className="w-full max-w-md space-y-4 rounded-xl border border-gray-200 bg-white p-8 shadow-sm">
        <h1 className="text-3xl font-bold tracking-tight">SmartNSales</h1>
        <p className="text-gray-600">Next.js frontend + Django REST API.</p>
        <HealthStatus initial={initial} />
      </div>
    </main>
  );
}
