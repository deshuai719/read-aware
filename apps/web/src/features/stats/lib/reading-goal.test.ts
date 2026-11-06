import { expect, test } from "bun:test";
import { readingGoalProgress, normalizeReadingGoal } from "./reading-goal";
import {
  localDayKey,
  type ReadingStatsStore,
} from "../../reader/lib/reading-stats";
test("goals sum real per-book local-day time without counting yesterday", () => {
  const now = new Date(2026, 10, 6, 12).getTime(),
    day = localDayKey(now);
  const store = {
    a: { daily: { [day]: 600000, "2026-11-05": 3600000 } },
    b: { daily: { [day]: 300000 } },
  } as unknown as ReadingStatsStore;
  expect(readingGoalProgress(store, 30, now)).toEqual({
    targetMinutes: 30,
    readMinutes: 15,
    fraction: 0.5,
    remainingMinutes: 15,
    achieved: false,
  });
  expect(readingGoalProgress(store, 10, now).achieved).toBe(true);
});
test("disabled and malformed goals never claim completion", () => {
  expect(normalizeReadingGoal(NaN)).toBe(30);
  expect(normalizeReadingGoal(999)).toBe(240);
  expect(readingGoalProgress({}, 0, Date.now()).achieved).toBe(false);
});
