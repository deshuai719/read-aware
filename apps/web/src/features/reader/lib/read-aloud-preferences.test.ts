import { expect, test } from "bun:test";
import { normalizeReadAloud } from "./read-aloud-preferences";
test("per-book read-aloud values have bounded speed and wall-clock sleep", () => {
  expect(normalizeReadAloud(undefined)).toEqual({
    voice: "auto",
    rate: 1,
    sleepMinutes: 0,
  });
  expect(
    normalizeReadAloud({ voice: "system:test", rate: 3, sleepMinutes: 999 }),
  ).toEqual({ voice: "system:test", rate: 2, sleepMinutes: 120 });
  expect(normalizeReadAloud({ rate: NaN, sleepMinutes: -1 }).rate).toBe(1);
});
