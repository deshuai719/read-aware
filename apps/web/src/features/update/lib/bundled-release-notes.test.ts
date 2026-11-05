import { expect, test } from "bun:test";
import { bundledReleaseNotes } from "./bundled-release-notes";
test("this installer has offline release contents, unknown versions still use the feed",()=>{
  expect(bundledReleaseNotes("0.5.0-17","zh-Hans")?.text.groups[0]?.items.length).toBeGreaterThan(3);
  expect(bundledReleaseNotes("v0.5.0-17","en")?.version).toBe("v0.5.0-17");
  expect(bundledReleaseNotes("0.5.0-18","en")?.text.groups[0]?.items).toHaveLength(5);
  expect(bundledReleaseNotes("0.5.0-19","en")?.text.groups[0]?.items).toHaveLength(7);
  expect(bundledReleaseNotes("0.5.0-20","en")?.text.groups[0]?.items).toHaveLength(3);
  expect(bundledReleaseNotes("0.5.0-21","en")?.text.groups[0]?.items).toHaveLength(4);
  expect(bundledReleaseNotes("0.5.0-22","en")).toBeNull();
});
