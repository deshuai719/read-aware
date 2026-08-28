/**
 * Per-account mailbox on the local filesystem: one SQLite database per
 * account mirrors the Durable Object's per-account shard. MailboxCore's SQL
 * is shared verbatim; Bun's single-threaded event loop plus SQLite's
 * synchronous calls preserve the DO's serialized seq assignment. The
 * WebSocket doorbell (`watch`) is omitted — clients already poll on a
 * 5-minute interval, so the route answers 501.
 */
import { mkdirSync } from "node:fs";
import { unlink } from "node:fs/promises";
import { join } from "node:path";
import { Database } from "bun:sqlite";
import { MailboxCore, type SqlExec } from "../mailbox-core";
import type { Mailbox } from "../ports";

function sqlOver(db: Database): SqlExec {
  return {
    // The DO's sql.exec() runs EAGERLY (toArray just reads the cursor) — the
    // adapter must match, or DDL statements whose rows nobody reads never run.
    exec: (query, ...bindings) => {
      const rows = db.query(query).all(...(bindings as never[])) as Record<string, unknown>[];
      return { toArray: () => rows };
    },
  };
}

export function createLocalMailbox(mailboxDir: string, accountId: string): Mailbox {
  mkdirSync(mailboxDir, { recursive: true });
  const file = join(mailboxDir, `${accountId}.sqlite`);
  const db = new Database(file);
  const core = new MailboxCore(sqlOver(db));
  core.ensureSchema();
  return {
    append: async (events, maxEvents) => core.append(events, new Date().toISOString(), maxEvents),
    count: async () => core.count(),
    listAfter: async (after, limit) => core.listAfter(after, limit),
    wipe: async () => {
      core.wipe();
      db.close();
      try {
        await unlink(file);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      }
    },
  };
}