"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type Item = {
  id: string;
  slug: string;
  name: string;
  description: string;
  thumbnailUrl: string;
  category: string;
  libraryStatus: string;
  usageCount: number;
  isPremium: boolean;
  isFeatured: boolean;
  hasGame: boolean;
  stepCount: number;
  currentPublishedVersion: { version: number } | null;
  draftVersion: { version: number } | null;
  updatedAt: string;
};

const STATUS_LABELS: Record<string, string> = {
  draft: "ฉบับร่าง",
  published: "เผยแพร่แล้ว",
  deprecated: "เลิกใช้งาน",
  archived: "เก็บถาวร",
};

export default function AdminTemplatesPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("any");
  const [category, setCategory] = useState("");
  const [sort, setSort] = useState("recommended");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({
      page: String(page),
      limit: "12",
      sort,
      status,
    });
    if (q) params.set("q", q);
    if (category) params.set("category", category);
    const res = await fetch(`/api/admin/templates?${params}`);
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "โหลดไม่สำเร็จ");
      setLoading(false);
      return;
    }
    setItems(data.items);
    setTotalPages(data.totalPages);
    setLoading(false);
  }, [page, q, status, category, sort]);

  useEffect(() => {
    void load();
  }, [load]);

  async function createTemplate() {
    setCreating(true);
    const res = await fetch("/api/admin/templates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "เทมเพลตใหม่" }),
    });
    const data = await res.json();
    setCreating(false);
    if (!res.ok) {
      setError(data.error || "สร้างไม่สำเร็จ");
      return;
    }
    window.location.href = `/admin/templates/${data.id}`;
  }

  async function duplicate(id: string) {
    const res = await fetch(`/api/admin/templates/${id}/duplicate`, {
      method: "POST",
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "ทำสำเนาไม่สำเร็จ");
      return;
    }
    window.location.href = `/admin/templates/${data.id}`;
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-violet-50 to-rose-50">
      <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-violet-400">สตูดิโอเทมเพลต</p>
            <h1 className="text-2xl font-bold text-violet-800">คลังเทมเพลต 🎨</h1>
          </div>
          <div className="flex gap-2">
            <Link
              href="/admin/events"
              className="rounded-full border-2 border-violet-200 bg-white px-4 py-2 text-sm font-semibold text-violet-600"
            >
              ← การ์ดทั้งหมด
            </Link>
            <button
              type="button"
              disabled={creating}
              onClick={() => void createTemplate()}
              className="rounded-full bg-violet-600 px-4 py-2 text-sm font-bold text-white"
            >
              {creating ? "กำลังสร้าง…" : "+ สร้างเทมเพลต"}
            </button>
          </div>
        </div>

        <div className="mb-4 grid gap-2 sm:grid-cols-4">
          <input
            value={q}
            onChange={(e) => {
              setPage(1);
              setQ(e.target.value);
            }}
            placeholder="ค้นหาชื่อ / รหัส / แท็ก…"
            className="rounded-2xl border-2 border-violet-100 bg-white px-4 py-2.5 text-sm sm:col-span-2"
          />
          <select
            value={status}
            onChange={(e) => {
              setPage(1);
              setStatus(e.target.value);
            }}
            className="rounded-2xl border-2 border-violet-100 bg-white px-3 py-2.5 text-sm"
          >
            <option value="any">สถานะทั้งหมด</option>
            <option value="draft">ฉบับร่าง</option>
            <option value="published">เผยแพร่แล้ว</option>
            <option value="deprecated">เลิกใช้งาน</option>
            <option value="archived">เก็บถาวร</option>
          </select>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            className="rounded-2xl border-2 border-violet-100 bg-white px-3 py-2.5 text-sm"
          >
            <option value="recommended">แนะนำ</option>
            <option value="newest">ใหม่ล่าสุด</option>
            <option value="popular">ยอดนิยม</option>
            <option value="updated">อัปเดตล่าสุด</option>
          </select>
        </div>

        <div className="mb-4 flex gap-1.5 overflow-x-auto pb-1">
          {[
            ["", "ทั้งหมด"],
            ["birthday", "วันเกิด"],
            ["photo", "รูปภาพ"],
            ["minigame", "มินิเกม"],
            ["romantic", "โรแมนติก"],
            ["friend", "เพื่อน"],
            ["family", "ครอบครัว"],
            ["simple", "เรียบง่าย"],
          ].map(([value, label]) => (
            <button
              key={value || "all"}
              type="button"
              onClick={() => {
                setPage(1);
                setCategory(value);
              }}
              className={`shrink-0 rounded-full border-2 px-3 py-1.5 text-xs font-medium ${
                category === value
                  ? "border-violet-500 bg-violet-500 text-white"
                  : "border-violet-100 bg-white text-violet-600"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {error && (
          <p className="mb-4 rounded-2xl border-2 border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
            {error}
          </p>
        )}

        {loading ? (
          <p className="text-center text-violet-300">กำลังโหลด…</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((t) => (
              <article
                key={t.id}
                className="rounded-3xl border-2 border-violet-100 bg-white p-4 shadow-sm"
              >
                <div className="grid aspect-[4/3] place-items-center rounded-2xl bg-gradient-to-br from-violet-50 to-rose-50 text-5xl">
                  {t.thumbnailUrl.startsWith("emoji:")
                    ? t.thumbnailUrl.slice(6)
                    : "🎨"}
                </div>
                <h2 className="mt-3 truncate font-bold text-violet-900">{t.name}</h2>
                <p className="mt-1 line-clamp-2 text-xs text-violet-400">{t.description}</p>
                <div className="mt-2 flex flex-wrap gap-1">
                  <span className="rounded-full bg-violet-50 px-2 py-0.5 text-[10px] text-violet-600">
                    {STATUS_LABELS[t.libraryStatus.toLowerCase()] ?? t.libraryStatus}
                  </span>
                  {t.currentPublishedVersion && (
                    <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] text-emerald-600">
                      v{t.currentPublishedVersion.version}
                    </span>
                  )}
                  {t.draftVersion && (
                    <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] text-amber-600">
                      ฉบับร่าง รุ่น {t.draftVersion.version}
                    </span>
                  )}
                  {t.hasGame && (
                    <span className="rounded-full bg-fuchsia-50 px-2 py-0.5 text-[10px] text-fuchsia-600">
                      เกม
                    </span>
                  )}
                  {t.isPremium && (
                    <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] text-amber-600">
                      พรีเมียม
                    </span>
                  )}
                </div>
                <p className="mt-2 text-[11px] text-violet-300">
                  {t.slug} · {t.stepCount} ขั้นตอน · ใช้ {t.usageCount} ครั้ง
                </p>
                <div className="mt-3 flex gap-2">
                  <Link
                    href={`/admin/templates/${t.id}`}
                    className="flex-1 rounded-full bg-violet-600 py-2 text-center text-xs font-bold text-white"
                  >
                    เปิดสตูดิโอ
                  </Link>
                  <button
                    type="button"
                    onClick={() => void duplicate(t.id)}
                    className="rounded-full border-2 border-violet-200 px-3 py-2 text-xs font-semibold text-violet-700"
                  >
                    สำเนา
                  </button>
                </div>
              </article>
            ))}
          </div>
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
