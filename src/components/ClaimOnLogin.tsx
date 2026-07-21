"use client";

import { useEffect, useRef } from "react";
import { useSession } from "next-auth/react";

/** หลัง login ย้ายการ์ดเดิมจาก device_token เข้าบัญชี (ครั้งเดียวต่อ session) */
export function ClaimOnLogin() {
  const { status } = useSession();
  const ran = useRef(false);

  useEffect(() => {
    if (status !== "authenticated" || ran.current) return;
    ran.current = true;
    void fetch("/api/auth/claim-device", { method: "POST" }).catch(() => {});
  }, [status]);

  return null;
}
