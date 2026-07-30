# Type-Safe API SDK

Build the client other engineers will actually trust: a typed SDK over a real HTTP API where the compiler — not a runtime crash in production — catches the wrong field, the missing variant, the response that lied about its shape. You model the domain with discriminated unions and generics, validate every response at the boundary, and let inference carry exact types all the way to the call site, with zero `any` left to paper over the gaps.

**Difficulty:** advanced · **Est. days:** 8 · **Stack:** typescript, zod, openapi-typescript, vitest, fetch · **Tracks:** typescript, apis, backend

## Deliverable

An installable TypeScript SDK exposing typed methods (e.g. client.users.get(id)) that validate every response against a schema at the network boundary, return a discriminated Result<T> instead of throwing on protocol errors, and infer exact return types at the call site — with `noImplicitAny` and `strict` on and zero `any` in the public surface.

## Why this project

A typed SDK is where TypeScript stops being decoration and starts earning its keep. The interesting work isn't sprinkling annotations — it's deciding where types are allowed to lie and slamming that door shut: at the network boundary, where `unknown` becomes a domain type exactly once, behind a real runtime check. Get the discriminated unions, the constrained generics, and the validated boundary right, and the compiler becomes a second engineer who reviews every call before it runs — flagging the unhandled variant, the wrong field, the response that changed shape. Cast your way past any of it and you've built a liar with good documentation. Do it honestly and you've built the thing teams reach for precisely because they don't have to think about whether it's safe.

## Skills

- modeling a domain with discriminated unions
- writing generic functions with constraints
- validating untrusted input at the boundary
- carrying inference to the call site
- designing a Result type instead of throwing
- generating types from an API schema

## Milestones

### 1. Model the domain, not the JSON

Before you write a single request, describe what the API actually returns — in types. Most SDKs rot because they mirror the wire format loosely: one fat interface with everything optional, so the compiler can never tell you which fields are guaranteed when. Do the opposite. Use a discriminated union for anything that has variants — a webhook event, a payment that is `pending | settled | failed`, a search hit that is a `user | repo | issue` — with a literal `kind` field as the discriminant so a `switch` narrows each branch to exactly its payload. Use literal types where the API only ever returns a fixed set of strings. The win shows up later: when you handle a value, TypeScript forces you to account for every variant, and adding a new one breaks every site that forgot it. That is the whole point of a union over a grab-bag object.

**Definition of done:**

- At least one core entity is a discriminated union with a literal discriminant, and a `switch` over it compiles only when every variant is handled.
- Adding a hypothetical new variant produces a compile error at the unhandled call sites (verified by an exhaustiveness `never` check).

### 2. A generic request core

Now write the one function every method routes through: `request<T>(path, init)`. The trick is letting the caller's expected type flow through without lying. A naive version types the return as `Promise<any>` or casts the parsed JSON `as T` — both of which silently hand back whatever the server sent, type-checked against nothing. Instead, make the generic a real parameter the caller supplies (or that a schema infers), and constrain it so only valid shapes pass: `T extends ApiResource`. Keep the function honest — it returns the parsed body typed as `T` only after validation runs, never before. This is where you feel the difference between a generic that documents intent and a cast that suppresses the type-checker. One of them survives a backend that changes its response next quarter; the other doesn't.

**Definition of done:**

- A single generic `request<T>` powers all SDK methods, and `T` is constrained — passing an unrelated type is a compile error.
- No `as T` cast on parsed JSON anywhere in the request path; the typed value comes out of validation, not a cast.

### 3. Validate at the boundary

Types are erased at runtime. A `User` interface guarantees nothing about the bytes that come back over the wire — the server can send `null` where you typed `string`, drop a field, or return an error page with a 200. So treat the network as untrusted input and parse it: define a schema (zod, or hand-rolled validators if you want to feel the mechanism) for each response, parse the JSON through it at the boundary, and only then let the value enter your typed world. The payoff is that `unknown` becomes `User` exactly once, in one place, with a real check behind it — instead of `any` leaking the lie everywhere downstream. Decide deliberately what 'invalid' means: is a missing optional field a hard failure or a tolerated gap? Strictness here is a design choice, and getting it wrong is how SDKs become brittle or become liars.

**Definition of done:**

- Every response passes through a schema parse before reaching typed code; a malformed payload is rejected, not silently accepted.
- The boundary takes `unknown` (never `any`) and the SDK has a test proving a deliberately malformed response is caught.

### 4. Return results, don't throw

An SDK that throws on every 404 forces callers to wrap each call in try/catch and guess what `catch (e: unknown)` even holds — the failure mode is invisible in the type. Model the outcome instead. Return a discriminated `Result<T>` — `{ ok: true; data: T } | { ok: false; error: ApiError }` — so the compiler makes the caller handle failure before touching the data; there is no way to read `result.data` without first narrowing `result.ok`. Type the error side as a union too (network failure vs. validation failure vs. an API error code), so handling stays exhaustive. Keep throwing for genuine bugs — a programming mistake should crash loud — but turn expected protocol failures into values. This is the difference between an SDK whose surface tells the truth about what can go wrong and one that hides it behind exceptions the types never mention.

**Definition of done:**

- Public methods return a discriminated `Result<T>`; reading `data` without narrowing `ok` is a compile error.
- The error branch is a union covering at least network, validation, and API-error cases, handled exhaustively in a test.

### 5. Generate types from the schema

Hand-writing every type is fine for a small API and a slow drift into lies for a large one — the moment the backend ships a field you didn't transcribe, your handwritten types are confidently wrong. The senior move is to make the API's own contract the single source of truth. Take its OpenAPI (or JSON Schema) document and generate the TypeScript types from it with a tool like openapi-typescript, then build your typed methods on top of the generated surface. Now a backend change to the spec re-generates types, and the compiler points at every call site that no longer matches — your SDK can't silently drift out of sync. Wire generation into the build so stale types fail CI rather than ship. The hard part isn't running the generator; it's designing the seam so your hand-written ergonomics (the nice `Result<T>`, the discriminated unions) wrap the generated types cleanly instead of fighting them.

**Definition of done:**

- Response types are generated from an OpenAPI/JSON Schema document, not hand-transcribed, and regeneration is a single command.
- Changing a field in the spec and regenerating surfaces a compile error at the now-stale call site.

## Rubric

### Runtime validation (parse-don't-validate)

- **Junior:** Responses are cast `as T` or accepted with `any`; a changed API field silently produces wrong data at the call site.
- **Mid:** `parse()` runs a schema against the raw body and throws `ValidationError` on mismatch; `ValidationError.issues` carries the full list of failures so callers can surface actionable messages.
- **Senior:** `parse()` takes a generic `Schema<T>` and returns `T` — not `unknown` — only after the schema confirms the shape; no `as` cast anywhere in the validated path; the schema type parameter threads through `defineClient.get` so the return type at the call site is exact, not widened.

### Error envelope design (HttpError vs ValidationError vs network)

- **Junior:** All failures surface as generic `Error`; the caller cannot distinguish a 404 from a schema mismatch from a network timeout without string-matching the message.
- **Mid:** `HttpError` (with `.status` and `.body`) and `ValidationError` (with `.issues`) are separate named classes; a caller can branch with `instanceof` and get typed properties without casting.
- **Senior:** The error hierarchy enables exhaustive handling: a 4xx should never be retried (wrong caller), a 5xx or network error is a candidate for retry, a `ValidationError` means the contract broke and must be investigated — you can articulate and test each branch, and no branch requires a type cast or string inspection to distinguish them.

### Retry and backoff correctness

- **Junior:** `withRetry` retries a fixed number of times with a hardcoded delay; the clock is real `setTimeout`, so tests either sleep or stub globals.
- **Mid:** The sleep function is injected, making tests deterministic and instant; `backoffDelays` is a pure function returning an array, so callers can inspect or log the schedule without side effects.
- **Senior:** You can articulate which errors are safe to retry (5xx, network) and which are not (4xx, `ValidationError`), and explain why retrying a non-idempotent POST on 5xx risks double-execution; in production you would add jitter to `backoffDelays` to avoid thundering-herd convergence — you can sketch the formula and explain why it matters under a fleet outage.

## Senior stretch

- Make the SDK self-documenting: derive the method map from the OpenAPI paths so `client.users.get` and its argument/return types are generated, and adding an endpoint to the spec adds a typed method for free.
- Add a typed retry/pagination layer that preserves the element type across pages — a generic `paginate<T>` that yields `T` items, never widening to `unknown` as it walks the cursor.
- Enable the strictest tsconfig (`exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`) and fix every error it surfaces — proof the SDK's types hold under maximum strictness, not just the defaults.

---

Full project page, progress tracking and linked lessons: https://fallowlone.com/en/projects/type-safe-sdk
