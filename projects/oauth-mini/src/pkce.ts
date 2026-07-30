// TODO(you): PKCE (RFC 7636) + the flow's CSRF defence.
//
// The acceptance suite checks the parts a library would otherwise hide from you:
// verifier entropy and shape, that the challenge really is base64url(SHA-256(verifier)),
// that `plain` is refused, and that comparisons are exact.
import { randomBytes } from "node:crypto";

export const VERIFIER_MIN_LEN = 43;
export const VERIFIER_MAX_LEN = 128;

/** base64url, no padding. */
export function base64url(buf: Buffer): string {
  void buf;
  return ""; // TODO: base64, then +→- /→_ and strip '='.
}

export function generateVerifier(): string {
  void randomBytes;
  return ""; // TODO: 32 CSPRNG bytes → base64url (43 chars).
}

export function challengeFor(verifier: string): string {
  void verifier;
  return ""; // TODO: base64url(sha256(verifier)).
}

/** S256 only. Compare in constant time. */
export function verifyChallenge(verifier: string, storedChallenge: string, method: string = "S256"): boolean {
  void verifier; void storedChallenge; void method;
  return false; // TODO
}

/** Constant-time state comparison; an empty state never passes. */
export function verifyState(returned: string, stored: string): boolean {
  void returned; void stored;
  return false; // TODO
}
