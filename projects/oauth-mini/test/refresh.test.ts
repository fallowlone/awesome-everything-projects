import { test, expect } from "bun:test";
import { RefreshStore } from "../src/refresh";
import { grantedScopes, hasScope, hasAllScopes } from "../src/scopes";

test("rotation issues a new token and retires the presented one", () => {
  const s = new RefreshStore();
  s.issue("r1", "fam-1");
  expect(s.rotate("r1", "r2")).toEqual({ ok: true, next: "r2" });
  expect(s.isActive("r2")).toBe(true);
  expect(s.isActive("r1")).toBe(false); // single use
});

test("reusing a consumed token is detected and revokes the whole family", () => {
  const s = new RefreshStore();
  s.issue("r1", "fam-1");
  s.rotate("r1", "r2");

  const reuse = s.rotate("r1", "r3");
  expect(reuse).toEqual({ ok: false, error: "invalid_grant", reuseDetected: true });

  // The thief and the legitimate client are indistinguishable, so the current
  // token dies too — re-authentication is the only way forward.
  expect(s.isActive("r2")).toBe(false);
  expect(s.isActive("r3")).toBe(false);
});

test("an unknown token fails without claiming reuse", () => {
  const s = new RefreshStore();
  expect(s.rotate("never-issued", "r2")).toEqual({
    ok: false,
    error: "invalid_grant",
    reuseDetected: false,
  });
});

test("revoking a family kills its active token", () => {
  const s = new RefreshStore();
  s.issue("r1", "fam-1");
  s.issue("other", "fam-2");
  s.revokeFamily("fam-1");
  expect(s.isActive("r1")).toBe(false);
  expect(s.isActive("other")).toBe(true); // other sessions are untouched
});

test("a long rotation chain stays usable and every old link stays dead", () => {
  const s = new RefreshStore();
  s.issue("r0", "fam-1");
  let current = "r0";
  for (let i = 1; i <= 5; i++) {
    const next = `r${i}`;
    expect(s.rotate(current, next).ok).toBe(true);
    expect(s.isActive(current)).toBe(false);
    current = next;
  }
  expect(s.isActive("r5")).toBe(true);
});

test("granted scopes are the intersection of requested and consented", () => {
  expect(grantedScopes(["read:profile", "write:billing"], ["read:profile"])).toEqual(["read:profile"]);
  expect(grantedScopes(["read:profile"], [])).toEqual([]);
});

test("a token granted read:profile does not satisfy write:billing", () => {
  const granted = grantedScopes(["read:profile", "write:billing"], ["read:profile"]);
  expect(hasScope(granted, "read:profile")).toBe(true);
  expect(hasScope(granted, "write:billing")).toBe(false);
});

test("scope matching is exact, not prefix-based", () => {
  expect(hasScope(["read:profile"], "read:profile:email")).toBe(false);
  expect(hasScope(["read:profile:email"], "read:profile")).toBe(false);
});

test("hasAllScopes is an all-of check", () => {
  expect(hasAllScopes(["a", "b"], ["a", "b"])).toBe(true);
  expect(hasAllScopes(["a"], ["a", "b"])).toBe(false);
  expect(hasAllScopes(["a", "b"], [])).toBe(true);
});
