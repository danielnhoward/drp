import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const BASIC_AUTH_USERNAME = process.env.BASIC_AUTH_USERNAME;
const BASIC_AUTH_PASSWORD = process.env.BASIC_AUTH_PASSWORD;

// Optional bypass key: if `BASIC_AUTH_BYPASS_KEY` is set, a matching value
// supplied as a query param (name `BASIC_AUTH_BYPASS_PARAM` or `access_key`
// by default) will set a long-lived cookie so subsequent requests don't need
// the query param. This allows QR codes to grant temporary access.
const BASIC_AUTH_BYPASS_KEY = process.env.BASIC_AUTH_BYPASS_KEY;
const BASIC_AUTH_BYPASS_PARAM = process.env.BASIC_AUTH_BYPASS_PARAM ?? "access_key";
const BASIC_AUTH_BYPASS_COOKIE = process.env.BASIC_AUTH_BYPASS_COOKIE ?? "bypass_key";
const BASIC_AUTH_BYPASS_MAX_AGE = Number(process.env.BASIC_AUTH_BYPASS_MAX_AGE ?? 1 * 60 * 60);

// Routes that don't require a session. Everything else gets redirected to
// /welcome when the session cookie is missing. The admin page is intentionally
// open so it can be used to recover access by impersonating any account.
const PUBLIC_ROUTES = new Set(["/welcome", "/login", "/admin"]);

function isPublic(pathname: string): boolean {
  if (PUBLIC_ROUTES.has(pathname)) return true;
  // Treat nested admin routes (e.g. /admin/anything) as public too.
  if (pathname.startsWith("/admin/")) return true;
  // The app icon (served at /icon.svg from app/icon.svg) is public so the
  // browser can show the favicon on the logged-out landing/login pages: the
  // favicon fetch carries no session cookie, so a session-gated /icon.svg would
  // redirect to an HTML page and fail to load as an image.
  if (pathname === "/icon.svg") return true;
  // Avatar and run-photo files are public so next/image's internal optimizer
  // fetch (which doesn't forward the session cookie) can load them; both are
  // already exposed in shared views like the run card and profile popup.
  return pathname.startsWith("/avatars/") || pathname.startsWith("/run-photos/");
}

function unauthorized(): NextResponse {
  return new NextResponse("Authentication required.", {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Basic realm="Protected area", charset="UTF-8"',
    },
  });
}

function hasValidBasicAuth(request: NextRequest): boolean {
  if (!BASIC_AUTH_USERNAME || !BASIC_AUTH_PASSWORD) return true;

  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Basic ")) return false;

  const encodedCredentials = authHeader.slice("Basic ".length);

  try {
    const credentials = Buffer.from(encodedCredentials, "base64")
      .toString("utf8")
      .split(":");

    const username = credentials.shift() ?? "";
    const password = credentials.join(":");

    return username === BASIC_AUTH_USERNAME && password === BASIC_AUTH_PASSWORD;
  } catch {
    return false;
  }
}

function hasValidBypassCookie(request: NextRequest): boolean {
  if (!BASIC_AUTH_BYPASS_KEY) return false;
  const cookie = request.cookies.get(BASIC_AUTH_BYPASS_COOKIE)?.value;
  if (!cookie) return false;
  return cookie === BASIC_AUTH_BYPASS_KEY;
}

export function proxy(request: NextRequest) {
  // If a bypass key is present in the query params and matches the configured
  // key, set a cookie and redirect to the same URL without the param so the
  // secret isn't visible in logs or the address bar.
  try {
    const url = new URL(request.url);
    const provided = url.searchParams.get(BASIC_AUTH_BYPASS_PARAM);
    if (BASIC_AUTH_BYPASS_KEY && provided && provided === BASIC_AUTH_BYPASS_KEY) {
      url.searchParams.delete(BASIC_AUTH_BYPASS_PARAM);
      const res = NextResponse.redirect(url);
      const parts = [
        `${BASIC_AUTH_BYPASS_COOKIE}=${encodeURIComponent(BASIC_AUTH_BYPASS_KEY)}`,
        `Path=/`,
        `Max-Age=${BASIC_AUTH_BYPASS_MAX_AGE}`,
        `SameSite=Lax`,
      ];
      if (process.env.NODE_ENV === "production") parts.push("Secure");
      parts.push("HttpOnly");
      res.headers.append("Set-Cookie", parts.join("; "));
      return res;
    }
  } catch {
    // ignore URL parse errors and continue to auth checks
  }

  // Allow bypass cookie as alternative to Basic Auth
  if (!hasValidBypassCookie(request) && !hasValidBasicAuth(request)) return unauthorized();

  const { pathname } = request.nextUrl;

  if (isPublic(pathname)) return NextResponse.next();

  // Optimistic check only — presence of the cookie is enough at the proxy
  // layer. Server Components/Actions still call requireUser(), which verifies
  // the id resolves to an actual row before trusting it.
  if (request.cookies.get("session")?.value) return NextResponse.next();

  const welcomeUrl = new URL("/welcome", request.url);
  return NextResponse.redirect(welcomeUrl);
}

export const config = {
  // Match everything except Next internals and static assets.
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
