"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useCallback, useEffect, useState } from "react";

import { QrModal } from "@/components/QrModal";
import { isoToThaiDisplay } from "@/lib/thai-date";

type EventItem = {
  id: string;
  name: string;
  eventDate: string | null;
  status: string;
  viewCount: number;
  template: { id: string; slug: string; name: string } | null;
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

  return (
    <main className="min-h-screen bg-gradient-to-b from-pink-50 to-amber-50">
      <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Link href="/" className="text-sm font-semibold text-rose-400">
              🎁 Wish Flow
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
              ตั้ง PIN 6 หลัก 🔒 <span className="font-normal text-rose-400">(แก้ได้ตามใจ)</span>
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
            <p className="mt-3 font-mono text-4xl tracking-[0.3em] text-amber-900">{newPin.pin}</p>
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
                className="rounded-3xl border-2 border-rose-100 bg-white p-4 shadow-sm transition hover:shadow-md sm:p-5"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h2 className="text-lg font-bold text-rose-800">
                      🎂 {event.name}
                      {event.status === "draft" && (
                        <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-500">
                          📝 ฉบับร่าง
                        </span>
                      )}
                    </h2>
                    <p className="mt-1 text-sm text-rose-400">
                      {event.template?.name ?? "ยังไม่เลือกเทมเพลต"} · เปิดดู {event.viewCount} ครั้ง
                      {event.eventDate ? ` · ${isoToThaiDisplay(event.eventDate)}` : ""}
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
