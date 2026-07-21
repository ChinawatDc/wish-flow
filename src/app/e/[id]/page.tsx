"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { ExpiredCardOverlay } from "@/components/ExpiredCardOverlay";

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "del"] as const;

type PublicMeta = {
  name: string;
  canSubmit: boolean;
  guestAccessMode: "PIN" | "PUBLIC";
  guestbookEnabled: boolean;
  reason?: string;
};

export default function GuestPinPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params.id;

  const [mode, setMode] = useState<"loading" | "PIN" | "PUBLIC">("loading");
  const [publicMeta, setPublicMeta] = useState<PublicMeta | null>(null);
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [expired, setExpired] = useState(false);
  const [loading, setLoading] = useState(false);
  const [wobble, setWobble] = useState(false);
  const [pressed, setPressed] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/e/${id}/guestbook`);
        if (!res.ok) {
          setMode("PIN");
          return;
        }
        const data = (await res.json()) as PublicMeta;
        setPublicMeta(data);
        if (data.reason === "expired") setExpired(true);
        if (data.guestAccessMode === "PUBLIC") {
          setMode("PUBLIC");
        } else {
          setMode("PIN");
        }
      } catch {
        setMode("PIN");
      }
    })();
  }, [id]);

  const submit = useCallback(
    async (fullPin: string) => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/e/${id}/verify-pin`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pin: fullPin }),
        });
        const data = await res.json();
        if (res.status === 410) {
          setExpired(true);
          setError(data.error || "อีเวนต์นี้หมดอายุแล้ว");
          setPin("");
          return;
        }
        if (res.status === 429) {
          setError(`ลองหลายครั้งเกินไป รออีก ${data.retryAfterSeconds ?? "สักครู่"} วินาทีนะ 🥺`);
          setPin("");
          return;
        }
        if (!res.ok) {
          setError(data.error || "PIN ไม่ถูกต้อง ลองใหม่นะ");
          setPin("");
          setWobble(true);
          setTimeout(() => setWobble(false), 500);
          return;
        }
        router.push(data.redirect || `/e/${id}/view`);
      } catch {
        setError("มีบางอย่างผิดพลาด ลองใหม่อีกครั้งนะ");
        setPin("");
      } finally {
        setLoading(false);
      }
    },
    [id, router],
  );

  const press = useCallback(
    (key: string) => {
      if (loading) return;
      setPressed(key);
      setTimeout(() => setPressed(null), 180);

      if (key === "del") {
        setPin((p) => p.slice(0, -1));
        return;
      }
      setPin((p) => {
        if (p.length >= 6) return p;
        const next = p + key;
        if (next.length === 6) void submit(next);
        return next;
      });
    },
    [loading, submit],
  );

  useEffect(() => {
    if (mode !== "PIN") return;
    function onKey(e: KeyboardEvent) {
      if (/^\d$/.test(e.key)) press(e.key);
      if (e.key === "Backspace") press("del");
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [press, mode]);

  async function enterPublicCard() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/e/${id}/public-enter`, { method: "POST" });
      const data = await res.json();
      if (res.status === 410) {
        setExpired(true);
        setError(data.error);
        return;
      }
      if (!res.ok) {
        setError(data.error || "เข้าชมไม่สำเร็จ");
        return;
      }
      router.push(data.redirect || `/e/${id}/view`);
    } catch {
      setError("มีบางอย่างผิดพลาด ลองใหม่อีกครั้งนะ");
    } finally {
      setLoading(false);
    }
  }

  if (mode === "loading") {
    return (
      <main className="grid min-h-screen place-items-center bg-gradient-to-b from-pink-100 to-amber-50 text-rose-300">
        กำลังโหลด…
      </main>
    );
  }

  if (mode === "PUBLIC") {
    return (
      <main className="relative min-h-screen bg-gradient-to-b from-rose-100 via-amber-50 to-stone-50">
        {expired && <ExpiredCardOverlay />}
        <div className="mx-auto flex min-h-screen w-full max-w-md flex-col items-center justify-center px-4 py-10 text-center">
          <p className="text-6xl">💍</p>
          <h1 className="mt-4 font-[family-name:var(--font-mali)] text-3xl font-bold text-rose-800">
            {publicMeta?.name || "คำเชิญ"}
          </h1>
          <p className="mt-2 text-sm text-rose-500">
            ยินดีต้อนรับ — แชร์คำอวยพรและร่วมเป็นสักขีพยานความสุขได้ที่นี่
          </p>
          {error && (
            <p className="mt-4 rounded-2xl border-2 border-red-200 bg-red-50 px-4 py-2 text-sm text-red-600">
              {error}
            </p>
          )}
          <div className="mt-8 flex w-full flex-col gap-3">
            {publicMeta?.guestbookEnabled && (
              <Link
                href={`/e/${id}/guestbook`}
                className="rounded-full bg-rose-500 py-3.5 text-base font-bold text-white shadow-lg shadow-rose-200"
              >
                เขียนในสมุดอวยพร
              </Link>
            )}
            <button
              type="button"
              disabled={loading || expired}
              onClick={() => void enterPublicCard()}
              className="rounded-full border-2 border-rose-200 bg-white/80 py-3.5 text-base font-semibold text-rose-600 disabled:opacity-50"
            >
              {loading ? "กำลังเปิด…" : "ดูการ์ด"}
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="relative min-h-screen bg-gradient-to-b from-pink-100 via-rose-50 to-amber-50">
      {expired && <ExpiredCardOverlay />}
      <div className="mx-auto flex min-h-screen w-full max-w-sm flex-col items-center justify-center px-4 py-8">
        <div className="animate-float text-6xl">💝</div>
        <h1 className="mt-4 text-2xl font-bold text-rose-600 sm:text-3xl">มีของขวัญรอคุณอยู่!</h1>
        <p className="mt-1 text-sm text-rose-400">กรอก PIN 6 หลักเพื่อเปิดดู</p>

        <div
          className={`mt-8 flex gap-3 ${wobble ? "animate-wobble" : ""}`}
          aria-label="PIN"
        >
          {Array.from({ length: 6 }).map((_, i) => (
            <span
              key={i}
              className={`grid h-3.5 w-3.5 place-items-center rounded-full transition ${
                i < pin.length ? "scale-125 bg-rose-500" : "bg-rose-200"
              }`}
            />
          ))}
        </div>

        {error && (
          <p className="mt-4 text-center text-sm text-red-500" role="alert">
            {error}
          </p>
        )}

        <div className="mt-8 grid w-full grid-cols-3 gap-3">
          {KEYS.map((key, idx) =>
            key === "" ? (
              <span key={`empty-${idx}`} />
            ) : (
              <button
                key={key}
                type="button"
                disabled={loading}
                onClick={() => press(key)}
                className={`rounded-2xl bg-white/80 py-4 text-2xl font-semibold text-rose-700 shadow-sm transition active:scale-95 ${
                  pressed === key ? "bg-rose-100" : ""
                }`}
              >
                {key === "del" ? "⌫" : key}
              </button>
            ),
          )}
        </div>
      </div>
    </main>
  );
}
