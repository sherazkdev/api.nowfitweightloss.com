import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/** Redirect legacy admin URLs (pre–Phase 15) to `/admin/*`. */
const LEGACY_MATCHERS = ["/login", "/meal", "/workout", "/data", "/settings"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  for (const prefix of LEGACY_MATCHERS) {
    if (pathname === prefix || pathname.startsWith(`${prefix}/`)) {
      const url = request.nextUrl.clone();
      url.pathname = `/admin${pathname}`;
      return NextResponse.redirect(url);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/login", "/login/:path*", "/meal/:path*", "/workout/:path*", "/data/:path*", "/settings/:path*"],
};
