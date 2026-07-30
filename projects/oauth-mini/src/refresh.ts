// TODO(you): refresh-token rotation with reuse detection.
//
// Every refresh consumes the presented token and issues a new one. The security
// payoff is the SECOND use of an already-rotated token: you cannot tell a replay
// from a theft, so the whole family must be revoked. The suite checks exactly that.
export type RotateResult =
  | { ok: true; next: string }
  | { ok: false; error: "invalid_grant"; reuseDetected: boolean };

export class RefreshStore {
  issue(token: string, familyId: string): void {
    void token; void familyId; // TODO
  }

  rotate(presented: string, next: string): RotateResult {
    void presented; void next;
    return { ok: false, error: "invalid_grant", reuseDetected: false }; // TODO
  }

  revokeFamily(familyId: string): void {
    void familyId; // TODO
  }

  isActive(token: string): boolean {
    void token;
    return false; // TODO
  }
}
