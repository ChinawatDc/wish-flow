"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

const STATUS_TH: Record<string, string> = {
  NEW: "🆕 ใหม่",
  CLAIMED: "👀 รับแล้ว",
  IN_PROGRESS: "🔧 กำลังทำ",
  WAITING_USER: "💬 รอผู้ใช้",
  RESOLVED: "✅ แก้แล้ว",
  CLOSED: "🔒 ปิด",
  SPAM: "🚫 สแปม",
};

const PRIORITY_TH: Record<string, string> = {
  LOW: "ต่ำ",
  NORMAL: "ปกติ",
  HIGH: "สูง",
  URGENT: "🔥 ด่วน",
};

type CaseRow = {
  id: string;
  caseNumber: number;
  status: string;
  priority: string;
  name: string;
  subject: string;
  contactEmail: string;
  createdAt: string;
  assignedAdmin: { id: string; name: string | null; email: string } | null;
};

export default function AdminSupportPage() {
  const [cases, setCases] = useState<CaseRow[]>([]);
  const [status, setStatus] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: "20" });
    if (status) params.set("status", status);
    if (q) params.set("q", q);
    const res = await fetch(`/api/admin/support/cases?${params}`);
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "โหลดไม่สำเร็จ");
      setLoading(false);
      return;
    }
    setCases(data.cases);
    setTotalPages(data.totalPages);
    setLoading(false);
  }, [page, status, q]);

  useEffect(() => {
    void load();
  }, [load]);

  async function claim(id: string) {
    const res = await fetch(`/api/admin/support/cases/${id}/claim`, { method: "POST" });
    const data = await res.json();
    if (!res.ok) setError(data.error || "รับเคสไม่สำเร็จ");
    await load();
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-violet-50 to-rose-50">
      <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6">
        <div className="mb-4">
          <p className="text-sm font-semibold text-violet-400">ผู้ดูแลระบบ</p>
          <h1 className="text-2xl font-bold text-violet-800">เคสซัพพอร์ต 🛟</h1>
        </div>

        <div className="mb-4 flex flex-wrap gap-2">
          <select
            value={status}
            onChange={(e) => {
              setPage(1);
              setStatus(e.target.value);
            }}
            className="rounded-2xl border-2 border-violet-100 bg-white px-3 py-2.5 text-sm outline-none focus:border-violet-300"
          >
            <option value="">ทุกสถานะ</option>
            {Object.entries(STATUS_TH).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
          <input
            value={q}
            onChange={(e) => {
              setPage(1);
              setQ(e.target.value);
            }}
            placeholder="ค้นหาหัวข้อ/ชื่อ/อีเมล…"
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
        ) : cases.length === 0 ? (
          <p className="rounded-3xl border-2 border-violet-100 bg-white p-8 text-center text-violet-300">
            ไม่มีเคส
          </p>
        ) : (
          <ul className="space-y-3">
            {cases.map((c) => (
              <li
                key={c.id}
                className="rounded-3xl border-2 border-violet-100 bg-white p-4 shadow-sm"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="text-xs text-violet-400">
                      #{c.caseNumber} · {STATUS_TH[c.status] ?? c.status} · ความสำคัญ{" "}
                      {PRIORITY_TH[c.priority] ?? c.priority}
                    </p>
                    <p className="truncate font-bold text-violet-900">{c.subject}</p>
                    <p className="mt-0.5 truncate text-xs text-violet-400">
                      {c.name} · {c.contactEmail} ·{" "}
                      {new Date(c.createdAt).toLocaleString("th-TH")}
                      {c.assignedAdmin &&
                        ` · ผู้รับ: ${c.assignedAdmin.name || c.assignedAdmin.email}`}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    {!c.assignedAdmin && (c.status === "NEW" || c.status === "IN_PROGRESS") && (
                      <button
                        type="button"
                        onClick={() => claim(c.id)}
                        className="rounded-xl bg-violet-500 px-3 py-2 text-xs font-semibold text-white hover:bg-violet-600"
                      >
                        รับเคส
                      </button>
                    )}
                    <Link
                      href={`/admin/support/${c.id}`}
                      className="rounded-xl border-2 border-violet-200 px-3 py-2 text-xs font-semibold text-violet-700 hover:bg-violet-50"
                    >
                      เปิดดู →
                    </Link>
                  </div>
                </div>
              </li>
            ))}
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
    </main>
  );
}
