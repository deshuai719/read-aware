import type { Annotation, AnnotationType, Highlight } from "./annotation-types";
import type { TocEntry } from "../../reader/lib/reader-types";
export type AnnotationFilter = {
  query?: string;
  type?: AnnotationType | "all";
  chapter?: string;
  color?: Highlight["color"] | "all";
};
function canonical(href: string) {
  try {
    return decodeURI(href).replace(/^\.\//, "");
  } catch {
    return href;
  }
}
export function filterAnnotations(
  items: readonly Annotation[],
  filter: AnnotationFilter,
): Annotation[] {
  const query = filter.query?.trim().toLocaleLowerCase();
  return items.filter(
    (item) =>
      (!filter.type || filter.type === "all" || item.type === filter.type) &&
      (!filter.color ||
        filter.color === "all" ||
        (item.type === "highlight" && item.color === filter.color)) &&
      (!filter.chapter ||
        canonical(item.chapterHref ?? "") === canonical(filter.chapter)) &&
      (!query ||
        (item.text + (item.type === "note" ? "\n" + item.content : ""))
          .toLocaleLowerCase()
          .includes(query)),
  );
}
export function groupAnnotationsByChapter(
  items: readonly Annotation[],
  toc: readonly TocEntry[],
): { label: string | null; items: Annotation[] }[] {
  const claimed = new Set<string>(),
    groups: { label: string | null; items: Annotation[] }[] = [];
  for (const entry of toc) {
    const key = canonical(entry.href);
    const group = items.filter(
      (a) =>
        a.chapterHref && canonical(a.chapterHref) === key && !claimed.has(a.id),
    );
    if (group.length) {
      group.forEach((a) => claimed.add(a.id));
      groups.push({ label: entry.label, items: group });
    }
  }
  const rest = items.filter((a) => !claimed.has(a.id));
  if (rest.length) groups.push({ label: null, items: rest });
  return groups;
}
function csv(value: string) {
  const safe = /^[\s]*[=+@-]/.test(value) ? "'" + value : value;
  return '"' + safe.replace(/"/g, '""') + '"';
}
export function exportAnnotations(
  items: readonly Annotation[],
  toc: readonly TocEntry[],
  bookTitle: string,
  format: "md" | "csv",
): string {
  const groups = groupAnnotationsByChapter(items, toc);
  if (format === "csv")
    return (
      "\uFEFF" +
      [
        [
          "book",
          "chapter",
          "type",
          "color",
          "quoted_text",
          "note",
          "anchor",
          "created_at",
          "updated_at",
        ],
        ...groups.flatMap((group) =>
          group.items.map((item) => [
            bookTitle,
            group.label ?? "",
            item.type,
            item.type === "highlight" ? item.color : "",
            item.text,
            item.type === "note" ? item.content : "",
            item.cfiRange ?? "",
            item.createdAt,
            item.updatedAt,
          ]),
        ),
      ]
        .map((row) => row.map(csv).join(","))
        .join("\r\n")
    );
  const title = bookTitle.replace(/[\r\n]/g, " ");
  return (
    "# " +
    title +
    "\n\n" +
    groups
      .map(
        (group) =>
          (group.label
            ? "## " + group.label.replace(/[\r\n]/g, " ") + "\n\n"
            : "") +
          group.items
            .map(
              (item) =>
                "### " +
                item.type +
                " — " +
                item.createdAt +
                "\n\n" +
                item.text
                  .split("\n")
                  .map((line) => "> " + line)
                  .join("\n") +
                "\n\n" +
                (item.type === "note" ? item.content + "\n\n" : "") +
                "Anchor: " +
                (item.cfiRange ?? "") +
                "\n\n",
            )
            .join(""),
      )
      .join("")
  );
}
