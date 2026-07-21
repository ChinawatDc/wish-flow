"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { ExpiredCardOverlay } from "@/components/ExpiredCardOverlay";
import { StepRenderer } from "@/components/steps/StepRenderer";
import type { StepDef, StepsSchema } from "@/lib/validation";

type ViewPayload = {
  name: string;
  template: { name: string; stepsSchema: StepsSchema };
  templateData: Record<string, unknown>;
  assets?: { id: string; url: string }[];
};

function detectDeviceClass(): "MOBILE" | "TABLET" | "DESKTOP" | "UNKNOWN" {
  if (typeof window === "undefined") return "UNKNOWN";
  const w = window.innerWidth;
  if (w < 768) return "MOBILE";
  if (w < 1024) return "TABLET";
  return "DESKTOP";
}

export default function GuestViewPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const [data, setData] = useState<ViewPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expired, setExpired] = useState(false);
  const sent = useRef<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetch(`/api/e/${id}/view`);
      const json = await res.json();
      if (cancelled) return;
      if (res.status === 410) {
        setExpired(true);
        setError(json.error || "อีเวนต์นี้หมดอายุแล้ว");
        return;
      }
      if (!res.ok) {
        setError(json.error || "กรุณากรอก PIN ก่อนเข้าชม");
        return;
      }
      setData(json);
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  function track(payload: {
    kind: "STEP_START" | "STEP_COMPLETE" | "STEP_SKIP" | "FLOW_COMPLETE";
    stepKey?: string;
    stepType?: string;
    stepIndex?: number;
  }) {
    const key = `${payload.kind}:${payload.stepKey ?? ""}:${payload.stepIndex ?? ""}`;
    if (sent.current.has(key)) return;
    sent.current.add(key);
    void fetch(`/api/e/${id}/telemetry`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...payload,
        deviceClass: detectDeviceClass(),
      }),
    });
  }

  if (expired) {
    return (
      <main className="relative grid min-h-screen place-items-center bg-gradient-to-b from-pink-100 to-rose-50">
        <ExpiredCardOverlay />
      </main>
    );
  }

  if (error) {
    return (
      <main className="grid min-h-screen place-items-center bg-gradient-to-b from-pink-100 to-rose-50 px-4">
        <div className="text-center">
          <p className="text-5xl">🔒</p>
          <p className="mt-3 text-rose-500">{error}</p>
          <Link
            href={`/e/${id}`}
            className="mt-5 inline-block rounded-full bg-rose-500 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-rose-200"
          >
            กรอก PIN
          </Link>
        </div>
      </main>
    );
  }

  if (!data) {
    return (
      <main className="grid min-h-screen place-items-center bg-gradient-to-b from-pink-100 to-rose-50 text-rose-300">
        กำลังโหลด… 🎈
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-pink-100 via-rose-50 to-amber-50">
      <div className="mx-auto w-full max-w-2xl px-4 py-8 sm:px-6">
        <h1 className="text-center text-xl font-bold text-rose-700 sm:text-2xl">
          🎉 {data.name}
        </h1>
        <div className="mt-6">
          <StepRenderer
            steps={data.template.stepsSchema.steps}
            data={data.templateData}
            assets={data.assets ?? []}
            eventId={id}
            onStepChange={(index, step: StepDef | undefined) => {
              if (!step) return;
              track({
                kind: "STEP_START",
                stepKey: step.key,
                stepType: step.type,
                stepIndex: index,
              });
            }}
            onComplete={() => track({ kind: "FLOW_COMPLETE" })}
          />
        </div>
      </div>
    </main>
  );
}
