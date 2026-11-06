import { expect, test } from "bun:test";
import {
  normalizeReaderAdvanced,
  readerAllowsMotion,
  cjkTypographyCss,
} from "./reader-advanced";
test("optional motion never overrides reduced-motion", () => {
  expect(readerAllowsMotion("smooth", false)).toBe(true);
  expect(readerAllowsMotion("none", false)).toBe(false);
  expect(readerAllowsMotion("smooth", true)).toBe(false);
  expect(readerAllowsMotion(undefined, true)).toBe(false);
});
test("CJK options never rewrite or normalize original document text", () => {
  expect(
    cjkTypographyCss({ cjkLineBreak: "book", cjkSpacing: false }),
  ).not.toContain("!important");
  expect(
    cjkTypographyCss({ cjkLineBreak: "strict", cjkSpacing: true }),
  ).toContain("line-break:strict");
  expect(cjkTypographyCss({ cjkSpacing: true })).toContain(
    "text-autospace:normal",
  );
});
test("default image fidelity and parameter bounds", () => {
  expect(normalizeReaderAdvanced(null).imageBrightness).toBe(100);
  expect(
    normalizeReaderAdvanced({ imageBrightness: 200 }).imageBrightness,
  ).toBe(100);
  expect(normalizeReaderAdvanced({ imageBrightness: 1 }).imageBrightness).toBe(
    30,
  );
  expect(
    normalizeReaderAdvanced({ imageBrightness: NaN }).imageBrightness,
  ).toBe(100);
});
