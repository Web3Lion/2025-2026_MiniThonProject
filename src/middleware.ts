import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, SESSION_VALUE } from "@/lib/auth";

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Never block the login page or auth API
  if (pathname.startsWith("/admin/login") || pathname.startsWith("/api/auth")) {
    return NextResponse.next();
  }

  // Protect all other /admin routes
  if (pathname.startsWith("/admin")) {
    const session = req.cookies.get(ADMIN_COOKIE);
    if (session?.value !== SESSION_VALUE) {
      return NextResponse.redirect(new URL("/admin/login", req.url));
    }
  }

  // Protect admin API routes
  if (
    pathname.startsWith("/api/collection") ||
    pathname.startsWith("/api/teams") ||
    pathname.startsWith("/api/donations") ||
    pathname.startsWith("/api/wallets") ||
    pathname.startsWith("/api/mint")
  ) {
    const session = req.cookies.get(ADMIN_COOKIE);
    if (session?.value !== SESSION_VALUE) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/admin/:path*",
    "/api/collection/:path*",
    "/api/teams/:path*",
    "/api/donations/:path*",
    "/api/wallets/:path*",
    "/api/mint/:path*",
    "/api/auth/:path*",
  ],
};