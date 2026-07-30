# Offline PWA sync

Offline-first notes PWA: a local write queue (IndexedDB) that syncs on reconnect with last-writer-wins conflict resolution, a service worker for asset caching, and background sync for missed flushes.

**Difficulty:** advanced · **Est. days:** 6 · **Stack:** preact, workbox, hono · **Tracks:** frontend, browser

## Deliverable

A notes app that works fully offline, queues edits in IndexedDB, and automatically syncs them to the server on reconnect without data loss.

## Why this project

Offline-first is easy to promise and brutal to get right. You'll build a proper write-queue architecture on IndexedDB, a service worker that makes the shell installable and fast, and a conflict-resolution strategy that's explainable to a product manager. Background Sync makes reconnect automatic even when the tab is closed.

## Skills

- IndexedDB write queue
- Service Worker caching strategies
- Background Sync API
- last-writer-wins conflict resolution
- optimistic UI

## Milestones

### 1. Local-first write queue

Intercept all reads/writes through an IndexedDB queue and render the UI from local state — the app must work with DevTools set to Offline.

**Definition of done:**

- All reads/writes go through an IndexedDB queue and the UI renders from local state; the app works with DevTools set to Offline.
- A write made offline is durable across a reload (still queued, not lost).

### 2. Service-worker caching

Add a service worker with a stale-while-revalidate strategy for the shell and cache-first for assets.

**Definition of done:**

- The app shell loads from the service worker offline; the shell uses stale-while-revalidate, static assets use cache-first.
- A new deploy updates the cached shell on the next visit without a hard refresh.

### 3. Sync with LWW on reconnect

Flush the write queue on reconnect, resolve conflicts with last-writer-wins (compare server_updated_at vs local_updated_at), and register a Background Sync tag as a fallback.

**Definition of done:**

- On reconnect the queue flushes and conflicts resolve last-writer-wins by comparing server vs local updated_at; no edit is silently lost.
- A Background Sync tag flushes the queue even if the tab was closed at reconnect time.

## Rubric

### Service-worker cache strategy

- **Junior:** A service worker is registered and intercepts fetch, but caching is uniform — the same strategy for the shell, API responses, and static assets.
- **Mid:** The shell uses stale-while-revalidate (always fast, updated in the background), static assets use cache-first (immutable hashed filenames), and a new deploy triggers cache replacement on the next visit without a hard refresh.
- **Senior:** You can state the stale-content window for each strategy and explain why the service-worker lifecycle (install → waiting → activate) makes the update timing non-obvious: a new worker waits for all tabs to close before claiming, and skipWaiting changes that trade-off from 'stale until restart' to 'potential mid-session inconsistency'.

### Write-queue durability & background sync

- **Junior:** Edits are stored in memory while offline; a reload before reconnect loses them.
- **Mid:** The write queue lives in IndexedDB so it survives page reloads; on reconnect the queue flushes to the server, and no edit is silently lost.
- **Senior:** A Background Sync tag registers on write so the flush fires even if the tab was closed at reconnect time; you can state the browser-support caveat (Safari's partial support) and the fallback behavior when Background Sync is unavailable.

### Write-conflict resolution on reconnect

- **Junior:** On reconnect the local write silently overwrites the server, or the server wins without inspecting timestamps — data from one side vanishes without notice.
- **Mid:** Conflicts are resolved by comparing server_updated_at vs local_updated_at (last-writer-wins); no edit is silently discarded — the losing version is at least logged.
- **Senior:** You can state where whole-document LWW fails (two users edit different fields of the same note; the later flush clobbers the other's change) and articulate the per-field merge that the senior-stretch implements — changes to different fields never overwrite each other because the merge key is field + timestamp, not document + timestamp.

## Senior stretch

- Replace last-writer-wins with per-field merging: changes to different fields of the same note never clobber each other.
- Add an undo stack that works across offline/online transitions without corrupting the sync queue.

---

Full project page, progress tracking and linked lessons: https://fallowlone.com/en/projects/offline-pwa-sync
