import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { LibraryTextResult } from "./LibraryTextResult";
test("multiline results override fixed button height and keep phrasing-only content", () => {
  const html = renderToStaticMarkup(
    <LibraryTextResult
      hit={{
        bookId: "b",
        bookTitle: "Title",
        cfi: "c",
        sourceSha256: "hash",
        chapter: "Chapter",
        pre: "Before ",
        match: "quiet road",
        post: " after",
      }}
      onSelect={() => {}}
    />,
  );
  expect(html).toContain("h-auto");
  expect(html).not.toContain("h-9");
  expect(html).not.toContain("<p");
  expect(html).not.toContain("<h3");
  expect(html).toContain("quiet road");
});
