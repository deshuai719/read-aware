import type { TFunction } from "i18next";

/**
 * Engine failures arrive with a stable code prefix (see foliate-js/epub.js);
 * anything without one is already a human-readable message. Codes exist so the
 * reader can say "this book is encrypted" in the user's own language instead of
 * pasting an English exception.
 */
const ERROR_CODES = [
  { prefix: "EPUB_DRM", key: "errorDrm" },
  { prefix: "EPUB_NO_PACKAGE", key: "errorNoPackage" },
] as const;

/** Turn a thrown value into a reader-facing message. `t` is bound to `reader`. */
export function formatReaderError(error: unknown, t: TFunction<"reader">) {
  if (error instanceof Error && error.message) {
    const mapped = ERROR_CODES.find(code => error.message.startsWith(code.prefix));
    if (mapped) return t(mapped.key);
    return error.message;
  }
  return t("loadError");
}
