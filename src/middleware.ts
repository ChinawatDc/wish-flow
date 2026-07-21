import NextAuth from "next-auth";
import { NextResponse } from "next/server";

import { authConfig } from "@/lib/auth.config";

const { auth } = NextAuth(authConfig);

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const isLoggedIn = Boolean(req.auth?.user?.id);
  const status = req.auth?.user?.status;
  const role = req.auth?.user?.role;

  if (isLoggedIn && status === "SUSPENDED") {
    if (
      pathname.startsWith("/events") ||
      pathname.startsWith("/admin") ||
      pathname.startsWith("/profile") ||
      pathname.startsWith("/messages") ||
      pathname.startsWith("/support/chat") ||
      pathname.startsWith("/api/events") ||
      pathname.startsWith("/api/admin") ||
      pathname.startsWith("/api/me") ||
      pathname.startsWith("/api/support/conversations") ||
      pathname.startsWith("/api/auth/claim-device")
    ) {
      if (pathname.startsWith("/api/")) {
        return NextResponse.json(
          { error: "บัญชีถูกระงับชั่วคราว" },
          { status: 403 },
        );
      }
      const url = new URL("/login", req.nextUrl.origin);
      url.searchParams.set("error", "suspended");
      return NextResponse.redirect(url);
    }
  }

  const needsAuth =
    pathname.startsWith("/events") ||
    pathname.startsWith("/admin") ||
    pathname.startsWith("/profile") ||
    pathname.startsWith("/messages") ||
    pathname.startsWith("/support/chat") ||
    pathname.startsWith("/api/events") ||
    pathname.startsWith("/api/admin") ||
    pathname.startsWith("/api/me") ||
    pathname.startsWith("/api/support/conversations");

  if (needsAuth && !isLoggedIn) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
    }
    const url = new URL("/login", req.nextUrl.origin);
    url.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(url);
  }

  if (pathname.startsWith("/admin") || pathname.startsWith("/api/admin")) {
    if (role !== "ADMIN") {
      if (pathname.startsWith("/api/")) {
        return NextResponse.json(
          { error: "เฉพาะผู้ดูแลระบบเท่านั้น" },
          { status: 403 },
        );
      }
      return NextResponse.redirect(new URL("/events", req.nextUrl.origin));
    }
  }

  return NextResponse.next();
});

export const config = {
  // หมายเหตุ: /support/contact และ /api/support/contact, /api/support/cases เป็น public — ไม่อยู่ใน matcher
  matcher: [
    "/events/:path*",
    "/admin/:path*",
    "/profile/:path*",
    "/profile",
    "/messages/:path*",
    "/messages",
    "/support/chat/:path*",
    "/support/chat",
    "/api/events/:path*",
    "/api/admin/:path*",
    "/api/me/:path*",
    "/api/support/conversations/:path*",
    "/api/support/conversations",
  ],
};
