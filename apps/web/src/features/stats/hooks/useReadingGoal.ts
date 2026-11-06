import { useEffect, useState } from "react";
import { useAtomValue } from "jotai";
import { readingStatsAtom } from "../../../state/ui";
import { localKV } from "../../../platform/local-store";
import { normalizeReadingGoal, readingGoalProgress } from "../lib/reading-goal";
const KEY = "read-aware-daily-reading-goal";
export function useReadingGoal() {
  const store = useAtomValue(readingStatsAtom),
    [minutes, setMinutes] = useState(() =>
      normalizeReadingGoal(Number(localKV.getItem(KEY) ?? 30)),
    );
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const refresh = () => setNow(Date.now());
    const timer = setInterval(refresh, 60000);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, []);
  return {
    ...readingGoalProgress(store, minutes, now),
    setTarget: (value: number) => {
      const next = normalizeReadingGoal(value);
      localKV.setItem(KEY, String(next));
      setMinutes(next);
    },
  };
}
