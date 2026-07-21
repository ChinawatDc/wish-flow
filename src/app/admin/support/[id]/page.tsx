"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

const STATUS_TH: Record<string, string> = {
  NEW: "🆕 ใหม่",
  CLAIMED: "👀 รับแล้ว",
  IN_PROGRESS: "🔧 กำลังทำ",
  WAITING_USER: "💬 รอผู้ใช้",
  RESOLVED: "✅ แก้แล้ว",
  CLOSED: "🔒 ปิด",
  SPAM: "🚫 สแปม",
};

type CaseDetail = {
  id: string;
  caseNumber: number;
  status: string;
  priority: string;
  name: string;
  subject: string;
  detail: string;
  usernameOrEmail: string | null;
  contactEmail: string;
  phone: string | null;
  createdAt: string;
  assignedAdmin: { id: string; name: string | null; email: string } | null;
  linkedUser: { id: string; email: string; name: string | null } | null;
  messages: {
    id: string;
    senderType: string;
    visibility: string;
    body: string;
    createdAt: string;
  }[];
  statusHistory: {
    fromStatus: string | null;
    toStatus: string;
    note: string | null;
    createdAt: string;
  }[];
};

export default function AdminSupportCasePage() {
  const params = useParams<{ id: string }>();
  const [data, setData] = useState<CaseDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reply, setReply] = useState("");
  const [visibility, setVisibility] = useState<"PUBLIC" | "INTERNAL">("PUBLIC");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(`/api/admin/support/cases/${params.id}`);
    const json = await res.json();
    if (!res.ok) {
      setError(json.error || "โหลดไม่สำเร็จ");
      return;
    }
    setData(json.case);
  }, [params.id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function patch(body: Record<string, unknown>) {
    setBusy(true);
    const res = await fetch(`/api/admin/support/cases/${params.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setBusy(false);
    if (!res.ok) {
      const json = await res.json();
      setError(json.error || "อัปเดตไม่สำเร็จ");
      return;
    }
    await load();
  }

  async function claim() {
    setBusy(true);
    const res = await fetch(`/api/admin/support/cases/${params.id}/claim`, {
      method: "POST",
    });
    setBusy(false);
    if (!res.ok) {
      const json = await res.json();
      setError(json.error || "รับเคสไม่สำเร็จ");
    }
    await load();
  }

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!reply.trim()) return;
    setBusy(true);
    const res = await fetch(`/api/admin/support/cases/${params.id}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: reply, visibility }),
    });
    setBusy(false);
    if (!res.ok) {
      const json = await res.json();
      setError(json.error || "ส่งไม่สำเร็จ");
      return;
    }
    setReply("");
    await load();
  }

  if (error && !data) {
    return (
      <main className="min-h-screen bg-gradient-to-b from-violet-50 to-rose-50 p-8 text-center">
        <p className="text-red-500">😢 {error}</p>
      </main>
    );
  }
  if (!data) {
    return (
      <main className="min-h-screen bg-gradient-to-b from-violet-50 to-rose-50 p-8 text-center text-violet-300">
        กำลังโหลด…
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-violet-50 to-rose-50">
      <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6">
        <Link href="/admin/support" className="text-sm font-semibold text-violet-400">
          ← กลับรายการเคส
        </Link>

        {error && (
          <p className="mt-3 rounded-2xl border-2 border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
            😢 {error}
          </p>
        )}

        <div className="mt-3 rounded-3xl border-2 border-violet-100 bg-white p-5 shadow-sm">
          <p className="text-xs text-violet-400">
            เคส #{data.caseNumber} · {new Date(data.createdAt).toLocaleString("th-TH")}
          </p>
          <h1 className="text-xl font-bold text-violet-900">{data.subject}</h1>
          <p className="mt-2 whitespace-pre-wrap text-sm text-violet-700">{data.detail}</p>
          <div className="mt-3 grid grid-cols-1 gap-1 text-xs text-violet-500 sm:grid-cols-2">
            <p>ผู้แจ้ง: {data.name}</p>
            <p>อีเมล: {data.contactEmail}</p>
            {data.phone && <p>โทร: {data.phone}</p>}
            {data.usernameOrEmail && <p>บัญชีที่อ้างอิง: {data.usernameOrEmail}</p>}
            {data.linkedUser && (
              <p>
                🔗 ผูกกับบัญชี: {data.linkedUser.email}
              </p>
            )}
            {data.assignedAdmin && (
              <p>ผู้รับเคส: {data.assignedAdmin.name || data.assignedAdmin.email}</p>
            )}
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            {!data.assignedAdmin && (
              <button
                type="button"
                onClick={claim}
                disabled={busy}
                className="rounded-xl bg-violet-500 px-3 py-2 text-xs font-semibold text-white hover:bg-violet-600 disabled:opacity-50"
              >
                รับเคสนี้
              </button>
            )}
            <select
              value={data.status}
              onChange={(e) => patch({ status: e.target.value })}
              disabled={busy}
              className="rounded-xl border-2 border-violet-100 bg-white px-3 py-2 text-xs outline-none"
            >
              {Object.entries(STATUS_TH).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
            <select
              value={data.priority}
              onChange={(e) => patch({ priority: e.target.value })}
              disabled={busy}
              className="rounded-xl border-2 border-violet-100 bg-white px-3 py-2 text-xs outline-none"
            >
              <option value="LOW">ความสำคัญ: ต่ำ</option>
              <option value="NORMAL">ความสำคัญ: ปกติ</option>
              <option value="HIGH">ความสำคัญ: สูง</option>
              <option value="URGENT">ความสำคัญ: ด่วน 🔥</option>
            </select>
          </div>
        </div>

        <h2 className="mt-6 mb-2 font-bold text-violet-800">การสนทนา</h2>
        <div className="space-y-2">
          {data.messages.map((m) => (
            <div
              key={m.id}
              className={`rounded-2xl border-2 p-3 text-sm ${
                m.visibility === "INTERNAL"
                  ? "border-amber-200 bg-amber-50 text-amber-800"
                  : m.senderType === "ADMIN"
                    ? "mr-6 border-violet-100 bg-violet-50 text-violet-800"
                    : "ml-6 border-rose-100 bg-rose-50 text-rose-800"
              }`}
            >
              <p className="text-xs font-bold opacity-70">
                {m.senderType === "ADMIN" ? "เจ้าหน้าที่" : "ผู้แจ้ง"}
                {m.visibility === "INTERNAL" && " · 🔒 โน้ตภายใน (ผู้แจ้งไม่เห็น)"}
              </p>
              <p className="mt-1 whitespace-pre-wrap">{m.body}</p>
              <p className="mt-1 text-right text-[10px] opacity-50">
                {new Date(m.createdAt).toLocaleString("th-TH")}
              </p>
            </div>
          ))}
        </div>

        <form onSubmit={sendMessage} className="mt-4 space-y-2">
          <div className="flex gap-3 text-xs font-semibold">
            <label className="flex items-center gap-1 text-violet-600">
              <input
                type="radio"
                checked={visibility === "PUBLIC"}
                onChange={() => setVisibility("PUBLIC")}
              />
              ตอบผู้แจ้ง
            </label>
            <label className="flex items-center gap-1 text-amber-600">
              <input
                type="radio"
                checked={visibility === "INTERNAL"}
                onChange={() => setVisibility("INTERNAL")}
              />
              🔒 โน้ตภายใน
            </label>
          </div>
          <div className="flex gap-2">
            <input
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              className="flex-1 rounded-2xl border-2 border-violet-100 bg-white px-4 py-2.5 text-sm outline-none focus:border-violet-300"
              placeholder={visibility === "PUBLIC" ? "ตอบกลับผู้แจ้ง…" : "โน้ตภายในทีม…"}
              maxLength={4000}
            />
            <button
              type="submit"
              disabled={busy || !reply.trim()}
              className="rounded-full bg-violet-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-violet-600 disabled:opacity-50"
            >
              ส่ง
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}
