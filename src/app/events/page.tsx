"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useCallback, useEffect, useState } from "react";

import { ExpiredCardOverlay } from "@/components/ExpiredCardOverlay";
import { QrModal } from "@/components/QrModal";
import { isoToThaiDisplay } from "@/lib/thai-date";

type EventItem = {
  id: string;
  name: string;
  eventDate: string | null;
  expiresAt: string | null;
  status: string;
  isExpired: boolean;
  viewCount: number;
  template: { id: string; slug: string; name: string } | null;
  share: {
    listingId: string;
    status: "LISTED" | "UNLISTED";
    heartCount: number;
    useCount: number;
    hasRevisions: boolean;
  } | null;
};

function randomPin() {
  return String(Math.floor(Math.random() * 1_000_000)).padStart(6, "0");
}

function EventsPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [pin, setPin] = useState("");
  const [creating, setCreating] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [newPin, setNewPin] = useState<{ id: string; pin: string } | null>(null);
  const [qr, setQr] = useState<{ title: string; url: string; dataUrl: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [shareEvent, setShareEvent] = useState<EventItem | null>(null);
  const [shareIncludeAssets, setShareIncludeAssets] = useState(false);
  const [shareBlurb, setShareBlurb] = useState("");
  const [sharing, setSharing] = useState(false);
  const [revisions, setRevisions] = useState<
    {
      id: string;
      version: number;
      createdAt: string;
      isCurrent: boolean;
      includeAssets: boolean;
    }[]
  >([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/events");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "โหลดข้อมูลไม่สำเร็จ");
      setEvents(data.events);
    } catch (e) {
      setError(e instanceof Error ? e.message : "โหลดข้อมูลไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (searchParams.get("create") === "1") {
      setShowCreate(true);
      setPin(randomPin());
    }
  }, [searchParams]);

  function openCreate() {
    setShowCreate((v) => {
      if (!v) setPin(randomPin());
      return !v;
    });
  }

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, pin }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "สร้างไม่สำเร็จ");
      setNewPin({ id: data.id, pin: data.pin });
      setName("");
      setShowCreate(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "สร้างไม่สำเร็จ");
    } finally {
      setCreating(false);
    }
  }

  async function onDelete(id: string) {
    if (!confirm("ลบการ์ดนี้เลยไหม? 🗑️")) return;
    const res = await fetch(`/api/events/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "ลบไม่สำเร็จ");
      return;
    }
    await load();
  }

  async function onDuplicate(id: string) {
    setError(null);
    const res = await fetch(`/api/events/${id}/duplicate`, { method: "POST" });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "ทำสำเนาไม่สำเร็จ");
      return;
    }
    setNewPin({ id: data.id, pin: data.pin });
    await load();
  }

  async function openQr(id: string, title: string) {
    const res = await fetch(`/api/events/${id}/qr`);
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "สร้าง QR ไม่สำเร็จ");
      return;
    }
    setQr({ title, url: data.url, dataUrl: data.dataUrl });
  }

  async function openShare(event: EventItem) {
    setShareEvent(event);
    setShareIncludeAssets(false);
    setShareBlurb("");
    setRevisions([]);
    if (event.share?.hasRevisions) {
      const res = await fetch(`/api/events/${event.id}/share/revisions`);
      const data = await res.json();
      if (res.ok) setRevisions(data.revisions ?? []);
    }
  }

  async function publishShare() {
    if (!shareEvent) return;
    setSharing(true);
    setError(null);
    const res = await fetch(`/api/events/${shareEvent.id}/share`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        includeAssets: shareIncludeAssets,
        blurb: shareBlurb || null,
      }),
    });
    const data = await res.json();
    setSharing(false);
    if (!res.ok) {
      setError(data.error || "แชร์ไม่สำเร็จ");
      return;
    }
    setShareEvent(null);
    await load();
  }

  async function unpublishShare(eventId: string) {
    const res = await fetch(`/api/events/${eventId}/share/unpublish`, {
      method: "POST",
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "เลิกแชร์ไม่สำเร็จ");
      return;
    }
    await load();
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-pink-50 to-amber-50">
      <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Link href="/marketplace" className="text-sm font-semibold text-rose-400">
              💝 คลังแชร์
            </Link>
            <h1 className="mt-1 text-2xl font-bold text-rose-700 sm:text-3xl">การ์ดของฉัน</h1>
          </div>
          <button
            type="button"
            onClick={openCreate}
            className="rounded-full bg-rose-500 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-rose-200 transition hover:-translate-y-0.5 hover:bg-rose-600"
          >
            ✨ สร้างการ์ดใหม่
          </button>
        </div>

        {error && (
          <p className="mb-4 rounded-2xl border-2 border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
            😢 {error}
          </p>
        )}

        {showCreate && (
          <form
            onSubmit={onCreate}
            className="mb-6 rounded-3xl border-2 border-rose-100 bg-white p-5 shadow-md sm:p-6"
          >
            <label className="block text-sm font-semibold text-rose-800">
              ชื่อการ์ด 🎂
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                maxLength={120}
                placeholder="สุขสันต์วันเกิดนะ!"
                className="mt-1 w-full rounded-2xl border-2 border-rose-100 px-4 py-3 text-base outline-none focus:border-rose-300"
              />
            </label>
            <label className="mt-4 block text-sm font-semibold text-rose-800">
              ตั้ง PIN 6 หลัก 🔒{" "}
              <span className="font-normal text-rose-400">(แก้ได้ตามใจ)</span>
              <input
                inputMode="numeric"
                pattern="\d{6}"
                maxLength={6}
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
                required
                className="mt-1 w-full rounded-2xl border-2 border-rose-100 px-4 py-3 text-center font-mono text-2xl tracking-[0.4em] outline-none focus:border-rose-300"
              />
            </label>
            <button
              type="submit"
              disabled={creating || pin.length !== 6}
              className="mt-4 w-full rounded-2xl bg-rose-500 px-4 py-3 text-base font-semibold text-white shadow-md shadow-rose-200 hover:bg-rose-600 disabled:opacity-50 sm:w-auto sm:px-8"
            >
              {creating ? "กำลังสร้าง…" : "สร้างเลย 🎉"}
            </button>
          </form>
        )}

        {newPin && (
          <div className="mb-6 rounded-3xl border-2 border-amber-200 bg-amber-50 p-5 sm:p-6">
            <p className="text-base font-bold text-amber-900">🔑 จด PIN นี้ไว้นะ</p>
            <p className="mt-1 text-sm text-amber-700">เพื่อนต้องใช้ PIN นี้เปิดการ์ด</p>
            <p className="mt-3 font-mono text-4xl tracking-[0.3em] text-amber-900">
              {newPin.pin}
            </p>
            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                onClick={() => router.push(`/events/${newPin.id}/edit`)}
                className="rounded-2xl bg-amber-500 px-5 py-3 text-sm font-semibold text-white shadow-md hover:bg-amber-600"
              >
                🎨 แต่งการ์ดต่อ
              </button>
              <button
                type="button"
                onClick={() => setNewPin(null)}
                className="rounded-2xl border-2 border-amber-200 bg-white px-5 py-3 text-sm font-semibold text-amber-800"
              >
                ปิด
              </button>
            </div>
          </div>
        )}

        {loading ? (
          <p className="text-center text-rose-300">กำลังโหลด… 🎈</p>
        ) : events.length === 0 ? (
          <div className="rounded-3xl border-2 border-dashed border-rose-200 bg-white/60 p-10 text-center">
            <p className="text-4xl">🎈</p>
            <p className="mt-2 text-rose-400">ยังไม่มีการ์ด กดสร้างการ์ดแรกเลย!</p>
          </div>
        ) : (
          <ul className="space-y-3">
            {events.map((event) => (
              <li
                key={event.id}
                className="relative overflow-hidden rounded-3xl border-2 border-rose-100 bg-white p-4 shadow-sm transition hover:shadow-md sm:p-5"
              >
                {event.isExpired && <ExpiredCardOverlay compact />}
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h2 className="text-lg font-bold text-rose-800">
                      🎂 {event.name}
                      {event.status === "draft" && !event.isExpired && (
                        <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-500">
                          📝 ฉบับร่าง
                        </span>
                      )}
                      {event.isExpired && (
                        <span className="ml-2 rounded-full bg-slate-800/80 px-2 py-0.5 text-xs font-semibold text-white">
                          หมดอายุ
                        </span>
                      )}
                      {event.share?.status === "LISTED" && (
                        <span className="ml-2 rounded-full bg-pink-100 px-2 py-0.5 text-xs font-semibold text-pink-600">
                          แชร์แล้ว ♥{event.share.heartCount} · {event.share.useCount} คน
                        </span>
                      )}
                    </h2>
                    <p className="mt-1 text-sm text-rose-400">
                      {event.template?.name ?? "ยังไม่เลือกเทมเพลต"} · เปิดดู{" "}
                      {event.viewCount} ครั้ง
                      {event.eventDate ? ` · ${isoToThaiDisplay(event.eventDate)}` : ""}
                      {event.expiresAt
                        ? ` · หมดอายุ ${isoToThaiDisplay(event.expiresAt)}`
                        : ""}
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
                    <Link
                      href={`/e/${event.id}`}
                      className="rounded-xl border-2 border-rose-100 px-3 py-2 text-center text-sm font-medium text-rose-600 hover:bg-rose-50"
                    >
                      👀 ดู
                    </Link>
                    <Link
                      href={`/events/${event.id}/edit`}
                      className="rounded-xl border-2 border-rose-100 px-3 py-2 text-center text-sm font-medium text-rose-600 hover:bg-rose-50"
                    >
                      🎨 แก้ไข
                    </Link>
                    <button
                      type="button"
                      onClick={() => openQr(event.id, event.name)}
                      className="rounded-xl border-2 border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-600 hover:bg-rose-100"
                    >
                      📱 QR
                    </button>
                    <button
                      type="button"
                      onClick={() => onDuplicate(event.id)}
                      className="rounded-xl border-2 border-rose-100 px-3 py-2 text-sm font-medium text-rose-600 hover:bg-rose-50"
                    >
                      📋 สำเนา
                    </button>
                    <button
                      type="button"
                      onClick={() => openShare(event)}
                      className="rounded-xl border-2 border-pink-200 px-3 py-2 text-sm font-medium text-pink-600 hover:bg-pink-50"
                    >
                      💝 แชร์
                    </button>
                    {event.share?.status === "LISTED" && (
                      <button
                        type="button"
                        onClick={() => unpublishShare(event.id)}
                        className="rounded-xl border-2 border-slate-200 px-3 py-2 text-sm font-medium text-slate-500 hover:bg-slate-50"
                      >
                        เลิกแชร์
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => onDelete(event.id)}
                      className="rounded-xl border-2 border-red-100 px-3 py-2 text-sm font-medium text-red-500 hover:bg-red-50"
                    >
                      🗑️ ลบ
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <QrModal
        open={!!qr}
        onClose={() => setQr(null)}
        title={qr?.title ?? ""}
        url={qr?.url ?? ""}
        dataUrl={qr?.dataUrl ?? ""}
      />

      {shareEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-3xl border-2 border-pink-200 bg-white p-6 shadow-xl">
            <h2 className="text-lg font-bold text-pink-700">แชร์ไปคลังการ์ด 💝</h2>
            <p className="mt-2 text-sm text-pink-500">
              จะสร้างเวอร์ชันคงที่จากสถานะปัจจุบัน —
              แก้การ์ดทีหลังไม่กระทบจนกดแชร์อีกครั้ง
            </p>
            <label className="mt-4 block text-sm font-semibold text-rose-800">
              คำอธิบายสั้น ๆ (ไม่บังคับ)
              <textarea
                value={shareBlurb}
                onChange={(e) => setShareBlurb(e.target.value)}
                maxLength={500}
                rows={2}
                className="mt-1 w-full rounded-2xl border-2 border-rose-100 px-3 py-2 text-sm outline-none focus:border-rose-300"
              />
            </label>
            <label className="mt-3 flex items-start gap-2 text-sm text-rose-700">
              <input
                type="checkbox"
                checked={shareIncludeAssets}
                onChange={(e) => setShareIncludeAssets(e.target.checked)}
                className="mt-1"
              />
              <span>
                <b>รวมรูปภาพ</b> ไปกับเวอร์ชันที่แชร์
                <span className="block text-xs text-rose-400">
                  ถ้าไม่ติ๊ก จะแชร์เฉพาะโครง/ข้อความ (แนะนำสำหรับรูปส่วนตัว)
                </span>
              </span>
            </label>
            {revisions.length > 0 && (
              <div className="mt-4 rounded-2xl bg-rose-50 p-3">
                <p className="text-xs font-semibold text-rose-500">
                  ประวัติเวอร์ชันที่เคยแชร์
                </p>
                <ul className="mt-2 max-h-28 space-y-1 overflow-y-auto text-xs text-rose-600">
                  {revisions.map((r) => (
                    <li key={r.id}>
                      รุ่น {r.version}
                      {r.isCurrent ? " (ปัจจุบัน)" : ""} ·{" "}
                      {new Date(r.createdAt).toLocaleString("th-TH")}
                      {r.includeAssets ? " · มีรูป" : ""}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => setShareEvent(null)}
                className="flex-1 rounded-full border-2 border-rose-200 px-4 py-2.5 text-sm font-semibold text-rose-600"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                disabled={sharing}
                onClick={publishShare}
                className="flex-1 rounded-full bg-pink-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-pink-600 disabled:opacity-50"
              >
                {sharing ? "กำลังเผยแพร่…" : "เผยแพร่เวอร์ชันนี้"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

export default function EventsPage() {
  return (
    <Suspense fallback={<main className="p-8 text-center text-rose-300">กำลังโหลด… 🎈</main>}>
      <EventsPageInner />
    </Suspense>
  );
}
