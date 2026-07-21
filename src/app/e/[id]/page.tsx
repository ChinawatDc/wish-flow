"use client";

import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "del"] as const;

export default function GuestPinPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params.id;

  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [wobble, setWobble] = useState(false);
  const [pressed, setPressed] = useState<string | null>(null);

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

  // keyboard support for desktop
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (/^\d$/.test(e.key)) press(e.key);
      if (e.key === "Backspace") press("del");
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [press]);

  return (
    <main className="min-h-screen bg-gradient-to-b from-pink-100 via-rose-50 to-amber-50">
      <div className="mx-auto flex min-h-screen w-full max-w-sm flex-col items-center justify-center px-4 py-8">
        <div className="animate-float text-6xl">💝</div>
        <h1 className="mt-4 text-2xl font-bold text-rose-600 sm:text-3xl">มีของขวัญรอคุณอยู่!</h1>
        <p className="mt-1 text-sm text-rose-400">กรอก PIN 6 หลักเพื่อเปิดดู</p>

        {/* PIN dots */}
        <div
          className={`mt-6 flex gap-3 ${wobble ? "animate-wobble" : ""}`}
          aria-label={`กรอกแล้ว ${pin.length} จาก 6 หลัก`}
        >
          {Array.from({ length: 6 }).map((_, i) => (
            <span
              key={i}
              className={`h-5 w-5 rounded-full border-2 transition-all duration-150 ${
                i < pin.length
                  ? "scale-110 border-rose-400 bg-rose-400"
                  : "border-rose-200 bg-white"
              }`}
            />
          ))}
        </div>

        {error && (
          <p className="mt-4 rounded-2xl border-2 border-red-200 bg-red-50 px-4 py-2.5 text-center text-sm text-red-500">
            {error}
          </p>
        )}
        {loading && <p className="mt-4 text-sm text-rose-400">กำลังตรวจสอบ… 🔍</p>}

        {/* numpad */}
        <div className="mt-8 grid w-full max-w-[280px] grid-cols-3 gap-3">
          {KEYS.map((key, idx) =>
            key === "" ? (
              <span key={`sp-${idx}`} />
            ) : (
              <button
                key={key}
                type="button"
                onClick={() => press(key)}
                disabled={loading}
                aria-label={key === "del" ? "ลบ" : key}
                className={`aspect-square rounded-full border-2 text-2xl font-bold shadow-sm transition active:scale-90 disabled:opacity-40 ${
                  pressed === key ? "animate-pop" : ""
                } ${
                  key === "del"
                    ? "border-amber-200 bg-amber-50 text-amber-600 hover:bg-amber-100"
                    : "border-rose-200 bg-white text-rose-600 hover:bg-rose-50"
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
