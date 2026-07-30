# Collaborative cursors — starter

Implement `src/presence.ts` until the acceptance suite passes:

    bun test

Two tabs on localhost will not show you these failures; the suite will:

- **Presence is current state, not a log.** A reconnecting client gets one snapshot.
- **A stale frame cannot teleport a cursor.** LWW on the timestamp, ties keep what is
  stored — two tabs, a proxy buffer and a reconnect are enough to deliver an old
  frame late.
- **Silent peers expire.** A suspended mobile tab never fires `close`, so without a
  TTL its ghost cursor stays on everyone's screen.
- **Pointer events coalesce.** 120 Hz input, one send per interval, and the *final*
  position still gets delivered — dropping it leaves the cursor short of the pointer.
- **Reconnects jitter.** Otherwise one deploy brings every client back at the same
  instant and takes the server down again.

Green suite = the model is right. Then build the app on the project page: the
WebSocket transport, room fan-out (and why naive fan-out is O(N²)), client-side
interpolation for smooth motion, CRDT-backed shared selections, and the
broadcast-storm incident.
