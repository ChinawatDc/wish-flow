"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { FormEvent, Suspense, useState } from "react";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawCallback = searchParams.get("callbackUrl");
  const safeCallback =
    rawCallback && rawCallback.startsWith("/") && !rawCallback.startsWith("//")
      ? rawCallback
      : null;
  const urlError = searchParams.get("error");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(
    urlError === "suspended"
      ? "บัญชีถูกระงับชั่วคราว กรุณาติดต่อผู้ดูแล"
      : urlError
        ? "เข้าสู่ระบบไม่สำเร็จ"
        : null,
  );
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });
    setLoading(false);
    if (res?.error) {
      setError(
        res.error.includes("SUSPENDED")
          ? "บัญชีถูกระงับชั่วคราว"
          : "อีเมลหรือรหัสผ่านไม่ถูกต้อง",
      );
      return;
    }
    await fetch("/api/auth/claim-device", { method: "POST" }).catch(() => {});
    // ไม่มี callback ปลอดภัย → ให้ `/` แยก home ตาม role
    router.push(safeCallback ?? "/");
    router.refresh();
  }

  return (
    <main className="min-h-[80vh] bg-gradient-to-b from-pink-50 to-amber-50 px-4 py-10">
      <div className="mx-auto w-full max-w-md rounded-3xl border-2 border-rose-100 bg-white p-6 shadow-md">
        <h1 className="text-2xl font-bold text-rose-700">เข้าสู่ระบบ 🔐</h1>
        <p className="mt-1 text-sm text-rose-400">จัดการการ์ดอวยพรของคุณ</p>

        {error && (
          <p className="mt-4 rounded-2xl border-2 border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
            😢 {error}
          </p>
        )}

        <form onSubmit={onSubmit} className="mt-5 space-y-4">
          <label className="block text-sm font-semibold text-rose-800">
            อีเมล
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-2xl border-2 border-rose-100 px-4 py-3 outline-none focus:border-rose-300"
            />
          </label>
          <label className="block text-sm font-semibold text-rose-800">
            รหัสผ่าน
            <input
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded-2xl border-2 border-rose-100 px-4 py-3 outline-none focus:border-rose-300"
            />
          </label>
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-2xl bg-rose-500 py-3.5 text-base font-bold text-white shadow-lg shadow-rose-200 hover:bg-rose-600 disabled:opacity-50"
          >
            {loading ? "กำลังเข้าสู่ระบบ…" : "เข้าสู่ระบบ"}
          </button>
        </form>

        <button
          type="button"
          onClick={() => signIn("google", { callbackUrl: safeCallback ?? "/" })}
          className="mt-3 w-full rounded-2xl border-2 border-rose-200 bg-white py-3 text-sm font-semibold text-rose-700 hover:bg-rose-50"
        >
          เข้าด้วย Google
        </button>
        <p className="mt-2 text-center text-xs text-rose-300">
          (ต้องตั้ง AUTH_GOOGLE_ID / AUTH_GOOGLE_SECRET ก่อนใช้งาน Google)
        </p>

        <p className="mt-5 text-center text-sm text-rose-500">
          ยังไม่มีบัญชี?{" "}
          <Link href="/register" className="font-bold underline">
            สมัครสมาชิก
          </Link>
        </p>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<main className="p-8 text-center text-rose-300">กำลังโหลด…</main>}>
      <LoginForm />
    </Suspense>
  );
}
