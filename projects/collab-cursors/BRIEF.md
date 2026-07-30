# Collaborative cursors

Show every connected user's live cursor and selection in a shared document, conflict-free, over WebSocket.

**Difficulty:** intermediate · **Est. days:** 6 · **Stack:** preact, ws, yjs · **Tracks:** networking, frontend, react, browser, distributed, queues, performance, observability

## Deliverable

A page where two browser tabs see each other's cursors move in real time with names and colors, surviving reconnects.

## Why this project

Real-time collaboration is mostly a presence-and-conflict problem. You'll start with a naive WebSocket transport and a presence model, then build server-side broadcast fan-out and room sharding, smooth and throttle motion on the client, make shared selections conflict-free, survive reconnects with backpressure, scale across multiple WS servers via pub/sub — and finally detect and survive a broadcast storm. The same shape powers Figma multiplayer and Google Docs.

## Skills

- WebSocket
- presence protocol
- CRDT basics
- throttling / interpolation
- broadcast fan-out
- reconnect / resync
- horizontal scale via pub/sub
- incident response

## Milestones

### 1. WebSocket transport and the presence model

Before any cursors move, decide what a connection means. A WebSocket is a long-lived, stateful, full-duplex pipe — unlike HTTP, the server now holds per-socket state and must reason about its lifecycle (open → message → close). Model presence as ephemeral state keyed by a session id: who is here, their name, color, and last cursor. Define a small binary or JSON message envelope ({type, sessionId, payload}) and a heartbeat (ping/pong every ~15 s) so dead sockets are detected, not leaked. At this stage one cursor update is one message; a 10-person room at 60 Hz raw input would be 600 msgs/s inbound, which is exactly why later milestones throttle.

**Definition of done:**

- A client opens a WebSocket, sends a join with name+color, and the server tracks it in a per-room presence map keyed by session id.
- A heartbeat detects a dead socket within one interval and removes its presence entry; you can show the open/message/close transitions in a log.

**Self-review:** Show your message envelope and heartbeat; a senior reviewer checks presence is ephemeral (not persisted), keyed by session not user, and that a closed socket cannot leak a presence entry.

### 2. Broadcast fan-out and room sharding

Every message from one client must reach the other N−1 clients in the same room — and naive fan-out is O(N²): in a 50-person room, each of 50 senders at even 20 msgs/s produces 50×49×20 ≈ 49k message-sends/s on one server. Contain it by isolating state per room (a room owns its socket set and presence), and by fanning out only to that room, never the whole server. Decide the relay rule: echo-to-others (sender already rendered locally) and skip the originator. Keep the per-room broadcast loop off the critical accept path so a hot room can't stall new connections.

**Definition of done:**

- A message is fanned out only to sockets in the same room, excluding the sender, and you can state the per-room send count formula N×(N−1)×rate.
- Two rooms are fully isolated: joining or flooding room A produces zero traffic in room B.

**Self-review:** Walk a reviewer through one message's fan-out path; they check it's O(N) per message within a single room, the sender is excluded, and rooms share no socket set.

### 3. Cursor interpolation, throttling, and coalescing on the client

Raw pointer events fire faster than anyone can use — up to 120 Hz on a high-refresh display — and the network can't (and shouldn't) carry that. On send, throttle outgoing cursor updates to a fixed cadence (~50 ms / 20 Hz) and coalesce: if three moves queue before the next tick, send only the last position, not all three. On render, the remote stream arrives jittery and sparse, so interpolate between the last two received points (lerp toward the target each animation frame) so a cursor that updates at 20 Hz still glides at display refresh. Drive rendering from requestAnimationFrame, not from each inbound message, so a burst can't thrash layout.

**Definition of done:**

- Outgoing updates are capped at a fixed rate with coalescing, verified by counting messages/s under continuous mouse movement.
- Remote cursors glide smoothly via interpolation driven by requestAnimationFrame, not stepping once per received message.

**Self-review:** Have a reviewer move the mouse and watch your network panel and frame timeline; they check send rate is fixed regardless of input rate, and rendering is rAF-driven, not message-driven.

### 4. Conflict-free shared selections (LWW now, CRDT for stretch)

Cursors are last-writer-wins by nature — a newer position simply replaces the old. But shared selections and any shared mutable state need an explicit conflict rule, because two clients can mutate concurrently and messages arrive out of order. Start with LWW keyed by a logical timestamp (a Lamport counter, not wall-clock, since unsynced clocks lie): each presence field carries a counter, and a receiver ignores any update with a counter ≤ what it already has, making the merge commutative and idempotent. This is enough for per-user selection state. For genuinely shared editable content (the stretch), LWW drops writes, so you need a CRDT.

**Definition of done:**

- Each presence field carries a logical counter; an out-of-order or duplicate update is ignored, and you can show two reorderings converge to the same state.
- You can articulate exactly where LWW loses data and why a CRDT is required for shared editable text.

**Self-review:** Reorder and duplicate two concurrent selection updates by hand; a reviewer checks the final state is independent of arrival order (commutative + idempotent), and that wall-clock time is not the tiebreaker.

### 5. Reconnect, resync, and backpressure

Networks drop. When a socket closes, the client must reconnect with exponential backoff + jitter (so 1000 clients knocked off by a deploy don't reconnect in a synchronized thundering herd), and on reconnect resync the full room snapshot rather than replaying a missed delta stream — for ephemeral presence, a fresh snapshot is correct and cheap. On the server, a slow consumer is dangerous: if you keep queuing fan-out messages for a socket whose send buffer is full, memory grows unbounded. Apply backpressure — watch socket.bufferedAmount and, past a threshold, drop coalescible cursor frames (they're stale anyway) rather than buffer them, or disconnect the laggard.

**Definition of done:**

- A killed connection reconnects with backoff+jitter and resyncs the room snapshot; presence is correct again without a manual refresh.
- A deliberately slow consumer triggers backpressure (frames dropped or socket closed) and server memory stays bounded under the load.

**Self-review:** Kill a socket mid-session and throttle one consumer; a reviewer checks reconnect uses jittered backoff (not a tight loop), resync is a snapshot not a replay, and a slow client cannot grow server memory without bound.

### 6. Scale across servers, observe it, and survive a broadcast storm

One WS server caps out (file descriptors, CPU on fan-out) long before your user count does, so put two or more behind a load balancer with sticky sessions and bridge them with a pub/sub backplane (Redis pub/sub or similar): a message lands on server A, publishes to a per-room channel, and every server with members of that room re-fans-out locally. Now instrument it — emit RED metrics (connection rate, message errors, fan-out duration) per room and propagate a trace across the publish hop — because without numbers an incident is invisible. Then trigger one: a runaway client (or a feedback echo bug) floods a room, the backplane amplifies it across all servers, fan-out duration p99 spikes and CPU saturates. Detect it on your dashboard, mitigate live (per-connection rate limit + room message cap), and find the root cause.

**Definition of done:**

- Two WS servers share rooms through a pub/sub backplane: a cursor on server A appears on a client connected to server B.
- A dashboard shows per-room connection rate, error rate, and fan-out p99, and a trace crosses the publish hop.
- You reproduced a broadcast storm, mitigated it with a per-connection rate limit and room cap, and showed fan-out p99 returning to normal — your write-up names the amplification mechanism, not just 'high CPU'.

**Self-review:** Show the backplane path and your storm write-up; a reviewer checks the pub/sub fan-out doesn't double-deliver to local members, that sticky sessions are intentional, and that the root cause names the amplification (echo loop / unbounded re-publish), not the symptom.

## Rubric

### Merge convergence & conflict rule

- **Junior:** Cursor position is broadcast and the last arrival wins; concurrent updates are not acknowledged as a problem.
- **Mid:** Presence fields carry a logical (Lamport) counter; an out-of-order or duplicate update is ignored and you can show two arrival orders converge to the same state.
- **Senior:** You can articulate the exact point where LWW loses concurrent writes and why a sequence CRDT (e.g. Yjs) is required for editable shared text — and the stretch proves it with a convergence test across reordered concurrent ops.

### Offline-then-rejoin reconciliation

- **Junior:** On reconnect the page reloads; presence state from the session is lost and no snapshot is delivered.
- **Mid:** Reconnect uses exponential backoff+jitter and the server sends a full room snapshot; presence is correct again without a manual refresh.
- **Senior:** You explicitly chose snapshot-over-replay for ephemeral presence and can state why replaying a delta stream would be wrong here (ordering, tombstones, memory cost). A deliberately slow consumer triggers backpressure — frames are dropped, not buffered unboundedly — and server memory stays flat under load.

### WebSocket transport & backpressure

- **Junior:** Raw mousemove events are forwarded one-to-one over the socket; send rate matches input rate and no flow control exists.
- **Mid:** Outgoing updates are throttled to ~20 Hz with coalescing; remote cursors are interpolated via requestAnimationFrame so they glide smoothly even on a sparse stream.
- **Senior:** You monitor socket.bufferedAmount and drop stale cursor frames when a consumer falls behind rather than buffering them; a broadcast storm (echo-loop or runaway re-publish via the pub/sub backplane) is detected from RED metrics, mitigated with a per-connection rate cap + room message ceiling, and the post-mortem names the amplification mechanism — not just 'high CPU'.

### Horizontal scale via pub/sub

- **Junior:** All clients must connect to the same server process; running two instances means cursors from one are invisible to the other.
- **Mid:** Two WS servers share rooms through a pub/sub backplane so a cursor on server A appears for clients on server B; sticky sessions are deliberate.
- **Senior:** Fan-out from the backplane never double-delivers to local members (the originating server skips the re-publish for sockets it already served); traces cross the publish hop so a slow room points at the backplane span, not just aggregate CPU.

## Senior stretch

- Make shared text edits conflict-free with a sequence CRDT (Yjs) and prove convergence: apply the same concurrent ops in different orders across tabs and show identical final documents.
- Edge-route WebSockets: terminate connections at the nearest region and bridge rooms over a global pub/sub, reasoning explicitly about cross-region fan-out latency.
- Add presence garbage collection: reap stale sessions across the whole cluster (not just the local server) so a crashed node's ghosts disappear within one heartbeat window.
- Move the fan-out hot loop off the main thread or into a binary protocol (CBOR/MessagePack + transferable buffers) and measure the message-throughput gain per room.

---

Full project page, progress tracking and linked lessons: https://fallowlone.com/en/projects/collab-cursors
