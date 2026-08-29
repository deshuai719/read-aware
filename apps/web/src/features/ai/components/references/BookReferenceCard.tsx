/**
 * A shelf book shown as a card inside an assistant reply. Renders from the
 * persisted snapshot immediately; cover, author and progress upgrade in place
 * once the shelf hydrates. Clicking opens the book in the reader (dispatched
 * via openBookRequestAtom — the reader session lives far up the tree in App).
 */
import { LockSimple } from "@phosphor-icons/react";
import { useSetAtom } from "jotai";
import { Progress } from "@read-aware/ui";
import { formatPercent, useTranslation } from "../../../../i18n";
import type { LibraryBook } from "../../../library/lib/library-types";
import { BookCoverPlaceholder } from "../../../shelf/components/BookCoverPlaceholder";
import type { ChatBookReference } from "../../lib/chat-types";
import { openBookRequestAtom } from "../../state/chat-intent";

export function BookReferenceCard({
  reference,
  book,
  locked = false,
}: {
  reference: ChatBookReference;
  /** Hydrated shelf record; null = still loading, undefined = off the shelf. */
  book: LibraryBook | null | undefined;
  /** The referenced book sits in a password-locked collection this session. */
  locked?: boolean;
}) {
  const { t } = useTranslation("ai");
  const dispatchOpen = useSetAtom(openBookRequestAtom);
  const title = book?.title ?? reference.title;
  const author = book?.author ?? reference.author;
  const missing = book === undefined;

  // Password-hidden folder: render a neutral placeholder, no cover, title or
  // progress, and never offer a click-through to the reader.
  if (locked) {
    return (
      <div className="flex w-full items-center gap-3 rounded-md border border-border px-2.5 py-2 opacity-70">
        <LockSimple size={16} weight="fill" aria-hidden="true" className="shrink-0 text-fg-muted" />
        <span className="font-sans text-xs text-fg-muted">{t("chat.references.locked")}</span>
      </div>
    );
  }

  const body = (
    <>
      <div className="h-16 w-11 shrink-0 overflow-hidden rounded-sm shadow-sm">
        {book?.coverUrl ? (
          <img src={book.coverUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <BookCoverPlaceholder title={title} author={author} />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <span className="block truncate font-serif text-sm font-medium text-fg">{title}</span>
        {author && (
          <span className="mt-0.5 block truncate font-sans text-xs text-fg-muted">{author}</span>
        )}
        {missing ? (
          <span className="mt-0.5 block font-sans text-xs text-fg-subtle">
            {t("chat.references.missingBook")}
          </span>
        ) : book && book.progressPercent > 0 ? (
          <div className="mt-1.5 flex items-center gap-2">
            <Progress value={book.progressPercent} size="sm" className="w-24" />
            <span className="font-sans text-[11px] tabular-nums text-fg-muted">
              {formatPercent(book.progressPercent)}
            </span>
          </div>
        ) : null}
      </div>
    </>
  );

  if (missing) {
    return (
      <div className="flex w-full items-center gap-3 rounded-md border border-border px-2.5 py-2 opacity-70">
        {body}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => dispatchOpen({ id: crypto.randomUUID(), bookId: reference.bookId })}
      aria-label={t("chat.references.openBook", { title })}
      className="flex w-full items-center gap-3 rounded-md border border-border px-2.5 py-2 text-left transition-colors hover:bg-fill focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-fg"
    >
      {body}
    </button>
  );
}
