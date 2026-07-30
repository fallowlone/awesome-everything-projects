// TODO(you): presigned PUT issuance and server-side verification.
//
// The suite hunts the classic hole: a constraint the URL advertises but the
// signature does not cover is a field the client can rewrite. Sign only key+expiry
// and someone uploads a 4 GB executable as image/png. So: every constraint goes
// inside the canonical string, comparisons are constant-time, receipt is confirmed
// from the STORE's metadata rather than the client's claim, and object keys are
// derived server-side (a client filename is a path-traversal primitive).
import { createHmac, timingSafeEqual } from "node:crypto";

export type PresignRequest = {
  key: string;
  contentType: string;
  maxBytes: number;
  expiresAt: number;
};

export type Presigned = PresignRequest & { signature: string };

export type PutAttempt = {
  key: string;
  contentType: string;
  contentLength: number;
  signature: string;
  now: number;
};

export type VerifyResult =
  | { ok: true }
  | { ok: false; error: "expired" | "bad_signature" | "content_type_mismatch" | "too_large" | "key_mismatch" };

/** Include every signed field, with separators that cannot be forged by shifting text. */
export function canonicalString(req: PresignRequest): string {
  void req;
  return ""; // TODO
}

export function presign(req: PresignRequest, secret: string): Presigned {
  void req; void secret; void createHmac;
  throw new Error("TODO");
}

/** Check expiry and signature BEFORE the constraint comparisons. */
export function verifyPut(attempt: PutAttempt, granted: PresignRequest, secret: string): VerifyResult {
  void attempt; void granted; void secret; void timingSafeEqual;
  return { ok: false, error: "bad_signature" }; // TODO
}

export type ObjectMeta = { key: string; size: number; etag: string };
export type ReceiptResult = { ok: true } | { ok: false; error: "missing" | "size_mismatch" | "etag_mismatch" };

export function confirmReceipt(
  meta: ObjectMeta | null,
  expected: { key: string; size: number; etag: string },
): ReceiptResult {
  void meta; void expected;
  return { ok: false, error: "missing" }; // TODO
}

/** `prefix/userId/<random>.<ext>` — never the client's path. */
export function safeKey(prefix: string, userId: string, filename: string, random: string): string {
  void prefix; void userId; void filename; void random;
  return ""; // TODO
}
