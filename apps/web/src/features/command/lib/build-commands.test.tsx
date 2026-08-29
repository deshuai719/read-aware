import { describe, expect, test } from "bun:test";
import type { TFunction } from "i18next";
import type { CommandContext } from "./build-commands";
import { unlockCollection } from "../../library/lib/collection-lock";
import type { Collection, LibraryBook } from "../../library/lib/library-types";
import { buildCommands } from "./build-commands";

const noop = () => {};
const t = ((key: string) => key) as unknown as TFunction<"command">;

function context(readingBookId: string | null): CommandContext {
  return {
    activeTopNav: "shelf",
    readingBookId,
    shelfView: { layout: "grid", group: "none", sort: "recent" },
    collections: [],
    books: [],
    openBook: noop,
    openCollection: noop,
    goShelf: noop,
    goAgent: noop,
    goStats: noop,
    openSettings: noop,
    importBook: noop,
    startSelection: noop,
    setLayout: noop,
    setSort: noop,
    setGroup: noop,
  };
}

describe("buildCommands", () => {
  test("omits the Library destination while already on the Library surface", () => {
    const commands = buildCommands(context(null), t);
    expect(commands.some((command) => command.id === "go-shelf")).toBe(false);
  });

  test("offers the Library destination while a reader is open", () => {
    const commands = buildCommands(context("book-1"), t);
    expect(commands.some((command) => command.id === "go-shelf")).toBe(true);
  });

  test("hides books whose collection is password-locked", () => {
    const collections: Collection[] = [
      { id: "c-locked", name: "Private", createdAt: "2026-01-01T00:00:00.000Z", passwordHash: "hash" },
      { id: "c-open", name: "Open", createdAt: "2026-01-01T00:00:00.000Z" },
    ];
    const base: LibraryBook = {
      id: "x",
      title: "Untitled",
      author: "Unknown author",
      format: "epub",
      fileName: "book.epub",
      mimeType: "application/epub+zip",
      fileSize: 1024,
      coverUrl: null,
      createdAt: "2026-03-13T00:00:00.000Z",
      updatedAt: "2026-03-13T00:00:00.000Z",
      lastOpenedAt: null,
      progressPercent: 0,
      readingStatus: "unread",
      progress: null,
      starred: false,
    };
    const ctx = {
      ...context(null),
      collections,
      books: [
        { ...base, id: "locked-book", title: "Secret", collectionId: "c-locked" },
        { ...base, id: "open-book", title: "Visible", collectionId: "c-open" },
      ] satisfies LibraryBook[],
    };
    const commands = buildCommands(ctx, t);
    expect(commands.some((command) => command.id === "book-locked-book")).toBe(false);
    expect(commands.some((command) => command.id === "book-open-book")).toBe(true);
  });

  test("shows locked-collection books once the folder is unlocked this session", () => {
    unlockCollection("c-locked");
    const collections: Collection[] = [
      { id: "c-locked", name: "Private", createdAt: "2026-01-01T00:00:00.000Z", passwordHash: "hash" },
    ];
    const base: LibraryBook = {
      id: "x",
      title: "Untitled",
      author: "Unknown author",
      format: "epub",
      fileName: "book.epub",
      mimeType: "application/epub+zip",
      fileSize: 1024,
      coverUrl: null,
      createdAt: "2026-03-13T00:00:00.000Z",
      updatedAt: "2026-03-13T00:00:00.000Z",
      lastOpenedAt: null,
      progressPercent: 0,
      readingStatus: "unread",
      progress: null,
      starred: false,
    };
    const ctx = {
      ...context(null),
      collections,
      books: [{ ...base, id: "now-visible", title: "Secret", collectionId: "c-locked" }] satisfies LibraryBook[],
    };
    const commands = buildCommands(ctx, t);
    expect(commands.some((command) => command.id === "book-now-visible")).toBe(true);
  });
});
