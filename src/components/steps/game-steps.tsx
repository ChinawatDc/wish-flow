"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import {
  AssetImage,
  field,
  NextButton,
  StepShell,
  type StepComponentProps,
} from "./shared";

function SkipLink({ onNext }: { onNext: () => void }) {
  return (
    <button type="button" onClick={onNext} className="text-sm text-rose-300 underline">
      ข้ามเกมนี้
    </button>
  );
}

/* ---------- แตะลูกโป่ง ---------- */

export function TapBalloonStep({ data, onNext, isLast }: StepComponentProps) {
  const message = field(data, "balloon_message");
  const TOTAL = 6;
  const [popped, setPopped] = useState<Set<number>>(new Set());
  const done = popped.size >= TOTAL;

  const balloons = useMemo(
    () =>
      Array.from({ length: TOTAL }, (_, i) => ({
        id: i,
        left: 8 + ((i * 37) % 70),
        delay: (i * 0.35) % 2,
        color: ["🎈", "🩷", "💛", "💙", "💚", "🧡"][i % 6],
      })),
    [],
  );

  return (
    <StepShell>
      <h2 className="text-xl font-bold text-rose-700">
        {done ? "เก่งมาก! 🎉" : `แตะลูกโป่งให้แตกครบ ${TOTAL} ลูก! (${popped.size}/${TOTAL})`}
      </h2>
      {!done ? (
        <>
          <div className="relative h-72 w-full max-w-sm overflow-hidden rounded-3xl border-2 border-rose-100 bg-gradient-to-b from-sky-50 to-rose-50">
            {balloons.map((b) =>
              popped.has(b.id) ? null : (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => setPopped((s) => new Set(s).add(b.id))}
                  className="animate-float absolute text-5xl transition active:scale-125"
                  style={{ left: `${b.left}%`, top: `${15 + ((b.id * 23) % 55)}%`, animationDelay: `${b.delay}s` }}
                  aria-label={`ลูกโป่งลูกที่ ${b.id + 1}`}
                >
                  {b.color === "🎈" ? "🎈" : "🎈"}
                </button>
              ),
            )}
          </div>
          <SkipLink onNext={onNext} />
        </>
      ) : (
        <>
          <p className="max-w-md text-lg text-rose-900">
            {message || "นี่คือคำอวยพรของเธอ 🎈 ขอให้มีความสุขมากๆ!"}
          </p>
          <NextButton onNext={onNext} isLast={isLast} />
        </>
      )}
    </StepShell>
  );
}

/* ---------- เก็บหัวใจ ---------- */

export function CatchHeartStep({ data, onNext, isLast }: StepComponentProps) {
  const message = field(data, "heart_message");
  const GOAL = 5;
  const [caught, setCaught] = useState(0);
  const [hearts, setHearts] = useState<{ id: number; left: number; top: number }[]>([]);
  const nextId = useRef(0);
  const done = caught >= GOAL;

  useEffect(() => {
    if (done) return;
    const timer = setInterval(() => {
      setHearts((prev) => {
        const trimmed = prev.length > 6 ? prev.slice(1) : prev;
        return [
          ...trimmed,
          {
            id: nextId.current++,
            left: 10 + Math.random() * 75,
            top: 10 + Math.random() * 70,
          },
        ];
      });
    }, 700);
    return () => clearInterval(timer);
  }, [done]);

  return (
    <StepShell>
      <h2 className="text-xl font-bold text-rose-700">
        {done ? "เก็บครบแล้ว! 💕" : `แตะเก็บหัวใจให้ครบ ${GOAL} ดวง (${caught}/${GOAL})`}
      </h2>
      {!done ? (
        <>
          <div className="relative h-72 w-full max-w-sm overflow-hidden rounded-3xl border-2 border-rose-100 bg-gradient-to-b from-rose-50 to-pink-100">
            {hearts.map((h) => (
              <button
                key={h.id}
                type="button"
                onClick={() => {
                  setHearts((prev) => prev.filter((x) => x.id !== h.id));
                  setCaught((c) => c + 1);
                }}
                className="absolute text-4xl transition active:scale-150"
                style={{ left: `${h.left}%`, top: `${h.top}%` }}
                aria-label="เก็บหัวใจ"
              >
                💗
              </button>
            ))}
          </div>
          <SkipLink onNext={onNext} />
        </>
      ) : (
        <>
          <p className="max-w-md text-lg text-rose-900">
            {message || "รักเธอที่สุดเลย 💕"}
          </p>
          <NextButton onNext={onNext} isLast={isLast} />
        </>
      )}
    </StepShell>
  );
}

/* ---------- จับคู่ภาพ ---------- */

export function MemoryMatchStep({ data, assets, onNext, isLast }: StepComponentProps) {
  const message = field(data, "match_message");
  const EMOJIS = ["🎂", "🎁", "🎈", "🌸"];

  const cards = useMemo(() => {
    const sources =
      assets.length >= 2
        ? assets.slice(0, 4).map((a) => ({ key: a.id, asset: a, emoji: "" }))
        : EMOJIS.map((e) => ({ key: e, asset: undefined, emoji: e }));
    const doubled = [...sources, ...sources].map((s, i) => ({ ...s, cardId: i }));
    for (let i = doubled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [doubled[i], doubled[j]] = [doubled[j], doubled[i]];
    }
    return doubled;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [flipped, setFlipped] = useState<number[]>([]);
  const [matched, setMatched] = useState<Set<string>>(new Set());
  const done = matched.size >= cards.length / 2;

  function flip(cardId: number) {
    if (flipped.length === 2 || flipped.includes(cardId)) return;
    const next = [...flipped, cardId];
    setFlipped(next);
    if (next.length === 2) {
      const [a, b] = next.map((id) => cards.find((c) => c.cardId === id)!);
      if (a.key === b.key) {
        setMatched((m) => new Set(m).add(a.key));
        setFlipped([]);
      } else {
        setTimeout(() => setFlipped([]), 800);
      }
    }
  }

  return (
    <StepShell>
      <h2 className="text-xl font-bold text-rose-700">
        {done ? "ความจำดีมาก! 🧠✨" : "จับคู่ภาพให้ครบ!"}
      </h2>
      {!done ? (
        <>
          <div className="grid grid-cols-4 gap-2">
            {cards.map((card) => {
              const isUp = flipped.includes(card.cardId) || matched.has(card.key);
              return (
                <button
                  key={card.cardId}
                  type="button"
                  onClick={() => flip(card.cardId)}
                  className={`h-16 w-16 overflow-hidden rounded-xl border-2 text-3xl transition sm:h-20 sm:w-20 ${
                    isUp ? "border-rose-300 bg-white" : "border-rose-200 bg-rose-300"
                  }`}
                  aria-label={isUp ? "การ์ดเปิดอยู่" : "เปิดการ์ด"}
                >
                  {isUp ? (
                    card.asset ? (
                      <AssetImage asset={card.asset} className="h-full w-full object-cover" />
                    ) : (
                      card.emoji
                    )
                  ) : (
                    "💟"
                  )}
                </button>
              );
            })}
          </div>
          <SkipLink onNext={onNext} />
        </>
      ) : (
        <>
          <p className="max-w-md text-lg text-rose-900">
            {message || "สุขสันต์วันเกิดนะ!"}
          </p>
          <NextButton onNext={onNext} isLast={isLast} />
        </>
      )}
    </StepShell>
  );
}

/* ---------- ควิซ ---------- */

export function QuizStep({ data, onNext, isLast }: StepComponentProps) {
  const question = field(data, "quiz_question") || "วันเกิดใครเอ่ย?";
  const options = [
    field(data, "quiz_option_1") || "ของเธอไง",
    field(data, "quiz_option_2") || "ของฉัน",
    field(data, "quiz_option_3") || "ของแมว",
  ];
  const correct = Number(field(data, "quiz_correct") || "1") - 1;
  const [picked, setPicked] = useState<number | null>(null);
  const done = picked === correct;

  return (
    <StepShell>
      <p className="text-4xl">🤔</p>
      <h2 className="max-w-md text-xl font-bold text-rose-700 sm:text-2xl">{question}</h2>
      <div className="flex w-full max-w-xs flex-col gap-2">
        {options.map((opt, i) => (
          <button
            key={i}
            type="button"
            onClick={() => setPicked(i)}
            disabled={done}
            className={`rounded-2xl border-2 px-4 py-3 text-base font-medium transition ${
              picked === i
                ? i === correct
                  ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                  : "animate-wobble border-red-200 bg-red-50 text-red-500"
                : "border-rose-100 bg-white text-rose-700 hover:bg-rose-50"
            }`}
          >
            {opt}
          </button>
        ))}
      </div>
      {done ? (
        <NextButton onNext={onNext} isLast={isLast} label="ถูกต้อง! ไปต่อ 🎉" />
      ) : (
        <SkipLink onNext={onNext} />
      )}
    </StepShell>
  );
}

/* ---------- วงล้อ ---------- */

export function SpinWheelStep({ data, onNext, isLast }: StepComponentProps) {
  const wishes = (field(data, "wheel_wishes") || "ขอให้มีความสุข, ขอให้รวย, ขอให้สุขภาพดี, ขอให้สมหวัง")
    .split(",")
    .map((w) => w.trim())
    .filter(Boolean);
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  function spin() {
    if (spinning) return;
    setSpinning(true);
    setResult(null);
    setTimeout(() => {
      setResult(wishes[Math.floor(Math.random() * wishes.length)]);
      setSpinning(false);
    }, 1600);
  }

  return (
    <StepShell>
      <h2 className="text-xl font-bold text-rose-700">หมุนวงล้อรับคำอวยพร!</h2>
      <div
        className={`grid h-40 w-40 place-items-center rounded-full border-8 border-rose-300 bg-gradient-to-br from-rose-100 to-amber-100 text-6xl shadow-xl ${
          spinning ? "animate-spin" : ""
        }`}
      >
        🎡
      </div>
      {result ? (
        <>
          <p className="animate-pop max-w-md rounded-2xl border-2 border-amber-200 bg-amber-50 px-6 py-4 text-lg font-semibold text-amber-800">
            ✨ {result} ✨
          </p>
          <NextButton onNext={onNext} isLast={isLast} />
        </>
      ) : (
        <>
          <button
            type="button"
            onClick={spin}
            disabled={spinning}
            className="rounded-full bg-rose-500 px-8 py-3.5 text-base font-semibold text-white shadow-lg shadow-rose-200 hover:bg-rose-600 disabled:opacity-60"
          >
            {spinning ? "กำลังหมุน…" : "หมุนเลย! 🎡"}
          </button>
          <SkipLink onNext={onNext} />
        </>
      )}
    </StepShell>
  );
}

/* ---------- หาของขวัญ ---------- */

export function FindGiftStep({ data, onNext, isLast }: StepComponentProps) {
  const message = field(data, "gift_message");
  const winner = useMemo(() => Math.floor(Math.random() * 9), []);
  const [picks, setPicks] = useState<Set<number>>(new Set());
  const found = picks.has(winner);

  return (
    <StepShell>
      <h2 className="text-xl font-bold text-rose-700">
        {found ? "เจอแล้ว! 🎁" : "ของขวัญซ่อนอยู่กล่องไหนนะ?"}
      </h2>
      {!found ? (
        <>
          <div className="grid grid-cols-3 gap-3">
            {Array.from({ length: 9 }, (_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setPicks((s) => new Set(s).add(i))}
                disabled={picks.has(i)}
                className={`h-20 w-20 rounded-2xl border-2 text-4xl transition active:scale-90 sm:h-24 sm:w-24 ${
                  picks.has(i)
                    ? "border-slate-200 bg-slate-50 opacity-50"
                    : "border-rose-200 bg-white hover:bg-rose-50"
                }`}
                aria-label={`กล่องที่ ${i + 1}`}
              >
                {picks.has(i) ? "💨" : "📦"}
              </button>
            ))}
          </div>
          <SkipLink onNext={onNext} />
        </>
      ) : (
        <>
          <p className="animate-pop text-6xl">🎁✨</p>
          <p className="max-w-md text-lg text-rose-900">
            {message || "ของขวัญของเธอคือความสุขตลอดปี!"}
          </p>
          <NextButton onNext={onNext} isLast={isLast} />
        </>
      )}
    </StepShell>
  );
}

/* ---------- คอนเฟตติ ---------- */

export function ConfettiPopStep({ data, onNext, isLast }: StepComponentProps) {
  const message = field(data, "confetti_message");
  const [pops, setPops] = useState(0);
  const GOAL = 3;
  const done = pops >= GOAL;

  return (
    <StepShell>
      <h2 className="text-xl font-bold text-rose-700">
        {done ? "ปาร์ตี้! 🎉🎊" : `แตะปล่อยคอนเฟตติ ${GOAL} ครั้ง! (${pops}/${GOAL})`}
      </h2>
      <button
        type="button"
        onClick={() => setPops((p) => Math.min(p + 1, GOAL))}
        disabled={done}
        className={`text-8xl transition active:scale-125 ${done ? "" : "animate-float"}`}
        aria-label="ปล่อยคอนเฟตติ"
      >
        {done ? "🎊🎉🎊" : "🎉"}
      </button>
      {done ? (
        <>
          <p className="max-w-md text-lg text-rose-900">{message || "ปาร์ตี้เริ่มแล้ว!"}</p>
          <NextButton onNext={onNext} isLast={isLast} />
        </>
      ) : (
        <SkipLink onNext={onNext} />
      )}
    </StepShell>
  );
}
