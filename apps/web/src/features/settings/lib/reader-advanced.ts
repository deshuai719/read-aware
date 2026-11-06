export type ReaderAdvancedPreferences = {
  pageTransition: "none" | "smooth";
  cjkLineBreak: "book" | "strict" | "loose";
  cjkSpacing: boolean;
  imageBrightness: number;
};
export const DEFAULT_READER_ADVANCED: ReaderAdvancedPreferences = {
  pageTransition: "smooth",
  cjkLineBreak: "book",
  cjkSpacing: false,
  imageBrightness: 100,
};
export function normalizeReaderAdvanced(
  value: Partial<ReaderAdvancedPreferences> | null | undefined,
): ReaderAdvancedPreferences {
  return {
    pageTransition: value?.pageTransition === "none" ? "none" : "smooth",
    cjkLineBreak:
      value?.cjkLineBreak === "strict" || value?.cjkLineBreak === "loose"
        ? value.cjkLineBreak
        : "book",
    cjkSpacing: value?.cjkSpacing === true,
    imageBrightness:
      typeof value?.imageBrightness === "number" &&
      Number.isFinite(value.imageBrightness)
        ? Math.max(30, Math.min(100, value.imageBrightness))
        : 100,
  };
}
export function readerAllowsMotion(
  transition: ReaderAdvancedPreferences["pageTransition"] | undefined,
  reduced: boolean,
): boolean {
  return transition !== "none" && !reduced;
}
export function cjkTypographyCss(
  settings: Partial<ReaderAdvancedPreferences>,
): string {
  return (
    "body:lang(zh),body:lang(ja),body:lang(ko){" +
    (settings.cjkLineBreak && settings.cjkLineBreak !== "book"
      ? "line-break:" +
        settings.cjkLineBreak +
        " !important;word-break:normal !important;"
      : "") +
    (settings.cjkSpacing ? "text-autospace:normal;" : "") +
    "}"
  );
}
