/**
 * POST /api/auth/login — set the optibio_session cookie if password matches.
 *
 * Cookie is the SHA-256 of (APP_PASSWORD + "::optibio") so it's not the password
 * itself and can't be reversed. 30-day expiry. HttpOnly + Secure (in prod).
 */

import { NextResponse } from "next/server";

async function expectedSession(password: string): Promise<string> {
  const data = new TextEncoder().encode(password + "::optibio");
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function POST(req: Request) {
  const { password } = (await req.json().catch(() => ({}))) as { password?: string };
  if (typeof password !== "string" || password.length === 0) {
    return NextResponse.json({ error: "Password required" }, { status: 400 });
  }

  const expected = process.env.APP_PASSWORD;
  if (!expected) {
    // No password gate active — accept anything but warn.
    const session = await expectedSession(password);
    const res = NextResponse.json({ success: true, warning: "APP_PASSWORD not set on server — auth disabled" });
    res.cookies.set("optibio_session", session, cookieOptions());
    return res;
  }

  if (password !== expected) {
    return NextResponse.json({ error: "Wrong password" }, { status: 401 });
  }

  const session = await expectedSession(expected);
  const res = NextResponse.json({ success: true });
  res.cookies.set("optibio_session", session, cookieOptions());
  return res;
}

function cookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30 days
  };
}
