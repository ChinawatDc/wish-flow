"use client";

type Props = {
  open: boolean;
  onClose: () => void;
  title: string;
  url: string;
  dataUrl: string;
};

export function QrModal({ open, onClose, title, url, dataUrl }: Props) {
  if (!open) return null;

  async function copyLink() {
    await navigator.clipboard.writeText(url);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
      <div
        role="dialog"
        aria-modal="true"
        className="w-full max-w-md rounded-3xl border-2 border-rose-100 bg-white p-5 shadow-2xl sm:p-6"
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-bold text-rose-700">📱 แชร์การ์ด</h3>
            <p className="text-sm text-rose-400">{title}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl px-2 py-1 text-rose-300 hover:bg-rose-50"
            aria-label="ปิด"
          >
            ✕
          </button>
        </div>

        <div className="flex flex-col items-center gap-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={dataUrl}
            alt="QR code ของการ์ด"
            className="h-56 w-56 rounded-2xl border-2 border-rose-100"
          />
          <p className="break-all text-center text-xs text-rose-400 sm:text-sm">{url}</p>
          <button
            type="button"
            onClick={copyLink}
            className="w-full rounded-2xl bg-rose-500 px-4 py-3.5 text-sm font-semibold text-white shadow-md shadow-rose-200 hover:bg-rose-600"
          >
            📋 คัดลอกลิงก์
          </button>
        </div>
      </div>
    </div>
  );
}
