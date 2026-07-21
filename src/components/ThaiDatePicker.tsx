"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import {
  dateToIso,
  isoToDate,
  isoToThaiDisplay,
  thaiMonthName,
  toBuddhistYear,
} from "@/lib/thai-date";

type Props = {
  /** ISO "2026-07-21" หรือ "" */
  value: string;
  onChange: (iso: string) => void;
  placeholder?: string;
};

const WEEKDAYS = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"];

/**
 * ปฏิทินไทย พ.ศ. แสดง DD-MM-YYYY (พ.ศ.) — เก็บค่าจริงเป็น ISO/ค.ศ.
 */
export function ThaiDatePicker({ value, onChange, placeholder }: Props) {
  const [open, setOpen] = useState(false);
  const selected = value ? isoToDate(value) : null;
  const [viewYear, setViewYear] = useState(
    () => selected?.getFullYear() ?? new Date().getFullYear(),
  );
  const [viewMonth, setViewMonth] = useState(
    () => selected?.getMonth() ?? new Date().getMonth(),
  );
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onEsc(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onClickOutside);
      document.removeEventListener("keydown", onEsc);
    };
  }, []);

  const grid = useMemo(() => {
    const firstDay = new Date(viewYear, viewMonth, 1).getDay();
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const cells: (number | null)[] = [];
    for (let i = 0; i < firstDay; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);
    return cells;
  }, [viewYear, viewMonth]);

  const yearOptions = useMemo(() => {
    const current = new Date().getFullYear();
    const years: number[] = [];
    for (let y = current - 5; y <= current + 5; y++) years.push(y);
    return years;
  }, []);

  function pick(day: number) {
    onChange(dateToIso(new Date(viewYear, viewMonth, day)));
    setOpen(false);
  }

  function shiftMonth(delta: number) {
    const d = new Date(viewYear, viewMonth + delta, 1);
    setViewYear(d.getFullYear());
    setViewMonth(d.getMonth());
  }

  const today = new Date();

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="dialog"
        aria-expanded={open}
        className="flex w-full items-center justify-between rounded-2xl border-2 border-rose-100 bg-white px-4 py-3 text-left outline-none focus:border-rose-300"
      >
        <span className={value ? "text-rose-900" : "text-rose-300"}>
          {value ? isoToThaiDisplay(value) : (placeholder ?? "เลือกวันที่ (วว-ดด-ปปปป)")}
        </span>
        <span className="text-xl">📅</span>
      </button>
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          className="absolute -top-1 right-10 text-xs text-rose-300 hover:text-rose-500"
          aria-label="ล้างวันที่"
        >
          ล้าง ✕
        </button>
      )}

      {open && (
        <div
          role="dialog"
          aria-label="ปฏิทินเลือกวันที่"
          className="absolute z-40 mt-2 w-full min-w-[300px] rounded-3xl border-2 border-rose-100 bg-white p-4 shadow-xl"
        >
          <div className="mb-3 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => shiftMonth(-1)}
              className="grid h-9 w-9 place-items-center rounded-full text-rose-500 hover:bg-rose-50"
              aria-label="เดือนก่อนหน้า"
            >
              ◀
            </button>
            <div className="flex gap-1">
              <select
                value={viewMonth}
                onChange={(e) => setViewMonth(Number(e.target.value))}
                className="rounded-xl border-2 border-rose-100 px-2 py-1.5 text-sm text-rose-800"
                aria-label="เลือกเดือน"
              >
                {Array.from({ length: 12 }, (_, m) => (
                  <option key={m} value={m}>
                    {thaiMonthName(m)}
                  </option>
                ))}
              </select>
              <select
                value={viewYear}
                onChange={(e) => setViewYear(Number(e.target.value))}
                className="rounded-xl border-2 border-rose-100 px-2 py-1.5 text-sm text-rose-800"
                aria-label="เลือกปี พ.ศ."
              >
                {yearOptions.map((y) => (
                  <option key={y} value={y}>
                    พ.ศ. {toBuddhistYear(y)}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="button"
              onClick={() => shiftMonth(1)}
              className="grid h-9 w-9 place-items-center rounded-full text-rose-500 hover:bg-rose-50"
              aria-label="เดือนถัดไป"
            >
              ▶
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1 text-center">
            {WEEKDAYS.map((d) => (
              <span key={d} className="py-1 text-xs font-semibold text-rose-300">
                {d}
              </span>
            ))}
            {grid.map((day, i) =>
              day === null ? (
                <span key={`empty-${i}`} />
              ) : (
                <button
                  key={day}
                  type="button"
                  onClick={() => pick(day)}
                  className={`grid h-9 w-9 place-items-center rounded-full text-sm transition ${
                    selected &&
                    selected.getFullYear() === viewYear &&
                    selected.getMonth() === viewMonth &&
                    selected.getDate() === day
                      ? "bg-rose-500 font-bold text-white"
                      : today.getFullYear() === viewYear &&
                          today.getMonth() === viewMonth &&
                          today.getDate() === day
                        ? "border-2 border-rose-300 text-rose-600"
                        : "text-rose-800 hover:bg-rose-50"
                  }`}
                >
                  {day}
                </button>
              ),
            )}
          </div>
        </div>
      )}
    </div>
  );
}
