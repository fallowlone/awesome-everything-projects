// TODO(you): implement a URL shortener core with counter-based base62 encoding.
// encodeBase62(n) maps a non-negative integer to a base62 string; decodeBase62
// is the inverse. Shortener.create() assigns a unique code (deterministic,
// no Math.random / Date.now) and stores the URL with a creation timestamp.
// Shortener.resolve() returns the url + redirect type, or null if unknown or
// expired (now - createdAt > ttlMs). Default redirect is 301, default ttl = Infinity.

export function encodeBase62(n: number): string {
  void n;
  return ""; // TODO
}

export function decodeBase62(s: string): number {
  void s;
  return 0; // TODO
}

export type Redirect = 301 | 302;

export class Shortener {
  constructor(opts?: { ttlMs?: number; redirect?: Redirect }) {
    void opts;
    // TODO: store opts, initialise counter
  }
  create(url: string, now: number): { code: string; redirect: Redirect } {
    void url; void now;
    return null as unknown as { code: string; redirect: Redirect }; // TODO
  }
  resolve(code: string, now: number): { url: string; redirect: Redirect } | null {
    void code; void now;
    return null; // TODO
  }
}
