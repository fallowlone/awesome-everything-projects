// TODO(you): the authorization-code store.
//
// An authorization code is a ONE-TIME bearer of intent. The suite replays codes,
// swaps clients, swaps redirect_uris, and expires codes — make single use a
// property of the store, not of the caller.
export type CodeGrant = {
  clientId: string;
  redirectUri: string;
  codeChallenge: string;
  codeChallengeMethod: string;
  scope: string[];
  expiresAt: number;
};

export type ExchangeInput = {
  code: string;
  clientId: string;
  redirectUri: string;
  codeVerifier: string;
  now: number;
};

export type ExchangeResult =
  | { ok: true; scope: string[] }
  | { ok: false; error: "invalid_grant" | "invalid_request" };

export class AuthCodeStore {
  issue(code: string, grant: CodeGrant): void {
    void code; void grant; // TODO
  }

  exchange(input: ExchangeInput): ExchangeResult {
    void input;
    return { ok: false, error: "invalid_grant" }; // TODO
  }

  get size(): number {
    return 0; // TODO
  }
}
