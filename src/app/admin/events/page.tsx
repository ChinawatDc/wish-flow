"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type EventRow = {
  id: string;
  name: string;
  status: string;
  viewCount: number;
  eventDate: string | null;
  createdAt: string;
  owner: { id: string; email: string; name: string | null } | null;
  template: { id: string; slug: string; name: string } | null;
};

export default function AdminEventsPage() {
  const [events, setEvents] = useState<EventRow[]>([]);
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [selected, setSelected] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({ page: String(page), limit: "20" });
    if (q) params.set("q", q);
    const res = await fetch(`/api/admin/events?${params}`);
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "โหลดไม่สำเร็จ");
      setLoading(false);
      return;
    }
    setEvents(data.events);
    setTotalPages(data.totalPages);
    setLoading(false);
  }, [page, q]);

  useEffect(() => {
    void load();
  }, [load]);

  async function openDetail(id: string) {
    const res = await fetch(`/api/admin/events/${id}`);
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "โหลดรายละเอียดไม่สำเร็จ");
      return;
    }
    setSelected(data);
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-violet-50 to-rose-50">
      <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-sm font-semibold text-violet-400">ผู้ดูแลระบบ · อ่านอย่างเดียว</p>
            <h1 className="text-2xl font-bold text-violet-800">การ์ดทั้งหมด 👀</h1>
            <p className="mt-1 text-xs text-violet-400">
              ดูได้ทุกใบ แต่แก้ไข/ลบการ์ดของ user ไม่ได้ — ใช้หน้า “การ์ดของฉัน” สำหรับการ์ดตัวเอง
            </p>
          </div>
          <Link
            href="/admin/users"
            className="rounded-full border-2 border-violet-200 bg-white px-4 py-2 text-sm font-semibold text-violet-600"
          >
            ← จัดการผู้ใช้
          </Link>
        </div>

        <input
          value={q}
          onChange={(e) => {
            setPage(1);
            setQ(e.target.value);
          }}
          placeholder="ค้นหาชื่อการ์ดหรืออีเมลเจ้าของ…"
          className="mb-4 w-full rounded-2xl border-2 border-violet-100 bg-white px-4 py-2.5 text-sm outline-none focus:border-violet-300"
        />

        {error && (
          <p className="mb-4 rounded-2xl border-2 border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
            😢 {error}
          </p>
        )}

        {loading ? (
          <p className="text-center text-violet-300">กำลังโหลด…</p>
        ) : (
          <ul className="space-y-3">
            {events.map((e) => (
              <li
                key={e.id}
                className="rounded-3xl border-2 border-violet-100 bg-white p-4 shadow-sm"
              >
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-bold text-violet-900">🎂 {e.name}</p>
                    <p className="mt-1 text-xs text-violet-400">
                      เจ้าของ: {e.owner?.email ?? "—"} · {e.template?.name ?? "ไม่มีเทมเพลต"} ·{" "}
                      {e.status} · เปิดดู {e.viewCount}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => openDetail(e.id)}
                    className="rounded-xl border-2 border-violet-200 px-3 py-2 text-sm font-semibold text-violet-700 hover:bg-violet-50"
                  >
                    ดูรายละเอียด
                  </button>
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

      {selected && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-violet-900/30 p-4 backdrop-blur-sm sm:items-center"
          onClick={() => setSelected(null)}
        >
          <div
            role="dialog"
            className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-3xl bg-white p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-2">
              <h2 className="text-lg font-bold text-violet-800">
                {(selected.name as string) || "รายละเอียด"}
              </h2>
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="grid h-8 w-8 place-items-center rounded-full bg-violet-100 text-violet-600"
              >
                ✕
              </button>
            </div>
            <pre className="mt-3 overflow-x-auto rounded-2xl bg-violet-50 p-3 text-xs text-violet-800">
              {JSON.stringify(selected, null, 2)}
            </pre>
            <p className="mt-3 text-xs text-violet-400">
              โหมดอ่านอย่างเดียว — ไม่มีปุ่มแก้ไข/ลบการ์ดของ user
            </p>
          </div>
        </div>
      )}
    </main>
  );
}
