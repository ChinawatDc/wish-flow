"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

type Message = {
  id: string;
  senderType: string;
  visibility: string;
  from: string;
  body: string;
  createdAt: string;
};

const POLL_MS = 4000;

export default function AdminInboxConversationPage() {
  const params = useParams<{ id: string }>();
  const [user, setUser] = useState<{ name: string | null; email: string } | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [visibility, setVisibility] = useState<"PUBLIC" | "INTERNAL">("PUBLIC");
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const countRef = useRef(0);

  const load = useCallback(async () => {
    const res = await fetch(`/api/admin/inbox/${params.id}/messages`);
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "โหลดไม่สำเร็จ");
      return;
    }
    setUser(data.user);
    setMessages(data.messages);
  }, [params.id]);

  useEffect(() => {
    void load();
    const timer = setInterval(() => void load(), POLL_MS);
    return () => clearInterval(timer);
  }, [load]);

  useEffect(() => {
    if (messages.length !== countRef.current) {
      countRef.current = messages.length;
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    setSending(true);
    const res = await fetch(`/api/admin/inbox/${params.id}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: text, visibility }),
    });
    setSending(false);
    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "ส่งไม่สำเร็จ");
      return;
    }
    setText("");
    await load();
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-violet-50 to-rose-50">
      <div className="mx-auto flex min-h-[calc(100vh-57px)] w-full max-w-2xl flex-col px-4 py-4 sm:px-6">
        <div className="mb-3">
          <Link href="/admin/inbox" className="text-sm font-semibold text-violet-400">
            ← กล่องข้อความ
          </Link>
          <h1 className="text-xl font-bold text-violet-800">
            💬 {user ? user.name || user.email : "กำลังโหลด…"}
          </h1>
        </div>

        {error && (
          <p className="mb-3 rounded-2xl border-2 border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
            😢 {error}
          </p>
        )}

        <div className="flex-1 space-y-2 overflow-y-auto rounded-3xl border-2 border-violet-100 bg-white/70 p-4">
          {messages.map((m) => (
            <div
              key={m.id}
              className={`flex ${m.senderType === "ADMIN" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${
                  m.visibility === "INTERNAL"
                    ? "border-2 border-amber-200 bg-amber-50 text-amber-800"
                    : m.senderType === "ADMIN"
                      ? "bg-violet-500 text-white"
                      : "border-2 border-rose-100 bg-rose-50 text-rose-800"
                }`}
              >
                <p className="text-[10px] font-bold opacity-70">
                  {m.from}
                  {m.visibility === "INTERNAL" && " · 🔒 ภายใน"}
                </p>
                <p className="whitespace-pre-wrap">{m.body}</p>
                <p className="mt-0.5 text-right text-[10px] opacity-60">
                  {new Date(m.createdAt).toLocaleTimeString("th-TH", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              </div>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        <form onSubmit={send} className="mt-3 space-y-2">
          <div className="flex gap-3 text-xs font-semibold">
            <label className="flex items-center gap-1 text-violet-600">
              <input
                type="radio"
                checked={visibility === "PUBLIC"}
                onChange={() => setVisibility("PUBLIC")}
              />
              ตอบผู้ใช้
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
              value={text}
              onChange={(e) => setText(e.target.value)}
              className="flex-1 rounded-2xl border-2 border-violet-100 bg-white px-4 py-2.5 text-sm outline-none focus:border-violet-300"
              placeholder={visibility === "PUBLIC" ? "พิมพ์ข้อความถึงผู้ใช้…" : "โน้ตภายในทีม…"}
              maxLength={4000}
            />
            <button
              type="submit"
              disabled={sending || !text.trim()}
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
