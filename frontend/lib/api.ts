import { cookies } from "next/headers";

// Server-side fetch to Django over the docker network, forwarding the user's
// httpOnly access cookie so server components load data already authenticated.
const API_URL = process.env.API_URL ?? "http://backend:8000";

export async function apiGet(path: string): Promise<Response> {
  const access = (await cookies()).get("access_token")?.value;
  return fetch(`${API_URL}${path}`, {
    headers: access ? { Cookie: `access_token=${access}` } : {},
    cache: "no-store",
    signal: AbortSignal.timeout(8000), // don't hang SSR on a stuck backend
  });
}

// Follow DRF's `next` pagination and return every result.
// ponytail: one request per page (O(n/page_size)); fine for a board, switch to
// per-column lazy loading if a single board ever holds thousands of tasks.
export async function apiGetAll(
  path: string,
): Promise<{ ok: boolean; status: number; results: unknown[] }> {
  const results: unknown[] = [];
  for (let page = 1; ; page++) {
    const sep = path.includes("?") ? "&" : "?";
    const res = await apiGet(`${path}${sep}page=${page}`);
    if (!res.ok) {
      if (page === 1) return { ok: false, status: res.status, results: [] };
      break; // stop at the first failing page, return what we have
    }
    const data = await res.json();
    results.push(...data.results);
    if (!data.next) break;
  }
  return { ok: true, status: 200, results };
}
