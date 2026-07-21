"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";

/** ซ่อนบน guest routes `/e/*` */
export function AppNav() {
  const pathname = usePathname();
  const { data: session, status } = useSession();

  if (pathname.startsWith("/e/")) return null;

  const user = session?.user;
  const isAdmin = user?.role === "ADMIN";
  const brandHref = !user ? "/" : isAdmin ? "/admin" : "/events";

  return (
    <header className="border-b-2 border-rose-100 bg-white/80 backdrop-blur">
      <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <Link href={brandHref} className="text-base font-bold text-rose-600">
          🎁 Wish Flow
        </Link>
        <nav className="flex flex-wrap items-center justify-end gap-2 text-sm">
          {status === "loading" ? (
            <span className="text-rose-300">…</span>
          ) : user ? (
            <>
              <Link
                href="/events"
                className="rounded-full px-3 py-1.5 font-medium text-rose-600 hover:bg-rose-50"
              >
                การ์ดของฉัน
              </Link>
              <Link
                href="/marketplace"
                className="rounded-full px-3 py-1.5 font-medium text-rose-600 hover:bg-rose-50"
              >
                คลังแชร์
              </Link>
              <Link
                href="/support/chat"
                className="rounded-full px-3 py-1.5 font-medium text-rose-600 hover:bg-rose-50"
              >
                แชท
              </Link>
              {isAdmin && (
                <Link
                  href="/admin"
                  className="rounded-full px-3 py-1.5 font-medium text-violet-600 hover:bg-violet-50"
                >
                  แดชบอร์ด
                </Link>
              )}
              <Link
                href="/profile"
                className="hidden max-w-[140px] truncate text-xs text-rose-400 hover:text-rose-600 sm:inline"
              >
                {user.email}
              </Link>
              <Link
                href="/profile"
                className="rounded-full px-3 py-1.5 font-medium text-rose-600 hover:bg-rose-50 sm:hidden"
              >
                โปรไฟล์
              </Link>
              <button
                type="button"
                onClick={() => signOut({ callbackUrl: "/" })}
                className="rounded-full border-2 border-rose-200 px-3 py-1.5 font-semibold text-rose-600 hover:bg-rose-50"
              >
                ออกจากระบบ
              </button>
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="rounded-full px-3 py-1.5 font-medium text-rose-600 hover:bg-rose-50"
              >
                เข้าสู่ระบบ
              </Link>
              <Link
                href="/register"
                className="rounded-full bg-rose-500 px-4 py-1.5 font-semibold text-white shadow-sm hover:bg-rose-600"
              >
                สมัครสมาชิก
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
