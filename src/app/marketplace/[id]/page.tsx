"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { StepRenderer } from "@/components/steps/StepRenderer";

type CardDetail = {
  id: string;
  title: string;
  blurb: string | null;
  includeAssets: boolean;
  heartCount: number;
  useCount: number;
  owner: { name: string };
  heartedByMe: boolean;
  isOwn: boolean;
  revision: {
    id: string;
    version: number;
    name: string;
    templateData: Record<string, unknown>;
    assets: { id: string; url: string; sortOrder: number }[];
    template: { id: string; slug: string; name: string } | null;
    stepsSchema: { steps: Array<Record<string, unknown>> } | null;
    settings: Record<string, unknown>;
  };
};

export default function MarketplaceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [card, setCard] = useState<CardDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/marketplace/cards/${id}`);
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "โหลดไม่สำเร็จ");
      setLoading(false);
      return;
    }
    setCard(data.card);
    setLoading(false);
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function toggleHeart() {
    if (!card) return;
    setBusy(true);
    const res = await fetch(`/api/marketplace/cards/${card.id}/heart`, {
      method: "POST",
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(data.error || "กดหัวใจไม่สำเร็จ");
      return;
    }
    setCard({ ...card, heartedByMe: data.hearted, heartCount: data.heartCount });
  }

  async function applyCard() {
    if (!card) return;
    setBusy(true);
    const res = await fetch(`/api/marketplace/cards/${card.id}/use`, {
      method: "POST",
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(data.error || "นำไปใช้ไม่สำเร็จ");
      return;
    }
    router.push(`/events/${data.eventId}/edit`);
  }

  if (loading) {
    return (
      <main className="grid min-h-screen place-items-center text-rose-300">
        กำลังโหลด…
      </main>
    );
  }

  if (!card) {
    return (
      <main className="mx-auto max-w-lg px-4 py-12 text-center">
        <p className="text-rose-500">{error || "ไม่พบการ์ด"}</p>
        <Link href="/marketplace" className="mt-4 inline-block text-rose-600 underline">
          ← กลับคลังแชร์
        </Link>
      </main>
    );
  }

  const steps = card.revision.stepsSchema?.steps ?? [];

  return (
    <main className="min-h-screen bg-gradient-to-b from-rose-50 to-amber-50">
      <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6">
        <Link href="/marketplace" className="text-sm font-semibold text-rose-500">
          ← คลังแชร์
        </Link>
        <h1 className="mt-3 text-2xl font-bold text-rose-800">{card.title}</h1>
        <p className="mt-1 text-sm text-rose-400">
          โดย {card.owner.name} · รุ่น {card.revision.version}
          {card.includeAssets ? " · รวมรูปภาพ" : " · ไม่รวมรูป"}
        </p>
        {card.blurb && <p className="mt-3 text-rose-600">{card.blurb}</p>}

        {error && (
          <p className="mt-4 rounded-2xl border-2 border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
            {error}
          </p>
        )}

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={toggleHeart}
            className={`rounded-full border-2 px-4 py-2 text-sm font-semibold ${
              card.heartedByMe
                ? "border-rose-400 bg-rose-500 text-white"
                : "border-rose-200 text-rose-600 hover:bg-rose-50"
            }`}
          >
            {card.heartedByMe ? "♥ ถูกใจแล้ว" : "♡ กดหัวใจ"} ({card.heartCount})
          </button>
          <span className="rounded-full border-2 border-rose-100 bg-white px-4 py-2 text-sm text-rose-500">
            นำไปใช้แล้ว {card.useCount} คน
          </span>
          {!card.isOwn && (
            <button
              type="button"
              disabled={busy}
              onClick={applyCard}
              className="rounded-full bg-rose-500 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-600 disabled:opacity-50"
            >
              นำไปใช้เป็นการ์ดของฉัน
            </button>
          )}
        </div>

        <div className="mt-8 overflow-hidden rounded-3xl border-2 border-rose-100 bg-white shadow-sm">
          <p className="border-b border-rose-50 px-4 py-2 text-xs font-semibold text-rose-400">
            ตัวอย่างพรีวิว (ไม่ใช่ลิงก์ PIN จริง)
          </p>
          {steps.length > 0 ? (
            <div className="p-2">
              <StepRenderer
                steps={steps as never}
                data={card.revision.templateData}
                assets={card.revision.assets}
              />
            </div>
          ) : (
            <p className="p-8 text-center text-rose-300">ไม่มีขั้นตอนให้พรีวิว</p>
          )}
        </div>
      </div>
    </main>
  );
}
