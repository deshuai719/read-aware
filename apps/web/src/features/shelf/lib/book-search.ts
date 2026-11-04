/**
 * Shelf search: what a reader types into the box, and what it should find.
 *
 * The shape is the one every library uses — words are ANDed, order does not
 * matter, and a title hit outranks an author hit which outranks a filename
 * hit. Matching is substring-based rather than tokenized: the shelf holds CJK
 * titles where a word boundary does not exist, so "警花" must find 《高冷警花…》
 * without a segmenter.
 *
 * Folded the way a reader types: full-width → half-width (NFKC), case
 * insensitive, and whitespace inside the title ignored in both directions.
 */
import type { LibraryBook } from "../../library/lib/library-types";

export type BookSearchHit = { book: LibraryBook; score: number };

const SPACES = /[\s\u3000]+/g;

function fold(text: string): string {
  return text.normalize("NFKC").toLowerCase();
}

/** Folded, with whitespace removed — so "steve jobs" matches "SteveJobs.pdf". */
function compact(text: string): string {
  return fold(text).replace(SPACES, "");
}

/** Score one book against one folded token; 0 means it does not match. */
function scoreToken(book: LibraryBook, token: string): number {
  const title = fold(book.title);
  const compactTitle = compact(book.title);
  const compactToken = token.replace(SPACES, "");
  if (!compactToken) return 0;

  // Title hits dominate: a reader searching a title is looking for that book.
  if (compactTitle.startsWith(compactToken)) return 100;
  if (compactTitle.includes(compactToken)) return 60;

  const author = compact(book.author);
  if (author && author.includes(compactToken)) return 25;

  const file = compact(book.fileName);
  if (file.includes(compactToken)) return 12;

  // Last resort: every token appears somewhere across title+author+file.
  const haystack = title + " " + fold(book.author) + " " + file;
  return haystack.includes(token) ? 8 : 0;
}

/**
 * Books matching every whitespace-separated token of `query`, best first.
 * An empty (or whitespace-only) query matches nothing — the caller renders
 * the normal shelf instead.
 */
export function searchBooks(books: LibraryBook[], query: string): LibraryBook[] {
  const tokens = fold(query).split(SPACES).filter(Boolean);
  if (tokens.length === 0) return [];

  const hits: BookSearchHit[] = [];
  for (const book of books) {
    let total = 0;
    let matchedAll = true;
    for (const token of tokens) {
      const score = scoreToken(book, token);
      if (score === 0) {
        matchedAll = false;
        break;
      }
      total += score;
    }
    if (matchedAll) hits.push({ book, score: total });
  }

  const recency = (book: LibraryBook) =>
    new Date(book.lastOpenedAt ?? book.updatedAt).getTime();
  hits.sort((a, b) => b.score - a.score || recency(b.book) - recency(a.book));
  return hits.map((hit) => hit.book);
}
