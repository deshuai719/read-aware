import { expect, test } from "bun:test";
import {
  localFontFormat,
  localFontId,
  localFontFamily,
  LOCAL_FONT_MAX_BYTES,
} from "./local-font-format";
test("recognized signatures and size bounds are independent of the file extension", () => {
  for (const [signature, format] of [
    ["OTTO", "otf"],
    ["wOFF", "woff"],
    ["wOF2", "woff2"],
  ] as const) {
    const bytes = new Uint8Array(16);
    bytes.set(new TextEncoder().encode(signature));
    expect(localFontFormat(bytes)).toBe(format);
  }
  expect(
    localFontFormat(new Uint8Array([0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0])),
  ).toBe("ttf");
  expect(() => localFontFormat(new Uint8Array(12))).toThrow(
    "font-invalid-format",
  );
  expect(() =>
    localFontFormat(new Uint8Array(LOCAL_FONT_MAX_BYTES + 1)),
  ).toThrow("font-invalid-size");
});
test("font IDs cannot inject CSS family tokens", () => {
  expect(localFontId('local:bad";body{}')).toBeNull();
  expect(localFontFamily("local:01234567-89ab-cdef-0123-456789abcdef")).toBe(
    "ReadAwareLocal_0123456789abcdef0123456789abcdef",
  );
});
