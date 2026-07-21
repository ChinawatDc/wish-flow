"use client";

import { useRef, useState } from "react";

export type UploadedAsset = {
  id: string;
  url: string;
  sortOrder: number;
};

type Props = {
  eventId: string;
  assets: UploadedAsset[];
  onChange: (assets: UploadedAsset[]) => void;
};

export function ImageUploader({ eventId, assets, onChange }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  function uploadFile(file: File): Promise<UploadedAsset> {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      const form = new FormData();
      form.append("file", file);
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) setProgress(Math.round((e.loaded / e.total) * 100));
      };
      xhr.onload = () => {
        try {
          const json = JSON.parse(xhr.responseText);
          if (xhr.status >= 200 && xhr.status < 300) resolve(json.asset);
          else reject(new Error(json.error || "อัปโหลดไม่สำเร็จ"));
        } catch {
          reject(new Error("อัปโหลดไม่สำเร็จ"));
        }
      };
      xhr.onerror = () => reject(new Error("อัปโหลดไม่สำเร็จ"));
      xhr.open("POST", `/api/events/${eventId}/assets`);
      xhr.send(form);
    });
  }

  async function onFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    setError(null);
    try {
      const next = [...assets];
      for (const file of Array.from(files)) {
        setProgress(0);
        const asset = await uploadFile(file);
        next.push(asset);
        onChange([...next]);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "อัปโหลดไม่สำเร็จ");
    } finally {
      setUploading(false);
      setProgress(0);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function remove(assetId: string) {
    const res = await fetch(`/api/events/${eventId}/assets/${assetId}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "ลบรูปไม่สำเร็จ");
      return;
    }
    onChange(assets.filter((a) => a.id !== assetId));
  }

  async function move(index: number, dir: -1 | 1) {
    const target = index + dir;
    if (target < 0 || target >= assets.length) return;
    const next = [...assets];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
    await fetch(`/api/events/${eventId}/assets/reorder`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderedIds: next.map((a) => a.id) }),
    });
  }

  return (
    <div>
      {error && (
        <p className="mb-3 rounded-2xl border-2 border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
          😢 {error}
        </p>
      )}

      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {assets.map((asset, i) => (
          <div
            key={asset.id}
            className="group relative overflow-hidden rounded-2xl border-2 border-rose-100"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={asset.url}
              alt={`รูปที่ ${i + 1}`}
              className="aspect-square w-full object-cover"
              loading="lazy"
            />
            <span className="absolute left-1 top-1 rounded-full bg-white/90 px-2 py-0.5 text-xs font-bold text-rose-500">
              {i + 1}
            </span>
            <div className="absolute inset-x-0 bottom-0 flex justify-center gap-1 bg-gradient-to-t from-black/50 to-transparent p-1.5">
              <button
                type="button"
                onClick={() => move(i, -1)}
                disabled={i === 0}
                className="rounded-full bg-white/90 px-2 py-1 text-xs disabled:opacity-40"
                aria-label="เลื่อนขึ้น"
              >
                ◀
              </button>
              <button
                type="button"
                onClick={() => remove(asset.id)}
                className="rounded-full bg-white/90 px-2 py-1 text-xs text-red-500"
                aria-label="ลบรูป"
              >
                🗑️
              </button>
              <button
                type="button"
                onClick={() => move(i, 1)}
                disabled={i === assets.length - 1}
                className="rounded-full bg-white/90 px-2 py-1 text-xs disabled:opacity-40"
                aria-label="เลื่อนลง"
              >
                ▶
              </button>
            </div>
          </div>
        ))}

        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="grid aspect-square place-items-center rounded-2xl border-2 border-dashed border-rose-200 text-rose-400 transition hover:border-rose-300 hover:bg-rose-50 disabled:opacity-50"
        >
          {uploading ? (
            <span className="text-xs">{progress}%</span>
          ) : (
            <span className="text-center text-xs">
              <span className="block text-2xl">📷</span>
              เพิ่มรูป
            </span>
          )}
        </button>
      </div>

      <p className="mt-2 text-xs text-rose-300">
        JPG / PNG / WebP ไม่เกิน 5 MB ต่อรูป (สูงสุด 12 รูป)
      </p>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        capture={undefined}
        onChange={(e) => onFiles(e.target.files)}
        className="hidden"
      />
    </div>
  );
}
