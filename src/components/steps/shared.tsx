"use client";

/** Props มาตรฐานที่ step component ทุกตัวรับ */
export type StepAsset = { id: string; url: string };

export type StepComponentProps = {
  data: Record<string, unknown>;
  assets: StepAsset[];
  onNext: () => void;
  isLast: boolean;
};

export function field(data: Record<string, unknown>, key: string): string {
  const value = data[key];
  return typeof value === "string" ? value : "";
}

export function NextButton({
  onNext,
  isLast,
  label,
}: {
  onNext: () => void;
  isLast: boolean;
  label?: string;
}) {
  return (
    <button
      type="button"
      onClick={onNext}
      className="rounded-full bg-rose-500 px-8 py-3.5 text-base font-semibold text-white shadow-lg shadow-rose-200 transition hover:-translate-y-0.5 hover:bg-rose-600"
    >
      {label ?? (isLast ? "จบแล้ว 💛" : "ไปต่อ 💫")}
    </button>
  );
}

export function StepShell({ children }: { children: React.ReactNode }) {
  return (
    <section className="flex min-h-[65vh] flex-col items-center justify-center gap-6 px-4 text-center">
      {children}
    </section>
  );
}

/** รูป fallback เมื่อไม่มี asset */
export function AssetImage({
  asset,
  className,
  alt,
}: {
  asset: StepAsset | undefined;
  className?: string;
  alt?: string;
}) {
  if (!asset?.url) {
    return (
      <div
        className={`grid place-items-center bg-rose-100 text-5xl ${className ?? ""}`}
        aria-hidden
      >
        🌸
      </div>
    );
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={asset.url} alt={alt ?? "รูปภาพ"} className={className} loading="lazy" />;
}
