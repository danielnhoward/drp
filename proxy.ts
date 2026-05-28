import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Routes that don't require a session. Everything else gets redirected to
// /login when the session cookie is missing. The admin page is intentionally
// open so it can be used to recover access by impersonating any account.
const PUBLIC_ROUTES = new Set(["/login", "/admin"]);

function isPublic(pathname: string): boolean {
  if (PUBLIC_ROUTES.has(pathname)) return true;
  // Treat nested admin routes (e.g. /admin/anything) as public too.
  if (pathname.startsWith("/admin/")) return true;
  // Avatar files are public so next/image's internal optimizer fetch (which
  // doesn't forward the session cookie) can load them; they're also already
  // exposed in shared views like the run card.
  return pathname.startsWith("/avatars/");
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isPublic(pathname)) return NextResponse.next();

  // Optimistic check only — presence of the cookie is enough at the proxy
  // layer. Server Components/Actions still call requireUser(), which verifies
  // the id resolves to an actual row before trusting it.
  if (request.cookies.get("session")?.value) return NextResponse.next();

  const loginUrl = new URL("/login", request.url);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  // Match everything except Next internals and static assets.
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
