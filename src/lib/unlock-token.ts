import { SignJWT, jwtVerify } from "jose";

import { UNLOCK_TTL_SECONDS } from "@/lib/constants";

function getSecret() {
  const secret = process.env.UNLOCK_JWT_SECRET;
  if (!secret) {
    throw new Error("UNLOCK_JWT_SECRET is not set");
  }
  return new TextEncoder().encode(secret);
}

export async function issueUnlockToken(eventId: string): Promise<string> {
  return new SignJWT({ eventId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${UNLOCK_TTL_SECONDS}s`)
    .sign(getSecret());
}

export async function verifyUnlockToken(
  token: string,
  expectedEventId: string,
): Promise<boolean> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    return payload.eventId === expectedEventId;
  } catch {
    return false;
  }
}
