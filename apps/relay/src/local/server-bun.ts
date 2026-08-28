/**
 * Local production entry for the relay: the same ports and router as the
 * Cloudflare Worker, bound to bun:sqlite and the local filesystem, so the
 * whole sync surface runs on a plain VPS (docs/design.md §2, §4).
 * Personal single-user deployment: password login only — no OAuth, magic
 * link, Stripe, or bundled AI (their env-driven ports stay unconfigured).
 */
import { mkdirSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { Database } from "bun:sqlite";
import { SqlAccountStore, type D1Like } from "../account-store";
import { SqlAiUsageStore } from "../ai-usage-store";
import { SqlReportStore } from "../report-store";
import { SqlRateLimitStore } from "../rate-limit-store";
import { cleanupRelayStorage } from "../housekeeping";
import { DEFAULT_CONFIG, type Mailbox, type RelayPorts } from "../ports";
import { createRelayHandler } from "../router";
import { createFsBlobStore } from "./fs-blob-store";
import { createLocalMailbox } from "./local-mailbox";
import { createPasswordLogin } from "./password-auth";

const MIGRATIONS_DIR = join(import.meta.dir, "../../migrations");
const MIGRATION_FILES = readdirSync(MIGRATIONS_DIR)
  .filter((name) => name.endsWith(".sql"))
  .sort();

/** Apply pending D1 migration files once, tracking applied names so a restart
 * never re-runs an ALTER (mirrors wrangler's migration bookkeeping). */
async function applyMigrations(db: Database): Promise<void> {
  db.exec("CREATE TABLE IF NOT EXISTS schema_migrations (name TEXT PRIMARY KEY)");
  const applied = new Set(
    (db.query("SELECT name FROM schema_migrations").all() as { name: string }[]).map((r) => r.name),
  );
  for (const name of MIGRATION_FILES) {
    if (applied.has(name)) continue;
    const sql = await Bun.file(join(MIGRATIONS_DIR, name)).text();
    db.exec(sql);
    db.query("INSERT INTO schema_migrations (name) VALUES (?)").run(name);
  }
}

/** bun:sqlite shaped into the D1 subset the Sql* stores use. */
function d1Over(db: Database): D1Like {
  return {
    prepare: (sql) => ({
      bind: (...values) => ({
        first: async <T,>() => (db.query(sql).get(...(values as never[])) as T) ?? null,
        run: async () => {
          db.query(sql).run(...(values as never[]));
        },
        all: async <T,>() => ({ results: db.query(sql).all(...(values as never[])) as T[] }),
      }),
    }),
  };
}

async function main(): Promise<void> {
  const env = process.env;
  const dataDir = env.DATA_DIR ?? join(import.meta.dir, "../../.local-data");
  const mailboxDir = join(dataDir, "mailboxes");
  const blobDir = join(dataDir, "blobs");
  for (const dir of [dataDir, mailboxDir, blobDir]) mkdirSync(dir, { recursive: true });

  const db = new Database(join(dataDir, "relay.sqlite"));
  db.exec("PRAGMA journal_mode = WAL");
  await applyMigrations(db);

  const d1 = d1Over(db);
  const mailboxes = new Map<string, Mailbox>();
  const blobs = createFsBlobStore(blobDir);

  const passwordLogin =
    env.AUTH_USER && env.AUTH_PASSWORD_HASH && env.AUTH_ACCOUNT_EMAIL
      ? createPasswordLogin({
          username: env.AUTH_USER,
          passwordHash: env.AUTH_PASSWORD_HASH,
          accountEmail: env.AUTH_ACCOUNT_EMAIL,
        })
      : undefined;

  const ports: RelayPorts = {
    accounts: new SqlAccountStore(d1),
    rateLimits: new SqlRateLimitStore(d1),
    mailboxFor(accountId) {
      let mailbox = mailboxes.get(accountId);
      if (!mailbox) {
        mailbox = createLocalMailbox(mailboxDir, accountId);
        mailboxes.set(accountId, mailbox);
      }
      return mailbox;
    },
    blobs,
    reports: new SqlReportStore(d1, {
      put: async (id, payload) => {
        // Same blob root, "_reports" prefix — account ids are UUIDs, so no
        // collision (mirrors the Worker's R2 layout).
        await blobs.put("_reports", `${id}.json`, payload);
      },
    }),
    aiUsage: new SqlAiUsageStore(d1),
    stripe: null,
    aiModels: [],
    magicLink: null,
    oauthProviders: {},
    config: {
      ...DEFAULT_CONFIG,
      adminToken: null,
      relayOrigin: env.RELAY_ORIGIN ?? "https://relay.readaware.app",
      webAppOrigin: env.APP_ORIGIN ?? DEFAULT_CONFIG.webAppOrigin,
      maxBlobBytes: Number(env.MAX_BLOB_BYTES) || DEFAULT_CONFIG.maxBlobBytes,
      maxAccountBlobBytes: Number(env.MAX_ACCOUNT_BLOB_BYTES) || DEFAULT_CONFIG.maxAccountBlobBytes,
      maxAccountEvents: Number(env.MAX_ACCOUNT_EVENTS) || DEFAULT_CONFIG.maxAccountEvents,
    },
    now: () => Date.now(),
    passwordLogin,
  };

  const handler = createRelayHandler(ports);
  const port = Number(env.PORT ?? 8787);
  Bun.serve({ hostname: "127.0.0.1", port, fetch: handler });
  console.log(`[relay] listening on http://127.0.0.1:${port} (data: ${dataDir})`);

  // Hourly housekeeping — mirrors the Worker's cron trigger (wrangler.jsonc).
  setInterval(() => {
    cleanupRelayStorage(ports.accounts, ports.rateLimits, Date.now()).catch((error) => {
      console.error("[relay] housekeeping failed", error);
    });
  }, 60 * 60 * 1000);
}

await main();