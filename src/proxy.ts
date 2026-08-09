import { NextResponse, type NextRequest } from "next/server";

import { SESSION_COOKIE } from "@/lib/auth/session";

/**
 * Cheap routing guard.
 *
 * This only looks at whether a session cookie is *present* - it does not
 * verify the signature. Verification happens in the app layout, which is the
 * authority on who is signed in. The point here is to keep signed-out visitors
 * from rendering an app page just to be redirected out of it.
 */

const PUBLIC_PATHS = ["/login", "/register"];

export function proxy(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl;
  const hasSessionCookie = request.cookies.has(SESSION_COOKIE);
  const isPublicPath = PUBLIC_PATHS.includes(pathname);

  if (!hasSessionCookie && !isPublicPath) {
    const loginUrl = new URL("/login", request.url);
    // Come back to the requested page after signing in.
    if (pathname !== "/") loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (hasSessionCookie && isPublicPath) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return NextResponse.next();
}

export const config = {
  // Everything except Next's own assets and the API routes, which do their own
  // authentication and must return a status code rather than a redirect.
  matcher: ["/((?!_next/static|_next/image|api/|favicon.ico|.*\\.(?:svg|png|jpg|webp|ico)$).*)"],
};
