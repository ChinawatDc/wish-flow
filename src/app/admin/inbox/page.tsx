"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type ConversationRow = {
  id: string;
  user: { id: string; name: string | null; email: string };
  lastMessageAt: string | null;
  adminUnreadCount: number;
  lastMessage: { body: string; senderType: string } | null;
};

const POLL_MS = 8000;

export default function AdminInboxPage() {
  const [conversations, setConversations] = useState<ConversationRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/inbox?limit=50");
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "โหลดไม่สำเร็จ");
      setLoading(false);
      return;
    }
    setConversations(data.conversations);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
    const timer = setInterval(() => void load(), POLL_MS);
    return () => clearInterval(timer);
  }, [load]);

  return (
    <main className="min-h-screen bg-gradient-to-b from-violet-50 to-rose-50">
      <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6">
        <div className="mb-4">
          <p className="text-sm font-semibold text-violet-400">ผู้ดูแลระบบ</p>
          <h1 className="text-2xl font-bold text-violet-800">กล่องข้อความ 📥</h1>
        </div>

        {error && (
          <p className="mb-4 rounded-2xl border-2 border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
            😢 {error}
          </p>
        )}

        {loading ? (
          <p className="text-center text-violet-300">กำลังโหลด…</p>
        ) : conversations.length === 0 ? (
          <p className="rounded-3xl border-2 border-violet-100 bg-white p-8 text-center text-violet-300">
            ยังไม่มีข้อความจากผู้ใช้
          </p>
        ) : (
          <ul className="space-y-2">
            {conversations.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/admin/inbox/${c.id}`}
                  className="flex items-center justify-between gap-3 rounded-3xl border-2 border-violet-100 bg-white p-4 shadow-sm hover:border-violet-300"
                >
                  <div className="min-w-0">
                    <p className="truncate font-bold text-violet-900">
                      {c.user.name || c.user.email}
                    </p>
                    <p className="truncate text-xs text-violet-400">
                      {c.lastMessage
                        ? `${c.lastMessage.senderType === "USER" ? "" : "เจ้าหน้าที่: "}${c.lastMessage.body}`
                        : "ยังไม่มีข้อความ"}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    {c.adminUnreadCount > 0 && (
                      <span className="inline-block rounded-full bg-rose-500 px-2 py-0.5 text-xs font-bold text-white">
                        {c.adminUnreadCount}
                      </span>
                    )}
                    {c.lastMessageAt && (
                      <p className="mt-1 text-[10px] text-violet-300">
                        {new Date(c.lastMessageAt).toLocaleString("th-TH")}
                      </p>
                    )}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
