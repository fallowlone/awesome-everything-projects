import { test, expect } from "bun:test";
import { WriteQueue, flush, resolveLww, type Mutation, type ServerNote } from "../src/sync";

const m = (id: string, noteId: string, body: string, updatedAt: number): Mutation => ({ id, noteId, body, updatedAt });

test("edits queue up while offline", () => {
  const q = new WriteQueue();
  q.enqueue(m("1", "n1", "a", 100));
  q.enqueue(m("2", "n2", "b", 110));
  expect(q.pending().map((x) => x.id)).toEqual(["1", "2"]);
});

test("repeated edits of one note collapse to the newest", () => {
  // A queue that grows with every keystroke will not survive a long offline stretch.
  const q = new WriteQueue();
  q.enqueue(m("1", "n1", "first", 100));
  q.enqueue(m("2", "n1", "second", 200));
  expect(q.size).toBe(1);
  expect(q.pending()[0].body).toBe("second");
});

test("a late-arriving older edit never overwrites a newer one", () => {
  const q = new WriteQueue();
  q.enqueue(m("2", "n1", "newer", 200));
  q.enqueue(m("1", "n1", "older", 100));
  expect(q.pending()[0].body).toBe("newer");
});

test("a mutation leaves the queue only on ACK", () => {
  // Dropping at send time loses the edit whenever the response never arrives.
  const q = new WriteQueue();
  q.enqueue(m("1", "n1", "a", 100));
  expect(q.pending()).toHaveLength(1);
  q.ack("1");
  expect(q.pending()).toHaveLength(0);
  expect(q.size).toBe(0);
});

test("LWW picks the newer side and gives ties to the server", () => {
  const server: ServerNote = { noteId: "n1", body: "s", serverUpdatedAt: 100 };
  expect(resolveLww(m("1", "n1", "l", 200), server)).toBe("local");
  expect(resolveLww(m("1", "n1", "l", 50), server)).toBe("server");
  // A tie must resolve to a fixed side or two clients flip-flop forever.
  expect(resolveLww(m("1", "n1", "l", 100), server)).toBe("server");
  expect(resolveLww(m("1", "n1", "l", 1), null)).toBe("local"); // new note
});

test("a flush applies pending edits to server state", () => {
  const server = new Map<string, ServerNote>();
  const applied = new Set<string>();
  const out = flush([m("1", "n1", "hello", 100)], server, applied);
  expect(out.applied).toEqual(["1"]);
  expect(server.get("n1")?.body).toBe("hello");
});

test("a retried flush after a lost ACK does not write twice", () => {
  const server = new Map<string, ServerNote>();
  const applied = new Set<string>();
  const mut = [m("1", "n1", "hello", 100)];

  flush(mut, server, applied);
  server.set("n1", { noteId: "n1", body: "edited-elsewhere", serverUpdatedAt: 500 });

  const retry = flush(mut, server, applied);
  expect(retry.skipped).toEqual(["1"]);
  // The replay must not resurrect the old body over the newer server state.
  expect(server.get("n1")?.body).toBe("edited-elsewhere");
});

test("a stale local edit loses to newer server state and is reported as a conflict", () => {
  const server = new Map<string, ServerNote>([["n1", { noteId: "n1", body: "server", serverUpdatedAt: 900 }]]);
  const out = flush([m("1", "n1", "stale", 100)], server, new Set());
  expect(out.conflicts).toEqual(["1"]);
  expect(out.applied).toEqual([]);
  expect(server.get("n1")?.body).toBe("server");
});

test("a resolved conflict is not re-litigated on the next flush", () => {
  const server = new Map<string, ServerNote>([["n1", { noteId: "n1", body: "server", serverUpdatedAt: 900 }]]);
  const applied = new Set<string>();
  const mut = [m("1", "n1", "stale", 100)];
  flush(mut, server, applied);
  const again = flush(mut, server, applied);
  expect(again.skipped).toEqual(["1"]);
  expect(again.conflicts).toEqual([]);
});

test("a mixed queue is applied oldest-first so the newest body ends up on top", () => {
  const server = new Map<string, ServerNote>();
  const out = flush(
    [m("2", "n1", "second", 200), m("1", "n1", "first", 100)],
    server,
    new Set(),
  );
  expect(out.applied).toEqual(["1", "2"]);
  expect(server.get("n1")?.body).toBe("second");
  expect(server.get("n1")?.serverUpdatedAt).toBe(200);
});

test("independent notes in one flush do not interfere", () => {
  const server = new Map<string, ServerNote>();
  const out = flush([m("1", "n1", "a", 100), m("2", "n2", "b", 90)], server, new Set());
  expect(out.applied.sort()).toEqual(["1", "2"]);
  expect(server.size).toBe(2);
});
