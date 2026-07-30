# React feature at scale

Ship one real production React feature — a live collaborative activity dashboard — then operate it: optimistic edits, streaming updates, a frame budget, full a11y, and an incident drill when a render storm freezes the tab.

**Difficulty:** advanced · **Est. days:** 8 · **Stack:** React 19, a streaming SSR framework (Next.js App Router or equivalent), Server-Sent Events or WebSocket transport, TanStack Query or an external store (Zustand/Redux/useSyncExternalStore), a virtualization library (TanStack Virtual or react-virtuoso), axe-core + Testing Library + Playwright, a RUM / web-vitals collector · **Tracks:** react, frontend, performance, observability

## Deliverable

A deployed real-time activity dashboard: an RSC shell with client islands, live updates over a stream, optimistic mutations with rollback, a virtualized event feed, a passing axe + keyboard a11y audit, a tracked frame/INP budget, and a written post-mortem of a re-render storm.

## Why this project

This is the React capstone: take everything from the spine and ship one feature the way a senior actually ships it. A live activity dashboard looks like a list — but it is a server-rendered shell hydrating client islands, a stream of updates fighting your render path, optimistic writes that must roll back cleanly, and thousands of rows that must scroll at 60 fps without dropping a keyboard user. You will frame it, design its state ownership, build the islands and the live path, test the async surface, hold a frame budget, pass an a11y audit, deploy with field telemetry, then survive and post-mortem a re-render storm.

## Skills

- RSC + client islands
- real-time state sync
- optimistic mutations
- list virtualization
- accessibility (ARIA + focus)
- frame/INP budgeting
- field RUM
- render-storm debugging

## Milestones

### 1. Frame the feature: surface, budgets, non-goals

Before any JSX, decide what the dashboard is and is not. It is read-heavy and update-driven: many viewers, a steady stream of events, a few interactive mutations. Decide the render model up front — what is server-rendered static shell, what must be an interactive client island — because that choice sets your hydration cost and your time-to-interactive. Write down user-facing budgets (INP < 200 ms on a filter click, p75 LCP < 2.5 s, no dropped frames while the feed streams) and explicit non-goals so you don't gold-plate an admin panel nobody asked for.

**Definition of done:**

- You have a component map marking each region as server shell vs client island, with a one-line reason per island.
- You wrote 3 user-facing budgets (an INP target, an LCP target, a streaming frame target) and at least two explicit non-goals.

### 2. Design state ownership: server, client, and the boundary

Decide where each piece of state lives before you write a hook, because the wrong owner is what causes the re-render storm in the last milestone. Server state (the event history, the current snapshot) belongs to a fetching/cache layer; client state (which filter is active, which row is focused) is local UI; the live stream feeds a store that many components read. Pick your sync primitive — query cache vs an external store via useSyncExternalStore — and draw the serialization boundary: what crosses from server component to client island must be serializable, so functions, class instances, and Dates don't silently break hydration.

**Definition of done:**

- Every piece of state has exactly one owner (server-cache, local-UI, or shared-store), written down, and you can name the one that the live stream writes to.
- You listed what crosses the server→client boundary and confirmed it is all serializable (no functions or Dates over the wire).

### 3. Build the RSC shell, islands, and the live update path

Render the dashboard shell on the server with the first snapshot already in the HTML, then hydrate only the interactive islands so the page is useful before JS is parsed. Wire the live transport (SSE or WebSocket) into your shared store and reconcile incoming events into the snapshot — this is where ordering, dedup, and reconnect/backfill bite. Keep the stream off the render-blocking path: an event should update the store and let only the subscribed rows re-render, not re-render the whole tree on every message.

**Definition of done:**

- The server-rendered shell shows a usable first snapshot before hydration, and only marked islands ship client JS.
- Live events update the store and re-render only subscribed rows (you confirmed it in the Profiler, not the whole tree), and a reconnect backfills missed events without duplicates.

### 4. Add optimistic mutations with honest rollback

A senior dashboard lets you act — acknowledge an event, mute a source, pin a row — and feels instant. Implement those with React 19 Actions (useActionState / useOptimistic) so the UI applies the change immediately, then reconciles against the server result. The hard part is failure: the server rejects, or a live event arrives mid-flight and conflicts. Roll back to the real state without flicker, surface the failure to the user, and make the operation idempotent so a retry or a duplicate event doesn't double-apply.

**Definition of done:**

- An action applies optimistically and rolls back to the true server state on rejection, with the failure surfaced to the user (not swallowed).
- A retried or duplicated mutation is idempotent — it does not double-apply, and a conflicting live event resolves to one consistent state.

### 5. Test the async surface and virtualize the feed

The dashboard's risk is async and volume. Test it from the user's seat: mock the stream and the mutation endpoint with MSW, drive interactions with user-event, and assert on what the user sees after an optimistic write resolves or fails — not on internal state. Then virtualize the event feed so 10k rows render only the visible window: a naive list re-lays-out the whole DOM on every stream tick and tanks INP, while a virtualized list keeps the committed node count flat. Measure the difference, don't assume it.

**Definition of done:**

- Tests cover an optimistic success and a rejected-rollback path via MSW + user-event, asserting on visible output, and run green in one command.
- The feed is virtualized: committed DOM nodes stay roughly constant from 100 to 10k rows, and you recorded the INP improvement versus the naive list.

### 6. Make it accessible: semantics, focus, live regions

A real-time dashboard is an accessibility minefield: content updates without user action, focus can be yanked when rows shift, and a virtualized feed hides nodes the screen reader expects. Use real semantics (lists, buttons, headings — not click-handler divs), manage focus deliberately so an optimistic update or a filter change doesn't strand the keyboard user, and announce meaningful changes through an ARIA live region without spamming every stream tick. Composite widgets (filter menus, the row actions) need full keyboard operation and correct roles.

**Definition of done:**

- An axe-core audit passes on the dashboard with no critical/serious violations, and you can drive the whole feature — filter, act on a row, dismiss a menu — with the keyboard alone.
- Meaningful updates are announced via a polite live region (not every stream tick), and focus is preserved or moved deliberately across optimistic updates and filter changes.

### 7. Deploy it and watch the field: RUM, web vitals, budgets

Lab numbers lie; field numbers don't. Ship the feature behind your streaming framework's build, then collect Real User Monitoring — p75 LCP, INP, CLS from actual sessions — and wire your milestone-1 budgets into a dashboard with an alert when p75 INP crosses 200 ms. A code-split bundle keeps the island JS off the initial load; confirm the split actually landed in the build output. The point is to find regressions from real devices and networks, not from your fast laptop.

**Definition of done:**

- The feature is deployed and a RUM dashboard shows field p75 LCP, INP, and CLS tied to your budgets, with an alert on the INP budget.
- The interactive island is code-split out of the initial load, and you confirmed the chunk boundary in the actual build output.

### 8. Survive a re-render storm, then write the post-mortem

Traffic spikes, the event stream goes from 5 to 500 messages/sec, and the tab freezes: INP climbs past a second, frames drop, and the fan spins. Detect it from your own RUM (INP p75 blowing the budget) and your Profiler flamegraph. The root cause is almost never 'too many events' — it's a context value or store selector that makes every message re-render the whole tree, an unstable callback breaking memoization, or a non-virtualized branch you missed. Mitigate live (coalesce stream updates into a batched/transitioned commit, narrow the subscription, stabilize the value), then write the post-mortem. The fix is a render-path change, not 'throttle the server'.

**Definition of done:**

- You reproduced the storm by driving the stream at peak rate and captured the INP spike and dropped frames in the Profiler / RUM.
- You mitigated it on the render path (batched/transitioned commits, a narrowed subscription, or a stabilized value) and showed INP returning under 200 ms at the same event rate.
- Your post-mortem names the trigger, the render-path root cause, the blast radius, the fix, and one prevention that is not 'rate-limit the stream'.

**Self-review:** Paste your post-mortem's root cause and the prevention item; a senior reviewer checks it names the render-path mechanism (over-broad subscription / unstable value / missing batching), not just the symptom (high INP).

## Rubric

### RSC + Suspense boundary placement

- **Junior:** The page uses 'use client' at a high level, shipping most of the component tree as a client bundle; the server renders little more than a skeleton.
- **Mid:** The shell is a Server Component delivering the first snapshot in HTML; interactive islands are pushed to the leaves with explicit 'use client' boundaries, and Suspense wraps async data so content streams in rather than blocking the shell.
- **Senior:** You can state what crosses the serialization boundary (no functions, class instances, or Dates over the wire) and show the Profiler confirming that a live event re-renders only the subscribed island — not the whole tree. The interactive island is code-split, and the chunk boundary is visible in the actual build output.

### Server/client data fetching & waterfall prevention

- **Junior:** Data is fetched in a useEffect after mount; the user sees a spinner while the request completes, and any nested component fetches start only after the parent renders.
- **Mid:** The initial snapshot is fetched on the server and arrives in the HTML; the live stream hydrates the client store and reconciles incoming events into the snapshot without waterfalls or duplicates.
- **Senior:** Optimistic mutations use React 19 Actions (useOptimistic) — the UI reflects the change immediately, rolls back to the true server state on rejection without flicker, and a retried or duplicated mutation is idempotent. A concurrent live event arriving during a pending action resolves to one consistent state.

### Code-splitting & hydration cost

- **Junior:** All component code ships in the initial bundle regardless of whether it is above or below the fold; hydration blocks interactivity until the full JS is parsed.
- **Mid:** Islands are code-split so their JS is not in the initial load; the virtualized feed keeps committed DOM nodes roughly constant from 100 to 10k rows and you have a recorded INP improvement over the naive list.
- **Senior:** Field RUM (p75 LCP, INP, CLS) is collected and tied to the budgets from the framing milestone; an alert fires when p75 INP crosses 200 ms. You can state which bundle chunks landed in the build output and why the split boundary is there and not elsewhere.

### Render-storm root cause & fix

- **Junior:** A stream burst causes visible lag; the post-mortem says 'too many events' and the mitigation is throttling the stream.
- **Mid:** The Profiler flamegraph shows which component re-rendered on every message; you narrow the store subscription or stabilize a context value to fix it, and INP drops under 200 ms at the same event rate.
- **Senior:** The post-mortem names the render-path mechanism (over-broad context subscription / unstable callback breaking memoization / missing batching/transitions) and the prevention is a structural change — not 'rate-limit the server'. You also reproduced the storm by driving the stream at peak rate and captured the INP spike in both RUM and the Profiler.

## Senior stretch

- Add presence and live cursors (who is viewing, who is acting) over the same transport without adding a second render-storm risk.
- Make conflict resolution explicit: when two users act on the same row, define and implement the merge rule (last-write-wins vs CRDT-style) instead of letting the stream decide.
- Persist and restore client view state (filters, scroll position, pinned rows) across reloads and across tabs without a hydration mismatch.
- Add a graceful-degradation mode: when the stream is down, fall back to polling and show a non-alarming staleness indicator instead of breaking the feature.

---

Full project page, progress tracking and linked lessons: https://fallowlone.com/en/projects/react-feature-at-scale
