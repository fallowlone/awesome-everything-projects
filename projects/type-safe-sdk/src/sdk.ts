// TODO(you): implement the type-safe SDK primitives below.
// All I/O and timing must be INJECTED — no real fetch, no real setTimeout.

// --- ValidationError ---
export class ValidationError extends Error {
  issues: string[];
  constructor(issues: string[]) {
    super(issues.join("; "));
    this.name = "ValidationError";
    this.issues = issues; // TODO: already wired; make parse() actually throw this
  }
}

// --- Schema ---
export type Schema<T> = (data: unknown) => { ok: true; value: T } | { ok: false; issues: string[] };

// --- parse ---
// TODO: if schema(data).ok is true return value; otherwise throw new ValidationError(issues).
export function parse<T>(schema: Schema<T>, data: unknown): T {
  // stub: always returns data as-is regardless of schema
  return data as T;
}

// --- backoffDelays ---
export type Policy = { max: number; baseMs: number };

// TODO: return [baseMs, baseMs*2, baseMs*4, ...] with length === max (pure, no timers).
export function backoffDelays(policy: Policy): number[] {
  // stub: always empty
  return [];
}

// --- withRetry ---
// TODO: call fn; on throw retry up to policy.max times, awaiting sleep(backoffDelays[i])
//       before each retry; rethrow the last error if all attempts fail.
export async function withRetry<T>(
  fn: () => Promise<T>,
  policy: Policy,
  sleep: (ms: number) => Promise<void>,
): Promise<T> {
  // stub: calls fn exactly once, no retry
  void sleep; void policy;
  return fn();
}

// --- HttpError ---
export class HttpError extends Error {
  status: number;
  body: unknown;
  constructor(status: number, body: unknown) {
    super(`HTTP ${status}`);
    this.name = "HttpError";
    this.status = status;
    this.body = body; // TODO: already wired; make defineClient.get actually throw this
  }
}

// --- Fetched / ClientOpts / defineClient ---
export type Fetched = { status: number; body: unknown };
export type ClientOpts = {
  baseUrl: string;
  fetchImpl: (url: string) => Promise<Fetched>;
};

// TODO: get: await fetchImpl(baseUrl + path).
//   status 200 → return parse(schema, body).
//   status 4xx/5xx → throw new HttpError(status, body).
export function defineClient(opts: ClientOpts): {
  get<T>(path: string, schema: Schema<T>): Promise<T>;
} {
  return {
    async get<T>(path: string, schema: Schema<T>): Promise<T> {
      // stub: returns body without parsing or status handling
      const result = await opts.fetchImpl(opts.baseUrl + path);
      void schema;
      return result.body as T;
    },
  };
}
