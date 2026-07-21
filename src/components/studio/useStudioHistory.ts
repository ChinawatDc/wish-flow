"use client";

import { useCallback, useMemo, useState } from "react";

export function useStudioHistory<T>(initial: T, limit = 40) {
  const [past, setPast] = useState<T[]>([]);
  const [present, setPresent] = useState(initial);
  const [future, setFuture] = useState<T[]>([]);

  const set = useCallback(
    (next: T, recordHistory = true) => {
      if (recordHistory) {
        setPast((prev) => [...prev.slice(-(limit - 1)), present]);
        setFuture([]);
      }
      setPresent(next);
    },
    [limit, present],
  );

  const undo = useCallback(() => {
    setPast((prev) => {
      if (prev.length === 0) return prev;
      const nextPast = [...prev];
      const previous = nextPast.pop()!;
      setFuture((f) => [present, ...f]);
      setPresent(previous);
      return nextPast;
    });
  }, [present]);

  const redo = useCallback(() => {
    setFuture((prev) => {
      if (prev.length === 0) return prev;
      const nextFuture = [...prev];
      const next = nextFuture.shift()!;
      setPast((p) => [...p, present]);
      setPresent(next);
      return nextFuture;
    });
  }, [present]);

  return useMemo(
    () => ({
      value: present,
      set,
      undo,
      redo,
      canUndo: past.length > 0,
      canRedo: future.length > 0,
    }),
    [future.length, past.length, present, redo, set, undo],
  );
}
