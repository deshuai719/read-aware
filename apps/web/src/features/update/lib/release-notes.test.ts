import { describe, expect, test } from "bun:test";
import { fetchReleaseNotes, parseReleaseNotes, stripMarkdown } from "./release-notes";

const body = [
  "## New",
  "",
  "- **reader**: In-book search with jump-to-hit",
  "- **shelf**: Right-click menus for books",
  "",
  "## Improved",
  "",
  "- **ui**: Anchor DropdownMenu to the viewport",
  "",
  "## Fixed",
  "",
  "- **plugins**: Accept the syncTransports capability",
  "",
  "**Full Changelog**: https://github.com/o/r/compare/v1...v2",
].join("\n");

describe("parseReleaseNotes", () => {
  test("groups bullets by section and splits the scope lead-in", () => {
    const text = parseReleaseNotes(body)!;
    expect(text.groups.map((g) => g.kind)).toEqual(["new", "improved", "fixed"]);
    expect(text.groups[0]!.items[0]).toEqual({ title: "reader", body: "In-book search with jump-to-hit" });
    expect(text.summary).toBe("reader: In-book search with jump-to-hit");
  });

  test("release-please headings and a bare bullet list both parse", () => {
    expect(parseReleaseNotes("### Features\n\n* faster opening")!.groups[0]).toEqual({
      kind: "new",
      items: [{ body: "faster opening" }],
    });
    expect(parseReleaseNotes("- one change")!.groups[0]!.items[0]).toEqual({ body: "one change" });
  });

  test("a body with no bullets (the old compare-link-only release) yields nothing", () => {
    expect(parseReleaseNotes("**Full Changelog**: https://example/compare/a...b")).toBeNull();
  });

  test("markdown emphasis, links and code are flattened", () => {
    expect(stripMarkdown("**bold** [link](https://x) `code` ~~old~~")).toBe("bold link code old");
  });
});

describe("fetchReleaseNotes", () => {
  test("tries the v-prefixed tag, then the bare one", async () => {
    const seen: string[] = [];
    const results: Record<string, unknown> = {
      "https://api.github.com/repos/o/r/releases/tags/v1.2.3": { message: "Not Found" },
      "https://api.github.com/repos/o/r/releases/tags/1.2.3": {
        tag_name: "1.2.3",
        body: "## Fixed\n\n- **ai**: keep ids prefixed",
        published_at: "2026-10-30T10:30:06Z",
      },
    };
    const entry = await fetchReleaseNotes("1.2.3", async (url) => {
      seen.push(String(url));
      const payload = results[String(url)];
      const ok = payload && !("message" in (payload as object));
      return new Response(JSON.stringify(payload ?? {}), { status: ok ? 200 : 404 });
    }, "o/r");
    expect(seen).toHaveLength(2);
    expect(entry?.version).toBe("1.2.3");
    expect(entry?.date).toBe("2026-10-30");
    expect(entry?.text.groups[0]!.kind).toBe("fixed");
  });

  test("network failure resolves to null (the dialog keeps its fallback)", async () => {
    const entry = await fetchReleaseNotes("9.9.9", async () => {
      throw new Error("offline");
    }, "o/r");
    expect(entry).toBeNull();
  });
});
