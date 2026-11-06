import type { TextEncoding } from "../../reader/lib/decode-text";
export type BookTextIdentity = {
  sourceSha256: string | null;
  textEncoding: TextEncoding;
};
export function bookTextIdentityKey(value: BookTextIdentity): string {
  return JSON.stringify([value.sourceSha256, value.textEncoding]);
}
/** Legacy caches are reusable only for automatic decoding; known source hashes must agree. */
export function bookTextIdentityMatches(
  record: { sourceSha256?: string | null; textEncoding?: TextEncoding },
  current: BookTextIdentity,
): boolean {
  return (
    (record.textEncoding ?? "auto") === current.textEncoding &&
    (!record.sourceSha256 || record.sourceSha256 === current.sourceSha256)
  );
}
