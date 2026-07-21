"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

import { TemplateStudioBuilder } from "@/components/studio/TemplateStudioBuilder";
import { parseStepsSchema } from "@/lib/validation";

export default function AdminTemplateEditorPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [payload, setPayload] = useState<{
    template: {
      id: string;
      slug: string;
      name: string;
      description: string;
      category: string;
      tags: string[];
      mood: string;
      thumbnailUrl: string;
      requiredAssetCount: number;
      isPremium: boolean;
      isFeatured: boolean;
      isActive: boolean;
      sortOrder: number;
      marketplaceVisibility: "PUBLIC" | "UNLISTED" | "PRIVATE";
      priceLabel: string | null;
      priceCurrency: string | null;
      licensingNotes: string | null;
    };
    draft: {
      version: number;
      status: string;
      stepsSchema: unknown;
      dataModel: unknown;
      settings: unknown;
      sampleData: unknown;
    };
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetch(`/api/admin/templates/${id}`);
      const data = await res.json();
      if (cancelled) return;
      if (!res.ok) {
        setError(data.error || "โหลดไม่สำเร็จ");
        setLoading(false);
        return;
      }
      if (!data.draft) {
        setError("ไม่มีฉบับร่าง");
        setLoading(false);
        return;
      }
      setPayload({
        template: data,
        draft: data.draft,
      });
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (loading) {
    return (
      <main className="grid min-h-screen place-items-center text-violet-300">
        กำลังโหลดสตูดิโอ…
      </main>
    );
  }

  if (error || !payload) {
    return (
      <main className="grid min-h-screen place-items-center px-4">
        <div className="text-center">
          <p className="text-red-500">{error || "ไม่พบเทมเพลต"}</p>
          <Link href="/admin/templates" className="mt-4 inline-block text-violet-600">
            ← กลับคลังเทมเพลต
          </Link>
        </div>
      </main>
    );
  }

  const stepsSchema = parseStepsSchema(payload.draft.stepsSchema);
  const dataModel =
    payload.draft.dataModel &&
    typeof payload.draft.dataModel === "object" &&
    Array.isArray((payload.draft.dataModel as { fields?: unknown }).fields)
      ? (payload.draft.dataModel as {
          fields: Array<{
            key: string;
            type: string;
            labelTh: string;
            labelEn: string;
            required: boolean;
            sampleValue?: unknown;
            helpText?: string;
          }>;
        })
      : { fields: [] };

  return (
    <>
      <div className="border-b border-violet-100 bg-white px-4 py-2 text-sm">
        <Link href="/admin/templates" className="font-semibold text-violet-600">
          ← คลังเทมเพลต
        </Link>
      </div>
      <TemplateStudioBuilder
        template={payload.template}
        versionLabel={`ฉบับร่าง รุ่น ${payload.draft.version}`}
        initialDraft={{
          stepsSchema,
          dataModel,
          settings:
            payload.draft.settings && typeof payload.draft.settings === "object"
              ? (payload.draft.settings as Record<string, unknown>)
              : {},
          sampleData:
            payload.draft.sampleData && typeof payload.draft.sampleData === "object"
              ? (payload.draft.sampleData as Record<string, unknown>)
              : {},
        }}
      />
    </>
  );
}
