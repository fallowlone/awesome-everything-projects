# Production-Shaped Nest Service

NestJS rewards you for structure and punishes you for skipping it. Build a service the way a team would ship it: feature modules with real boundaries, DTOs that validate at the edge, guards and interceptors that own cross-cutting concerns, a typed config you can't typo, and an e2e suite that boots the whole app. This is the difference between knowing Nest's decorators and knowing why they exist.

**Difficulty:** advanced · **Est. days:** 9 · **Stack:** nestjs, typescript, class-validator / class-transformer, @nestjs/config + zod (or joi), jest + supertest, @nestjs/microservices (Redis or RabbitMQ transport), pino (nestjs-pino) · **Tracks:** nest, backend, node

## Deliverable

A running NestJS service with at least two feature modules, request DTOs validated by class-validator, a guard and an interceptor wired globally, a typed and schema-validated config, and a Jest e2e suite that boots the app over HTTP and asserts both success and failure paths.

## Why this project

Anyone can scaffold a Nest app; the senior skill is knowing why every decorator earns its place. This project makes you defend each one: modules because boundaries keep a codebase changeable, DTOs because the edge is the only honest place to validate, guards and interceptors because cross-cutting logic rots when it's copy-pasted, typed config because environments lie, and e2e tests because wiring fails in ways units never see. The queue and the correlated logs are where it stops being a tutorial app and starts behaving like something on call — work that happens out of band, a redelivery that must not double-charge, and one id that lets you follow a single request across two processes. Build it this way once and you'll never again wonder what Nest's structure is protecting you from.

## Skills

- designing feature modules with explicit boundaries
- DTO validation with class-validator and a global ValidationPipe
- writing guards and interceptors for cross-cutting concerns
- typed, schema-validated configuration
- e2e testing a Nest app over HTTP
- message-based communication over a queue
- structured logging with request correlation

## Milestones

### 1. Carve the modules

Resist the temptation to drop everything into AppModule. Pick two real features — say 'orders' and 'notifications' — and give each its own module with its own controller and provider, exporting only what another module is allowed to touch. The discipline here is that a module's public surface is its exports; everything else is private. Use Nest's DI to inject a service into a controller instead of constructing it, so the container owns lifetimes and you can swap implementations in tests. When you're done you should be able to point at any class and say which module owns it and why.

**Definition of done:**

- Two feature modules exist, each exporting only its public provider; importing a module's private provider from outside fails.
- A service is injected into its controller via the DI container, not instantiated with new.

### 2. Validate at the edge

Every byte a client sends is hostile until proven otherwise. Define DTO classes with class-validator decorators and turn on a global ValidationPipe with whitelist and forbidNonWhitelisted, so unknown fields are stripped or rejected instead of silently flowing into your handlers. The payoff is a single, declarative place where the shape of a request is the contract — a bad body bounces with a 400 that names the offending field before any business code runs. Decide deliberately whether to transform and coerce types, because 'whitelist on, transform off' and 'both on' behave differently in ways that bite later.

**Definition of done:**

- A request with an unknown or wrongly-typed field returns 400 with a message naming the field, and never reaches the controller body.
- Valid requests pass through with a fully typed DTO instance, not a raw untyped object.

### 3. Own the cross-cutting concerns

Authorization and logging don't belong scattered through controllers. Write a guard that decides whether a request may proceed — return false or throw to send a 403, before the handler ever runs — and an interceptor that wraps the handler to measure timing or shape the response. Understanding the order matters: guards run before pipes and interceptors, interceptors straddle the handler on both sides. Wire at least one globally and scope another to a single route, so you feel the difference between app-wide policy and local behavior. The lesson is that Nest gives you these seams precisely so business code stays about business.

**Definition of done:**

- A guard blocks an unauthorized request with 403 before the handler runs; an authorized one proceeds.
- An interceptor measurably wraps the handler (e.g. adds a duration header or unified envelope) on every response it covers.

### 4. Configuration you can't typo

Reading process.env directly is a time bomb: a misspelled key is undefined at 3am, not at startup. Load configuration through ConfigModule and validate it against a schema (zod or joi) at boot, so a missing or malformed value crashes the app immediately with a clear message instead of failing deep inside a handler later. Expose a typed config service so callers ask for config.get('database.url') and get a string, not string | undefined. The goal is fail-fast: the process should refuse to start unless its environment is provably complete and well-typed.

**Definition of done:**

- Starting the app with a missing or invalid required env var fails fast with a message that names the variable.
- Config is read through a typed service whose return types are non-nullable for required keys.

### 5. Boot the whole thing in tests

Unit tests prove a provider's logic; e2e tests prove the wiring. Use Nest's testing utilities to compile the real module graph, start an HTTP server, and hit your endpoints with supertest — pipes, guards, and interceptors all in the loop, exactly as production runs them. Cover the unhappy paths on purpose: assert that an invalid DTO returns 400, an unauthorized request returns 403, and a valid request returns the right body. This suite is the contract you can refactor against without fear; if it stays green, the seams you built still hold.

**Definition of done:**

- An e2e test boots the app over HTTP and asserts a happy-path 2xx with the expected body.
- Separate e2e tests assert the 400 (invalid DTO) and 403 (guard) failure paths.

### 6. Senior stretch: a queue and a log you can trust

Real systems don't do everything inline on the request. Split the second feature behind a message transport: the HTTP module accepts the work and emits a message, and a microservice consumer (Redis or RabbitMQ transport via @nestjs/microservices) processes it out of band. Now you confront delivery semantics honestly — is this fire-and-forget, at-least-once, will a redelivery double-charge someone? — and you make the consumer idempotent on purpose. Pair it with structured JSON logging (pino) that carries a correlation id from the inbound request through to the consumer, so one request is one traceable story across two processes. That correlation is what turns 'it's slow somewhere' into 'it's slow here'.

**Definition of done:**

- Work flows from an HTTP endpoint through a queue to a microservice consumer that processes it out of band.
- Logs are structured JSON and a single correlation id ties the inbound request to its consumer-side processing.

## Rubric

### Module boundaries and DI discipline

- **Junior:** Most logic lives in AppModule; providers are constructed with new or imported freely across modules, so there is no real encapsulation.
- **Mid:** Two or more feature modules each export only their public provider; a service is injected via the DI container, not instantiated manually; importing a private provider from outside the module fails at wiring time.
- **Senior:** Provider scope is chosen deliberately (DEFAULT vs REQUEST vs TRANSIENT) with a written reason for each non-default choice; module boundaries make the dependency graph acyclic and each module's public surface is the minimal API needed by its consumers — not a convenience re-export of everything inside.

### DTO validation at the edge with class-validator

- **Junior:** Validation is manual (if checks inside the handler) or absent; unknown fields flow silently into business logic.
- **Mid:** A global ValidationPipe with whitelist: true and forbidNonWhitelisted: true rejects unknown fields at the boundary; invalid requests return 400 with a message that names the offending field before any handler runs.
- **Senior:** transform: true vs transform: false is an explicit decision, not an accidental default — you can state what 'whitelist on, transform off' does to a number-typed field sent as a string, and the DTO classes double as TypeScript type sources so there is no parallel interface to keep in sync.

### Guards, interceptors, and typed config

- **Junior:** Auth and timing logic are scattered in controller bodies; config is read with process.env.KEY directly and a typo surfaces at runtime, not at startup.
- **Mid:** A guard returns false / throws before the handler on unauthorized requests; an interceptor wraps the handler call; ConfigModule validates the schema at boot and crashes with a named error on a missing variable.
- **Senior:** The guard is wired globally with one app-wide instance rather than duplicated on every controller; the interceptor's rxjs tap / catchError pipeline handles errors without swallowing them; the typed ConfigService returns non-nullable types for required keys so callers never receive string | undefined.

### E2e wiring coverage and out-of-band delivery

- **Junior:** Only unit tests exist; the module wiring and the ValidationPipe / guard order are never tested end to end.
- **Mid:** An e2e suite boots the real module graph over HTTP (supertest) and asserts the happy-path 2xx, the invalid-DTO 400, and the unauthorized 403 — pipes, guards, and interceptors all in the loop.
- **Senior:** The second feature is wired behind a message transport; a correlation id travels from the HTTP request through the queue to the consumer log; the consumer is idempotent on redelivery, proven by a test that sends the same message twice and asserts a single side-effect.

## Senior stretch

- Make the consumer survive a redelivery: give each message a key, dedupe on it, and prove with a test that processing the same message twice has the same effect as once.
- Add a global exception filter that turns thrown domain errors into a consistent error envelope, and assert its shape in e2e tests so error responses are part of the contract, not an accident.
- Wire a /health endpoint and a request-duration interceptor, then load-test the queue path to find where latency moves once work is off the request thread.

---

Full project page, progress tracking and linked lessons: https://fallowlone.com/en/projects/nest-modular-service
