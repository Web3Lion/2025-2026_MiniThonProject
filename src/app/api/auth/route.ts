import { NextRequest, NextResponse } from "next/server";
import { isValidPassword, ADMIN_COOKIE, SESSION_VALUE } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { password } = body;

    if (!password) {
      return NextResponse.json({ success: false, error: "Password required" }, { status: 400 });
    }

    if (!isValidPassword(password)) {
      return NextResponse.json({ success: false, error: "Invalid password" }, { status: 401 });
    }

    const res = NextResponse.json({ success: true });

    // Use secure:false so it works in both Codespaces (HTTPS) and local dev
    // httpOnly keeps it safe from JS even without the secure flag
    res.cookies.set(ADMIN_COOKIE, SESSION_VALUE, {
      httpOnly: true,
      secure: false,       // works in Codespaces + local dev
      sameSite: "lax",
      maxAge: 60 * 60 * 8, // 8 hours
      path: "/",
    });

    return res;
  } catch (err) {
    return NextResponse.json(
      { success: false, error: "Bad request" },
      { status: 400 }
    );
  }
}

export async function DELETE() {
  const res = NextResponse.json({ success: true });
  res.cookies.delete(ADMIN_COOKIE);
  return res;
}