"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Message = {
  id: string;
  senderType: string;
  from: string;
  body: string;
  createdAt: string;
};

const POLL_MS = 4000;

/** แชทกับเจ้าหน้าที่ (polling fallback — realtime provider ยังไม่มี key) */
export default function SupportChatPage() {
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const countRef = useRef(0);

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/support/conversations");
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "เปิดห้องสนทนาไม่สำเร็จ");
        return;
      }
      setConversationId(data.conversation.id);
    })();
  }, []);

  const loadMessages = useCallback(async () => {
    if (!conversationId) return;
    const res = await fetch(`/api/support/conversations/${conversationId}/messages`);
    if (!res.ok) return;
    const data = await res.json();
    setMessages(data.messages);
  }, [conversationId]);

  useEffect(() => {
    if (!conversationId) return;
    void loadMessages();
    const timer = setInterval(() => void loadMessages(), POLL_MS);
    return () => clearInterval(timer);
  }, [conversationId, loadMessages]);

  useEffect(() => {
    if (messages.length !== countRef.current) {
      countRef.current = messages.length;
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!conversationId || !text.trim()) return;
    setSending(true);
    const res = await fetch(`/api/support/conversations/${conversationId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: text }),
    });
    setSending(false);
    if (res.ok) {
      setText("");
      await loadMessages();
    } else {
      const data = await res.json();
      setError(data.error || "ส่งไม่สำเร็จ");
    }
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-rose-50 to-amber-50">
      <div className="mx-auto flex min-h-[calc(100vh-57px)] w-full max-w-lg flex-col px-4 py-4 sm:px-6">
        <div className="mb-3">
          <p className="text-sm font-semibold text-rose-400">ศูนย์ช่วยเหลือ</p>
          <h1 className="text-xl font-bold text-rose-700">แชทกับเจ้าหน้าที่ 💬</h1>
        </div>

        {error && (
          <p className="mb-3 rounded-2xl border-2 border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
            😢 {error}
          </p>
        )}

        <div className="flex-1 space-y-2 overflow-y-auto rounded-3xl border-2 border-rose-100 bg-white/70 p-4">
          {messages.length === 0 && (
            <p className="py-10 text-center text-sm text-rose-300">
              ยังไม่มีข้อความ — พิมพ์ทักทายเจ้าหน้าที่ได้เลย 👋
            </p>
          )}
          {messages.map((m) => (
            <div
              key={m.id}
              className={`flex ${m.senderType === "USER" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${
                  m.senderType === "USER"
                    ? "bg-rose-500 text-white"
                    : "border-2 border-violet-100 bg-violet-50 text-violet-800"
                }`}
              >
                {m.senderType !== "USER" && (
                  <p className="text-[10px] font-bold text-violet-500">{m.from}</p>
                )}
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

        <form onSubmit={send} className="mt-3 flex gap-2">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="flex-1 rounded-2xl border-2 border-rose-100 bg-white px-4 py-2.5 text-sm outline-none focus:border-rose-300"
            placeholder="พิมพ์ข้อความ…"
            maxLength={4000}
          />
          <button
            type="submit"
            disabled={sending || !text.trim() || !conversationId}
            className="rounded-full bg-rose-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-rose-600 disabled:opacity-50"
          >
            ส่ง
          </button>
        </form>
      </div>
    </main>
  );
}
