"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import {
  FormEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import { ExpiredCardOverlay } from "@/components/ExpiredCardOverlay";
import { GUESTBOOK_POLL_INTERVAL_MS } from "@/lib/constants";

type WallEntry = {
  id: string;
  displayName: string | null;
  message: string;
  hasPhoto: boolean;
  photoUrl: string | null;
  createdAt: string;
};

type Meta = {
  name: string;
  canSubmit: boolean;
  reason?: string;
};

export default function GuestbookPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;

  const [meta, setMeta] = useState<Meta | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [message, setMessage] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [facing, setFacing] = useState<"user" | "environment">("user");
  const [cameraOn, setCameraOn] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expired, setExpired] = useState(false);
  const [wall, setWall] = useState<WallEntry[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const loadMeta = useCallback(async () => {
    const res = await fetch(`/api/e/${id}/guestbook`);
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "โหลดไม่สำเร็จ");
      return;
    }
    if (data.reason === "expired") setExpired(true);
    setMeta(data);
  }, [id]);

  const loadWall = useCallback(
    async (cursor?: string | null, append = false) => {
      const q = new URLSearchParams({ limit: "12" });
      if (cursor) q.set("cursor", cursor);
      const res = await fetch(`/api/e/${id}/guestbook/wall?${q}`);
      if (!res.ok) return;
      const data = await res.json();
      setWall((prev) => (append ? [...prev, ...data.entries] : data.entries));
      setNextCursor(data.nextCursor);
    },
    [id],
  );

  useEffect(() => {
    void loadMeta();
    void loadWall();
  }, [loadMeta, loadWall]);

  useEffect(() => {
    const t = setInterval(() => {
      void loadWall();
    }, GUESTBOOK_POLL_INTERVAL_MS);
    return () => clearInterval(t);
  }, [loadWall]);

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  async function startCamera(mode: "user" | "environment") {
    setError(null);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: mode },
        audio: false,
      });
      streamRef.current = stream;
      setFacing(mode);
      setCameraOn(true);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
    } catch {
      setError("เปิดกล้องไม่ได้ — ลองเลือกรูปจากคลังแทนนะ");
      setCameraOn(false);
    }
  }

  function stopCamera() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCameraOn(false);
  }

  async function capturePhoto() {
    const video = videoRef.current;
    if (!video) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 720;
    canvas.height = video.videoHeight || 960;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.9),
    );
    if (!blob) return;
    const file = new File([blob], `capture-${Date.now()}.jpg`, {
      type: "image/jpeg",
    });
    setPhoto(file);
    setPreview(URL.createObjectURL(blob));
    stopCamera();
  }

  function onPickFile(file: File | null) {
    if (!file) return;
    setPhoto(file);
    setPreview(URL.createObjectURL(file));
    stopCamera();
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!meta?.canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      const form = new FormData();
      if (displayName.trim()) form.set("displayName", displayName.trim());
      form.set("message", message.trim());
      if (photo) form.set("photo", photo);
      const res = await fetch(`/api/e/${id}/guestbook/submit`, {
        method: "POST",
        body: form,
      });
      const data = await res.json();
      if (res.status === 410) {
        setExpired(true);
        setError(data.error);
        return;
      }
      if (!res.ok) {
        setError(data.error || "ส่งไม่สำเร็จ");
        return;
      }
      setSubmitted(true);
      setMessage("");
      setDisplayName("");
      setPhoto(null);
      setPreview(null);
    } catch {
      setError("มีบางอย่างผิดพลาด ลองใหม่อีกครั้งนะ");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="relative min-h-screen bg-gradient-to-b from-rose-100 via-amber-50 to-stone-50">
      {expired && <ExpiredCardOverlay />}
      <div className="mx-auto w-full max-w-lg px-4 py-8">
        <Link href={`/e/${id}`} className="text-sm font-medium text-rose-500 hover:underline">
          ← กลับ
        </Link>
        <h1 className="mt-3 font-[family-name:var(--font-mali)] text-3xl font-bold text-rose-800">
          สมุดอวยพร
        </h1>
        <p className="mt-1 text-sm text-rose-500">
          {meta?.name ?? "กำลังโหลด…"}
        </p>

        {submitted && (
          <div className="mt-4 rounded-3xl border-2 border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            ส่งคำอวยพรแล้ว — รอเจ้าของอนุมัติก่อนขึ้นกำแพงนะ 💛
          </div>
        )}
        {error && (
          <p className="mt-4 rounded-3xl border-2 border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
            {error}
          </p>
        )}

        {meta?.canSubmit && (
          <form
            onSubmit={onSubmit}
            className="mt-6 space-y-4 rounded-[2rem] border border-rose-100/80 bg-white/80 p-5 shadow-sm backdrop-blur"
          >
            <label className="block text-sm font-semibold text-rose-800">
              ชื่อ (ไม่บังคับ)
              <input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value.slice(0, 80))}
                maxLength={80}
                placeholder="แขกผู้มีเกียรติ"
                className="mt-1 w-full rounded-2xl border-2 border-rose-100 px-4 py-3 outline-none focus:border-rose-300"
              />
            </label>
            <label className="block text-sm font-semibold text-rose-800">
              คำอวยพร *
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value.slice(0, 1000))}
                required
                rows={4}
                maxLength={1000}
                placeholder="ขอให้ทั้งคู่มีความสุขตลอดไป…"
                className="mt-1 w-full rounded-2xl border-2 border-rose-100 px-4 py-3 outline-none focus:border-rose-300"
              />
            </label>

            <div className="space-y-2">
              <p className="text-sm font-semibold text-rose-800">รูป (ไม่บังคับ)</p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void startCamera("user")}
                  className="rounded-full border-2 border-rose-200 px-4 py-2 text-sm font-semibold text-rose-600"
                >
                  กล้องหน้า
                </button>
                <button
                  type="button"
                  onClick={() => void startCamera("environment")}
                  className="rounded-full border-2 border-rose-200 px-4 py-2 text-sm font-semibold text-rose-600"
                >
                  กล้องหลัง
                </button>
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="rounded-full border-2 border-rose-200 px-4 py-2 text-sm font-semibold text-rose-600"
                >
                  คลังรูป
                </button>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={(e) => onPickFile(e.target.files?.[0] ?? null)}
                />
              </div>

              {cameraOn && (
                <div className="overflow-hidden rounded-3xl bg-black">
                  <video
                    ref={videoRef}
                    playsInline
                    muted
                    className="aspect-[3/4] w-full object-cover"
                  />
                  <div className="flex gap-2 p-3">
                    <button
                      type="button"
                      onClick={() => void capturePhoto()}
                      className="flex-1 rounded-full bg-white py-2.5 text-sm font-bold text-rose-700"
                    >
                      ถ่ายรูป
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        void startCamera(
                          facing === "user" ? "environment" : "user",
                        )
                      }
                      className="rounded-full border border-white/40 px-4 py-2.5 text-sm text-white"
                    >
                      สลับ
                    </button>
                    <button
                      type="button"
                      onClick={stopCamera}
                      className="rounded-full border border-white/40 px-4 py-2.5 text-sm text-white"
                    >
                      ปิด
                    </button>
                  </div>
                </div>
              )}

              {preview && !cameraOn && (
                <div className="relative overflow-hidden rounded-3xl">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={preview} alt="ตัวอย่างรูป" className="w-full object-cover" />
                  <button
                    type="button"
                    onClick={() => {
                      setPhoto(null);
                      setPreview(null);
                    }}
                    className="absolute right-3 top-3 rounded-full bg-black/50 px-3 py-1 text-xs text-white"
                  >
                    ลบรูป
                  </button>
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={submitting || !message.trim()}
              className="w-full rounded-full bg-rose-500 py-3.5 text-base font-bold text-white shadow-lg shadow-rose-200 disabled:opacity-50"
            >
              {submitting ? "กำลังส่ง…" : "ส่งคำอวยพร"}
            </button>
          </form>
        )}

        {!meta?.canSubmit && meta && !expired && (
          <p className="mt-6 rounded-3xl border border-rose-100 bg-white/70 px-4 py-3 text-sm text-rose-500">
            สมุดอวยพรยังไม่เปิดให้ส่งข้อความในตอนนี้
          </p>
        )}

        <section className="mt-10">
          <h2 className="text-lg font-bold text-rose-800">กำแพงคำอวยพร</h2>
          <p className="text-xs text-rose-400">แสดงเฉพาะข้อความที่เจ้าของอนุมัติแล้ว</p>
          <div className="mt-4 space-y-3">
            {wall.length === 0 && (
              <p className="rounded-3xl bg-white/60 px-4 py-6 text-center text-sm text-rose-300">
                ยังไม่มีคำอวยพรบนกำแพง
              </p>
            )}
            {wall.map((e) => (
              <article
                key={e.id}
                className="rounded-3xl border border-rose-100/70 bg-white/85 p-4 shadow-sm"
              >
                {e.photoUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={e.photoUrl}
                    alt=""
                    className="mb-3 aspect-square w-full rounded-2xl object-cover"
                  />
                )}
                <p className="whitespace-pre-wrap text-rose-900">{e.message}</p>
                <p className="mt-2 text-xs text-rose-400">
                  {e.displayName || "แขกผู้มีเกียรติ"}
                </p>
              </article>
            ))}
          </div>
          {nextCursor && (
            <button
              type="button"
              onClick={() => void loadWall(nextCursor, true)}
              className="mt-4 w-full rounded-full border-2 border-rose-200 py-2.5 text-sm font-semibold text-rose-600"
            >
              โหลดเพิ่ม
            </button>
          )}
        </section>
      </div>
    </main>
  );
}
