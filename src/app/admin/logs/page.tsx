"use client";

import { useCallback, useEffect, useState } from "react";

type AuditRow = {
  id: string;
  occurredAt: string;
  action: string;
  actorEmail: string | null;
  resourceType: string;
  resourceId: string | null;
  outcome: string;
  summaryTh: string;
};

type SystemRow = {
  id: string;
  occurredAt: string;
  level: string;
  source: string;
  code: string;
  message: string;
  httpStatus: number | null;
};

const OUTCOME_TH: Record<string, string> = {
  SUCCESS: "✅ สำเร็จ",
  FAILURE: "❌ ล้มเหลว",
  DENIED: "⛔ ถูกปฏิเสธ",
};

const LEVEL_COLOR: Record<string, string> = {
  DEBUG: "text-slate-400",
  INFO: "text-sky-600",
  WARN: "text-amber-600",
  ERROR: "text-red-600",
  FATAL: "text-red-800",
};

export default function AdminLogsPage() {
  const [tab, setTab] = useState<"audit" | "system">("audit");
  const [auditRows, setAuditRows] = useState<AuditRow[]>([]);
  const [systemRows, setSystemRows] = useState<SystemRow[]>([]);
  const [actionFilter, setActionFilter] = useState("");
  const [outcomeFilter, setOutcomeFilter] = useState("");
  const [levelFilter, setLevelFilter] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({ page: String(page), limit: "25" });
    if (tab === "audit") {
      if (actionFilter) params.set("action", actionFilter);
      if (outcomeFilter) params.set("outcome", outcomeFilter);
    } else if (levelFilter) {
      params.set("level", levelFilter);
    }
    const res = await fetch(`/api/admin/logs/${tab}?${params}`);
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "โหลดไม่สำเร็จ");
      setLoading(false);
      return;
    }
    if (tab === "audit") setAuditRows(data.logs);
    else setSystemRows(data.logs);
    setTotalPages(data.totalPages);
    setLoading(false);
  }, [tab, page, actionFilter, outcomeFilter, levelFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  async function exportLogs(format: "csv" | "json") {
    const res = await fetch("/api/admin/logs/export", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: tab, format }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "ส่งออกไม่สำเร็จ");
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `wishflow-${tab}-logs.${format}`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-violet-50 to-rose-50">
      <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-sm font-semibold text-violet-400">ผู้ดูแลระบบ</p>
            <h1 className="text-2xl font-bold text-violet-800">บันทึกระบบ 📜</h1>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => exportLogs("csv")}
              className="rounded-full border-2 border-violet-200 bg-white px-4 py-2 text-xs font-semibold text-violet-600 hover:bg-violet-50"
            >
              ⬇ CSV
            </button>
            <button
              type="button"
              onClick={() => exportLogs("json")}
              className="rounded-full border-2 border-violet-200 bg-white px-4 py-2 text-xs font-semibold text-violet-600 hover:bg-violet-50"
            >
              ⬇ JSON
            </button>
            <button
              type="button"
              onClick={() => void load()}
              className="rounded-full border-2 border-violet-200 bg-white px-4 py-2 text-xs font-semibold text-violet-600 hover:bg-violet-50"
            >
              🔄 รีเฟรช
            </button>
          </div>
        </div>

        <div className="mb-4 flex gap-2">
          <button
            type="button"
            onClick={() => {
              setTab("audit");
              setPage(1);
            }}
            className={`rounded-full px-4 py-2 text-sm font-semibold ${
              tab === "audit"
                ? "bg-violet-500 text-white"
                : "border-2 border-violet-200 bg-white text-violet-600"
            }`}
          >
            Audit Log
          </button>
          <button
            type="button"
            onClick={() => {
              setTab("system");
              setPage(1);
            }}
            className={`rounded-full px-4 py-2 text-sm font-semibold ${
              tab === "system"
                ? "bg-violet-500 text-white"
                : "border-2 border-violet-200 bg-white text-violet-600"
            }`}
          >
            System Log
          </button>
        </div>

        <div className="mb-4 flex flex-wrap gap-2">
          {tab === "audit" ? (
            <>
              <input
                value={actionFilter}
                onChange={(e) => {
                  setPage(1);
                  setActionFilter(e.target.value);
                }}
                placeholder="action เช่น ADMIN.PASSWORD_RESET"
                className="flex-1 rounded-2xl border-2 border-violet-100 bg-white px-4 py-2 text-sm outline-none focus:border-violet-300"
              />
              <select
                value={outcomeFilter}
                onChange={(e) => {
                  setPage(1);
                  setOutcomeFilter(e.target.value);
                }}
                className="rounded-2xl border-2 border-violet-100 bg-white px-3 py-2 text-sm outline-none"
              >
                <option value="">ทุกผลลัพธ์</option>
                <option value="SUCCESS">สำเร็จ</option>
                <option value="FAILURE">ล้มเหลว</option>
                <option value="DENIED">ถูกปฏิเสธ</option>
              </select>
            </>
          ) : (
            <select
              value={levelFilter}
              onChange={(e) => {
                setPage(1);
                setLevelFilter(e.target.value);
              }}
              className="rounded-2xl border-2 border-violet-100 bg-white px-3 py-2 text-sm outline-none"
            >
              <option value="">ทุกระดับ</option>
              {["DEBUG", "INFO", "WARN", "ERROR", "FATAL"].map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
          )}
        </div>

        {error && (
          <p className="mb-4 rounded-2xl border-2 border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
            😢 {error}
          </p>
        )}

        {loading ? (
          <p className="text-center text-violet-300">กำลังโหลด…</p>
        ) : tab === "audit" ? (
          auditRows.length === 0 ? (
            <p className="rounded-3xl border-2 border-violet-100 bg-white p-8 text-center text-violet-300">
              ไม่มีรายการ
            </p>
          ) : (
            <ul className="space-y-2">
              {auditRows.map((l) => (
                <li
                  key={l.id}
                  className="rounded-2xl border-2 border-violet-100 bg-white p-3 text-sm shadow-sm"
                >
                  <div className="flex flex-wrap items-center justify-between gap-1">
                    <span className="font-mono text-xs font-bold text-violet-600">
                      {l.action}
                    </span>
                    <span className="text-xs">{OUTCOME_TH[l.outcome] ?? l.outcome}</span>
                  </div>
                  <p className="mt-1 text-violet-900">{l.summaryTh}</p>
                  <p className="mt-1 text-xs text-violet-400">
                    {new Date(l.occurredAt).toLocaleString("th-TH")}
                    {l.actorEmail && ` · โดย ${l.actorEmail}`}
                    {` · ${l.resourceType}${l.resourceId ? `:${l.resourceId.slice(0, 8)}` : ""}`}
                  </p>
                </li>
              ))}
            </ul>
          )
        ) : systemRows.length === 0 ? (
          <p className="rounded-3xl border-2 border-violet-100 bg-white p-8 text-center text-violet-300">
            ไม่มีรายการ
          </p>
        ) : (
          <ul className="space-y-2">
            {systemRows.map((l) => (
              <li
                key={l.id}
                className="rounded-2xl border-2 border-violet-100 bg-white p-3 text-sm shadow-sm"
              >
                <div className="flex flex-wrap items-center justify-between gap-1">
                  <span className={`text-xs font-bold ${LEVEL_COLOR[l.level] ?? ""}`}>
                    [{l.level}] {l.source} · {l.code}
                  </span>
                  {l.httpStatus && (
                    <span className="text-xs text-violet-400">HTTP {l.httpStatus}</span>
                  )}
                </div>
                <p className="mt-1 text-violet-900">{l.message}</p>
                <p className="mt-1 text-xs text-violet-400">
                  {new Date(l.occurredAt).toLocaleString("th-TH")}
                </p>
              </li>
            ))}
          </ul>
        )}

        {totalPages > 1 && (
          <div className="mt-4 flex justify-center gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
              className="rounded-full border px-4 py-2 text-sm disabled:opacity-40"
            >
              ก่อนหน้า
            </button>
            <span className="py-2 text-sm text-violet-400">
              {page}/{totalPages}
            </span>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="rounded-full border px-4 py-2 text-sm disabled:opacity-40"
            >
              ถัดไป
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
