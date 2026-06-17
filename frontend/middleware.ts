import { NextResponse, type NextRequest } from "next/server";

const API_URL = process.env.API_URL ?? "http://backend:8000";

function cookieValue(setCookies: string[], name: string): string | null {
  for (const c of setCookies) {
    const m = c.match(new RegExp(`^\\s*${name}=([^;]+)`));
    if (m) return m[1];
  }
  return null;
}

export async function middleware(request: NextRequest) {
  const hasAccess = request.cookies.has("access_token");
  const refresh = request.cookies.get("refresh_token")?.value;

  // Access cookie expired (15 min Max-Age) but the refresh cookie is still
  // valid → renew silently so the user isn't bounced to /login.
  // ponytail: with ROTATE_REFRESH_TOKENS, two concurrent renews can race (the
  // second replays a just-blacklisted token → that one request falls to
  // /login). Acceptable; the next navigation renews cleanly.
  if (!hasAccess && refresh) {
    const res = await fetch(`${API_URL}/api/auth/refresh/`, {
      method: "POST",
      headers: { Cookie: `refresh_token=${refresh}` },
    });
    if (res.ok) {
      const setCookies = res.headers.getSetCookie();
      const newAccess = cookieValue(setCookies, "access_token");

      // Authenticate THIS request too: forward the fresh access cookie upstream
      // so the server component's fetch is already authed.
      const headers = new Headers(request.headers);
      if (newAccess) {
        headers.set("cookie", `access_token=${newAccess}; refresh_token=${refresh}`);
      }
      const response = NextResponse.next({ request: { headers } });
      // ...and hand the new (httpOnly) cookies to the browser verbatim.
      for (const c of setCookies) response.headers.append("set-cookie", c);
      return response;
    }
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/board", "/board/:path*"],
};
