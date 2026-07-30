# A Next.js app to production

Build a multi-tenant content app on the App Router — then run it: lock down auth and secrets, layer the caches, decide every edge-vs-node call, and work the incident when one tenant poisons a shared ISR page.

**Difficulty:** advanced · **Est. days:** 9 · **Stack:** Next.js, React, a Postgres database, an ORM (Prisma or Drizzle), a CDN in front of the app, an OpenTelemetry-compatible tracer · **Tracks:** nextjs, frontend, security, observability, performance

## Deliverable

A deployed multi-tenant Next.js app with RSC + server actions, a JWT/session boundary with server-only secrets, a three-layer cache (ISR + CDN + cache tags), an error.tsx hierarchy wired to tracing, RED dashboards with SLOs, and a written post-mortem of an ISR cache-poisoning incident.

## Why this project

This is the Next.js capstone: take everything from the track and ship one real App Router application end to end, then operate it. A multi-tenant content app — each tenant gets its own subdomain, its own data, its own published pages — forces the decisions that separate a senior Next.js engineer from someone who can render a page. Where does the auth boundary live so a tenant can never read another's data? Which work runs at the edge and which on node, and why? How do three caches (the framework's Data/Full Route cache as ISR, the CDN in front, and per-domain cache tags) compose without serving tenant A's page to tenant B? You will frame it, build the RSC + server-action skeleton, draw the auth and secret boundaries, layer and tag the caches, place every edge/node call against an asset budget, build the error.tsx hierarchy and wire tracing, deploy it through a pipeline, then survive and post-mortem an ISR cache-poisoning incident.

## Skills

- RSC and server actions
- auth boundaries and secret hygiene
- layered caching (ISR/CDN/tags)
- edge-vs-node runtime decisions
- asset and bundle budgets
- error boundaries and tracing
- observability (RED/SLO)
- incident response and post-mortems

## Milestones

### 1. Frame the app: tenancy model, render strategy, SLOs

Before any code, decide the two things that shape everything downstream: how tenancy is keyed and how each route renders. Pick subdomain-per-tenant (clean isolation, more DNS/cert work) over path-per-tenant (simpler routing, easier to leak), and write down the keying rule. Then classify every route by render strategy — static (SSG) for marketing, ISR for published tenant content, dynamic SSR for dashboards — because that classification drives your caching, your edge/node split, and your blast radius later. Write 2–3 SLOs (e.g. p75 LCP < 2.5 s on published pages, p99 TTFB < 200 ms for cached routes) and explicit non-goals so you don't gold-plate the editor when the read path is what carries traffic.

**Definition of done:**

- You wrote down the tenancy keying rule (where the tenant id comes from on every request) and why subdomain over path.
- Every route is classified static / ISR / dynamic, and you have 2–3 SLOs plus two explicit non-goals.

### 2. Build the RSC + server-action skeleton

Stand up the App Router skeleton with the server/client boundary drawn deliberately. Keep data fetching in Server Components so credentials and queries never reach the client bundle; push interactivity to small client islands at the leaves, not whole-page 'use client'. Wire mutations through Server Actions instead of hand-rolled route handlers for form posts, and reach for the data layer (ORM/SQL in RSC) directly in the component tree. The test of a good skeleton: a published page ships almost no JS, and the hydration boundary is a thin shell around the interactive bits, not the page.

**Definition of done:**

- Data fetching lives in Server Components and a published page ships only the JS its interactive islands need (verified in the network panel).
- At least one mutation goes through a Server Action, and you can point to where the server/client boundary sits and why.

### 3. Draw the auth and secret boundaries

Make multi-tenant auth airtight. Decide session vs JWT for your case (stateful sessions revoke instantly but need a store; JWTs scale statelessly but you own revocation and rotation), then enforce the tenant boundary at the data layer so every query is scoped by tenant id — never trust the subdomain alone. Mark server-only modules so a secret can never be imported into a client component, keep your DB URL and signing keys out of the bundle, and protect Server Actions against CSRF and against acting on another tenant's resources. The boundary you're proving: a logged-in user of tenant A cannot read, mutate, or even probe tenant B, no matter what they put in the request.

**Definition of done:**

- Every data access is scoped by tenant id at the data layer, and you have a test that tenant A cannot reach tenant B's data.
- Secrets live behind server-only modules (a client import fails the build), and Server Actions are CSRF-protected.

### 4. Layer the caches: ISR, CDN, and cache tags

Compose three caches without leaking tenant data or serving stale content forever. Use ISR (the Full Route + Data cache) to make published tenant pages static-fast with background revalidation; put a CDN in front so cached HTML is served from the edge; and tag cache entries by domain (e.g. tenant:{id}, post:{id}) so a single edit invalidates exactly the pages it touched via on-demand revalidation — not a global purge, not a stale page. The trap is the shared cache key: if the CDN or the Data cache keys on URL but not tenant, a request can return the wrong tenant's HTML. Make the tenant part of every cache key and prove invalidation is surgical.

**Definition of done:**

- Published pages are ISR-cached and CDN-served, and the tenant id is part of every cache key (you verified no cross-tenant hit).
- Editing one post invalidates only its tagged pages on-demand, and you can show the before/after cache state.

### 5. Decide edge vs node, and hold the asset budget

Place every piece of work on the right runtime and keep the page light. The edge runtime is fast to start and close to the user but has a constrained API surface and no native Node modules — right for tenant routing, auth-check middleware, and geolocated rewrites; node is right for your ORM, heavy crypto, and anything pulling Node built-ins. Put the tenant resolution and a cheap auth gate in middleware at the edge; keep DB work on node. Then set an asset budget — optimize images through next/image, subset and self-host fonts to kill layout shift, and analyze the bundle so a stray client import doesn't blow your JS budget. Target: a published page under a defined JS budget (e.g. < 100 KB gzipped) with LCP image properly sized.

**Definition of done:**

- Tenant routing + auth gate run in edge middleware, DB work runs on node, and you can justify each placement.
- A published page meets a stated JS budget, images go through next/image, and fonts are self-hosted with no layout shift.

### 6. Build the error hierarchy and wire observability

Make failure contained and the running app legible. Build the error.tsx / not-found.tsx hierarchy so a thrown error in one route segment degrades that subtree, not the whole app — a failing widget in tenant A's dashboard must not blank tenant B's. Then instrument: register OpenTelemetry via instrumentation.ts, emit RED metrics (rate, errors, duration) on the read and action paths, log structured server-side events you can query by tenant, and propagate traces across the RSC → data-layer hops so a slow page points at the slow span. Turn your SLOs into a dashboard with an error budget so you see the incident before the next milestone hands you one.

**Definition of done:**

- An error.tsx hierarchy contains a thrown error to its route segment (one tenant's failure does not blank the app).
- A dashboard shows rate, error rate, and p50/p99 duration tied to your SLOs, and a trace for a slow page shows its RSC and data-layer spans.

### 7. Deploy it: runtime, pooling, rollout

Ship it the way you'd run it for tenants. Choose self-host vs a managed platform with eyes open — a managed platform gives you ISR/CDN/edge for free but bills per invocation and per GB-served; self-hosting on node gives control but you own the cache store and the CDN wiring. Whichever you pick, fix the serverless database problem: a per-invocation connection storm will exhaust Postgres, so put a pooler (PgBouncer or the platform's data proxy) between the app and the DB. Wire a pipeline that gates on the tenant-isolation test from the auth milestone, keep secrets injected at deploy, and make a bad rollout reversible in seconds.

**Definition of done:**

- A push runs the test suite (including the tenant-isolation test) → builds → deploys, and you can roll back without rebuilding.
- The DB is behind a pooler (no per-invocation connection storm), and secrets are injected at deploy, not baked into the build.

### 8. Survive an ISR cache-poisoning incident, then write the post-mortem

A request with an unkeyed header (or a tenant-blind cache key) makes Next.js cache the wrong response into the shared ISR/CDN entry; now tenant B is served tenant A's HTML — or an attacker-controlled page — until the entry revalidates, and a parallel cold-start storm during revalidation spikes TTFB. Detect it from your own metrics (a jump in cross-tenant 200s, a TTFB spike on revalidation), mitigate it live (purge the poisoned tag, narrow the cache key, drop the unkeyed input), find the root cause, and write the post-mortem. The fix that holds is keying the cache on everything that varies the response — tenant, auth state, the headers you actually read — plus request coalescing on revalidation so a cold ISR entry doesn't trigger a thundering herd. 'Shorten the TTL' is not a fix; it only narrows the poisoning window.

**Definition of done:**

- You reproduced the poisoning (a request that lands the wrong response in the shared ISR/CDN entry) and captured the cross-tenant hit and TTFB spike on your dashboard.
- You mitigated it by keying the cache on every response-varying input plus coalescing on revalidation, and showed clean tenant isolation and TTFB back to SLO.
- Your post-mortem names the trigger, the blast radius (which tenants, how long), the fix, and one prevention that is not 'shorten the TTL'.

**Self-review:** Paste your post-mortem's root cause and the prevention item; a senior reviewer checks it names the cache-keying mechanism (key on every response-varying input + coalescing), not just the symptom (wrong tenant's page / high TTFB).

## Rubric

### Caching layers & ISR correctness

- **Junior:** Pages are either fully static (no revalidation) or fully dynamic (no caching); tenant content is not cache-tagged and invalidation is a full purge.
- **Mid:** Published pages are ISR-cached, CDN-served, and tagged per tenant and post so a single edit invalidates exactly the affected pages on-demand; no untagged full purge is needed.
- **Senior:** The tenant id is part of every cache key at every layer (Data Cache, Full Route Cache, CDN Vary headers); you reproduced the ISR poisoning incident (a tenant-blind key serving the wrong HTML) and the fix keys on every response-varying input plus coalescing on revalidation so a cold ISR entry doesn't trigger a thundering herd. 'Shorten the TTL' is not in your prevention section.

### Env/secret handling

- **Junior:** Secrets are loaded from process.env in server components but no build-time guard prevents them from being imported into a client bundle.
- **Mid:** Sensitive modules are marked 'server-only' so a client import fails the build; secrets are injected at deploy time, not baked into the build artifact.
- **Senior:** Server Actions are CSRF-protected and verified against the authenticated tenant before acting; you have a test that tenant A cannot reach tenant B's data even by crafting a raw Server Action request. The DB is behind a pooler to prevent per-invocation connection storms on serverless.

### Observability & error boundaries

- **Junior:** Errors surface as unhandled exceptions that blank the whole page; there is no structured logging or tracing.
- **Mid:** An error.tsx / not-found.tsx hierarchy contains failures to their route segment (one tenant's error does not blank the app); OpenTelemetry is registered and a RED dashboard shows rate, error rate, and p50/p99 duration tied to SLOs.
- **Senior:** Traces propagate across RSC → data-layer hops so a slow page points at the slow span, not an aggregate. Structured logs are queryable by tenant so a cross-tenant incident can be scoped within minutes. You turned SLOs into an error budget so the incident milestone's TTFB spike is visible before it becomes a customer complaint.

### Deploy & rollback safety

- **Junior:** Deploys are manual; rolling back requires rebuilding, and secrets may be committed to the repo.
- **Mid:** A CI pipeline gates on the test suite (including the tenant-isolation test) before building and deploying; rollback does not require rebuilding.
- **Senior:** You can distinguish self-host vs managed deployment trade-offs with numbers (per-invocation billing vs fixed infra cost, ISR/CDN included vs hand-wired) and defend the choice for a multi-tenant read-heavy workload. The deploy pipeline rejects a secret baked into the build artifact via a static scan step.

## Senior stretch

- Support custom domains per tenant with automated TLS issuance and a domain-verification flow, without weakening the tenant cache-keying.
- Add a Partial Prerendering / streaming split so the static tenant shell ships instantly while the dynamic, per-user parts stream in behind Suspense.
- Go multi-region: serve published pages read-local from the nearest edge and reason explicitly about write-path consistency on revalidation.
- Add per-tenant rate limiting and cost attribution so one heavy tenant's traffic can't exhaust shared capacity or hide in an aggregate bill.

---

Full project page, progress tracking and linked lessons: https://fallowlone.com/en/projects/nextjs-app-to-production
