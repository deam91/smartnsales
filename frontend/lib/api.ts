import { cookies } from "next/headers";

// Server-side fetch to Django over the docker network, forwarding the user's
// httpOnly access cookie so server components load data already authenticated.
const API_URL = process.env.API_URL ?? "http://backend:8000";

export async function apiGet(path: string): Promise<Response> {
  const access = (await cookies()).get("access_token")?.value;
  return fetch(`${API_URL}${path}`, {
    headers: access ? { Cookie: `access_token=${access}` } : {},
    cache: "no-store",
  });
}
