/**
 * Personal-relay password login: a single username + Argon2id password hash
 * from the environment (docs/design.md §3). Returns the configured account
 * email when credentials match, null otherwise. The router's
 * findOrCreateByEmail does the rest of the account machinery.
 */
import { timingSafeEqual } from "node:crypto";

export type PasswordLogin = (username: string, password: string) => Promise<string | null>;

export function createPasswordLogin(options: {
  username: string;
  /** Argon2id hash produced by `bun apps/relay/scripts/hash-password.ts`. */
  passwordHash: string;
  /** Email-shaped account identity the relay reports to clients. */
  accountEmail: string;
}): PasswordLogin {
  const expectedUser = Buffer.from(options.username, "utf8");
  return async (username, password) => {
    const actual = Buffer.from(username, "utf8");
    if (actual.length !== expectedUser.length || !timingSafeEqual(actual, expectedUser)) {
      return null;
    }
    const ok = await Bun.password.verify(password, options.passwordHash);
    return ok ? options.accountEmail : null;
  };
}