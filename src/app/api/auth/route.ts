import { NextRequest, NextResponse } from "next/server";
import { isValidPassword, ADMIN_COOKIE, SESSION_VALUE } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const { password } = await req.json();
  if (!isValidPassword(password)) {
    return NextResponse.json({ success: false, error: "Invalid password" }, { status: 401 });
  }
  const res = NextResponse.json({ success: true });
  res.cookies.set(ADMIN_COOKIE, SESSION_VALUE, {
    httpOnly: true, secure: process.env.NODE_ENV === "production",
    sameSite: "lax", maxAge: 60 * 60 * 8, // 8 hours
    path: "/",
  });
  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ success: true });
  res.cookies.delete(ADMIN_COOKIE);
  return res;
}
