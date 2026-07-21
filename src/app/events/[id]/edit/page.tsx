"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { ImageUploader, type UploadedAsset } from "@/components/ImageUploader";
import { TemplateExplorer, type TemplateSummary } from "@/components/TemplateExplorer";
import { ThaiDatePicker } from "@/components/ThaiDatePicker";
import { StepRenderer } from "@/components/steps/StepRenderer";
import type { StepsSchema } from "@/lib/validation";

type TemplateDetail = {
  id: string;
  slug: string;
  name: string;
  description: string;
  category?: string;
  stepsSchema: StepsSchema;
};

type EventDetail = {
  id: string;
  name: string;
  eventDate: string | null;
  expiresAt: string | null;
  templateId: string | null;
  templateData: Record<string, unknown>;
  status: string;
  viewCount: number;
  assets: UploadedAsset[];
  stats: { unlockSuccess: number; unlockFail: number };
  template: TemplateDetail | null;
};

const FIELD_LABELS: Record<string, string> = {
  title_text: "ข้อความเปิดกล่อง 🎁",
  message_text: "คำอวยพร 💌",
  sender_name: "จาก (ชื่อผู้ส่ง)",
  cake_style: "แบบเค้ก 🎂",
  typewriter_text: "ข้อความพิมพ์ดีด ⌨️",
  envelope_message: "ข้อความในซอง 💌",
  countdown_title: "ข้อความก่อนนับถอยหลัง 🎬",
  final_message: "ข้อความปิดท้าย 🎉",
  confetti_message: "ข้อความหลังคอนเฟตติ 🎊",
  balloon_message: "ข้อความหลังแตะลูกโป่ง 🎈",
  heart_message: "ข้อความหลังเก็บหัวใจ 💗",
  match_message: "ข้อความหลังจับคู่สำเร็จ 🧠",
  quiz_question: "คำถามควิซ 🤔",
  quiz_option_1: "ตัวเลือกที่ 1",
  quiz_option_2: "ตัวเลือกที่ 2",
  quiz_option_3: "ตัวเลือกที่ 3",
  quiz_correct: "ข้อที่ถูก (1-3)",
  wheel_wishes: "คำอวยพรบนวงล้อ (คั่นด้วย , ) 🎡",
  gift_message: "ข้อความในกล่องของขวัญ 🎁",
  photo_caption: "คำบรรยายรูป 📸",
  polaroid_caption: "คำบรรยายโพลารอยด์ 📸",
  slideshow_caption: "คำบรรยายสไลด์โชว์ 🎞️",
  collage_caption: "คำบรรยายคอลลาจ 🖼️",
  timeline_caption: "หัวข้อไทม์ไลน์ 🛤️",
  scratch_caption: "ข้อความชวนขูด ✨",
  puzzle_caption: "ข้อความชวนต่อจิ๊กซอว์ 🧩",
};

function isLongField(key: string) {
  return (
    key.includes("message") ||
    key.includes("title") ||
    key.includes("text") ||
    key.includes("wishes")
  );
}

function SectionCard({
  emoji,
  title,
  defaultOpen,
  children,
}: {
  emoji: string;
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen ?? false);
  return (
    <section className="overflow-hidden rounded-3xl border-2 border-rose-100 bg-white shadow-sm">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between px-5 py-4 text-left"
      >
        <span className="text-base font-bold text-rose-800">
          {emoji} {title}
        </span>
        <span className={`text-rose-300 transition ${open ? "rotate-180" : ""}`}>▼</span>
      </button>
      {open && <div className="border-t-2 border-rose-50 px-5 py-4">{children}</div>}
    </section>
  );
}

export default function EditEventPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params.id;

  const [event, setEvent] = useState<EventDetail | null>(null);
  const [name, setName] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [templateId, setTemplateId] = useState("");
  const [templateInfo, setTemplateInfo] = useState<TemplateDetail | null>(null);
  const [templateData, setTemplateData] = useState<Record<string, string>>({});
  const [assets, setAssets] = useState<UploadedAsset[]>([]);
  const [status, setStatus] = useState("active");
  const [error, setError] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<"saved" | "dirty" | "saving">("saved");
  const [explorerOpen, setExplorerOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [showPinForm, setShowPinForm] = useState(false);
  const [customPin, setCustomPin] = useState("");
  const [newPin, setNewPin] = useState<string | null>(null);
  const loaded = useRef(false);

  const fields = useMemo(() => {
    const steps = templateInfo?.stepsSchema?.steps ?? [];
    const keys = new Set<string>();
    for (const step of steps) {
      for (const f of step.fields) keys.add(f);
    }
    return Array.from(keys);
  }, [templateInfo]);

  useEffect(() => {
    (async () => {
      const res = await fetch(`/api/events/${id}`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "โหลดข้อมูลไม่สำเร็จ");
        return;
      }
      setEvent(data);
      setName(data.name);
      setEventDate(data.eventDate ?? "");
      setExpiresAt(data.expiresAt ?? "");
      setTemplateId(data.templateId ?? "");
      setTemplateInfo(data.template);
      setStatus(data.status);
      setAssets(data.assets ?? []);
      const td = (data.templateData ?? {}) as Record<string, unknown>;
      const asStrings: Record<string, string> = {};
      for (const [k, v] of Object.entries(td)) {
        asStrings[k] = typeof v === "string" ? v : "";
      }
      setTemplateData(asStrings);
      loaded.current = true;
    })();
  }, [id]);

  const save = useCallback(async () => {
    setSaveState("saving");
    setError(null);
    try {
      const res = await fetch(`/api/events/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name || undefined,
          eventDate: eventDate || null,
          expiresAt: expiresAt || null,
          templateId: templateId || null,
          templateData,
          status,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "บันทึกไม่สำเร็จ");
      setSaveState("saved");
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "บันทึกไม่สำเร็จ");
      setSaveState("dirty");
      return false;
    }
  }, [id, name, eventDate, expiresAt, templateId, templateData, status]);

  // autosave (debounce 2s หลังแก้)
  useEffect(() => {
    if (!loaded.current) return;
    setSaveState("dirty");
    const timer = setTimeout(() => {
      void save();
    }, 2000);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name, eventDate, expiresAt, templateId, templateData, status]);

  // เตือนถ้าออกจากหน้าโดยยังไม่บันทึก
  useEffect(() => {
    function onBeforeUnload(e: BeforeUnloadEvent) {
      if (saveState !== "saved") e.preventDefault();
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [saveState]);

  async function onSaveAndBack() {
    const ok = await save();
    if (ok) router.push("/events");
  }

  function onSelectTemplate(t: TemplateSummary) {
    setTemplateId(t.id);
    fetch(`/api/templates/${t.slug}`)
      .then((r) => r.json())
      .then((data) => setTemplateInfo(data))
      .catch(() => {});
  }

  async function changePin(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const res = await fetch(`/api/events/${id}/regenerate-pin`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin: customPin }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "เปลี่ยน PIN ไม่สำเร็จ");
      return;
    }
    setNewPin(data.pin);
    setCustomPin("");
    setShowPinForm(false);
  }

  if (!event && !error) {
    return <main className="p-8 text-center text-rose-300">กำลังโหลด… 🎈</main>;
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-pink-50 to-amber-50 pb-28">
      <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6">
        <div className="flex items-center justify-between">
          <Link href="/events" className="text-sm font-medium text-rose-500 hover:underline">
            ← กลับ
          </Link>
          <span
            className={`rounded-full px-3 py-1 text-xs font-semibold ${
              saveState === "saved"
                ? "bg-emerald-50 text-emerald-600"
                : saveState === "saving"
                  ? "bg-amber-50 text-amber-600"
                  : "bg-rose-50 text-rose-400"
            }`}
            role="status"
          >
            {saveState === "saved"
              ? "✓ บันทึกแล้ว"
              : saveState === "saving"
                ? "กำลังบันทึก…"
                : "มีการแก้ไข"}
          </span>
        </div>
        <h1 className="mt-3 text-2xl font-bold text-rose-700 sm:text-3xl">🎨 แต่งการ์ด</h1>

        {error && (
          <p className="mt-4 rounded-2xl border-2 border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
            😢 {error}
          </p>
        )}
        {newPin && (
          <div className="mt-4 rounded-2xl border-2 border-amber-200 bg-amber-50 px-4 py-3">
            <p className="text-sm font-bold text-amber-900">🔑 PIN ใหม่ (จดไว้นะ)</p>
            <p className="mt-2 font-mono text-3xl tracking-[0.25em] text-amber-900">{newPin}</p>
          </div>
        )}

        <div className="mt-5 space-y-4">
          {/* 1. ข้อมูลพื้นฐาน */}
          <SectionCard emoji="📝" title="ข้อมูลพื้นฐาน" defaultOpen>
            <div className="space-y-4">
              <label className="block text-sm font-semibold text-rose-800">
                ชื่อการ์ด
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="mt-1 w-full rounded-2xl border-2 border-rose-100 px-4 py-3 outline-none focus:border-rose-300"
                />
              </label>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="text-sm font-semibold text-rose-800">วันเกิด/วันสำคัญ 🎂</p>
                  <div className="mt-1">
                    <ThaiDatePicker value={eventDate} onChange={setEventDate} />
                  </div>
                </div>
                <div>
                  <p className="text-sm font-semibold text-rose-800">วันหมดอายุการ์ด ⏳</p>
                  <div className="mt-1">
                    <ThaiDatePicker
                      value={expiresAt}
                      onChange={setExpiresAt}
                      placeholder="ไม่หมดอายุ"
                    />
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-between rounded-2xl border-2 border-rose-50 bg-rose-50/50 px-4 py-3">
                <div>
                  <p className="text-sm font-semibold text-rose-800">
                    {status === "active" ? "🟢 เผยแพร่แล้ว" : "📝 ฉบับร่าง"}
                  </p>
                  <p className="text-xs text-rose-400">
                    {status === "active"
                      ? "คนที่มีลิงก์ + PIN เปิดดูได้"
                      : "ยังไม่เปิดให้คนอื่นดู"}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setStatus((s) => (s === "active" ? "draft" : "active"))}
                  role="switch"
                  aria-checked={status === "active"}
                  className={`relative h-8 w-14 rounded-full transition ${
                    status === "active" ? "bg-emerald-400" : "bg-rose-200"
                  }`}
                >
                  <span
                    className={`absolute top-1 h-6 w-6 rounded-full bg-white shadow transition-all ${
                      status === "active" ? "left-7" : "left-1"
                    }`}
                  />
                </button>
              </div>
              <button
                type="button"
                onClick={() => setShowPinForm((v) => !v)}
                className="rounded-2xl border-2 border-rose-200 px-5 py-2.5 text-sm font-semibold text-rose-600 hover:bg-rose-50"
              >
                🔑 เปลี่ยน PIN
              </button>
              {showPinForm && (
                <form onSubmit={changePin} className="rounded-2xl border-2 border-amber-100 p-4">
                  <label className="block text-sm font-semibold text-amber-900">
                    PIN ใหม่ 6 หลัก
                    <input
                      inputMode="numeric"
                      pattern="\d{6}"
                      maxLength={6}
                      value={customPin}
                      onChange={(e) =>
                        setCustomPin(e.target.value.replace(/\D/g, "").slice(0, 6))
                      }
                      required
                      autoFocus
                      className="mt-1 w-full rounded-2xl border-2 border-amber-100 px-4 py-3 text-center font-mono text-2xl tracking-[0.4em] outline-none focus:border-amber-300"
                    />
                  </label>
                  <button
                    type="submit"
                    disabled={customPin.length !== 6}
                    className="mt-3 rounded-2xl bg-amber-500 px-6 py-2.5 text-sm font-semibold text-white shadow-md hover:bg-amber-600 disabled:opacity-50"
                  >
                    ยืนยัน PIN ใหม่
                  </button>
                </form>
              )}
              {event && (
                <p className="text-xs text-rose-300">
                  👀 เปิดดู {event.viewCount} ครั้ง · ปลดล็อกสำเร็จ {event.stats.unlockSuccess} ·
                  ไม่สำเร็จ {event.stats.unlockFail}
                </p>
              )}
            </div>
          </SectionCard>

          {/* 2. รูปภาพ */}
          <SectionCard emoji="📸" title={`รูปภาพ (${assets.length})`}>
            <ImageUploader eventId={id} assets={assets} onChange={setAssets} />
          </SectionCard>

          {/* 3. เทมเพลต */}
          <SectionCard emoji="🎨" title="เทมเพลต" defaultOpen>
            {templateInfo ? (
              <div className="flex items-center justify-between gap-3 rounded-2xl border-2 border-rose-100 bg-rose-50/50 p-4">
                <div>
                  <p className="font-bold text-rose-800">💖 {templateInfo.name}</p>
                  <p className="mt-1 text-xs text-rose-400">{templateInfo.description}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setExplorerOpen(true)}
                  className="shrink-0 rounded-full border-2 border-rose-200 bg-white px-4 py-2 text-sm font-semibold text-rose-600 hover:bg-rose-50"
                >
                  เปลี่ยน
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setExplorerOpen(true)}
                className="w-full rounded-2xl border-2 border-dashed border-rose-200 py-6 text-center text-rose-400 hover:border-rose-300 hover:bg-rose-50"
              >
                <span className="block text-3xl">🎁</span>
                เลือกเทมเพลต
              </button>
            )}
          </SectionCard>

          {/* 4. เนื้อหาการ์ด */}
          {fields.length > 0 && (
            <SectionCard emoji="💌" title="เนื้อหาการ์ด" defaultOpen>
              <div className="space-y-3">
                {fields.map((key) => (
                  <label key={key} className="block text-sm font-medium text-rose-700">
                    {FIELD_LABELS[key] ?? key}
                    {isLongField(key) ? (
                      <textarea
                        value={templateData[key] ?? ""}
                        onChange={(e) =>
                          setTemplateData((prev) => ({ ...prev, [key]: e.target.value }))
                        }
                        rows={3}
                        className="mt-1 w-full rounded-2xl border-2 border-rose-100 px-4 py-3 outline-none focus:border-rose-300"
                      />
                    ) : (
                      <input
                        value={templateData[key] ?? ""}
                        onChange={(e) =>
                          setTemplateData((prev) => ({ ...prev, [key]: e.target.value }))
                        }
                        className="mt-1 w-full rounded-2xl border-2 border-rose-100 px-4 py-3 outline-none focus:border-rose-300"
                      />
                    )}
                  </label>
                ))}
              </div>
            </SectionCard>
          )}
        </div>
      </div>

      {/* action bar ล่างจอ */}
      <div className="fixed inset-x-0 bottom-0 border-t-2 border-rose-100 bg-white/90 p-3 backdrop-blur">
        <div className="mx-auto flex w-full max-w-3xl gap-2">
          {templateInfo && (
            <button
              type="button"
              onClick={() => setPreviewOpen(true)}
              className="rounded-2xl border-2 border-rose-200 bg-white px-5 py-3 text-sm font-semibold text-rose-600 hover:bg-rose-50"
            >
              👀 ดูตัวอย่าง
            </button>
          )}
          <button
            type="button"
            onClick={onSaveAndBack}
            disabled={saveState === "saving"}
            className="flex-1 rounded-2xl bg-rose-500 px-6 py-3 text-base font-bold text-white shadow-lg shadow-rose-200 transition hover:bg-rose-600 disabled:opacity-50"
          >
            {saveState === "saving" ? "กำลังบันทึก…" : "💾 บันทึกและกลับ"}
          </button>
        </div>
      </div>

      <TemplateExplorer
        open={explorerOpen}
        onClose={() => setExplorerOpen(false)}
        currentSlug={templateInfo?.slug}
        onSelect={onSelectTemplate}
      />

      {/* mobile preview */}
      {previewOpen && templateInfo && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-rose-900/40 p-4 backdrop-blur-sm"
          onClick={() => setPreviewOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="ตัวอย่างการ์ด"
            onClick={(e) => e.stopPropagation()}
            className="flex h-[85dvh] w-full max-w-sm flex-col overflow-hidden rounded-[2rem] border-8 border-rose-900/80 bg-gradient-to-b from-pink-100 via-rose-50 to-amber-50 shadow-2xl"
          >
            <div className="flex items-center justify-between p-3">
              <p className="text-sm font-bold text-rose-700">📱 ตัวอย่างบนมือถือ</p>
              <button
                type="button"
                onClick={() => setPreviewOpen(false)}
                className="grid h-8 w-8 place-items-center rounded-full bg-rose-100 text-rose-500"
                aria-label="ปิดตัวอย่าง"
              >
                ✕
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-3 pb-4">
              <StepRenderer
                key={`${templateInfo.slug}-${previewOpen}`}
                steps={templateInfo.stepsSchema.steps}
                data={templateData}
                assets={assets}
              />
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
