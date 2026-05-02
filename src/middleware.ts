/**
 * Middleware — single-password auth gate for Phase 1.
 *
 * - Reads APP_PASSWORD from env. If unset, the app is wide open (dev convenience).
 * - Compares cookie `optibio_session` to a SHA-256 of APP_PASSWORD.
 * - On mismatch, redirects to /login (preserves intended path via ?next=).
 * - Whitelists: /login, /api/auth/*, /favicon.ico, /_next/*, public assets.
 *
 * Rotate the password: change APP_PASSWORD env → all sessions invalidate.
 */

import { NextResponse, type NextRequest } from "next/server";

async function expectedSession(password: string): Promise<string> {
  const data = new TextEncoder().encode(password + "::optibio");
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

const PUBLIC_PATHS = [
  "/login",
  "/api/auth/login",
  "/api/auth/logout",
  "/favicon.ico",
  "/file.svg",
  "/globe.svg",
  "/next.svg",
  "/vercel.svg",
  "/window.svg",
];

function isPublic(pathname: string): boolean {
  if (PUBLIC_PATHS.includes(pathname)) return true;
  if (pathname.startsWith("/_next/")) return true;
  if (pathname.startsWith("/api/auth/")) return true;
  return false;
}

export async function middleware(req: NextRequest) {
  const { pathname, searchParams } = req.nextUrl;
  if (isPublic(pathname)) return NextResponse.next();

  const password = process.env.APP_PASSWORD;
  // No password set → app is open. Useful in dev. The login page itself will
  // also indicate this so the operator knows.
  if (!password) return NextResponse.next();

  const cookie = req.cookies.get("optibio_session")?.value;
  const expected = await expectedSession(password);
  if (cookie === expected) return NextResponse.next();

  // Redirect to /login, preserve where they were going.
  const loginUrl = req.nextUrl.clone();
  loginUrl.pathname = "/login";
  loginUrl.search = `?next=${encodeURIComponent(pathname + (searchParams.toString() ? "?" + searchParams.toString() : ""))}`;
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
