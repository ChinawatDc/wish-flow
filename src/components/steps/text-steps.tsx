"use client";

import { useEffect, useState } from "react";

import { field, NextButton, StepShell, type StepComponentProps } from "./shared";

export function GiftBoxStep({ data, onNext, isLast }: StepComponentProps) {
  const [opened, setOpened] = useState(false);
  const title = field(data, "title_text");

  return (
    <StepShell>
      <button
        type="button"
        onClick={() => setOpened(true)}
        className={`text-7xl transition duration-500 sm:text-8xl ${opened ? "scale-110 rotate-6" : "animate-bounce"}`}
        aria-label="เปิดกล่องของขวัญ"
      >
        {opened ? "🎁✨" : "🎁"}
      </button>
      <h2 className="max-w-md text-2xl font-bold text-rose-700 sm:text-3xl">
        {title || "มีเซอร์ไพรส์รอคุณอยู่!"}
      </h2>
      {opened ? (
        <NextButton onNext={onNext} isLast={isLast} />
      ) : (
        <p className="text-sm text-rose-400">แตะกล่องของขวัญเพื่อเปิด</p>
      )}
    </StepShell>
  );
}

export function TextRevealStep({ data, onNext, isLast }: StepComponentProps) {
  const message = field(data, "message_text");
  const sender = field(data, "sender_name");

  return (
    <StepShell>
      <p className="text-4xl">💌</p>
      <p className="max-w-lg text-xl leading-relaxed text-rose-900 sm:text-2xl">
        {message || "ขอให้มีความสุขมากๆ นะ"}
      </p>
      {sender ? (
        <p className="text-base font-semibold text-rose-500 sm:text-lg">— {sender}</p>
      ) : null}
      <NextButton onNext={onNext} isLast={isLast} />
    </StepShell>
  );
}

export function TypewriterStep({ data, onNext, isLast }: StepComponentProps) {
  const text = field(data, "typewriter_text") || "สุขสันต์วันเกิดนะ...";
  const sender = field(data, "sender_name");
  const [shown, setShown] = useState(0);
  const done = shown >= text.length;

  useEffect(() => {
    const timer = setInterval(() => {
      setShown((n) => {
        if (n >= text.length) {
          clearInterval(timer);
          return n;
        }
        return n + 1;
      });
    }, 70);
    return () => clearInterval(timer);
  }, [text.length]);

  return (
    <StepShell>
      <p className="text-4xl">⌨️</p>
      <p className="min-h-[6rem] max-w-lg text-xl leading-relaxed text-rose-900 sm:text-2xl">
        {text.slice(0, shown)}
        {!done && <span className="animate-pulse">|</span>}
      </p>
      {done && sender ? (
        <p className="text-base font-semibold text-rose-500">— {sender}</p>
      ) : null}
      {done ? (
        <NextButton onNext={onNext} isLast={isLast} />
      ) : (
        <button
          type="button"
          onClick={() => setShown(text.length)}
          className="text-sm text-rose-300 underline"
        >
          แสดงทั้งหมด
        </button>
      )}
    </StepShell>
  );
}

export function EnvelopeStep({ data, onNext, isLast }: StepComponentProps) {
  const [opened, setOpened] = useState(false);
  const message = field(data, "envelope_message");
  const sender = field(data, "sender_name");

  return (
    <StepShell>
      {!opened ? (
        <>
          <button
            type="button"
            onClick={() => setOpened(true)}
            className="animate-float text-8xl"
            aria-label="เปิดซองจดหมาย"
          >
            💌
          </button>
          <p className="text-sm text-rose-400">แตะซองเพื่อเปิดอ่าน</p>
        </>
      ) : (
        <>
          <div className="w-full max-w-md rounded-3xl border-2 border-rose-200 bg-white p-6 shadow-lg">
            <p className="text-lg leading-relaxed text-rose-900">
              {message || "มีเรื่องอยากบอกเธอ... สุขสันต์วันเกิดนะ"}
            </p>
            {sender ? (
              <p className="mt-4 text-right text-sm font-semibold text-rose-500">— {sender}</p>
            ) : null}
          </div>
          <NextButton onNext={onNext} isLast={isLast} />
        </>
      )}
    </StepShell>
  );
}

export function CountdownStep({ data, onNext }: StepComponentProps) {
  const title = field(data, "countdown_title") || "พร้อมหรือยัง?";
  const [count, setCount] = useState<number | null>(null);

  function start() {
    let n = 3;
    setCount(n);
    const timer = setInterval(() => {
      n -= 1;
      if (n <= 0) {
        clearInterval(timer);
        onNext();
      } else {
        setCount(n);
      }
    }, 900);
  }

  return (
    <StepShell>
      {count === null ? (
        <>
          <p className="text-6xl">🎬</p>
          <h2 className="text-2xl font-bold text-rose-700 sm:text-3xl">{title}</h2>
          <button
            type="button"
            onClick={start}
            className="rounded-full bg-rose-500 px-10 py-4 text-lg font-semibold text-white shadow-lg shadow-rose-200 hover:bg-rose-600"
          >
            เริ่มเลย!
          </button>
        </>
      ) : (
        <p key={count} className="animate-pop text-9xl font-bold text-rose-500">
          {count}
        </p>
      )}
    </StepShell>
  );
}

export function CandleBlowStep({ data, onNext, isLast }: StepComponentProps) {
  const [blown, setBlown] = useState(false);
  const cakeStyle = field(data, "cake_style");

  return (
    <StepShell>
      <div className={`text-7xl sm:text-8xl ${blown ? "" : "animate-float"}`}>
        {blown ? "🎂✨" : "🕯️🎂"}
      </div>
      <h2 className="text-2xl font-bold text-rose-700 sm:text-3xl">
        {blown ? "ขอให้คำอธิษฐานเป็นจริงนะ! 🌟" : "เป่าเทียนกันเถอะ!"}
      </h2>
      {cakeStyle ? <p className="text-sm text-rose-300">เค้กแบบ: {cakeStyle}</p> : null}
      {!blown ? (
        <button
          type="button"
          onClick={() => setBlown(true)}
          className="rounded-full bg-amber-400 px-8 py-3.5 text-base font-semibold text-white shadow-lg shadow-amber-200 transition hover:-translate-y-0.5 hover:bg-amber-500"
        >
          เป่า! 💨
        </button>
      ) : (
        <NextButton onNext={onNext} isLast={isLast} />
      )}
    </StepShell>
  );
}

export function FinalCelebrationStep({ data }: StepComponentProps) {
  const message = field(data, "final_message") || "สุขสันต์วันเกิดอีกครั้งนะ 🎂";
  const sender = field(data, "sender_name");

  return (
    <StepShell>
      <div className="flex gap-2 text-5xl">
        <span className="animate-float">🎉</span>
        <span className="animate-float" style={{ animationDelay: "0.3s" }}>
          🎊
        </span>
        <span className="animate-float" style={{ animationDelay: "0.6s" }}>
          🎈
        </span>
      </div>
      <p className="max-w-lg text-2xl font-bold leading-relaxed text-rose-700 sm:text-3xl">
        {message}
      </p>
      {sender ? (
        <p className="text-base font-semibold text-rose-500">— {sender}</p>
      ) : null}
      <p className="text-sm text-rose-300">ขอบคุณที่เข้ามาดูนะ 💛</p>
    </StepShell>
  );
}
