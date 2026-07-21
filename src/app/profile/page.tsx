"use client";

import { useCallback, useEffect, useState } from "react";
import { signOut } from "next-auth/react";

type Profile = {
  id: string;
  email: string;
  name: string | null;
  username: string | null;
  phone: string | null;
  role: "USER" | "ADMIN";
  hasPassword: boolean;
  hasSecurityPin: boolean;
  mustChangePassword: boolean;
  mustChangeSecurityPin: boolean;
};

const inputCls =
  "w-full rounded-2xl border-2 border-rose-100 bg-white px-4 py-2.5 text-sm outline-none focus:border-rose-300";
const btnCls =
  "rounded-full bg-rose-500 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-rose-600 disabled:opacity-50";
const cardCls = "rounded-3xl border-2 border-rose-100 bg-white p-5 shadow-sm";

export default function ProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [phone, setPhone] = useState("");

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [currentPin, setCurrentPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/me/profile");
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "โหลดไม่สำเร็จ");
      setLoading(false);
      return;
    }
    setProfile(data.profile);
    setName(data.profile.name ?? "");
    setUsername(data.profile.username ?? "");
    setPhone(data.profile.phone ?? "");
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function flash(msg: string) {
    setNotice(msg);
    setError(null);
    setTimeout(() => setNotice(null), 4000);
  }

  async function saveProfile() {
    setError(null);
    const res = await fetch("/api/me/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: name || null,
        username: username || null,
        phone: phone || null,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "บันทึกไม่สำเร็จ");
      return;
    }
    setProfile(data.profile);
    flash("บันทึกโปรไฟล์แล้ว ✓");
  }

  async function submitPassword() {
    setError(null);
    if (newPassword !== confirmPassword) {
      setError("รหัสผ่านยืนยันไม่ตรงกัน");
      return;
    }
    const isSet = profile && !profile.hasPassword;
    const res = await fetch(isSet ? "/api/me/set-password" : "/api/me/change-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        isSet ? { newPassword } : { currentPassword, newPassword },
      ),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "เปลี่ยนรหัสผ่านไม่สำเร็จ");
      return;
    }
    // authVersion ถูก bump — ต้อง login ใหม่
    alert("เปลี่ยนรหัสผ่านสำเร็จ กรุณาเข้าสู่ระบบใหม่อีกครั้ง");
    await signOut({ callbackUrl: "/login" });
  }

  async function submitPin() {
    setError(null);
    if (newPin !== confirmPin) {
      setError("PIN ยืนยันไม่ตรงกัน");
      return;
    }
    const isSet = profile && !profile.hasSecurityPin;
    const res = await fetch("/api/me/security-pin", {
      method: isSet ? "POST" : "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        isSet
          ? { pin: newPin, confirmPin }
          : { currentPin, newPin, confirmPin },
      ),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "ตั้ง PIN ไม่สำเร็จ");
      return;
    }
    setCurrentPin("");
    setNewPin("");
    setConfirmPin("");
    flash(isSet ? "ตั้ง Security PIN แล้ว ✓" : "เปลี่ยน Security PIN แล้ว ✓");
    await load();
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-gradient-to-b from-rose-50 to-amber-50 py-10 text-center text-rose-300">
        กำลังโหลด…
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-rose-50 to-amber-50">
      <div className="mx-auto w-full max-w-2xl space-y-5 px-4 py-8 sm:px-6">
        <div>
          <p className="text-sm font-semibold text-rose-400">บัญชีของฉัน</p>
          <h1 className="text-2xl font-bold text-rose-700">โปรไฟล์ 🙋</h1>
        </div>

        {error && (
          <p className="rounded-2xl border-2 border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
            😢 {error}
          </p>
        )}
        {notice && (
          <p className="rounded-2xl border-2 border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {notice}
          </p>
        )}
        {profile?.mustChangePassword && (
          <p className="rounded-2xl border-2 border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
            ⚠️ รหัสผ่านของคุณถูกรีเซ็ตโดยผู้ดูแล กรุณาตั้งรหัสผ่านใหม่ทันที
          </p>
        )}
        {profile?.mustChangeSecurityPin && (
          <p className="rounded-2xl border-2 border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
            ⚠️ Security PIN ของคุณถูกรีเซ็ต กรุณาเปลี่ยน PIN ใหม่ทันที
          </p>
        )}

        <section className={cardCls}>
          <h2 className="mb-3 font-bold text-rose-700">ข้อมูลส่วนตัว</h2>
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-xs font-semibold text-rose-400">
                อีเมล (แก้ไขไม่ได้)
              </label>
              <input value={profile?.email ?? ""} disabled className={`${inputCls} bg-rose-50 text-rose-400`} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-rose-400">ชื่อ</label>
              <input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} placeholder="ชื่อที่แสดง" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-rose-400">ชื่อผู้ใช้ (username)</label>
              <input value={username} onChange={(e) => setUsername(e.target.value)} className={inputCls} placeholder="a-z 0-9 _ . -" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-rose-400">เบอร์โทร</label>
              <input value={phone} onChange={(e) => setPhone(e.target.value)} className={inputCls} placeholder="08x-xxx-xxxx" />
            </div>
            <button type="button" onClick={saveProfile} className={btnCls}>
              บันทึกโปรไฟล์
            </button>
          </div>
        </section>

        <section className={cardCls}>
          <h2 className="mb-3 font-bold text-rose-700">
            {profile?.hasPassword ? "เปลี่ยนรหัสผ่าน 🔑" : "ตั้งรหัสผ่าน 🔑"}
          </h2>
          {!profile?.hasPassword && (
            <p className="mb-3 text-xs text-rose-400">
              บัญชีนี้เข้าสู่ระบบด้วย Google — ตั้งรหัสผ่านเพื่อ login ด้วยอีเมลได้
            </p>
          )}
          <div className="space-y-3">
            {profile?.hasPassword && (
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className={inputCls}
                placeholder="รหัสผ่านปัจจุบัน"
              />
            )}
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className={inputCls}
              placeholder="รหัสผ่านใหม่ (อย่างน้อย 8 ตัวอักษร)"
            />
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className={inputCls}
              placeholder="ยืนยันรหัสผ่านใหม่"
            />
            <button
              type="button"
              onClick={submitPassword}
              disabled={!newPassword || newPassword.length < 8}
              className={btnCls}
            >
              {profile?.hasPassword ? "เปลี่ยนรหัสผ่าน" : "ตั้งรหัสผ่าน"}
            </button>
            <p className="text-xs text-rose-300">
              หลังเปลี่ยนรหัสผ่าน ระบบจะให้เข้าสู่ระบบใหม่ทุกอุปกรณ์
            </p>
          </div>
        </section>

        {profile?.role === "ADMIN" && (
          <section className={cardCls}>
            <h2 className="mb-1 font-bold text-violet-700">
              Security PIN ของผู้ดูแล 🛡️
            </h2>
            <p className="mb-3 text-xs text-violet-400">
              ใช้ยืนยันตัวตนก่อนทำรายการอ่อนไหว (เช่น รีเซ็ตรหัสผ่านผู้ใช้) —
              คนละอย่างกับ PIN ของการ์ดอวยพร
            </p>
            <div className="space-y-3">
              {profile.hasSecurityPin && (
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={6}
                  value={currentPin}
                  onChange={(e) => setCurrentPin(e.target.value.replace(/\D/g, ""))}
                  className={inputCls}
                  placeholder="PIN ปัจจุบัน (6 หลัก)"
                />
              )}
              <input
                type="password"
                inputMode="numeric"
                maxLength={6}
                value={newPin}
                onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ""))}
                className={inputCls}
                placeholder="PIN ใหม่ (6 หลัก)"
              />
              <input
                type="password"
                inputMode="numeric"
                maxLength={6}
                value={confirmPin}
                onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ""))}
                className={inputCls}
                placeholder="ยืนยัน PIN ใหม่"
              />
              <button
                type="button"
                onClick={submitPin}
                disabled={newPin.length !== 6 || confirmPin.length !== 6}
                className="rounded-full bg-violet-500 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-violet-600 disabled:opacity-50"
              >
                {profile.hasSecurityPin ? "เปลี่ยน PIN" : "ตั้ง PIN"}
              </button>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
