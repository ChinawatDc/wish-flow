"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

type Entry = {
  id: string;
  displayName: string | null;
  message: string;
  status: "PENDING" | "APPROVED" | "HIDDEN" | "REJECTED";
  hasPhoto: boolean;
  photoUrl: string | null;
  rejectReason: string | null;
  createdAt: string;
};

type Payload = {
  event: { id: string; name: string; guestbookEnabled: boolean; guestAccessMode: string };
  counts: Record<string, number>;
  page: number;
  limit: number;
  total: number;
  entries: Entry[];
};

const STATUS_TABS = [
  { key: "PENDING", label: "รออนุมัติ" },
  { key: "APPROVED", label: "อนุมัติแล้ว" },
  { key: "HIDDEN", label: "ซ่อน" },
  { key: "REJECTED", label: "ปฏิเสธ" },
  { key: "ALL", label: "ทั้งหมด" },
] as const;

export default function WishesModerationPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const [status, setStatus] = useState<(typeof STATUS_TABS)[number]["key"]>("PENDING");
  const [limit, setLimit] = useState(20);
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Payload | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    const q = new URLSearchParams({
      status,
      page: String(page),
      limit: String(limit),
    });
    const res = await fetch(`/api/events/${id}/guestbook?${q}`);
    const json = await res.json();
    if (!res.ok) {
      setError(json.error || "โหลดไม่สำเร็จ");
      return;
    }
    setData(json);
    setSelected(new Set());
  }, [id, status, page, limit]);

  useEffect(() => {
    void load();
  }, [load]);

  async function moderateOne(entryId: string, next: "APPROVED" | "HIDDEN" | "REJECTED") {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/events/${id}/guestbook/${entryId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "ทำรายการไม่สำเร็จ");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "ทำรายการไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }

  async function deleteOne(entryId: string) {
    if (!confirm("ลบคำอวยพรนี้ถาวร?")) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/events/${id}/guestbook/${entryId}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "ลบไม่สำเร็จ");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "ลบไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }

  async function bulk(next: "APPROVED" | "HIDDEN" | "REJECTED") {
    if (selected.size === 0) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/events/${id}/guestbook/bulk`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: Array.from(selected), status: next }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "ทำรายการกลุ่มไม่สำเร็จ");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "ทำรายการกลุ่มไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else if (next.size < 50) next.add(id);
      return next;
    });
  }

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.limit)) : 1;

  return (
    <main className="min-h-screen bg-gradient-to-b from-pink-50 to-amber-50 pb-16">
      <div className="mx-auto w-full max-w-3xl px-4 py-8">
        <div className="flex items-center justify-between gap-3">
          <Link href={`/events/${id}/edit`} className="text-sm font-medium text-rose-500 hover:underline">
            ← กลับไปแต่งการ์ด
          </Link>
          <Link href={`/e/${id}/guestbook`} className="text-sm text-rose-400 hover:underline">
            ดูหน้าแขก
          </Link>
        </div>
        <h1 className="mt-3 text-2xl font-bold text-rose-700">สมุดอวยพร — อนุมัติ</h1>
        <p className="text-sm text-rose-400">{data?.event.name ?? "…"}</p>

        {error && (
          <p className="mt-4 rounded-2xl border-2 border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
            {error}
          </p>
        )}

        <div className="mt-5 flex flex-wrap gap-2">
          {STATUS_TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => {
                setStatus(t.key);
                setPage(1);
              }}
              className={`rounded-full px-4 py-2 text-sm font-semibold ${
                status === t.key
                  ? "bg-rose-500 text-white"
                  : "border-2 border-rose-100 bg-white text-rose-600"
              }`}
            >
              {t.label}
              {data ? ` (${data.counts[t.key] ?? 0})` : ""}
            </button>
          ))}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <label className="text-sm text-rose-600">
            ต่อหน้า{" "}
            <select
              value={limit}
              onChange={(e) => {
                setLimit(Number(e.target.value));
                setPage(1);
              }}
              className="rounded-xl border-2 border-rose-100 px-2 py-1"
            >
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
            </select>
          </label>
          {selected.size > 0 && (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => void bulk("APPROVED")}
                className="rounded-full bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-white"
              >
                อนุมัติ ({selected.size})
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void bulk("HIDDEN")}
                className="rounded-full bg-amber-500 px-3 py-1.5 text-xs font-semibold text-white"
              >
                ซ่อน
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void bulk("REJECTED")}
                className="rounded-full bg-rose-700 px-3 py-1.5 text-xs font-semibold text-white"
              >
                ปฏิเสธ
              </button>
            </div>
          )}
        </div>

        <div className="mt-5 space-y-3">
          {!data && <p className="text-rose-300">กำลังโหลด…</p>}
          {data?.entries.length === 0 && (
            <p className="rounded-3xl bg-white/70 px-4 py-8 text-center text-sm text-rose-300">
              ไม่มีรายการในสถานะนี้
            </p>
          )}
          {data?.entries.map((e) => (
            <article
              key={e.id}
              className="rounded-3xl border-2 border-rose-100 bg-white p-4 shadow-sm"
            >
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  checked={selected.has(e.id)}
                  onChange={() => toggle(e.id)}
                  className="mt-1"
                />
                <div className="min-w-0 flex-1">
                  {e.photoUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={e.photoUrl}
                      alt=""
                      className="mb-3 max-h-48 rounded-2xl object-cover"
                    />
                  )}
                  <p className="whitespace-pre-wrap text-rose-900">{e.message}</p>
                  <p className="mt-2 text-xs text-rose-400">
                    {e.displayName || "ไม่ระบุชื่อ"} · {e.status} ·{" "}
                    {new Date(e.createdAt).toLocaleString("th-TH")}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {e.status !== "APPROVED" && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void moderateOne(e.id, "APPROVED")}
                        className="rounded-full bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-white"
                      >
                        อนุมัติ
                      </button>
                    )}
                    {e.status !== "HIDDEN" && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void moderateOne(e.id, "HIDDEN")}
                        className="rounded-full border-2 border-amber-200 px-3 py-1.5 text-xs font-semibold text-amber-700"
                      >
                        ซ่อน
                      </button>
                    )}
                    {e.status !== "REJECTED" && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void moderateOne(e.id, "REJECTED")}
                        className="rounded-full border-2 border-rose-200 px-3 py-1.5 text-xs font-semibold text-rose-700"
                      >
                        ปฏิเสธ
                      </button>
                    )}
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void deleteOne(e.id)}
                      className="rounded-full border-2 border-stone-200 px-3 py-1.5 text-xs font-semibold text-stone-600"
                    >
                      ลบ
                    </button>
                  </div>
                </div>
              </div>
            </article>
          ))}
        </div>

        {data && totalPages > 1 && (
          <div className="mt-6 flex items-center justify-center gap-3">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
              className="rounded-full border-2 border-rose-200 px-4 py-2 text-sm disabled:opacity-40"
            >
              ก่อนหน้า
            </button>
            <span className="text-sm text-rose-500">
              {page} / {totalPages}
            </span>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="rounded-full border-2 border-rose-200 px-4 py-2 text-sm disabled:opacity-40"
            >
              ถัดไป
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
