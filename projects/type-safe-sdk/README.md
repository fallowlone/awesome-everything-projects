# Type-Safe SDK — starter

Implement the primitives in `src/sdk.ts` so the acceptance suite passes.

    bun test

Rules: all I/O and timing must be **injected** — no real `fetch`, no real
`setTimeout`. The suite tests `parse` (throws `ValidationError` on schema
failure), `backoffDelays` (pure exponential: `[baseMs, baseMs*2, ...]`),
`withRetry` (injected `sleep`, exact retry count), `defineClient.get` (delegates
to injected `fetchImpl`, parses on 200, throws `HttpError` on 4xx/5xx).

When green, read the project page rubric and push to the senior bar.
