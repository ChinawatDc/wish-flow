"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { StepDef } from "@/lib/validation";

import { StepRenderer } from "./steps/StepRenderer";

export type TemplateSummary = {
  id: string;
  slug: string;
  name: string;
  description: string;
  thumbnailUrl: string;
  category: string;
  tags: string[];
  mood: string;
  requiredAssetCount: number;
  isPremium: boolean;
  usageCount: number;
  hasGame: boolean;
  stepCount: number;
};

const CATEGORIES: { value: string; label: string }[] = [
  { value: "", label: "ทั้งหมด" },
  { value: "birthday", label: "วันเกิด 🎂" },
  { value: "photo", label: "รูปภาพ 📸" },
  { value: "minigame", label: "มินิเกม 🎮" },
  { value: "romantic", label: "โรแมนติก 💕" },
  { value: "friend", label: "เพื่อน 🫶" },
  { value: "family", label: "ครอบครัว 👨‍👩‍👧" },
  { value: "simple", label: "เรียบง่าย ✨" },
];

const SORTS: { value: string; label: string }[] = [
  { value: "recommended", label: "แนะนำ" },
  { value: "newest", label: "ใหม่ล่าสุด" },
  { value: "popular", label: "ยอดนิยม" },
];

const FAVORITES_KEY = "wishflow_favorite_templates";
const RECENTS_KEY = "wishflow_recent_templates";

function loadIds(key: string): string[] {
  try {
    const raw = localStorage.getItem(key);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

type PreviewData = {
  slug: string;
  name: string;
  stepsSchema: { steps: StepDef[] };
  templateData: Record<string, string>;
};

type Props = {
  open: boolean;
  onClose: () => void;
  currentSlug?: string | null;
  onSelect: (template: TemplateSummary) => void;
};

export function TemplateExplorer({ open, onClose, currentSlug, onSelect }: Props) {
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [category, setCategory] = useState("");
  const [sort, setSort] = useState("recommended");
  const [gameFilter, setGameFilter] = useState<"" | "true" | "false">("");
  const [items, setItems] = useState<TemplateSummary[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [recents, setRecents] = useState<string[]>([]);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      setFavorites(loadIds(FAVORITES_KEY));
      setRecents(loadIds(RECENTS_KEY));
    }
  }, [open]);

  // debounce ค้นหา
  useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 350);
    return () => clearTimeout(t);
  }, [search]);

  const fetchPage = useCallback(
    async (pageNum: number, append: boolean) => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({
          page: String(pageNum),
          limit: "12",
          sort,
        });
        if (debounced) params.set("q", debounced);
        if (category) params.set("category", category);
        if (gameFilter) params.set("hasGame", gameFilter);
        const res = await fetch(`/api/templates?${params}`);
        if (!res.ok) throw new Error();
        const data = await res.json();
        setItems((prev) => (append ? [...prev, ...data.items] : data.items));
        setTotalPages(data.totalPages);
        setPage(data.page);
      } catch {
        setError("โหลดเทมเพลตไม่สำเร็จ ลองใหม่อีกครั้ง");
      } finally {
        setLoading(false);
      }
    },
    [debounced, category, sort, gameFilter],
  );

  useEffect(() => {
    if (open) fetchPage(1, false);
  }, [open, fetchPage]);

  // focus trap อย่างง่าย + ปิดด้วย Escape
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        if (preview) setPreview(null);
        else onClose();
      }
      if (e.key === "Tab" && panelRef.current) {
        const focusables = panelRef.current.querySelectorAll<HTMLElement>(
          'button, input, select, [tabindex]:not([tabindex="-1"])',
        );
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose, preview]);

  function toggleFavorite(id: string) {
    setFavorites((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      localStorage.setItem(FAVORITES_KEY, JSON.stringify(next));
      return next;
    });
  }

  async function openPreview(slug: string) {
    setPreviewLoading(true);
    try {
      const res = await fetch(`/api/templates/${slug}/preview`);
      if (!res.ok) throw new Error();
      setPreview(await res.json());
    } catch {
      setError("โหลดตัวอย่างไม่สำเร็จ");
    } finally {
      setPreviewLoading(false);
    }
  }

  function select(template: TemplateSummary) {
    const nextRecents = [template.id, ...recents.filter((x) => x !== template.id)].slice(0, 8);
    localStorage.setItem(RECENTS_KEY, JSON.stringify(nextRecents));
    onSelect(template);
    setPreview(null);
    onClose();
  }

  const sortedItems = useMemo(() => {
    if (sort !== "recommended") return items;
    // ดัน favorite + recent ขึ้นก่อนเมื่อเรียงแบบแนะนำ
    return [...items].sort((a, b) => {
      const score = (t: TemplateSummary) =>
        (favorites.includes(t.id) ? 2 : 0) + (recents.includes(t.id) ? 1 : 0);
      return score(b) - score(a);
    });
  }, [items, sort, favorites, recents]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-rose-900/30 backdrop-blur-sm sm:items-center sm:p-6"
      onClick={onClose}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="เลือกเทมเพลต"
        onClick={(e) => e.stopPropagation()}
        className="flex h-[92dvh] w-full flex-col rounded-t-3xl bg-[#fff8f5] shadow-2xl sm:h-[85vh] sm:max-w-4xl sm:rounded-3xl"
      >
        {/* header */}
        <div className="flex items-center justify-between gap-3 border-b-2 border-rose-100 p-4">
          <h2 className="text-lg font-bold text-rose-700">เลือกเทมเพลต 🎨</h2>
          <button
            type="button"
            onClick={onClose}
            className="grid h-9 w-9 place-items-center rounded-full bg-rose-100 text-rose-500 hover:bg-rose-200"
            aria-label="ปิด"
          >
            ✕
          </button>
        </div>

        {/* search + filters */}
        <div className="space-y-2 border-b-2 border-rose-100 p-3">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="ค้นหาเทมเพลต… 🔍"
            aria-label="ค้นหาเทมเพลต"
            className="w-full rounded-2xl border-2 border-rose-100 bg-white px-4 py-2.5 text-sm outline-none focus:border-rose-300"
          />
          <div className="flex gap-1.5 overflow-x-auto pb-1">
            {CATEGORIES.map((c) => (
              <button
                key={c.value}
                type="button"
                onClick={() => setCategory(c.value)}
                className={`shrink-0 rounded-full border-2 px-3 py-1.5 text-xs font-medium transition ${
                  category === c.value
                    ? "border-rose-400 bg-rose-400 text-white"
                    : "border-rose-100 bg-white text-rose-600 hover:bg-rose-50"
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              className="rounded-xl border-2 border-rose-100 bg-white px-2 py-1.5 text-xs text-rose-700"
              aria-label="เรียงลำดับ"
            >
              {SORTS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
            <select
              value={gameFilter}
              onChange={(e) => setGameFilter(e.target.value as typeof gameFilter)}
              className="rounded-xl border-2 border-rose-100 bg-white px-2 py-1.5 text-xs text-rose-700"
              aria-label="กรองมินิเกม"
            >
              <option value="">เกม: ทั้งหมด</option>
              <option value="true">มีมินิเกม 🎮</option>
              <option value="false">ไม่มีเกม</option>
            </select>
          </div>
        </div>

        {/* grid */}
        <div className="flex-1 overflow-y-auto p-3">
          {error && (
            <p className="mb-3 rounded-2xl border-2 border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
              😢 {error}
            </p>
          )}
          {!loading && sortedItems.length === 0 && !error ? (
            <div className="grid h-40 place-items-center text-center">
              <div>
                <p className="text-4xl">🔍</p>
                <p className="mt-2 text-sm text-rose-400">ไม่พบเทมเพลตที่ค้นหา ลองคำอื่นดูนะ</p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {sortedItems.map((t) => (
                <div
                  key={t.id}
                  className={`relative overflow-hidden rounded-3xl border-2 bg-white transition ${
                    currentSlug === t.slug ? "border-rose-400" : "border-rose-100"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => openPreview(t.slug)}
                    className="block w-full text-left"
                  >
                    <div className="grid aspect-[4/3] place-items-center bg-gradient-to-br from-rose-50 to-amber-50 text-5xl">
                      {t.thumbnailUrl.startsWith("emoji:")
                        ? t.thumbnailUrl.slice(6)
                        : "🎁"}
                    </div>
                    <div className="p-2.5">
                      <p className="truncate text-sm font-bold text-rose-800">{t.name}</p>
                      <p className="mt-0.5 line-clamp-2 text-xs text-rose-400">
                        {t.description}
                      </p>
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {t.hasGame && (
                          <span className="rounded-full bg-violet-50 px-2 py-0.5 text-[10px] text-violet-500">
                            🎮 มีเกม
                          </span>
                        )}
                        {t.requiredAssetCount > 0 && (
                          <span className="rounded-full bg-sky-50 px-2 py-0.5 text-[10px] text-sky-500">
                            📸 {t.requiredAssetCount} รูป
                          </span>
                        )}
                        {t.isPremium && (
                          <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] text-amber-500">
                            ⭐ พรีเมียม
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleFavorite(t.id)}
                    className="absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-full bg-white/90 text-base shadow"
                    aria-label={favorites.includes(t.id) ? "เลิกถูกใจ" : "ถูกใจ"}
                  >
                    {favorites.includes(t.id) ? "💖" : "🤍"}
                  </button>
                  {currentSlug === t.slug && (
                    <span className="absolute left-2 top-2 rounded-full bg-rose-400 px-2 py-0.5 text-[10px] font-bold text-white">
                      ใช้อยู่
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}

          {loading && (
            <p className="py-6 text-center text-sm text-rose-300">กำลังโหลด… 🎠</p>
          )}
          {!loading && page < totalPages && (
            <div className="pt-3 text-center">
              <button
                type="button"
                onClick={() => fetchPage(page + 1, true)}
                className="rounded-full border-2 border-rose-200 bg-white px-6 py-2.5 text-sm font-semibold text-rose-600 hover:bg-rose-50"
              >
                โหลดเพิ่ม ⬇️
              </button>
            </div>
          )}
        </div>
      </div>

      {/* preview overlay */}
      {(preview || previewLoading) && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-rose-900/40 p-4 backdrop-blur-sm"
          onClick={(e) => {
            e.stopPropagation();
            setPreview(null);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="ตัวอย่างเทมเพลต"
            onClick={(e) => e.stopPropagation()}
            className="flex max-h-[90dvh] w-full max-w-md flex-col overflow-hidden rounded-3xl bg-[#fff8f5] shadow-2xl"
          >
            {previewLoading ? (
              <p className="p-10 text-center text-rose-300">กำลังโหลดตัวอย่าง… 🎠</p>
            ) : preview ? (
              <>
                <div className="flex items-center justify-between border-b-2 border-rose-100 p-3">
                  <p className="font-bold text-rose-700">ตัวอย่าง: {preview.name}</p>
                  <button
                    type="button"
                    onClick={() => setPreview(null)}
                    className="grid h-8 w-8 place-items-center rounded-full bg-rose-100 text-rose-500"
                    aria-label="ปิดตัวอย่าง"
                  >
                    ✕
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto p-3">
                  <StepRenderer
                    key={preview.slug}
                    steps={preview.stepsSchema.steps}
                    data={preview.templateData}
                    assets={[]}
                  />
                </div>
                <div className="border-t-2 border-rose-100 p-3">
                  <button
                    type="button"
                    onClick={() => {
                      const t = items.find((x) => x.slug === preview.slug);
                      if (t) select(t);
                    }}
                    className="w-full rounded-full bg-rose-500 py-3 text-base font-bold text-white shadow-lg shadow-rose-200 hover:bg-rose-600"
                  >
                    ใช้เทมเพลตนี้ 💝
                  </button>
                </div>
              </>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
