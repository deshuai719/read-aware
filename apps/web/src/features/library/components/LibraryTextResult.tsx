import { Body, Button, Caption } from "@read-aware/ui";
import type { LibraryTextHit } from "../lib/library-full-text";
/** Multi-line result owns its height; every descendant stays inside the one hit target. */
export function LibraryTextResult({
  hit,
  onSelect,
}: {
  hit: LibraryTextHit;
  onSelect: () => void;
}) {
  return (
    <Button
      variant="ghost"
      className="flex h-auto min-h-24 w-full flex-col items-start justify-start gap-1 whitespace-normal rounded-md border-b border-border px-3 py-3 text-left"
      onClick={onSelect}
    >
      <Caption as="span" className="block text-fg-subtle">
        {hit.bookTitle}
        {hit.chapter ? " · " + hit.chapter : ""}
      </Caption>
      <Body
        as="span"
        className="block w-full break-words text-sm leading-relaxed font-normal text-fg"
      >
        {hit.pre}
        <mark className="bg-transparent font-semibold text-fg underline decoration-fg-subtle underline-offset-2">
          {hit.match}
        </mark>
        {hit.post}
      </Body>
    </Button>
  );
}
