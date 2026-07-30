// TODO(you): the local-first sync core.
//
// The suite drives the situations a flaky connection actually produces:
//   - edits queue offline and collapse per note (no keystroke-sized queue);
//   - a mutation leaves the queue only on ACK (dropping at send time loses edits);
//   - a retried flush after a LOST ACK must not write twice — the client-generated
//     mutation id is the idempotency key;
//   - stale local edits lose to newer server state (LWW, ties to the server) and a
//     resolved conflict is not re-litigated on the next flush;
//   - a queue is applied oldest-first, or an older body lands on top.
export type Mutation = { id: string; noteId: string; body: string; updatedAt: number };
export type ServerNote = { noteId: string; body: string; serverUpdatedAt: number };
export type FlushOutcome = { applied: string[]; skipped: string[]; conflicts: string[] };

export class WriteQueue {
  enqueue(m: Mutation): void {
    void m; // TODO
  }
  pending(): Mutation[] {
    return []; // TODO
  }
  ack(id: string): void {
    void id; // TODO
  }
  get size(): number {
    return 0; // TODO
  }
}

export function resolveLww(local: Mutation, server: ServerNote | null): "local" | "server" {
  void local; void server;
  return "server"; // TODO
}

/** `alreadyApplied` is the server's idempotency ledger of mutation ids. */
export function flush(
  mutations: Mutation[],
  server: Map<string, ServerNote>,
  alreadyApplied: Set<string>,
): FlushOutcome {
  void mutations; void server; void alreadyApplied;
  return { applied: [], skipped: [], conflicts: [] }; // TODO
}
