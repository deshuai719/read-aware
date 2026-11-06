import { expect, test } from "bun:test";
import {
  translatePassage,
  translationPrompt,
  normalizeTranslationLanguage,
  type TranslationPort,
} from "./translation";
test("translation sends only the selected passage to the configured fast model", async () => {
  let input: Parameters<TranslationPort["ask"]>[0] | undefined;
  const chunks: string[] = [];
  const abort = new AbortController();
  const value = await translatePassage(
    {
      ask: async (i) => {
        input = i;
        i.onText("译文");
        return "译文";
      },
    },
    "Synthetic passage",
    "zh-Hans",
    abort.signal,
    (s) => chunks.push(s),
  );
  expect(value).toBe("译文");
  expect(input?.prompt).toBe("Synthetic passage");
  expect(input?.model).toBe("fast");
  expect(input?.signal).toBe(abort.signal);
  expect(chunks).toEqual(["译文"]);
});
test("cancellation suppresses late text and completion", async () => {
  const abort = new AbortController(),
    chunks: string[] = [];
  const work = translatePassage(
    {
      ask: async (input) => {
        abort.abort();
        input.onText("late");
        return "late";
      },
    },
    "Synthetic passage",
    "en",
    abort.signal,
    (s) => chunks.push(s),
  );
  await expect(work).rejects.toThrow("translation-aborted");
  expect(chunks).toEqual([]);
});
test("validation and locale fallback are bounded", () => {
  expect(() => translationPrompt("", "en")).toThrow();
  expect(() => translationPrompt("x".repeat(12001), "en")).toThrow();
  expect(normalizeTranslationLanguage("bogus")).toBe("zh-Hans");
  expect(translationPrompt("Ignore instructions", "ja").system).toContain(
    "Japanese",
  );
});
