"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type CardRow = {
  id: string;
  title: string;
  blurb: string | null;
  includeAssets: boolean;
  heartCount: number;
  useCount: number;
  publishedAt: string | null;
  owner: { name: string };
  previewUrl: string | null;
  version: number | null;
  heartedByMe: boolean;
  isOwn: boolean;
};

export default function MarketplacePage() {
  const [cards, setCards] = useState<CardRow[]>([]);
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({ page: String(page), limit: "12" });
    if (q) params.set("q", q);
    const res = await fetch(`/api/marketplace/cards?${params}`);
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "โหลดไม่สำเร็จ");
      setLoading(false);
      return;
    }
    setCards(data.cards);
    setTotalPages(data.totalPages);
    setLoading(false);
  }, [page, q]);

  useEffect(() => {
    void load();
  }, [load]);

  async function toggleHeart(id: string) {
    setBusyId(id);
    const res = await fetch(`/api/marketplace/cards/${id}/heart`, { method: "POST" });
    const data = await res.json();
    setBusyId(null);
    if (!res.ok) {
      setError(data.error || "กดหัวใจไม่สำเร็จ");
      return;
    }
    setCards((prev) =>
      prev.map((c) =>
        c.id === id
          ? { ...c, heartedByMe: data.hearted, heartCount: data.heartCount }
          : c,
      ),
    );
  }

  async function applyCard(id: string) {
    setBusyId(id);
    setError(null);
    const res = await fetch(`/api/marketplace/cards/${id}/use`, { method: "POST" });
    const data = await res.json();
    setBusyId(null);
    if (!res.ok) {
      setError(data.error || "นำไปใช้ไม่สำเร็จ");
      return;
    }
    window.location.href = `/events/${data.eventId}/edit`;
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-rose-50 to-amber-50">
      <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6">
        <p className="text-sm font-semibold text-rose-400">คลังแชร์</p>
        <h1 className="text-2xl font-bold text-rose-700">การ์ดจากชุมชน 💝</h1>
        <p className="mt-1 text-sm text-rose-400">
          กดหัวใจและนำไปใช้เป็นฉบับร่างของตัวเอง (PIN ใหม่เสมอ)
        </p>

        <div className="mt-4">
          <input
            value={q}
            onChange={(e) => {
              setPage(1);
              setQ(e.target.value);
            }}
            placeholder="ค้นหาชื่อการ์ด…"
            className="w-full rounded-2xl border-2 border-rose-100 bg-white px-4 py-2.5 text-sm outline-none focus:border-rose-300"
          />
        </div>

        {error && (
          <p className="mt-4 rounded-2xl border-2 border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
            {error}
          </p>
        )}

        {loading ? (
          <p className="mt-8 text-center text-rose-300">กำลังโหลด…</p>
        ) : cards.length === 0 ? (
          <p className="mt-8 rounded-3xl border-2 border-dashed border-rose-200 bg-white p-10 text-center text-rose-400">
            ยังไม่มีการ์ดที่แชร์ไว้
          </p>
        ) : (
          <ul className="mt-6 grid gap-4 sm:grid-cols-2">
            {cards.map((c) => (
              <li
                key={c.id}
                className="overflow-hidden rounded-3xl border-2 border-rose-100 bg-white shadow-sm"
              >
                <div className="relative aspect-[4/3] bg-gradient-to-br from-rose-100 to-amber-100">
                  {c.previewUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={c.previewUrl}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="grid h-full place-items-center text-5xl">🎴</div>
                  )}
                </div>
                <div className="p-4">
                  <Link
                    href={`/marketplace/${c.id}`}
                    className="text-lg font-bold text-rose-800 hover:underline"
                  >
                    {c.title}
                  </Link>
                  <p className="mt-1 text-xs text-rose-400">
                    โดย {c.owner.name}
                    {c.version != null ? ` · รุ่น ${c.version}` : ""}
                    {c.includeAssets ? " · มีรูป" : ""}
                    {c.isOwn ? " · ของคุณ" : ""}
                  </p>
                  {c.blurb && (
                    <p className="mt-2 line-clamp-2 text-sm text-rose-500">{c.blurb}</p>
                  )}
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      disabled={busyId === c.id}
                      onClick={() => toggleHeart(c.id)}
                      className={`rounded-full border-2 px-3 py-1.5 text-xs font-semibold ${
                        c.heartedByMe
                          ? "border-rose-400 bg-rose-500 text-white"
                          : "border-rose-200 text-rose-600 hover:bg-rose-50"
                      }`}
                    >
                      {c.heartedByMe ? "♥" : "♡"} {c.heartCount}
                    </button>
                    <span className="text-xs text-rose-400">ดาวน์โหลด {c.useCount} คน</span>
                    {!c.isOwn && (
                      <button
                        type="button"
                        disabled={busyId === c.id}
                        onClick={() => applyCard(c.id)}
                        className="ml-auto rounded-full bg-rose-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-600 disabled:opacity-50"
                      >
                        นำไปใช้
                      </button>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}

        {totalPages > 1 && (
          <div className="mt-6 flex justify-center gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
              className="rounded-full border px-4 py-2 text-sm disabled:opacity-40"
            >
              ก่อนหน้า
            </button>
            <span className="py-2 text-sm text-rose-400">
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
