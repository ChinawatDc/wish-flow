import Link from "next/link";

const LINKS = [
  {
    href: "/admin/users",
    title: "จัดการผู้ใช้",
    desc: "แยกตาม Role · ระงับ · รีเซ็ตรหัสผ่าน/PIN",
    emoji: "👥",
  },
  {
    href: "/admin/events",
    title: "การ์ดทั้งหมด",
    desc: "ดูการ์ดทุกบัญชีแบบอ่านอย่างเดียว",
    emoji: "🎴",
  },
  {
    href: "/admin/templates",
    title: "สตูดิโอเทมเพลต",
    desc: "สร้าง · เผยแพร่ · วิเคราะห์เทมเพลต",
    emoji: "🎨",
  },
  {
    href: "/admin/support",
    title: "เคสติดต่อ",
    desc: "รับเคส · ตอบ · ปิดเคส",
    emoji: "🎫",
  },
  {
    href: "/admin/inbox",
    title: "กล่องข้อความ",
    desc: "แชทกับผู้ใช้ที่ล็อกอินแล้ว",
    emoji: "💬",
  },
  {
    href: "/admin/logs",
    title: "บันทึกระบบ",
    desc: "Audit Log + System Log + ส่งออก",
    emoji: "📋",
  },
  {
    href: "/events",
    title: "การ์ดของฉัน",
    desc: "สร้างและจัดการการ์ดของบัญชีนี้",
    emoji: "✨",
  },
  {
    href: "/marketplace",
    title: "คลังการ์ดแชร์",
    desc: "ดูการ์ดที่ผู้อื่นแชร์ไว้",
    emoji: "💝",
  },
] as const;

export default function AdminDashboardPage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-violet-50 to-rose-50">
      <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6">
        <p className="text-sm font-semibold text-violet-400">ผู้ดูแลระบบ</p>
        <h1 className="mt-1 text-3xl font-bold text-violet-800">แดชบอร์ด 🛠️</h1>
        <p className="mt-2 text-sm text-violet-500">
          เลือกเมนูที่ต้องการจัดการ — การ์ดของ user คนอื่นดูได้อย่างเดียว ห้ามแก้ไข
        </p>

        <div className="mt-8 grid gap-3 sm:grid-cols-2">
          {LINKS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-3xl border-2 border-violet-100 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-violet-300 hover:shadow-md"
            >
              <div className="text-3xl">{item.emoji}</div>
              <h2 className="mt-3 text-lg font-bold text-violet-800">{item.title}</h2>
              <p className="mt-1 text-sm text-violet-400">{item.desc}</p>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
