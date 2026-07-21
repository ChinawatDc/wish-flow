/** ปกบังการ์ดที่หมดอายุ — ใช้บน list / guest / preview */
export function ExpiredCardOverlay({
  compact = false,
}: {
  compact?: boolean;
}) {
  return (
    <div
      className={`absolute inset-0 z-20 flex flex-col items-center justify-center bg-slate-900/70 backdrop-blur-[2px] ${
        compact ? "rounded-3xl p-3" : "rounded-[inherit] p-6"
      }`}
      role="status"
      aria-label="การ์ดหมดอายุแล้ว"
    >
      <p className={compact ? "text-2xl" : "text-4xl"}>⏳</p>
      <p
        className={`mt-2 font-bold text-white ${
          compact ? "text-sm" : "text-lg"
        }`}
      >
        การ์ดหมดอายุแล้ว
      </p>
      {!compact && (
        <p className="mt-1 text-center text-sm text-white/80">
          ไม่สามารถเปิดดูเนื้อหาได้แล้ว
        </p>
      )}
    </div>
  );
}
