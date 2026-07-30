import { test, expect } from "bun:test";
import { AuthCodeStore } from "../src/codes";
import { generateVerifier, challengeFor } from "../src/pkce";

const grant = (verifier: string, over: Partial<Parameters<AuthCodeStore["issue"]>[1]> = {}) => ({
  clientId: "client-a",
  redirectUri: "https://app.example/callback",
  codeChallenge: challengeFor(verifier),
  codeChallengeMethod: "S256",
  scope: ["read:profile"],
  expiresAt: 60_000,
  ...over,
});

const exchange = (verifier: string, over: Record<string, unknown> = {}) => ({
  code: "code-1",
  clientId: "client-a",
  redirectUri: "https://app.example/callback",
  codeVerifier: verifier,
  now: 1_000,
  ...over,
});

test("a valid exchange returns the granted scope", () => {
  const v = generateVerifier();
  const store = new AuthCodeStore();
  store.issue("code-1", grant(v));
  expect(store.exchange(exchange(v))).toEqual({ ok: true, scope: ["read:profile"] });
});

test("a replayed code fails even with the correct verifier", () => {
  const v = generateVerifier();
  const store = new AuthCodeStore();
  store.issue("code-1", grant(v));
  expect(store.exchange(exchange(v)).ok).toBe(true);
  const replay = store.exchange(exchange(v));
  expect(replay).toEqual({ ok: false, error: "invalid_grant" });
  expect(store.size).toBe(0); // consumed, not merely marked
});

test("a wrong verifier fails AND still consumes the code", () => {
  // The code is spent on the attempt; an attacker does not get to brute-force
  // verifiers against a code that stays alive.
  const v = generateVerifier();
  const store = new AuthCodeStore();
  store.issue("code-1", grant(v));
  expect(store.exchange(exchange(generateVerifier())).ok).toBe(false);
  expect(store.exchange(exchange(v)).ok).toBe(false);
});

test("an expired code fails", () => {
  const v = generateVerifier();
  const store = new AuthCodeStore();
  store.issue("code-1", grant(v, { expiresAt: 500 }));
  expect(store.exchange(exchange(v, { now: 501 }))).toEqual({ ok: false, error: "invalid_grant" });
});

test("the code is bound to its client and its exact redirect_uri", () => {
  const v = generateVerifier();
  const store = new AuthCodeStore();

  store.issue("code-1", grant(v));
  expect(store.exchange(exchange(v, { clientId: "client-b" })).ok).toBe(false);

  store.issue("code-1", grant(v));
  expect(store.exchange(exchange(v, { redirectUri: "https://app.example/callback2" })).ok).toBe(false);

  store.issue("code-1", grant(v));
  expect(store.exchange(exchange(v, { redirectUri: "https://evil.example/callback" })).ok).toBe(false);
});

test("an unknown code fails without throwing", () => {
  const store = new AuthCodeStore();
  expect(store.exchange(exchange(generateVerifier()))).toEqual({ ok: false, error: "invalid_grant" });
});

test("a challenge stored with method plain is refused at the token step", () => {
  const v = generateVerifier();
  const store = new AuthCodeStore();
  store.issue("code-1", grant(v, { codeChallengeMethod: "plain", codeChallenge: v }));
  expect(store.exchange(exchange(v))).toEqual({ ok: false, error: "invalid_request" });
});
