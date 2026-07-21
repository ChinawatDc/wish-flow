import { describe, expect, it } from "vitest";

import { hashPin, verifyPin } from "./pin";

describe("PIN utilities", () => {
  it("hashes a PIN without storing it in plaintext", async () => {
    const hash = await hashPin("1234");

    expect(hash).not.toBe("1234");
    expect(hash).toMatch(/^\$2[aby]\$/);
  });

  it("verifies the correct PIN", async () => {
    const hash = await hashPin("2468");

    await expect(verifyPin("2468", hash)).resolves.toBe(true);
  });

  it("rejects an incorrect PIN", async () => {
    const hash = await hashPin("2468");

    await expect(verifyPin("1357", hash)).resolves.toBe(false);
  });
});