import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, SESSION_VALUE } from "@/lib/auth";

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Protect all /admin routes except the login page itself
  if (pathname.startsWith("/admin") && !pathname.startsWith("/admin/login")) {
    const session = req.cookies.get(ADMIN_COOKIE);
    if (session?.value !== SESSION_VALUE) {
      return NextResponse.redirect(new URL("/admin/login", req.url));
    }
  }

  // Protect admin API routes
  if (pathname.startsWith("/api/collection") || pathname.startsWith("/api/teams") || pathname.startsWith("/api/donations")) {
    const session = req.cookies.get(ADMIN_COOKIE);
    if (session?.value !== SESSION_VALUE) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/api/collection/:path*", "/api/teams/:path*", "/api/donations/:path*"],
};
