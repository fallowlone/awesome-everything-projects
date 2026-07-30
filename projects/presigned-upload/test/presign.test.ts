import { test, expect } from "bun:test";
import { presign, verifyPut, confirmReceipt, canonicalString, safeKey, type PresignRequest } from "../src/presign";

const SECRET = "test-secret";
const grant: PresignRequest = {
  key: "uploads/u1/abc.png",
  contentType: "image/png",
  maxBytes: 1_000_000,
  expiresAt: 10_000,
};

const attempt = (over: Record<string, unknown> = {}) => ({
  key: grant.key,
  contentType: grant.contentType,
  contentLength: 500_000,
  signature: presign(grant, SECRET).signature,
  now: 5_000,
  ...over,
});

test("a well-formed PUT inside every constraint passes", () => {
  expect(verifyPut(attempt(), grant, SECRET)).toEqual({ ok: true });
});

test("an expired URL is refused", () => {
  expect(verifyPut(attempt({ now: 10_001 }), grant, SECRET)).toEqual({ ok: false, error: "expired" });
  // Exactly at the expiry instant is already too late.
  expect(verifyPut(attempt({ now: 10_000 }), grant, SECRET)).toEqual({ ok: false, error: "expired" });
});

test("a forged signature is refused", () => {
  expect(verifyPut(attempt({ signature: "deadbeef" }), grant, SECRET).ok).toBe(false);
  expect(verifyPut(attempt(), grant, "other-secret").ok).toBe(false);
});

test("the content type is covered by the signature, so it cannot be swapped", () => {
  // The classic hole: sign only key+expiry and the client uploads an executable
  // as an image. Changing the type must invalidate the signature.
  const res = verifyPut(attempt({ contentType: "application/x-msdownload" }), grant, SECRET);
  expect(res.ok).toBe(false);
});

test("the size cap is enforced and covered by the signature", () => {
  expect(verifyPut(attempt({ contentLength: 1_000_001 }), grant, SECRET)).toEqual({ ok: false, error: "too_large" });
  expect(verifyPut(attempt({ contentLength: 1_000_000 }), grant, SECRET)).toEqual({ ok: true }); // boundary is allowed

  // A client that raises its own cap must fail the signature check.
  const raised = { ...grant, maxBytes: 999_999_999 };
  expect(verifyPut({ ...attempt(), contentLength: 5_000_000 }, raised, SECRET).ok).toBe(false);
});

test("the key is covered by the signature, so it cannot be redirected", () => {
  const moved = { ...grant, key: "uploads/u2/victim.png" };
  expect(verifyPut(attempt(), moved, SECRET).ok).toBe(false);
});

test("the canonical string separates fields so two different grants cannot collide", () => {
  const a = canonicalString({ key: "a", contentType: "b/c", maxBytes: 1, expiresAt: 2 });
  const b = canonicalString({ key: "a\ntype=b/c", contentType: "", maxBytes: 1, expiresAt: 2 });
  expect(a).not.toBe(b);
});

test("receipt is confirmed from store metadata, never from the client's word", () => {
  const expected = { key: grant.key, size: 500_000, etag: "abc123" };
  expect(confirmReceipt({ key: grant.key, size: 500_000, etag: "abc123" }, expected)).toEqual({ ok: true });
  expect(confirmReceipt(null, expected)).toEqual({ ok: false, error: "missing" });
  expect(confirmReceipt({ key: grant.key, size: 12, etag: "abc123" }, expected)).toEqual({ ok: false, error: "size_mismatch" });
  expect(confirmReceipt({ key: grant.key, size: 500_000, etag: "zzz" }, expected)).toEqual({ ok: false, error: "etag_mismatch" });
  expect(confirmReceipt({ key: "other", size: 500_000, etag: "abc123" }, expected)).toEqual({ ok: false, error: "missing" });
});

test("object keys are derived server-side and resist traversal", () => {
  const key = safeKey("uploads", "u1", "../../etc/passwd", "r4nd0m");
  expect(key).not.toContain("..");
  expect(key.startsWith("uploads/u1/")).toBe(true);

  // Two uploads of the same filename cannot collide, so one user cannot clobber another.
  expect(safeKey("uploads", "u1", "a.png", "aaa")).not.toBe(safeKey("uploads", "u1", "a.png", "bbb"));
  expect(safeKey("uploads", "u1", "photo.PNG", "x")).toEndWith(".png");
  expect(safeKey("uploads", "u1", "noext", "x")).toEndWith(".bin");
});
