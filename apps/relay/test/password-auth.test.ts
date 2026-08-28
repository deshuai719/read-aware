/**
 * Password login (personal self-hosted relay): /v1/auth/password issues the
 * same session/account shape as the magic-link path, gated on a single
 * configured username + Argon2id password hash.
 */
import { expect, test } from "bun:test";
import { createPasswordLogin } from "../src/local/password-auth";
import { makeRelay, post } from "./harness";

const passwordLogin = createPasswordLogin({
  username: "sync-user",
  passwordHash: await Bun.password.hash("correct-horse", { algorithm: "argon2id" }),
  accountEmail: "sync@021601.xyz",
});

test("password login answers 501 when not configured", async () => {
  const relay = makeRelay();
  const res = await relay.handle(post("/v1/auth/password", { username: "u", password: "p" }));
  expect(res.status).toBe(501);
});

test("password login issues a session for the configured account", async () => {
  const relay = makeRelay({}, {}, {}, null, null, passwordLogin);
  const res = await relay.handle(
    post("/v1/auth/password", { username: "sync-user", password: "correct-horse" }),
  );
  expect(res.status).toBe(200);
  const body = (await res.json()) as {
    session: string;
    accountId: string;
    email: string;
    keys: unknown;
  };
  expect(body.email).toBe("sync@021601.xyz");
  expect(body.session.length).toBeGreaterThan(0);
  expect(body.accountId.length).toBeGreaterThan(0);
  expect(body.keys).toBeNull();
});

test("password login rejects a wrong password", async () => {
  const relay = makeRelay({}, {}, {}, null, null, passwordLogin);
  const res = await relay.handle(
    post("/v1/auth/password", { username: "sync-user", password: "wrong" }),
  );
  expect(res.status).toBe(401);
});

test("password login rejects an unknown username", async () => {
  const relay = makeRelay({}, {}, {}, null, null, passwordLogin);
  const res = await relay.handle(
    post("/v1/auth/password", { username: "other", password: "correct-horse" }),
  );
  expect(res.status).toBe(401);
});

test("password login validates required fields", async () => {
  const relay = makeRelay({}, {}, {}, null, null, passwordLogin);
  expect(
    (await relay.handle(post("/v1/auth/password", { username: "sync-user" }))).status,
  ).toBe(400);
  expect(
    (await relay.handle(post("/v1/auth/password", { password: "correct-horse" }))).status,
  ).toBe(400);
});