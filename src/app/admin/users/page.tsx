"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";

type UserRow = {
  id: string;
  email: string;
  name: string | null;
  role: "USER" | "ADMIN";
  status: "ACTIVE" | "SUSPENDED";
  eventCount: number;
  hasSecurityPin: boolean;
  createdAt: string;
};

type PendingReset = { userId: string; kind: "password" | "pin" };

export default function AdminUsersPage() {
  const { data: session } = useSession();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // step-up modal
  const [pending, setPending] = useState<PendingReset | null>(null);
  const [needStepUp, setNeedStepUp] = useState(false);
  const [pin, setPin] = useState("");
  const [stepUpError, setStepUpError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);

  // แสดงค่าชั่วคราวครั้งเดียว
  const [tempCredential, setTempCredential] = useState<{
    label: string;
    value: string;
    email: string;
  } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({ page: String(page), limit: "20" });
    if (q) params.set("q", q);
    const res = await fetch(`/api/admin/users?${params}`);
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "โหลดไม่สำเร็จ");
      setLoading(false);
      return;
    }
    setUsers(data.users);
    setTotalPages(data.totalPages);
    setLoading(false);
  }, [page, q]);

  useEffect(() => {
    void load();
  }, [load]);

  async function patchUser(
    id: string,
    body: { role?: "USER" | "ADMIN"; status?: "ACTIVE" | "SUSPENDED" },
  ) {
    setError(null);
    const res = await fetch(`/api/admin/users/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "อัปเดตไม่สำเร็จ");
      return;
    }
    await load();
  }

  const runReset = useCallback(
    async (reset: PendingReset) => {
      setError(null);
      const path =
        reset.kind === "password" ? "reset-password" : "reset-security-pin";
      const res = await fetch(`/api/admin/users/${reset.userId}/${path}`, {
        method: "POST",
      });
      const data = await res.json();
      if (res.status === 428) {
        // ต้อง step-up ก่อน
        setPending(reset);
        setNeedStepUp(true);
        return;
      }
      if (!res.ok) {
        setError(data.error || "ดำเนินการไม่สำเร็จ");
        return;
      }
      const target = users.find((u) => u.id === reset.userId);
      setTempCredential({
        label: reset.kind === "password" ? "รหัสผ่านชั่วคราว" : "Security PIN ชั่วคราว",
        value: reset.kind === "password" ? data.tempPassword : data.tempPin,
        email: target?.email ?? "",
      });
      await load();
    },
    [users, load],
  );

  async function verifyStepUp() {
    setStepUpError(null);
    setVerifying(true);
    const res = await fetch("/api/admin/step-up/verify-pin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin }),
    });
    const data = await res.json();
    setVerifying(false);
    if (!res.ok) {
      setStepUpError(data.error || "ยืนยัน PIN ไม่สำเร็จ");
      return;
    }
    setPin("");
    setNeedStepUp(false);
    if (pending) {
      const p = pending;
      setPending(null);
      await runReset(p);
    }
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-violet-50 to-rose-50">
      <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-sm font-semibold text-violet-400">ผู้ดูแลระบบ</p>
            <h1 className="text-2xl font-bold text-violet-800">จัดการผู้ใช้ 👥</h1>
          </div>
          <Link
            href="/admin/events"
            className="rounded-full border-2 border-violet-200 bg-white px-4 py-2 text-sm font-semibold text-violet-600"
          >
            ดูการ์ดทั้งหมด →
          </Link>
        </div>

        <div className="mb-4 flex gap-2">
          <input
            value={q}
            onChange={(e) => {
              setPage(1);
              setQ(e.target.value);
            }}
            placeholder="ค้นหาอีเมลหรือชื่อ…"
            className="flex-1 rounded-2xl border-2 border-violet-100 bg-white px-4 py-2.5 text-sm outline-none focus:border-violet-300"
          />
        </div>

        {error && (
          <p className="mb-4 rounded-2xl border-2 border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
            😢 {error}
          </p>
        )}

        {loading ? (
          <p className="text-center text-violet-300">กำลังโหลด…</p>
        ) : (
          <ul className="space-y-3">
            {users.map((u) => {
              const isSelf = session?.user?.id === u.id;
              return (
                <li
                  key={u.id}
                  className="rounded-3xl border-2 border-violet-100 bg-white p-4 shadow-sm"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="font-bold text-violet-900">
                        {u.name || "—"}{" "}
                        <span className="text-sm font-normal text-violet-400">
                          {u.email}
                        </span>
                      </p>
                      <p className="mt-1 text-xs text-violet-400">
                        {u.role === "ADMIN" ? "👑 ADMIN" : "USER"} ·{" "}
                        {u.status === "ACTIVE" ? "🟢 ใช้งาน" : "⛔ ระงับ"} · การ์ด{" "}
                        {u.eventCount} ใบ
                        {u.hasSecurityPin && " · 🛡️ มี PIN"}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          patchUser(u.id, {
                            role: u.role === "ADMIN" ? "USER" : "ADMIN",
                          })
                        }
                        className="rounded-xl border-2 border-violet-200 px-3 py-2 text-xs font-semibold text-violet-700 hover:bg-violet-50"
                      >
                        {u.role === "ADMIN" ? "ลดเป็น USER" : "ตั้งเป็น ADMIN"}
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          patchUser(u.id, {
                            status: u.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE",
                          })
                        }
                        className={`rounded-xl border-2 px-3 py-2 text-xs font-semibold ${
                          u.status === "ACTIVE"
                            ? "border-red-200 text-red-500 hover:bg-red-50"
                            : "border-emerald-200 text-emerald-600 hover:bg-emerald-50"
                        }`}
                      >
                        {u.status === "ACTIVE" ? "ระงับ" : "เปิดใช้"}
                      </button>
                      {!isSelf && (
                        <>
                          <button
                            type="button"
                            onClick={() => runReset({ userId: u.id, kind: "password" })}
                            className="rounded-xl border-2 border-amber-200 px-3 py-2 text-xs font-semibold text-amber-600 hover:bg-amber-50"
                          >
                            🔑 รีเซ็ตรหัสผ่าน
                          </button>
                          <button
                            type="button"
                            onClick={() => runReset({ userId: u.id, kind: "pin" })}
                            className="rounded-xl border-2 border-amber-200 px-3 py-2 text-xs font-semibold text-amber-600 hover:bg-amber-50"
                          >
                            🛡️ รีเซ็ต PIN
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {totalPages > 1 && (
          <div className="mt-4 flex justify-center gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
              className="rounded-full border px-4 py-2 text-sm disabled:opacity-40"
            >
              ก่อนหน้า
            </button>
            <span className="py-2 text-sm text-violet-400">
              {page}/{totalPages}
            </span>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="rounded-full border px-4 py-2 text-sm disabled:opacity-40"
            >
              ถัดไป
            </button>
          </div>
        )}
      </div>

      {/* Step-up PIN modal */}
      {needStepUp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-3xl border-2 border-violet-200 bg-white p-6 shadow-xl">
            <h2 className="text-lg font-bold text-violet-800">
              ยืนยัน Security PIN 🛡️
            </h2>
            <p className="mt-2 text-sm text-violet-500">
              การรีเซ็ตรหัสผ่าน/PIN ของผู้ใช้ ต้องยืนยันตัวตนด้วย Security PIN
              ของคุณก่อน (มีผล 5 นาที)
            </p>
            {stepUpError && (
              <p className="mt-3 rounded-xl border-2 border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
                {stepUpError}
              </p>
            )}
            <input
              type="password"
              inputMode="numeric"
              maxLength={6}
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
              className="mt-4 w-full rounded-2xl border-2 border-violet-100 px-4 py-3 text-center text-lg tracking-[0.5em] outline-none focus:border-violet-300"
              placeholder="••••••"
              autoFocus
            />
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setNeedStepUp(false);
                  setPending(null);
                  setPin("");
                  setStepUpError(null);
                }}
                className="flex-1 rounded-full border-2 border-violet-200 px-4 py-2.5 text-sm font-semibold text-violet-600 hover:bg-violet-50"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={verifyStepUp}
                disabled={verifying || pin.length !== 6}
                className="flex-1 rounded-full bg-violet-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-violet-600 disabled:opacity-50"
              >
                {verifying ? "กำลังยืนยัน…" : "ยืนยัน PIN"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Temp credential one-time modal */}
      {tempCredential && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-3xl border-2 border-amber-200 bg-white p-6 shadow-xl">
            <h2 className="text-lg font-bold text-amber-700">
              {tempCredential.label} 🔐
            </h2>
            <p className="mt-2 text-sm text-amber-600">
              สำหรับ <b>{tempCredential.email}</b> — แสดง<b>ครั้งเดียวเท่านั้น</b>{" "}
              กรุณาส่งให้ผู้ใช้ทางช่องทางที่ปลอดภัย
              ผู้ใช้จะถูกบังคับเปลี่ยนทันทีหลังเข้าสู่ระบบ
            </p>
            <p className="mt-4 select-all rounded-2xl border-2 border-amber-100 bg-amber-50 p-4 text-center font-mono text-lg font-bold text-amber-800">
              {tempCredential.value}
            </p>
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => navigator.clipboard.writeText(tempCredential.value)}
                className="flex-1 rounded-full border-2 border-amber-300 px-4 py-2.5 text-sm font-semibold text-amber-700 hover:bg-amber-50"
              >
                📋 คัดลอก
              </button>
              <button
                type="button"
                onClick={() => setTempCredential(null)}
                className="flex-1 rounded-full bg-amber-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-amber-600"
              >
                ปิด
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
