import { createHash } from "crypto";

/** Pepper จาก env — ห้ามเก็บ IP/UA ดิบระยะยาว */
function pepper(): string {
  return process.env.AUTH_SECRET || process.env.UNLOCK_JWT_SECRET || "wf-pepper";
}

/** hash IP + pepper (sha256, สั้นพอสำหรับ correlate / rate-limit) */
export function hashIp(ip: string | null | undefined): string | null {
  if (!ip) return null;
  return createHash("sha256").update(`ip:${pepper()}:${ip}`).digest("hex").slice(0, 32);
}

/** ลดรายละเอียด user-agent ให้เหลือ digest สั้น */
export function digestUa(ua: string | null | undefined): string | null {
  if (!ua) return null;
  return createHash("sha256").update(`ua:${pepper()}:${ua}`).digest("hex").slice(0, 16);
}

/** hash token สาธารณะของ support case (sha256 — เก็บเฉพาะ hash ใน DB) */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
