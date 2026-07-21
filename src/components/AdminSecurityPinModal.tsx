"use client";

import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { useCallback, useEffect, useState } from "react";

/**
 * Admin ที่ยังไม่ตั้ง Security PIN → modal บังคับตั้งก่อนใช้เมนู admin
 * (Security PIN ของบัญชี — คนละอย่างกับ Event PIN)
 */
export function AdminSecurityPinModal() {
  const pathname = usePathname();
  const { data: session, status } = useSession();
  const [needsPin, setNeedsPin] = useState(false);
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [checked, setChecked] = useState(false);

  const isAdmin = session?.user?.role === "ADMIN";
  const onGuestRoute = pathname.startsWith("/e/");

  const check = useCallback(async () => {
    const res = await fetch("/api/me/security-status");
    if (!res.ok) return;
    const data = await res.json();
    setNeedsPin(data.role === "ADMIN" && !data.hasSecurityPin);
    setChecked(true);
  }, []);

  useEffect(() => {
    if (status === "authenticated" && isAdmin && !onGuestRoute) {
      void check();
    }
  }, [status, isAdmin, onGuestRoute, check]);

  if (!isAdmin || onGuestRoute || !checked || !needsPin) return null;

  async function submit() {
    setError(null);
    if (pin.length !== 6) {
      setError("PIN ต้องเป็นตัวเลข 6 หลัก");
      return;
    }
    if (pin !== confirmPin) {
      setError("PIN ยืนยันไม่ตรงกัน");
      return;
    }
    setSaving(true);
    const res = await fetch("/api/me/security-pin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin, confirmPin }),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) {
      setError(data.error || "ตั้ง PIN ไม่สำเร็จ");
      return;
    }
    setNeedsPin(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm rounded-3xl border-2 border-violet-200 bg-white p-6 shadow-xl">
        <h2 className="text-lg font-bold text-violet-800">
          ตั้ง Security PIN ก่อนใช้งาน 🛡️
        </h2>
        <p className="mt-2 text-sm text-violet-500">
          บัญชีผู้ดูแลต้องมี Security PIN 6 หลัก สำหรับยืนยันตัวตนก่อนทำรายการอ่อนไหว
          (คนละอย่างกับ PIN ของการ์ดอวยพร)
        </p>
        {error && (
          <p className="mt-3 rounded-xl border-2 border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
            {error}
          </p>
        )}
        <div className="mt-4 space-y-3">
          <input
            type="password"
            inputMode="numeric"
            maxLength={6}
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
            className="w-full rounded-2xl border-2 border-violet-100 px-4 py-3 text-center text-lg tracking-[0.5em] outline-none focus:border-violet-300"
            placeholder="••••••"
            autoFocus
          />
          <input
            type="password"
            inputMode="numeric"
            maxLength={6}
            value={confirmPin}
            onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ""))}
            className="w-full rounded-2xl border-2 border-violet-100 px-4 py-3 text-center text-lg tracking-[0.5em] outline-none focus:border-violet-300"
            placeholder="ยืนยัน PIN"
          />
          <button
            type="button"
            onClick={submit}
            disabled={saving || pin.length !== 6 || confirmPin.length !== 6}
            className="w-full rounded-full bg-violet-500 px-5 py-3 font-semibold text-white shadow-sm hover:bg-violet-600 disabled:opacity-50"
          >
            {saving ? "กำลังบันทึก…" : "ตั้ง PIN และเริ่มใช้งาน"}
          </button>
        </div>
      </div>
    </div>
  );
}
