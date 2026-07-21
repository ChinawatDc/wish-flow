/**
 * Turnstile CAPTCHA — ยังไม่มี key จริง (ดู goal.md § Blocked)
 * ถ้าไม่ตั้ง TURNSTILE_SECRET → stub ผ่านเสมอ
 * ถ้าตั้งแล้ว → ตรวจกับ Cloudflare siteverify จริง
 */
export async function verifyCaptchaToken(
  token: string | null | undefined,
  remoteIp?: string | null,
): Promise<{ ok: boolean; provider: "stub" | "turnstile" }> {
  const secret = process.env.TURNSTILE_SECRET;
  if (!secret) {
    return { ok: true, provider: "stub" };
  }
  if (!token) return { ok: false, provider: "turnstile" };
  try {
    const res = await fetch(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          secret,
          response: token,
          ...(remoteIp ? { remoteip: remoteIp } : {}),
        }),
      },
    );
    const data = (await res.json()) as { success?: boolean };
    return { ok: Boolean(data.success), provider: "turnstile" };
  } catch {
    return { ok: false, provider: "turnstile" };
  }
}
