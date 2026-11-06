import { listLibraryBooks, listCollections } from "./library-db";
import {
  getDesktopBlobInfo,
  openDesktopBlobFile,
} from "../../../platform/blob-store";
import {
  createFoliateView,
  type FoliateView,
} from "../../reader/lib/foliate-engine";
import { parseBookFile } from "../../reader/lib/parse-book";
import { ensureUsableToc } from "../../reader/lib/toc-synthesis";
import { getReaderOverrides } from "../../settings/lib/reader-overrides";
import { normalizeTextEncoding } from "../../reader/lib/decode-text";
import { scanLibraryText, type LibraryTextSource } from "./library-full-text";
import { isTauri } from "../../../platform/environment";
/** The same Foliate parser/searcher, with no visible renderer and no progress observers. Never fetches remote book bytes. */
export function searchLocalLibraryText(query: string, signal: AbortSignal) {
  return scanLibraryText(
    {
      books: listLibraryBooks,
      collections: listCollections,
      open: async (book, signal): Promise<LibraryTextSource | null> => {
        if (!isTauri()) throw new Error("library-search-desktop-only");
        const key = "bookfile:" + book.id,
          info = await getDesktopBlobInfo(key);
        if (!info?.sha256) return null;
        const file = await openDesktopBlobFile(
          key,
          book.fileName,
          book.mimeType,
        );
        if (!file) return null;
        let view: FoliateView | null = null,
          parsed: Awaited<ReturnType<typeof parseBookFile>> | null = null;
        const dispose = async () => {
          try {
            view?.close();
          } finally {
            view?.remove();
            await parsed?.destroy?.();
          }
        };
        try {
          parsed = await parseBookFile(file, {
            textEncoding: normalizeTextEncoding(
              getReaderOverrides()[book.id]?.textEncoding,
            ),
          });
          if (signal.aborted) {
            await dispose();
            return null;
          }
          await ensureUsableToc(parsed);
          view = await createFoliateView();
          await view.open(parsed);
          if (signal.aborted) {
            await dispose();
            return null;
          }
          const scan = view;
          return {
            sourceSha256: info.sha256,
            search: (query, signal) =>
              scan.search({
                query,
                matchCase: false,
                matchDiacritics: false,
                signal,
                batchSize: 25,
                sectionTimeoutMs: 1500,
                maxResults: 500,
              }),
            dispose,
          };
        } catch (error) {
          await dispose().catch(() => {});
          throw error;
        }
      },
    },
    query,
    signal,
  );
}
