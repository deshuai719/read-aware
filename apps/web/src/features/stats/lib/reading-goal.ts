import type { ReadingStatsStore } from "../../reader/lib/reading-stats";
import { localDayKey } from "../../reader/lib/reading-stats";
export function normalizeReadingGoal(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(0, Math.min(240, Math.round(value)))
    : 30;
}
export function readingGoalProgress(
  store: ReadingStatsStore,
  minutes: number,
  now: number,
) {
  const target = normalizeReadingGoal(minutes),
    day = localDayKey(now),
    readMs = Object.values(store).reduce(
      (sum, stats) => sum + Math.max(0, stats.daily[day] ?? 0),
      0,
    );
  return {
    targetMinutes: target,
    readMinutes: readMs / 60000,
    fraction: target > 0 ? Math.min(1, readMs / (target * 60000)) : 0,
    remainingMinutes: Math.max(0, Math.ceil(target - readMs / 60000)),
    achieved: target > 0 && readMs >= target * 60000,
  };
}
