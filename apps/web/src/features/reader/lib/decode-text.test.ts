import { expect, test } from "bun:test";
import { decodeTextBook, detectTextBook } from "./decode-text";
test("BOM and UTF-16 byte parity decide encoding without legacy guesses", () => {
  expect(
    detectTextBook(new Uint8Array([255, 254, 65, 0, 66, 0])).encoding,
  ).toBe("utf-16le");
  expect(
    detectTextBook(new Uint8Array([0, 65, 0, 66, 0, 67, 0, 68, 0, 69, 0, 70]))
      .text,
  ).toBe("ABCDEF");
});
test("UTF-8 decodes strictly; empty and ASCII do not falsely report ambiguity", () => {
  const bytes = new TextEncoder().encode("你好，Reader");
  expect(detectTextBook(bytes).encoding).toBe("utf-8");
  expect(decodeTextBook(bytes)).toBe("你好，Reader");
  expect(detectTextBook(new Uint8Array()).confidence).toBe("high");
});
test("explicit legacy override preserves the source bytes and exact decoding", () => {
  const bytes = new Uint8Array([0xa4, 0xa4, 0xa4, 0xe5]);
  const original = [...bytes];
  expect(detectTextBook(bytes, { encoding: "big5" }).text).toBe("中文");
  expect([...bytes]).toEqual(original);
  expect(detectTextBook(bytes, { encoding: "big5" }).reason).toBe("override");
});
test("ambiguous legacy encodings report alternatives instead of claiming certainty", () => {
  const result = detectTextBook(new Uint8Array([0xa4, 0xa4, 0xa4, 0xe5]));
  expect(result.confidence).toBe("low");
  expect(result.candidates).toContain("big5");
  expect(result.candidates).toContain("gb18030");
});
test("HTML charset is respected and malformed explicit UTF is a visible error", () => {
  const prefix = new TextEncoder().encode(
    '<meta charset="windows-1252"><p>caf',
  );
  const bytes = new Uint8Array([
    ...prefix,
    0xe9,
    ...new TextEncoder().encode("</p>"),
  ]);
  expect(detectTextBook(bytes, { html: true }).encoding).toBe("windows-1252");
  expect(detectTextBook(bytes, { html: true }).text).toContain("café");
  expect(() =>
    detectTextBook(new Uint8Array([0xff]), { encoding: "utf-8" }),
  ).toThrow("text-decoding-failed");
});
