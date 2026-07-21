"use client";

import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useCallback, useEffect, useMemo, useState } from "react";

import { StepRenderer } from "@/components/steps/StepRenderer";
import { FIELD_TYPES, STEP_TYPE_META, THEME_PRESETS } from "@/lib/step-registry";
import type { StepDef, StepsSchema } from "@/lib/validation";

import { useStudioHistory } from "./useStudioHistory";

type StudioDraft = {
  stepsSchema: StepsSchema;
  dataModel: {
    fields: Array<{
      key: string;
      type: string;
      labelTh: string;
      labelEn: string;
      required: boolean;
      sampleValue?: unknown;
      helpText?: string;
    }>;
  };
  settings: Record<string, unknown>;
  sampleData: Record<string, unknown>;
};

type TemplateMeta = {
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

type ValidationPayload = {
  ok: boolean;
  errors: { code: string; message: string; level: string }[];
  warnings: { code: string; message: string; level: string }[];
};

type Props = {
  template: TemplateMeta;
  initialDraft: StudioDraft;
  versionLabel: string;
};

type Panel = "canvas" | "library" | "properties" | "data" | "preview" | "analytics";

const GROUP_LABELS = {
  text: "ข้อความและเอฟเฟกต์",
  photo: "รูปภาพ",
  minigame: "มินิเกม",
} as const;

const SECTION_LABELS = {
  opening: "ช่วงเปิด",
  body: "เนื้อหาหลัก",
  finale: "ช่วงปิดท้าย",
} as const;

const FIELD_TYPE_LABELS: Record<string, string> = {
  "short-text": "ข้อความสั้น",
  "long-text": "ข้อความยาว",
  "rich-text": "ข้อความจัดรูปแบบ",
  "image-slot": "ช่องรูปภาพ",
  date: "วันที่",
  select: "ตัวเลือกเดียว",
  "multi-select": "หลายตัวเลือก",
  repeater: "รายการซ้ำ",
  boolean: "ใช่ / ไม่ใช่",
};

const THEME_LABELS: Record<string, string> = {
  "cute-pastel": "พาสเทลน่ารัก",
  "minimal-clean": "มินิมอลสะอาดตา",
  "warm-romantic": "โรแมนติกอบอุ่น",
  "fun-party": "ปาร์ตี้สนุกสนาน",
};

const CATEGORY_OPTIONS = [
  ["birthday", "วันเกิด"],
  ["photo", "รูปภาพ"],
  ["minigame", "มินิเกม"],
  ["romantic", "โรแมนติก"],
  ["friend", "เพื่อน"],
  ["family", "ครอบครัว"],
  ["simple", "เรียบง่าย"],
] as const;

const MOOD_OPTIONS = [
  ["cute", "น่ารัก"],
  ["minimal", "มินิมอล"],
  ["warm", "อบอุ่น"],
  ["playful", "สนุกสนาน"],
  ["romantic", "โรแมนติก"],
  ["funny", "ตลก"],
] as const;

function SortableStep({
  step,
  selected,
  onSelect,
}: {
  step: StepDef;
  selected: boolean;
  onSelect: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({
    id: step.key,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };
  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-2 rounded-2xl border-2 px-3 py-2 ${
        selected ? "border-violet-400 bg-violet-50" : "border-violet-100 bg-white"
      } ${step.enabled === false ? "opacity-50" : ""}`}
    >
      <button
        type="button"
        className="cursor-grab text-violet-300 active:cursor-grabbing"
        aria-label="ลากจัดลำดับ"
        {...attributes}
        {...listeners}
      >
        ⋮⋮
      </button>
      <button type="button" onClick={onSelect} className="flex-1 text-left">
        <p className="text-sm font-semibold text-violet-800">{step.key}</p>
        <p className="text-xs text-violet-400">
          {STEP_TYPE_META.find((item) => item.type === step.type)?.labelTh ?? step.type} ·{" "}
          {SECTION_LABELS[step.section ?? "body"]}
        </p>
      </button>
    </div>
  );
}

export function TemplateStudioBuilder({ template, initialDraft, versionLabel }: Props) {
  const history = useStudioHistory<StudioDraft>(initialDraft);
  const draft = history.value;
  const [meta, setMeta] = useState(template);
  const [selectedKey, setSelectedKey] = useState<string | null>(
    initialDraft.stepsSchema.steps[0]?.key ?? null,
  );
  const [mode, setMode] = useState<"basic" | "pro" | "expert">("basic");
  const [panel, setPanel] = useState<Panel>("canvas");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [validation, setValidation] = useState<ValidationPayload | null>(null);
  const [publishNotes, setPublishNotes] = useState("");
  const [breaking, setBreaking] = useState(false);
  const [analytics, setAnalytics] = useState<Record<string, unknown> | null>(null);
  const [previewIndex, setPreviewIndex] = useState(0);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const selected = draft.stepsSchema.steps.find((s) => s.key === selectedKey) ?? null;

  const updateSteps = useCallback(
    (steps: StepDef[]) => {
      history.set({
        ...draft,
        stepsSchema: { ...draft.stepsSchema, steps },
      });
    },
    [draft, history],
  );

  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = draft.stepsSchema.steps.findIndex((s) => s.key === active.id);
    const newIndex = draft.stepsSchema.steps.findIndex((s) => s.key === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    updateSteps(arrayMove(draft.stepsSchema.steps, oldIndex, newIndex));
  }

  function addStep(type: string) {
    const metaStep = STEP_TYPE_META.find((s) => s.type === type);
    if (!metaStep) return;
    let key = metaStep.type.replace(/-/g, "_");
    let i = 1;
    const keys = new Set(draft.stepsSchema.steps.map((s) => s.key));
    while (keys.has(key)) key = `${metaStep.type.replace(/-/g, "_")}_${i++}`;
    const step: StepDef = {
      key,
      type,
      fields: [...metaStep.defaultFields],
      enabled: true,
      section: "body",
      settings: {},
      elementOverrides: {},
    };
    updateSteps([...draft.stepsSchema.steps, step]);
    setSelectedKey(key);
    setPanel("properties");
  }

  function duplicateSelected() {
    if (!selected) return;
    let key = `${selected.key}_copy`;
    let i = 1;
    const keys = new Set(draft.stepsSchema.steps.map((s) => s.key));
    while (keys.has(key)) key = `${selected.key}_copy_${i++}`;
    const copy = { ...selected, key, settings: { ...selected.settings } };
    const idx = draft.stepsSchema.steps.findIndex((s) => s.key === selected.key);
    const next = [...draft.stepsSchema.steps];
    next.splice(idx + 1, 0, copy);
    updateSteps(next);
    setSelectedKey(key);
  }

  function removeSelected() {
    if (!selected) return;
    if (selected.fields.length > 0) {
      const ok = window.confirm(
        `ลบขั้นตอน "${selected.key}" หรือไม่? ช่องข้อมูลที่ผูกอยู่: ${selected.fields.join(", ")}`,
      );
      if (!ok) return;
    }
    const next = draft.stepsSchema.steps.filter((s) => s.key !== selected.key);
    updateSteps(next);
    setSelectedKey(next[0]?.key ?? null);
  }

  async function saveDraft() {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/templates/${meta.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          metadata: {
            name: meta.name,
            description: meta.description,
            category: meta.category,
            tags: meta.tags,
            mood: meta.mood,
            thumbnailUrl: meta.thumbnailUrl,
            requiredAssetCount: meta.requiredAssetCount,
            isPremium: meta.isPremium,
            isFeatured: meta.isFeatured,
            isActive: meta.isActive,
            sortOrder: meta.sortOrder,
            marketplaceVisibility: meta.marketplaceVisibility,
            priceLabel: meta.priceLabel,
            priceCurrency: meta.priceCurrency,
            licensingNotes: meta.licensingNotes,
          },
          draft: {
            stepsSchema: draft.stepsSchema,
            dataModel: draft.dataModel,
            settings: { ...draft.settings, mode },
            sampleData: draft.sampleData,
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage(data.error || "บันทึกไม่สำเร็จ");
        if (data.validation) setValidation(data.validation);
        return;
      }
      setMessage("บันทึกฉบับร่างแล้ว ✓");
    } finally {
      setSaving(false);
    }
  }

  async function runValidate() {
    await saveDraft();
    const res = await fetch(`/api/admin/templates/${meta.id}/validate`, {
      method: "POST",
    });
    const data = await res.json();
    if (!res.ok) {
      setMessage(data.error || "ตรวจสอบไม่สำเร็จ");
      return;
    }
    setValidation(data);
    setMessage(data.ok ? "ผ่านการตรวจสอบ ✓" : "พบปัญหาที่ต้องแก้");
  }

  async function publish() {
    if (!publishNotes.trim()) {
      setMessage("กรุณากรอกบันทึกประจำรุ่นก่อนเผยแพร่");
      return;
    }
    await saveDraft();
    const res = await fetch(`/api/admin/templates/${meta.id}/publish`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        releaseNotes: publishNotes,
        breakingChange: breaking,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setMessage(data.error || "เผยแพร่ไม่สำเร็จ");
      if (data.validation) setValidation(data.validation);
      return;
    }
    setMessage(
      `เผยแพร่รุ่น ${data.version.version} สำเร็จ ✓ (อีเวนต์เดิมยังใช้รุ่นเดิมอยู่)`,
    );
    setPublishNotes("");
  }

  async function loadAnalytics() {
    const res = await fetch(`/api/admin/templates/${meta.id}/analytics`);
    const data = await res.json();
    if (!res.ok) {
      setMessage(data.error || "โหลดข้อมูลวิเคราะห์ไม่สำเร็จ");
      return;
    }
    setAnalytics(data);
    setPanel("analytics");
  }

  const samplePreview = useMemo(() => {
    const out: Record<string, unknown> = { ...draft.sampleData };
    for (const field of draft.dataModel.fields) {
      if (out[field.key] == null && field.sampleValue != null) {
        out[field.key] = field.sampleValue;
      }
    }
    return out;
  }, [draft]);

  useEffect(() => {
    const settingsMode = (draft.settings as { mode?: string })?.mode;
    if (settingsMode === "basic" || settingsMode === "pro" || settingsMode === "expert") {
      setMode(settingsMode);
    }
  }, [draft.settings]);

  const libraryPanel = (
    <div className="space-y-3">
      <input
        placeholder="ค้นหาขั้นตอน…"
        className="w-full rounded-xl border-2 border-violet-100 px-3 py-2 text-sm"
        onChange={() => {}}
        id="step-search"
      />
      {(["text", "photo", "minigame"] as const).map((group) => (
        <div key={group}>
          <p className="mb-1 text-xs font-bold uppercase tracking-wide text-violet-400">
            {GROUP_LABELS[group]}
          </p>
          <div className="grid gap-1">
            {STEP_TYPE_META.filter((s) => s.group === group).map((s) => (
              <button
                key={s.type}
                type="button"
                onClick={() => addStep(s.type)}
                className="rounded-xl border border-violet-100 bg-white px-3 py-2 text-left text-sm hover:bg-violet-50"
              >
                <span className="font-semibold text-violet-800">{s.labelTh}</span>
                <span className="ml-2 text-xs text-violet-400">{s.type}</span>
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );

  const canvasPanel = (
    <div className="space-y-2">
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext
          items={draft.stepsSchema.steps.map((s) => s.key)}
          strategy={verticalListSortingStrategy}
        >
          {draft.stepsSchema.steps.map((step) => (
            <SortableStep
              key={step.key}
              step={step}
              selected={selectedKey === step.key}
              onSelect={() => {
                setSelectedKey(step.key);
                setPanel("properties");
              }}
            />
          ))}
        </SortableContext>
      </DndContext>
      {draft.stepsSchema.steps.length === 0 && (
        <p className="rounded-2xl border-2 border-dashed border-violet-200 p-6 text-center text-sm text-violet-400">
          ยังไม่มีขั้นตอน — เปิดคลังขั้นตอนแล้วเพิ่มได้เลย
        </p>
      )}
    </div>
  );

  const propertiesPanel = selected ? (
    <div className="space-y-3 text-sm">
      <label className="block">
        <span className="text-xs text-violet-400">รหัสขั้นตอน</span>
        <input
          value={selected.key}
          onChange={(e) => {
            const nextKey = e.target.value;
            updateSteps(
              draft.stepsSchema.steps.map((s) =>
                s.key === selected.key ? { ...s, key: nextKey } : s,
              ),
            );
            setSelectedKey(nextKey);
          }}
          className="mt-1 w-full rounded-xl border-2 border-violet-100 px-3 py-2"
        />
      </label>
      <label className="block">
        <span className="text-xs text-violet-400">ช่วงการแสดงผล</span>
        <select
          value={selected.section ?? "body"}
          onChange={(e) =>
            updateSteps(
              draft.stepsSchema.steps.map((s) =>
                s.key === selected.key
                  ? { ...s, section: e.target.value as StepDef["section"] }
                  : s,
              ),
            )
          }
          className="mt-1 w-full rounded-xl border-2 border-violet-100 px-3 py-2"
        >
          <option value="opening">ช่วงเปิด</option>
          <option value="body">เนื้อหาหลัก</option>
          <option value="finale">ช่วงปิดท้าย</option>
        </select>
      </label>
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={selected.enabled !== false}
          onChange={(e) =>
            updateSteps(
              draft.stepsSchema.steps.map((s) =>
                s.key === selected.key ? { ...s, enabled: e.target.checked } : s,
              ),
            )
          }
        />
        เปิดใช้ขั้นตอนนี้
      </label>
      <div>
        <p className="text-xs text-violet-400">ช่องข้อมูลที่ใช้</p>
        <p className="mt-1 rounded-xl bg-violet-50 px-3 py-2 text-xs text-violet-700">
          {selected.fields.join(", ") || "—"}
        </p>
      </div>
      {(mode === "pro" || mode === "expert") && (
        <label className="block">
          <span className="text-xs text-violet-400">การเปลี่ยนฉาก (ระดับมืออาชีพ)</span>
          <select
            value={String((selected.settings as { transition?: string })?.transition ?? "fade")}
            onChange={(e) =>
              updateSteps(
                draft.stepsSchema.steps.map((s) =>
                  s.key === selected.key
                    ? {
                        ...s,
                        settings: { ...s.settings, transition: e.target.value },
                      }
                    : s,
                ),
              )
            }
            className="mt-1 w-full rounded-xl border-2 border-violet-100 px-3 py-2"
          >
            <option value="fade">ค่อย ๆ ปรากฏ</option>
            <option value="slide">เลื่อนเข้า</option>
            <option value="none">ไม่มี</option>
          </select>
        </label>
      )}
      {mode === "expert" && (
        <label className="block">
          <span className="text-xs text-violet-400">
            สีคำบรรยายองค์ประกอบ (กำหนดทับระดับผู้เชี่ยวชาญ)
          </span>
          <input
            value={String(
              (selected.elementOverrides as { caption?: { color?: string } })?.caption
                ?.color ?? "",
            )}
            onChange={(e) =>
              updateSteps(
                draft.stepsSchema.steps.map((s) =>
                  s.key === selected.key
                    ? {
                        ...s,
                        elementOverrides: {
                          ...s.elementOverrides,
                          caption: { color: e.target.value },
                        },
                      }
                    : s,
                ),
              )
            }
            placeholder="#be123c"
            className="mt-1 w-full rounded-xl border-2 border-violet-100 px-3 py-2"
          />
        </label>
      )}
      <div className="flex flex-wrap gap-2 pt-2">
        <button
          type="button"
          onClick={duplicateSelected}
          className="rounded-full border-2 border-violet-200 px-3 py-1.5 text-xs font-semibold text-violet-700"
        >
          ทำสำเนา
        </button>
        <button
          type="button"
          onClick={removeSelected}
          className="rounded-full border-2 border-red-200 px-3 py-1.5 text-xs font-semibold text-red-600"
        >
          ลบ
        </button>
      </div>
    </div>
  ) : (
    <p className="text-sm text-violet-400">เลือกขั้นตอนจากพื้นที่จัดลำดับ</p>
  );

  const dataPanel = (
    <div className="space-y-3">
      {draft.dataModel.fields.map((field, index) => (
        <div key={field.key + index} className="rounded-2xl border-2 border-violet-100 bg-white p-3">
          <div className="grid gap-2 sm:grid-cols-2">
            <input
              value={field.key}
              onChange={(e) => {
                const fields = [...draft.dataModel.fields];
                fields[index] = { ...field, key: e.target.value };
                history.set({ ...draft, dataModel: { fields } });
              }}
              className="rounded-xl border px-2 py-1.5 text-sm"
              placeholder="รหัสช่องข้อมูล"
            />
            <select
              value={field.type}
              onChange={(e) => {
                const fields = [...draft.dataModel.fields];
                fields[index] = { ...field, type: e.target.value };
                history.set({ ...draft, dataModel: { fields } });
              }}
              className="rounded-xl border px-2 py-1.5 text-sm"
            >
              {FIELD_TYPES.map((t) => (
                <option key={t} value={t}>
                  {FIELD_TYPE_LABELS[t] ?? t}
                </option>
              ))}
            </select>
            <input
              value={field.labelTh}
              onChange={(e) => {
                const fields = [...draft.dataModel.fields];
                fields[index] = { ...field, labelTh: e.target.value };
                history.set({ ...draft, dataModel: { fields } });
              }}
              className="rounded-xl border px-2 py-1.5 text-sm"
              placeholder="ชื่อภาษาไทย"
            />
            <input
              value={field.labelEn}
              onChange={(e) => {
                const fields = [...draft.dataModel.fields];
                fields[index] = { ...field, labelEn: e.target.value };
                history.set({ ...draft, dataModel: { fields } });
              }}
              className="rounded-xl border px-2 py-1.5 text-sm"
              placeholder="ชื่อภาษาอังกฤษ"
            />
            <input
              value={String(field.sampleValue ?? "")}
              onChange={(e) => {
                const fields = [...draft.dataModel.fields];
                fields[index] = { ...field, sampleValue: e.target.value };
                const sampleData = { ...draft.sampleData, [field.key]: e.target.value };
                history.set({ ...draft, dataModel: { fields }, sampleData });
              }}
              className="rounded-xl border px-2 py-1.5 text-sm sm:col-span-2"
              placeholder="ข้อมูลตัวอย่าง"
            />
          </div>
          <label className="mt-2 flex items-center gap-2 text-xs text-violet-600">
            <input
              type="checkbox"
              checked={field.required}
              onChange={(e) => {
                const fields = [...draft.dataModel.fields];
                fields[index] = { ...field, required: e.target.checked };
                history.set({ ...draft, dataModel: { fields } });
              }}
            />
            จำเป็นต้องกรอก
          </label>
        </div>
      ))}
      <button
        type="button"
        onClick={() => {
          const key = `field_${draft.dataModel.fields.length + 1}`;
          history.set({
            ...draft,
            dataModel: {
              fields: [
                ...draft.dataModel.fields,
                {
                  key,
                  type: "short-text",
                  labelTh: key,
                  labelEn: key,
                  required: false,
                  sampleValue: "ตัวอย่าง",
                },
              ],
            },
            sampleData: { ...draft.sampleData, [key]: "ตัวอย่าง" },
          });
        }}
        className="rounded-full border-2 border-violet-200 px-4 py-2 text-sm font-semibold text-violet-700"
      >
        + เพิ่มช่องข้อมูล
      </button>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-b from-violet-50 to-rose-50 pb-24">
      <div className="sticky top-0 z-20 border-b-2 border-violet-100 bg-white/90 backdrop-blur">
        <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center gap-2 px-4 py-3">
          <div className="mr-auto">
            <p className="text-xs font-semibold text-violet-400">
              สตูดิโอเทมเพลต · {versionLabel}
            </p>
            <input
              value={meta.name}
              onChange={(e) => setMeta({ ...meta, name: e.target.value })}
              className="bg-transparent text-lg font-bold text-violet-900 outline-none"
            />
          </div>
          <select
            value={mode}
            onChange={(e) => {
              const next = e.target.value as typeof mode;
              setMode(next);
              history.set({ ...draft, settings: { ...draft.settings, mode: next } }, false);
            }}
            className="rounded-full border-2 border-violet-200 px-3 py-1.5 text-xs font-semibold"
          >
            <option value="basic">พื้นฐาน</option>
            <option value="pro">มืออาชีพ</option>
            <option value="expert">ผู้เชี่ยวชาญ</option>
          </select>
          <button
            type="button"
            disabled={!history.canUndo}
            onClick={history.undo}
            className="rounded-full border px-3 py-1.5 text-xs disabled:opacity-40"
          >
            เลิกทำ
          </button>
          <button
            type="button"
            disabled={!history.canRedo}
            onClick={history.redo}
            className="rounded-full border px-3 py-1.5 text-xs disabled:opacity-40"
          >
            ทำซ้ำ
          </button>
          <button
            type="button"
            onClick={() => void runValidate()}
            className="rounded-full border-2 border-violet-200 px-3 py-1.5 text-xs font-semibold text-violet-700"
          >
            ตรวจสอบ
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => void saveDraft()}
            className="rounded-full bg-violet-600 px-4 py-1.5 text-xs font-bold text-white"
          >
            {saving ? "กำลังบันทึก…" : "บันทึกฉบับร่าง"}
          </button>
        </div>
      </div>

      <div className="mx-auto grid w-full max-w-7xl gap-4 px-4 py-4 lg:grid-cols-[240px_1fr_280px]">
        <aside className="hidden rounded-3xl border-2 border-violet-100 bg-white p-3 lg:block">
          <p className="mb-2 text-sm font-bold text-violet-700">คลังขั้นตอน</p>
          {libraryPanel}
        </aside>

        <section className="rounded-3xl border-2 border-violet-100 bg-white p-4">
          <div className="mb-3 flex flex-wrap gap-2 lg:hidden">
            {(
              [
                ["canvas", "จัดลำดับ"],
                ["library", "คลัง"],
                ["properties", "คุณสมบัติ"],
                ["data", "ข้อมูล"],
                ["preview", "ดูตัวอย่าง"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setPanel(id)}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                  panel === id ? "bg-violet-600 text-white" : "bg-violet-50 text-violet-700"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="mb-4 grid gap-2 rounded-2xl bg-violet-50 p-3 sm:grid-cols-2">
            <label className="text-xs text-violet-500">
              หมวดหมู่
              <select
                value={meta.category}
                onChange={(e) => setMeta({ ...meta, category: e.target.value })}
                className="mt-1 w-full rounded-xl border px-2 py-1.5 text-sm"
              >
                {CATEGORY_OPTIONS.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs text-violet-500">
              อารมณ์
              <select
                value={meta.mood}
                onChange={(e) => setMeta({ ...meta, mood: e.target.value })}
                className="mt-1 w-full rounded-xl border px-2 py-1.5 text-sm"
              >
                {MOOD_OPTIONS.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs text-violet-500 sm:col-span-2">
              คำอธิบาย
              <textarea
                value={meta.description}
                onChange={(e) => setMeta({ ...meta, description: e.target.value })}
                className="mt-1 w-full rounded-xl border px-2 py-1.5 text-sm"
                rows={2}
              />
            </label>
            <label className="flex items-center gap-2 text-xs text-violet-600">
              <input
                type="checkbox"
                checked={meta.isPremium}
                onChange={(e) => setMeta({ ...meta, isPremium: e.target.checked })}
              />
              พรีเมียม
            </label>
            <label className="flex items-center gap-2 text-xs text-violet-600">
              <input
                type="checkbox"
                checked={meta.isFeatured}
                onChange={(e) => setMeta({ ...meta, isFeatured: e.target.checked })}
              />
              แนะนำเป็นพิเศษ
            </label>
            <label className="text-xs text-violet-500">
              การมองเห็นในตลาดเทมเพลต
              <select
                value={meta.marketplaceVisibility}
                onChange={(e) =>
                  setMeta({
                    ...meta,
                    marketplaceVisibility: e.target.value as TemplateMeta["marketplaceVisibility"],
                  })
                }
                className="mt-1 w-full rounded-xl border px-2 py-1.5 text-sm"
              >
                <option value="PUBLIC">สาธารณะ</option>
                <option value="UNLISTED">ไม่แสดงในรายการ</option>
                <option value="PRIVATE">ส่วนตัว</option>
              </select>
            </label>
            <label className="text-xs text-violet-500">
              ป้ายราคา
              <input
                value={meta.priceLabel ?? ""}
                onChange={(e) => setMeta({ ...meta, priceLabel: e.target.value || null })}
                className="mt-1 w-full rounded-xl border px-2 py-1.5 text-sm"
                placeholder="เช่น 49 บาท (ยังไม่มีระบบชำระเงิน)"
              />
            </label>
            {(mode === "basic" || mode === "pro" || mode === "expert") && (
              <label className="text-xs text-violet-500">
                ชุดธีม
                <select
                  value={String(
                    (draft.settings as { theme?: { preset?: string } })?.theme?.preset ??
                      "cute-pastel",
                  )}
                  onChange={(e) =>
                    history.set({
                      ...draft,
                      settings: {
                        ...draft.settings,
                        theme: {
                          ...((draft.settings as { theme?: object }).theme ?? {}),
                          preset: e.target.value,
                        },
                      },
                    })
                  }
                  className="mt-1 w-full rounded-xl border px-2 py-1.5 text-sm"
                >
                  {THEME_PRESETS.map((p) => (
                    <option key={p} value={p}>
                      {THEME_LABELS[p] ?? p}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>

          <div className="hidden lg:block">{canvasPanel}</div>
          <div className="lg:hidden">
            {panel === "canvas" && canvasPanel}
            {panel === "library" && libraryPanel}
            {panel === "properties" && propertiesPanel}
            {panel === "data" && dataPanel}
            {panel === "preview" && (
              <div className="rounded-3xl border-2 border-rose-100 bg-[#fff8f5] p-3">
                <StepRenderer
                  key={JSON.stringify(draft.stepsSchema)}
                  steps={draft.stepsSchema.steps}
                  data={samplePreview}
                  assets={[]}
                  initialIndex={previewIndex}
                  previewMode
                />
              </div>
            )}
            {panel === "analytics" && analytics && (
              <pre className="overflow-auto rounded-2xl bg-violet-50 p-3 text-xs">
                {JSON.stringify(analytics, null, 2)}
              </pre>
            )}
          </div>

          <div className="mt-4 hidden lg:block">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-bold text-violet-700">ตัวอย่างหน้าผู้รับ</p>
              <select
                value={previewIndex}
                onChange={(e) => setPreviewIndex(Number(e.target.value))}
                className="rounded-xl border px-2 py-1 text-xs"
              >
                {draft.stepsSchema.steps.map((s, i) => (
                  <option key={s.key} value={i}>
                    ไปที่: {s.key}
                  </option>
                ))}
              </select>
            </div>
            <div className="mx-auto max-w-md rounded-[2rem] border-4 border-violet-200 bg-[#fff8f5] p-3 shadow-inner">
              <StepRenderer
                key={`${previewIndex}-${draft.stepsSchema.steps.map((s) => s.key).join(",")}`}
                steps={draft.stepsSchema.steps}
                data={samplePreview}
                assets={[]}
                initialIndex={previewIndex}
                previewMode
              />
            </div>
          </div>
        </section>

        <aside className="hidden space-y-4 lg:block">
          <div className="rounded-3xl border-2 border-violet-100 bg-white p-3">
            <p className="mb-2 text-sm font-bold text-violet-700">คุณสมบัติขั้นตอน</p>
            {propertiesPanel}
          </div>
          <div className="rounded-3xl border-2 border-violet-100 bg-white p-3">
            <p className="mb-2 text-sm font-bold text-violet-700">โครงสร้างข้อมูล</p>
            {dataPanel}
          </div>
          {mode === "expert" && (
            <div className="rounded-3xl border-2 border-violet-100 bg-white p-3 text-xs text-violet-600">
              <p className="mb-2 font-bold text-violet-700">กฎการทำงานระดับผู้เชี่ยวชาญ</p>
              <p>
                ใช้กฎที่ระบบรองรับเท่านั้น (ข้อมูลว่าง / ไม่มีไฟล์ / ลดการเคลื่อนไหว) —
                ห้ามใช้โค้ดที่กำหนดเอง
              </p>
              <button
                type="button"
                className="mt-2 rounded-full border px-3 py-1.5 font-semibold"
                onClick={() => {
                  const rules = Array.isArray(
                    (draft.settings as { runtimeRules?: unknown[] }).runtimeRules,
                  )
                    ? [
                        ...((draft.settings as { runtimeRules: unknown[] }).runtimeRules ?? []),
                      ]
                    : [];
                  rules.push({
                    id: `rule_${rules.length + 1}`,
                    when: { op: "asset-missing" },
                    then: { action: "use-fallback-emoji" },
                  });
                  history.set({
                    ...draft,
                    settings: { ...draft.settings, runtimeRules: rules },
                  });
                }}
              >
                + เพิ่มกฎเมื่อไม่มีไฟล์ให้ใช้อีโมจิสำรอง
              </button>
            </div>
          )}
        </aside>
      </div>

      <div className="mx-auto w-full max-w-7xl space-y-3 px-4 pb-8">
        {validation && (
          <div className="rounded-3xl border-2 border-violet-100 bg-white p-4">
            <p className="font-bold text-violet-800">
              ผลการตรวจสอบ: {validation.ok ? "ผ่าน" : "ไม่ผ่าน"}
            </p>
            <ul className="mt-2 space-y-1 text-sm">
              {validation.errors.map((e, i) => (
                <li key={`e${i}`} className="text-red-600">
                  ✕ {e.message}
                </li>
              ))}
              {validation.warnings.map((w, i) => (
                <li key={`w${i}`} className="text-amber-600">
                  ! {w.message}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="rounded-3xl border-2 border-violet-100 bg-white p-4">
          <p className="font-bold text-violet-800">เผยแพร่ (ผู้ดูแลระบบเท่านั้น)</p>
          <p className="mt-1 text-xs text-violet-400">
            รุ่นที่เผยแพร่แล้วจะแก้ไขไม่ได้ — อีเวนต์เดิมจะไม่เปลี่ยนตามรุ่นใหม่
          </p>
          <textarea
            value={publishNotes}
            onChange={(e) => setPublishNotes(e.target.value)}
            placeholder="บันทึกประจำรุ่น *"
            className="mt-2 w-full rounded-2xl border-2 border-violet-100 px-3 py-2 text-sm"
            rows={3}
          />
          <label className="mt-2 flex items-center gap-2 text-sm text-violet-700">
            <input
              type="checkbox"
              checked={breaking}
              onChange={(e) => setBreaking(e.target.checked)}
            />
            มีการเปลี่ยนแปลงที่ไม่รองรับรุ่นเดิม
          </label>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void publish()}
              className="rounded-full bg-rose-500 px-5 py-2 text-sm font-bold text-white"
            >
              เผยแพร่
            </button>
            <button
              type="button"
              onClick={() => void loadAnalytics()}
              className="rounded-full border-2 border-violet-200 px-5 py-2 text-sm font-semibold text-violet-700"
            >
              ข้อมูลวิเคราะห์
            </button>
          </div>
        </div>

        {analytics && (
          <div className="rounded-3xl border-2 border-violet-100 bg-white p-4">
            <p className="font-bold text-violet-800">ข้อมูลวิเคราะห์ (ข้อมูลจริงเท่านั้น)</p>
            <pre className="mt-2 overflow-auto rounded-2xl bg-violet-50 p-3 text-xs text-violet-900">
              {JSON.stringify(analytics, null, 2)}
            </pre>
          </div>
        )}

        {message && (
          <p className="rounded-2xl border-2 border-violet-200 bg-violet-50 px-4 py-3 text-sm text-violet-800">
            {message}
          </p>
        )}
      </div>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t-2 border-violet-100 bg-white/95 p-3 backdrop-blur lg:hidden">
        <div className="mx-auto flex max-w-lg gap-2">
          <button
            type="button"
            onClick={() => setPanel("library")}
            className="flex-1 rounded-full border py-2 text-xs font-semibold"
          >
            + ขั้นตอน
          </button>
          <button
            type="button"
            onClick={() => setPanel("preview")}
            className="flex-1 rounded-full border py-2 text-xs font-semibold"
          >
            ดูตัวอย่าง
          </button>
          <button
            type="button"
            onClick={() => void saveDraft()}
            className="flex-1 rounded-full bg-violet-600 py-2 text-xs font-bold text-white"
          >
            บันทึก
          </button>
        </div>
      </div>
    </div>
  );
}
