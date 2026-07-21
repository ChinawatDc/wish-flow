"use client";

import { useParams, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";

const STATUS_TH: Record<string, string> = {
  NEW: "🆕 รอเจ้าหน้าที่รับเรื่อง",
  CLAIMED: "👀 เจ้าหน้าที่รับเรื่องแล้ว",
  IN_PROGRESS: "🔧 กำลังดำเนินการ",
  WAITING_USER: "💬 รอคุณตอบกลับ",
  RESOLVED: "✅ แก้ไขแล้ว",
  CLOSED: "🔒 ปิดเคสแล้ว",
  SPAM: "🚫 ถูกทำเครื่องหมายสแปม",
};

type CaseData = {
  id: string;
  caseNumber: number;
  status: string;
  subject: string;
  createdAt: string;
  messages: { id: string; from: string; senderType: string; body: string; createdAt: string }[];
  statusHistory: { toStatus: string; createdAt: string }[];
};

function CaseTracker() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const [data, setData] = useState<CaseData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    if (!token) {
      setError("ต้องมี token สำหรับติดตามเคส");
      return;
    }
    const res = await fetch(
      `/api/support/cases/${params.id}?token=${encodeURIComponent(token)}`,
    );
    const json = await res.json();
    if (!res.ok) {
      setError(json.error || "โหลดไม่สำเร็จ");
      return;
    }
    setError(null);
    setData(json.case);
  }, [params.id, token]);

  useEffect(() => {
    void load();
  }, [load]);

  async function sendReply(e: React.FormEvent) {
    e.preventDefault();
    if (!reply.trim()) return;
    setSending(true);
    const res = await fetch(`/api/support/cases/${params.id}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, body: reply }),
    });
    const json = await res.json();
    setSending(false);
    if (!res.ok) {
      setError(json.error || "ส่งไม่สำเร็จ");
      return;
    }
    setReply("");
    await load();
  }

  if (error) {
    return (
      <p className="rounded-2xl border-2 border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
        😢 {error}
      </p>
    );
  }
  if (!data) return <p className="text-center text-rose-300">กำลังโหลด…</p>;

  const closed = data.status === "CLOSED" || data.status === "SPAM";

  return (
    <>
      <div className="rounded-3xl border-2 border-rose-100 bg-white p-5 shadow-sm">
        <p className="text-xs font-semibold text-rose-400">เคส #{data.caseNumber}</p>
        <h1 className="text-lg font-bold text-rose-700">{data.subject}</h1>
        <p className="mt-2 inline-block rounded-full bg-rose-50 px-3 py-1 text-sm font-semibold text-rose-600">
          {STATUS_TH[data.status] ?? data.status}
        </p>
      </div>

      <div className="mt-4 space-y-3">
        {data.messages.map((m) => (
          <div
            key={m.id}
            className={`rounded-2xl border-2 p-3 text-sm ${
              m.senderType === "GUEST"
                ? "ml-6 border-rose-100 bg-rose-50 text-rose-800"
                : "mr-6 border-violet-100 bg-violet-50 text-violet-800"
            }`}
          >
            <p className="text-xs font-bold opacity-70">{m.from}</p>
            <p className="mt-1 whitespace-pre-wrap">{m.body}</p>
            <p className="mt-1 text-right text-[10px] opacity-50">
              {new Date(m.createdAt).toLocaleString("th-TH")}
            </p>
          </div>
        ))}
      </div>

      {!closed && (
        <form onSubmit={sendReply} className="mt-4 flex gap-2">
          <input
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            className="flex-1 rounded-2xl border-2 border-rose-100 bg-white px-4 py-2.5 text-sm outline-none focus:border-rose-300"
            placeholder="พิมพ์ข้อความตอบกลับ…"
            maxLength={4000}
          />
          <button
            type="submit"
            disabled={sending || !reply.trim()}
            className="rounded-full bg-rose-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-rose-600 disabled:opacity-50"
          >
            ส่ง
          </button>
        </form>
      )}
    </>
  );
}

export default function SupportCasePage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-rose-50 to-amber-50">
      <div className="mx-auto w-full max-w-lg px-4 py-8 sm:px-6">
        <Suspense fallback={<p className="text-center text-rose-300">กำลังโหลด…</p>}>
          <CaseTracker />
        </Suspense>
      </div>
    </main>
  );
}
