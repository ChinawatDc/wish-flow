"use client";

import Link from "next/link";
import { useState } from "react";

const inputCls =
  "w-full rounded-2xl border-2 border-rose-100 bg-white px-4 py-2.5 text-sm outline-none focus:border-rose-300";

export default function SupportContactPage() {
  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [detail, setDetail] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [usernameOrEmail, setUsernameOrEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    caseNumber: number;
    trackUrl: string;
    accessToken: string;
  } | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSending(true);
    const res = await fetch("/api/support/contact", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        subject,
        detail,
        contactEmail,
        usernameOrEmail: usernameOrEmail || undefined,
        phone: phone || undefined,
      }),
    });
    const data = await res.json();
    setSending(false);
    if (!res.ok) {
      setError(data.error || "ส่งไม่สำเร็จ");
      return;
    }
    setResult({
      caseNumber: data.case.caseNumber,
      trackUrl: data.trackUrl,
      accessToken: data.accessToken,
    });
  }

  if (result) {
    return (
      <main className="min-h-screen bg-gradient-to-b from-rose-50 to-amber-50">
        <div className="mx-auto w-full max-w-lg px-4 py-10 sm:px-6">
          <div className="rounded-3xl border-2 border-emerald-200 bg-white p-6 text-center shadow-sm">
            <div className="text-5xl">✅</div>
            <h1 className="mt-3 text-xl font-bold text-emerald-700">
              รับเรื่องแล้ว! เคส #{result.caseNumber}
            </h1>
            <p className="mt-2 text-sm text-emerald-600">
              เก็บลิงก์ติดตามเคสนี้ไว้ — <b>แสดงครั้งเดียวเท่านั้น</b>
            </p>
            <div className="mt-4 break-all rounded-2xl border-2 border-emerald-100 bg-emerald-50 p-3 text-xs text-emerald-700">
              {typeof window !== "undefined" ? window.location.origin : ""}
              {result.trackUrl}
            </div>
            <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-center">
              <button
                type="button"
                onClick={() =>
                  navigator.clipboard.writeText(
                    `${window.location.origin}${result.trackUrl}`,
                  )
                }
                className="rounded-full border-2 border-emerald-300 px-5 py-2.5 text-sm font-semibold text-emerald-700 hover:bg-emerald-50"
              >
                📋 คัดลอกลิงก์
              </button>
              <Link
                href={result.trackUrl}
                className="rounded-full bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-600"
              >
                เปิดหน้าติดตามเคส →
              </Link>
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-rose-50 to-amber-50">
      <div className="mx-auto w-full max-w-lg px-4 py-8 sm:px-6">
        <p className="text-sm font-semibold text-rose-400">ศูนย์ช่วยเหลือ</p>
        <h1 className="text-2xl font-bold text-rose-700">ติดต่อเจ้าหน้าที่ 💬</h1>
        <p className="mt-1 text-sm text-rose-400">
          ไม่ต้องเข้าสู่ระบบก็ส่งได้ — เราจะให้ลิงก์สำหรับติดตามเคสหลังส่งสำเร็จ
        </p>

        {error && (
          <p className="mt-4 rounded-2xl border-2 border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
            😢 {error}
          </p>
        )}

        <form onSubmit={submit} className="mt-5 space-y-3">
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={inputCls}
            placeholder="ชื่อของคุณ *"
            maxLength={120}
          />
          <input
            required
            type="email"
            value={contactEmail}
            onChange={(e) => setContactEmail(e.target.value)}
            className={inputCls}
            placeholder="อีเมลติดต่อกลับ *"
            maxLength={200}
          />
          <input
            value={usernameOrEmail}
            onChange={(e) => setUsernameOrEmail(e.target.value)}
            className={inputCls}
            placeholder="ชื่อผู้ใช้/อีเมลบัญชี Wish Flow (ถ้ามี)"
            maxLength={200}
          />
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className={inputCls}
            placeholder="เบอร์โทร (ไม่บังคับ)"
            maxLength={30}
          />
          <input
            required
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className={inputCls}
            placeholder="หัวข้อ เช่น เข้าสู่ระบบไม่ได้ *"
            maxLength={200}
          />
          <textarea
            required
            value={detail}
            onChange={(e) => setDetail(e.target.value)}
            className={`${inputCls} min-h-32`}
            placeholder="รายละเอียดปัญหา (อย่างน้อย 10 ตัวอักษร) *"
            minLength={10}
            maxLength={4000}
          />
          <button
            type="submit"
            disabled={sending}
            className="w-full rounded-full bg-rose-500 px-5 py-3 font-semibold text-white shadow-sm hover:bg-rose-600 disabled:opacity-50"
          >
            {sending ? "กำลังส่ง…" : "ส่งเรื่องถึงเจ้าหน้าที่ ✉️"}
          </button>
        </form>
      </div>
    </main>
  );
}
