/**
 * Generate an Argon2id hash for the relay's AUTH_PASSWORD_HASH env var.
 * Reads the password from stdin so it never lands in argv or shell history.
 *
 *   echo 'your-password' | bun apps/relay/scripts/hash-password.ts
 *
 * The hash is a standalone secret — only AUTH_PASSWORD_HASH goes into the
 * systemd EnvironmentFile; the plain password is never stored.
 */
const raw = await new Response(Bun.stdin).text();
const password = raw.replace(/\r?\n$/, "");
if (!password) {
  console.error("usage: echo 'your-password' | bun apps/relay/scripts/hash-password.ts");
  process.exit(1);
}
const hash = await Bun.password.hash(password, { algorithm: "argon2id" });
console.log(hash);