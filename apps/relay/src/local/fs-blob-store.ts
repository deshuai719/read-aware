/**
 * Filesystem BlobStore: encrypted blobs land as flat files under
 * `{root}/{accountId}/{key}` (mirrors R2's object-key layout). Both path
 * segments come from the HTTP surface, so each is validated against a strict
 * pattern before touching the filesystem — a crafted key can never escape
 * the root.
 */
import { readdir, readFile, stat, unlink, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import type { BlobStore } from "../ports";

// Router keys are BLOB_KEY_SHAPE ([A-Za-z0-9][A-Za-z0-9:._-]{0,255}) and
// chunked parts append #<index> — # is the only extra character the fs
// layer ever sees. A leading alphanumeric plus this set rules out ./.. segments.
const SEGMENT_PATTERN = /^[A-Za-z0-9][A-Za-z0-9:._#-]{0,255}$/;

function segmentPath(root: string, accountId: string, key: string): string {
  if (!SEGMENT_PATTERN.test(accountId)) throw new Error(`invalid account id: ${accountId}`);
  if (!SEGMENT_PATTERN.test(key)) throw new Error(`invalid blob key: ${key}`);
  return join(root, accountId, key);
}

export function createFsBlobStore(root: string): BlobStore {
  return {
    async put(accountId, key, bytes) {
      const path = segmentPath(root, accountId, key);
      await mkdir(join(root, accountId), { recursive: true });
      await writeFile(path, bytes);
    },
    async get(accountId, key) {
      try {
        return new Uint8Array(await readFile(segmentPath(root, accountId, key)));
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
        throw error;
      }
    },
    async head(accountId, key) {
      try {
        return (await stat(segmentPath(root, accountId, key))).size;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
        throw error;
      }
    },
    async delete(accountId, key) {
      const path = segmentPath(root, accountId, key);
      try {
        const size = (await stat(path)).size;
        await unlink(path);
        return size;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") return 0;
        throw error;
      }
    },
    async wipe(accountId) {
      const dir = join(root, accountId);
      try {
        for (const entry of await readdir(dir)) await unlink(join(dir, entry));
        await unlink(dir);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      }
    },
  };
}