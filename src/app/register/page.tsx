"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { FormEvent, useState } from "react";

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, name: name || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "สมัครไม่สำเร็จ");

      const login = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });
      if (login?.error) throw new Error("สมัครสำเร็จ แต่เข้าสู่ระบบไม่สำเร็จ");

      await fetch("/api/auth/claim-device", { method: "POST" }).catch(() => {});
      router.push("/");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "สมัครไม่สำเร็จ");
      setLoading(false);
    }
  }

  return (
    <main className="min-h-[80vh] bg-gradient-to-b from-pink-50 to-amber-50 px-4 py-10">
      <div className="mx-auto w-full max-w-md rounded-3xl border-2 border-rose-100 bg-white p-6 shadow-md">
        <h1 className="text-2xl font-bold text-rose-700">สมัครสมาชิก ✨</h1>
        <p className="mt-1 text-sm text-rose-400">สร้างบัญชีเพื่อเก็บการ์ดของคุณ</p>

        {error && (
          <p className="mt-4 rounded-2xl border-2 border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
            😢 {error}
          </p>
        )}

        <form onSubmit={onSubmit} className="mt-5 space-y-4">
          <label className="block text-sm font-semibold text-rose-800">
            ชื่อ (ไม่บังคับ)
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={80}
              className="mt-1 w-full rounded-2xl border-2 border-rose-100 px-4 py-3 outline-none focus:border-rose-300"
            />
          </label>
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
            รหัสผ่าน (อย่างน้อย 8 ตัว)
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
            {loading ? "กำลังสมัคร…" : "สมัครเลย 🎉"}
          </button>
        </form>

        <p className="mt-5 text-center text-sm text-rose-500">
          มีบัญชีแล้ว?{" "}
          <Link href="/login" className="font-bold underline">
            เข้าสู่ระบบ
          </Link>
        </p>
      </div>
    </main>
  );
}
