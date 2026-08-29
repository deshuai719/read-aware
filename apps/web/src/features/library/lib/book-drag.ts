/**
 * In-app book drag contract (HTML5 DnD, custom MIME type).
 *
 * The OS file import overlay (`useDropBookImport`) keys on `dataTransfer.types`
 * containing "Files". Cover images are `<img>` elements, so without this guard
 * a native image drag (which carries Files) would trigger the "drop to import"
 * overlay mid book-drag. Book drags set ONLY this type, and the import overlay
 * explicitly ignores drags that carry it.
 */
export const BOOK_DRAG_MIME = "application/x-read-aware-book-ids";