import Link from "next/link";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-pink-100 via-rose-50 to-amber-50">
      <div className="mx-auto flex min-h-screen w-full max-w-2xl flex-col items-center justify-center px-4 py-12 text-center">
        <div className="animate-float text-7xl sm:text-8xl">🎁</div>
        <h1 className="mt-6 text-4xl font-bold text-rose-600 sm:text-5xl">Wish Flow</h1>
        <p className="mt-4 text-lg text-rose-900/70 sm:text-xl">
          สร้างการ์ดอวยพร → แชร์ QR → เพื่อนกรอก PIN เปิดดู 🎉
        </p>
        <div className="mt-10 flex w-full max-w-sm flex-col gap-3 sm:flex-row sm:justify-center">
          <Link
            href="/events?create=1"
            className="rounded-full bg-rose-500 px-8 py-4 text-lg font-semibold text-white shadow-lg shadow-rose-200 transition hover:-translate-y-0.5 hover:bg-rose-600"
          >
            ✨ สร้างการ์ดอวยพร
          </Link>
          <Link
            href="/events"
            className="rounded-full border-2 border-rose-200 bg-white px-8 py-4 text-lg font-semibold text-rose-600 shadow-sm transition hover:-translate-y-0.5 hover:bg-rose-50"
          >
            📋 การ์ดของฉัน
          </Link>
        </div>
      </div>
    </main>
  );
}
