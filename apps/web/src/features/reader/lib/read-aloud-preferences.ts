export type ReadAloudPreferences = {
  voice: string;
  rate: number;
  sleepMinutes: number;
};
export const DEFAULT_READ_ALOUD: ReadAloudPreferences = {
  voice: "auto",
  rate: 1,
  sleepMinutes: 0,
};
export function normalizeReadAloud(
  value: Partial<ReadAloudPreferences> | undefined,
): ReadAloudPreferences {
  return {
    voice: typeof value?.voice === "string" ? value.voice : "auto",
    rate:
      typeof value?.rate === "number" && Number.isFinite(value.rate)
        ? Math.max(0.5, Math.min(2, value.rate))
        : 1,
    sleepMinutes:
      typeof value?.sleepMinutes === "number" &&
      Number.isFinite(value.sleepMinutes)
        ? Math.max(0, Math.min(120, Math.round(value.sleepMinutes)))
        : 0,
  };
}
