import { describe, expect, it } from "vitest";

import {
  dateToIso,
  dateToThaiLong,
  isoToDate,
  isoToThaiDisplay,
  thaiDisplayToIso,
  thaiMonthName,
  toBuddhistYear,
  toGregorianYear,
} from "./thai-date";

describe("แปลงปี ค.ศ. ↔ พ.ศ.", () => {
  it("ค.ศ. → พ.ศ. (+543)", () => {
    expect(toBuddhistYear(2026)).toBe(2569);
    expect(toBuddhistYear(2000)).toBe(2543);
    expect(toBuddhistYear(1990)).toBe(2533);
  });

  it("พ.ศ. → ค.ศ. (-543)", () => {
    expect(toGregorianYear(2569)).toBe(2026);
    expect(toGregorianYear(2543)).toBe(2000);
  });

  it("แปลงไปกลับได้ค่าเดิม", () => {
    for (const year of [1999, 2024, 2026, 2100]) {
      expect(toGregorianYear(toBuddhistYear(year))).toBe(year);
    }
  });
});

describe("isoToThaiDisplay", () => {
  it("แปลง ISO เป็น DD-MM-YYYY พ.ศ.", () => {
    expect(isoToThaiDisplay("2026-07-21")).toBe("21-07-2569");
    expect(isoToThaiDisplay("2000-01-01")).toBe("01-01-2543");
    expect(isoToThaiDisplay("1995-12-31")).toBe("31-12-2538");
  });

  it("คืนค่าว่างเมื่อ input ไม่ถูกต้อง", () => {
    expect(isoToThaiDisplay(null)).toBe("");
    expect(isoToThaiDisplay(undefined)).toBe("");
    expect(isoToThaiDisplay("")).toBe("");
    expect(isoToThaiDisplay("21-07-2569")).toBe("");
    expect(isoToThaiDisplay("not-a-date")).toBe("");
  });
});

describe("thaiDisplayToIso", () => {
  it("แปลง DD-MM-YYYY พ.ศ. กลับเป็น ISO", () => {
    expect(thaiDisplayToIso("21-07-2569")).toBe("2026-07-21");
    expect(thaiDisplayToIso("01-01-2543")).toBe("2000-01-01");
    expect(thaiDisplayToIso("29-02-2567")).toBe("2024-02-29"); // leap year
  });

  it("คืน null เมื่อวันที่ไม่มีจริง", () => {
    expect(thaiDisplayToIso("31-02-2569")).toBeNull(); // ไม่มี 31 ก.พ.
    expect(thaiDisplayToIso("29-02-2569")).toBeNull(); // 2026 ไม่ใช่ leap year
    expect(thaiDisplayToIso("00-01-2569")).toBeNull();
    expect(thaiDisplayToIso("15-13-2569")).toBeNull();
  });

  it("คืน null เมื่อ format ผิด", () => {
    expect(thaiDisplayToIso("2569-07-21")).toBeNull();
    expect(thaiDisplayToIso("21/07/2569")).toBeNull();
    expect(thaiDisplayToIso("abc")).toBeNull();
    expect(thaiDisplayToIso("")).toBeNull();
  });

  it("แปลงไปกลับได้ค่าเดิม", () => {
    for (const iso of ["2026-07-21", "2024-02-29", "1999-12-31"]) {
      expect(thaiDisplayToIso(isoToThaiDisplay(iso))).toBe(iso);
    }
  });
});

describe("dateToIso / isoToDate", () => {
  it("Date → ISO ไม่เพี้ยน timezone", () => {
    expect(dateToIso(new Date(2026, 6, 21))).toBe("2026-07-21");
    expect(dateToIso(new Date(2026, 0, 1))).toBe("2026-01-01");
  });

  it("ISO → Date local midnight", () => {
    const d = isoToDate("2026-07-21");
    expect(d?.getFullYear()).toBe(2026);
    expect(d?.getMonth()).toBe(6);
    expect(d?.getDate()).toBe(21);
  });

  it("isoToDate คืน null เมื่อ format ผิด", () => {
    expect(isoToDate("21-07-2569")).toBeNull();
  });
});

describe("ชื่อเดือนไทย", () => {
  it("เดือนเต็ม", () => {
    expect(thaiMonthName(0)).toBe("มกราคม");
    expect(thaiMonthName(6)).toBe("กรกฎาคม");
    expect(thaiMonthName(11)).toBe("ธันวาคม");
  });

  it("เดือนย่อ", () => {
    expect(thaiMonthName(6, true)).toBe("ก.ค.");
  });

  it("dateToThaiLong", () => {
    expect(dateToThaiLong(new Date(2026, 6, 21))).toBe("21 กรกฎาคม 2569");
  });
});
