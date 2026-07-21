"use client";

import { useEffect, useRef, useState } from "react";

import {
  AssetImage,
  field,
  NextButton,
  StepShell,
  type StepComponentProps,
} from "./shared";

export function PhotoRevealStep({ data, assets, onNext, isLast }: StepComponentProps) {
  const caption = field(data, "photo_caption");
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setRevealed(true), 300);
    return () => clearTimeout(t);
  }, []);

  return (
    <StepShell>
      <div
        className={`overflow-hidden rounded-3xl border-4 border-white shadow-xl transition-all duration-1000 ${
          revealed ? "scale-100 opacity-100" : "scale-90 opacity-0"
        }`}
      >
        <AssetImage
          asset={assets[0]}
          className="h-72 w-72 object-cover sm:h-80 sm:w-80"
          alt={caption || "รูปความทรงจำ"}
        />
      </div>
      {caption ? <p className="text-lg text-rose-700">{caption}</p> : null}
      <NextButton onNext={onNext} isLast={isLast} />
    </StepShell>
  );
}

export function PolaroidStep({ data, assets, onNext, isLast }: StepComponentProps) {
  const caption = field(data, "polaroid_caption");
  const [index, setIndex] = useState(0);
  const photos = assets.length > 0 ? assets : [undefined];
  const current = photos[index];
  const last = index >= photos.length - 1;

  return (
    <StepShell>
      <div className="rotate-[-2deg] rounded-lg bg-white p-3 pb-12 shadow-xl transition hover:rotate-0">
        <AssetImage
          asset={current}
          className="h-64 w-64 object-cover sm:h-72 sm:w-72"
          alt={`โพลารอยด์ ${index + 1}`}
        />
        <p className="mt-3 text-center text-sm text-rose-600">
          {caption || "ความทรงจำของเรา"} ({index + 1}/{photos.length})
        </p>
      </div>
      {!last ? (
        <button
          type="button"
          onClick={() => setIndex((i) => i + 1)}
          className="rounded-full border-2 border-rose-200 bg-white px-6 py-2.5 text-sm font-semibold text-rose-600 hover:bg-rose-50"
        >
          รูปถัดไป 📸
        </button>
      ) : (
        <NextButton onNext={onNext} isLast={isLast} />
      )}
    </StepShell>
  );
}

export function SlideshowStep({ data, assets, onNext, isLast }: StepComponentProps) {
  const caption = field(data, "slideshow_caption");
  const photos = assets.length > 0 ? assets : [undefined];
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (photos.length <= 1) return;
    const timer = setInterval(() => {
      setIndex((i) => (i + 1) % photos.length);
    }, 2500);
    return () => clearInterval(timer);
  }, [photos.length]);

  return (
    <StepShell>
      <div className="relative h-72 w-72 overflow-hidden rounded-3xl border-4 border-white shadow-xl sm:h-80 sm:w-80">
        {photos.map((photo, i) => (
          <div
            key={photo?.id ?? i}
            className={`absolute inset-0 transition-opacity duration-700 ${
              i === index ? "opacity-100" : "opacity-0"
            }`}
          >
            <AssetImage asset={photo} className="h-full w-full object-cover" />
          </div>
        ))}
      </div>
      <div className="flex gap-1.5">
        {photos.map((_, i) => (
          <span
            key={i}
            className={`h-2 w-2 rounded-full ${i === index ? "bg-rose-400" : "bg-rose-200"}`}
          />
        ))}
      </div>
      {caption ? <p className="text-lg text-rose-700">{caption}</p> : null}
      <NextButton onNext={onNext} isLast={isLast} />
    </StepShell>
  );
}

export function CollageStep({ data, assets, onNext, isLast }: StepComponentProps) {
  const caption = field(data, "collage_caption");
  const photos = assets.slice(0, 6);

  return (
    <StepShell>
      <div className="grid w-full max-w-md grid-cols-2 gap-2 sm:grid-cols-3">
        {(photos.length > 0 ? photos : Array.from({ length: 4 }, () => undefined)).map(
          (photo, i) => (
            <div
              key={photo?.id ?? i}
              className={`overflow-hidden rounded-2xl border-2 border-white shadow-md ${
                i % 3 === 0 ? "rotate-1" : "-rotate-1"
              }`}
            >
              <AssetImage asset={photo} className="aspect-square w-full object-cover" />
            </div>
          ),
        )}
      </div>
      {caption ? <p className="text-lg text-rose-700">{caption}</p> : null}
      <NextButton onNext={onNext} isLast={isLast} />
    </StepShell>
  );
}

export function TimelineStep({ data, assets, onNext, isLast }: StepComponentProps) {
  const caption = field(data, "timeline_caption");
  const photos = assets.length > 0 ? assets : [undefined, undefined, undefined];

  return (
    <StepShell>
      <h2 className="text-xl font-bold text-rose-700">{caption || "เส้นทางความทรงจำ"}</h2>
      <div className="w-full max-w-md space-y-4">
        {photos.map((photo, i) => (
          <div
            key={photo?.id ?? i}
            className={`flex items-center gap-3 ${i % 2 === 1 ? "flex-row-reverse" : ""}`}
          >
            <AssetImage
              asset={photo}
              className="h-24 w-24 shrink-0 rounded-2xl border-2 border-white object-cover shadow-md"
            />
            <div className="h-0.5 flex-1 bg-rose-200" />
            <span className="text-2xl">{["🌱", "🌸", "🌈", "⭐", "💛", "🎂"][i % 6]}</span>
          </div>
        ))}
      </div>
      <NextButton onNext={onNext} isLast={isLast} />
    </StepShell>
  );
}

export function ScratchCardStep({ data, assets, onNext, isLast }: StepComponentProps) {
  const caption = field(data, "scratch_caption");
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [progress, setProgress] = useState(0);
  const done = progress > 0.45;
  const scratching = useRef(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#fda4af";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#ffffff";
    ctx.font = "20px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("ขูดตรงนี้ ✨", canvas.width / 2, canvas.height / 2);
  }, []);

  function scratch(clientX: number, clientY: number) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * canvas.width;
    const y = ((clientY - rect.top) / rect.height) * canvas.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.globalCompositeOperation = "destination-out";
    ctx.beginPath();
    ctx.arc(x, y, 22, 0, Math.PI * 2);
    ctx.fill();

    const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
    let cleared = 0;
    for (let i = 3; i < image.data.length; i += 16) {
      if (image.data[i] === 0) cleared++;
    }
    setProgress(cleared / (image.data.length / 16));
  }

  return (
    <StepShell>
      <h2 className="text-xl font-bold text-rose-700">{caption || "ขูดเพื่อเปิดรูป!"}</h2>
      <div className="relative h-72 w-72 overflow-hidden rounded-3xl border-4 border-white shadow-xl">
        <AssetImage asset={assets[0]} className="h-full w-full object-cover" />
        {!done && (
          <canvas
            ref={canvasRef}
            width={288}
            height={288}
            className="absolute inset-0 h-full w-full touch-none"
            onPointerDown={(e) => {
              scratching.current = true;
              scratch(e.clientX, e.clientY);
            }}
            onPointerMove={(e) => {
              if (scratching.current) scratch(e.clientX, e.clientY);
            }}
            onPointerUp={() => {
              scratching.current = false;
            }}
            onPointerLeave={() => {
              scratching.current = false;
            }}
          />
        )}
      </div>
      {done ? (
        <NextButton onNext={onNext} isLast={isLast} />
      ) : (
        <button type="button" onClick={onNext} className="text-sm text-rose-300 underline">
          ข้าม
        </button>
      )}
    </StepShell>
  );
}

const PUZZLE_SIZE = 3;

export function PuzzlePhotoStep({ data, assets, onNext, isLast }: StepComponentProps) {
  const caption = field(data, "puzzle_caption");
  const [tiles, setTiles] = useState<number[]>(() => {
    const arr = Array.from({ length: PUZZLE_SIZE * PUZZLE_SIZE }, (_, i) => i);
    // shuffle (swap pairs) — ทำให้สลับง่ายพอเล่นสนุก
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  });
  const [selected, setSelected] = useState<number | null>(null);
  const solved = tiles.every((t, i) => t === i);
  const photo = assets[0];

  function tap(index: number) {
    if (solved) return;
    if (selected === null) {
      setSelected(index);
      return;
    }
    setTiles((prev) => {
      const next = [...prev];
      [next[selected], next[index]] = [next[index], next[selected]];
      return next;
    });
    setSelected(null);
  }

  return (
    <StepShell>
      <h2 className="text-xl font-bold text-rose-700">
        {solved ? "เก่งมาก! 🎉" : caption || "แตะสลับชิ้นส่วนให้ครบ!"}
      </h2>
      <div
        className="grid gap-1 rounded-2xl border-4 border-white bg-white p-1 shadow-xl"
        style={{ gridTemplateColumns: `repeat(${PUZZLE_SIZE}, 1fr)` }}
      >
        {tiles.map((tile, i) => (
          <button
            key={i}
            type="button"
            onClick={() => tap(i)}
            aria-label={`ชิ้นที่ ${i + 1}`}
            className={`relative h-20 w-20 overflow-hidden rounded-lg transition sm:h-24 sm:w-24 ${
              selected === i ? "ring-4 ring-rose-400" : ""
            }`}
          >
            {photo?.url ? (
              <div
                className="absolute inset-0 bg-cover"
                style={{
                  backgroundImage: `url(${photo.url})`,
                  backgroundSize: `${PUZZLE_SIZE * 100}%`,
                  backgroundPosition: `${((tile % PUZZLE_SIZE) / (PUZZLE_SIZE - 1)) * 100}% ${(Math.floor(tile / PUZZLE_SIZE) / (PUZZLE_SIZE - 1)) * 100}%`,
                }}
              />
            ) : (
              <div className="grid h-full w-full place-items-center bg-rose-100 text-2xl">
                {["🌸", "🎈", "🧸", "🌈", "⭐", "💛", "🍰", "🎁", "🎀"][tile]}
              </div>
            )}
          </button>
        ))}
      </div>
      {solved ? (
        <NextButton onNext={onNext} isLast={isLast} />
      ) : (
        <button type="button" onClick={onNext} className="text-sm text-rose-300 underline">
          ข้าม
        </button>
      )}
    </StepShell>
  );
}
