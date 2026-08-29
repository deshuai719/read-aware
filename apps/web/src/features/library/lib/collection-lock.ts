/**
 * Collection folder locks: Argon2id password hashes that ride the synced
 * `collection.passwordChanged` event (so every device locks the same folder
 * with the same password), plus the in-memory session unlock state. The hash
 * string is self-describing JSON (salt + params + digest) generated and
 * verified client-side with @noble — the relay never sees any of it, and a
 * restart re-locks every folder.
 */
import type { Collection, LibraryBook } from "./library-types";
import { argon2id } from "@noble/hashes/argon2.js";
import { randomBytes } from "@noble/hashes/utils.js";
import { equalBytes } from "@noble/ciphers/utils.js";

type StoredHash = { salt: string; hash: string; t: number; m: number; p: number };

const utf8 = (s: string) => new TextEncoder().encode(s);

function toBase64(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

function fromBase64(s: string): Uint8Array {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
  return out;
}

const KDF_PARAMS = { t: 2, m: 65536, p: 1 } as const;

/** Hash a folder password for `collection.passwordChanged`. */
export function hashCollectionPassword(password: string): string {
  const salt = randomBytes(16);
  const hash = argon2id(utf8(password), salt, KDF_PARAMS);
  return JSON.stringify({
    salt: toBase64(salt),
    hash: toBase64(hash),
    t: KDF_PARAMS.t,
    m: KDF_PARAMS.m,
    p: KDF_PARAMS.p,
  } satisfies StoredHash);
}

/** Constant-time verification against a synced password hash. */
export function verifyCollectionPassword(passwordHash: string, password: string): boolean {
  try {
    const stored = JSON.parse(passwordHash) as StoredHash;
    const salt = fromBase64(stored.salt);
    const hash = argon2id(utf8(password), salt, { t: stored.t, m: stored.m, p: stored.p });
    return equalBytes(hash, fromBase64(stored.hash));
  } catch {
    return false;
  }
}

/** In-memory session unlock state — a restart re-locks every folder. */
const unlocked = new Set<string>();

export function unlockCollection(id: string): void {
  unlocked.add(id);
}

export function lockCollection(id: string): void {
  unlocked.delete(id);
}

export function isCollectionUnlocked(id: string): boolean {
  return unlocked.has(id);
}
/**
 * Whether a collection is currently password-hidden: it carries a hash and the
 * session has not unlocked it. Single source of truth for every preview
 * surface (tiles, internal view, search, stats, reference cards).
 */
export function isCollectionLocked(collection: Pick<Collection, "id" | "passwordHash">): boolean {
  return Boolean(collection.passwordHash) && !isCollectionUnlocked(collection.id);
}

/**
 * Whether a book lives inside a password-hidden collection (no `collectionId`
 * or an unlocked/missing collection is never hidden).
 */
export function isBookInLockedCollection(
  book: Pick<LibraryBook, "collectionId">,
  collections: readonly Pick<Collection, "id" | "passwordHash">[],
): boolean {
  if (!book.collectionId) return false;
  const collection = collections.find((c) => c.id === book.collectionId);
  return collection ? isCollectionLocked(collection) : false;
}