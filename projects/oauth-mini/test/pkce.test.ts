import { test, expect } from "bun:test";
import { createHash } from "node:crypto";
import {
  generateVerifier,
  challengeFor,
  verifyChallenge,
  verifyState,
  VERIFIER_MIN_LEN,
} from "../src/pkce";

test("generateVerifier returns a high-entropy base64url string of legal length", () => {
  const a = generateVerifier();
  const b = generateVerifier();
  expect(a).not.toBe(b); // CSPRNG, not a counter or a timestamp
  expect(a.length).toBeGreaterThanOrEqual(VERIFIER_MIN_LEN);
  expect(a.length).toBeLessThanOrEqual(128);
  expect(a).toMatch(/^[A-Za-z0-9\-._~]+$/); // unreserved set only
  expect(a).not.toContain("="); // base64url carries no padding
});

test("challengeFor is SHA-256 of the verifier, base64url-encoded without padding", () => {
  const verifier = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk";
  const expected = createHash("sha256")
    .update(verifier, "ascii")
    .digest("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  expect(challengeFor(verifier)).toBe(expected);
});

test("verifyChallenge accepts the matching verifier and rejects a wrong one", () => {
  const verifier = generateVerifier();
  const challenge = challengeFor(verifier);
  expect(verifyChallenge(verifier, challenge)).toBe(true);
  expect(verifyChallenge(generateVerifier(), challenge)).toBe(false);
});

test("verifyChallenge rejects the plain method even when the value matches", () => {
  // `plain` hands the verifier to anyone who can read the authorization request,
  // which defeats PKCE entirely. S256 only.
  const verifier = generateVerifier();
  expect(verifyChallenge(verifier, verifier, "plain")).toBe(false);
  expect(verifyChallenge(verifier, challengeFor(verifier), "plain")).toBe(false);
});

test("verifyChallenge rejects a verifier shorter than the RFC floor", () => {
  const short = "tooshort";
  expect(verifyChallenge(short, challengeFor(short))).toBe(false);
});

test("verifyState requires an exact match and rejects empty values", () => {
  expect(verifyState("abc123", "abc123")).toBe(true);
  expect(verifyState("abc123", "abc124")).toBe(false);
  expect(verifyState("", "")).toBe(false); // a missing state is not a passing state
  expect(verifyState("abc", "")).toBe(false);
});
