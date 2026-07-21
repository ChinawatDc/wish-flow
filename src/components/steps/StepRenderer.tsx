"use client";

import { useEffect, useMemo, useState, type ComponentType } from "react";

import { KNOWN_STEP_TYPES as REGISTRY_TYPES } from "@/lib/step-registry";
import type { StepDef } from "@/lib/validation";

import {
  CatchHeartStep,
  ConfettiPopStep,
  FindGiftStep,
  MemoryMatchStep,
  QuizStep,
  SpinWheelStep,
  TapBalloonStep,
} from "./game-steps";
import {
  CollageStep,
  PhotoRevealStep,
  PolaroidStep,
  PuzzlePhotoStep,
  ScratchCardStep,
  SlideshowStep,
  TimelineStep,
} from "./photo-steps";
import type { StepAsset, StepComponentProps } from "./shared";
import {
  CandleBlowStep,
  CountdownStep,
  EnvelopeStep,
  FinalCelebrationStep,
  GiftBoxStep,
  GuestbookCtaStep,
  TextRevealStep,
  TypewriterStep,
} from "./text-steps";

/**
 * Registry: step type → component
 * เพิ่ม template ใหม่ = ผสม type เดิมใน steps_schema ไม่ต้องแก้โค้ด
 */
const STEP_REGISTRY: Record<string, ComponentType<StepComponentProps>> = {
  "gift-box": GiftBoxStep,
  "text-reveal": TextRevealStep,
  "typewriter-message": TypewriterStep,
  "envelope-open": EnvelopeStep,
  countdown: CountdownStep,
  "candle-blow": CandleBlowStep,
  "final-celebration": FinalCelebrationStep,
  "photo-reveal": PhotoRevealStep,
  "photo-polaroid": PolaroidStep,
  "photo-slideshow": SlideshowStep,
  "photo-collage": CollageStep,
  "memory-timeline": TimelineStep,
  "scratch-card": ScratchCardStep,
  "puzzle-photo": PuzzlePhotoStep,
  "tap-the-balloon": TapBalloonStep,
  "catch-the-heart": CatchHeartStep,
  "memory-match": MemoryMatchStep,
  "birthday-quiz": QuizStep,
  "spin-the-wheel": SpinWheelStep,
  "find-the-gift": FindGiftStep,
  "confetti-pop": ConfettiPopStep,
  "guestbook-cta": GuestbookCtaStep,
};

export const KNOWN_STEP_TYPES = REGISTRY_TYPES;

function UnknownStep({ type, onNext }: { type: string; onNext: () => void }) {
  return (
    <section className="flex min-h-[65vh] flex-col items-center justify-center gap-4 px-4 text-center">
      <p className="text-rose-400">ยังไม่รองรับ step แบบ: {type}</p>
      <button
        type="button"
        onClick={onNext}
        className="rounded-full bg-rose-400 px-6 py-2.5 text-sm font-semibold text-white"
      >
        ข้าม
      </button>
    </section>
  );
}

type Props = {
  steps: StepDef[];
  data: Record<string, unknown>;
  assets?: StepAsset[];
  initialIndex?: number;
  eventId?: string;
  previewMode?: boolean;
  onStepChange?: (index: number, step: StepDef | undefined) => void;
  onComplete?: () => void;
};

export function StepRenderer({
  steps,
  data,
  assets = [],
  initialIndex = 0,
  eventId,
  previewMode = false,
  onStepChange,
  onComplete,
}: Props) {
  const enabled = useMemo(
    () => steps.filter((s) => s.enabled !== false),
    [steps],
  );
  const [index, setIndex] = useState(() =>
    Math.min(Math.max(initialIndex, 0), Math.max(enabled.length - 1, 0)),
  );

  useEffect(() => {
    setIndex(Math.min(Math.max(initialIndex, 0), Math.max(enabled.length - 1, 0)));
  }, [initialIndex, enabled.length]);

  useEffect(() => {
    onStepChange?.(index, enabled[index]);
  }, [index, enabled, onStepChange]);

  const step = enabled[index];
  const progress = useMemo(
    () => ((index + 1) / Math.max(enabled.length, 1)) * 100,
    [index, enabled.length],
  );

  if (!step) {
    return (
      <section className="grid min-h-[65vh] place-items-center px-4 text-center">
        <div>
          <p className="text-5xl">💛</p>
          <p className="mt-3 text-lg text-rose-500">ขอบคุณที่เข้ามาดูนะ</p>
        </div>
      </section>
    );
  }

  const next = () => {
    setIndex((i) => {
      const n = i + 1;
      if (n >= enabled.length) onComplete?.();
      return n;
    });
  };
  const isLast = index >= enabled.length - 1;
  const Component = STEP_REGISTRY[step.type];

  return (
    <div className="mx-auto w-full max-w-2xl">
      <div className="mb-2 h-2 overflow-hidden rounded-full bg-rose-100">
        <div
          className="h-full rounded-full bg-gradient-to-r from-rose-400 to-amber-400 transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>
      <p className="mb-4 text-center text-xs text-rose-300">
        {index + 1} / {enabled.length}
      </p>
      {Component ? (
        <Component
          key={`${step.key}-${index}`}
          data={data}
          assets={assets}
          onNext={next}
          isLast={isLast}
          eventId={eventId}
          previewMode={previewMode}
        />
      ) : (
        <UnknownStep type={step.type} onNext={next} />
      )}
    </div>
  );
}
