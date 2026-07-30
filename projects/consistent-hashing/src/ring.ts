// TODO(you): implement a consistent hash ring with virtual nodes.
//
// opts.vnodes  — number of virtual positions per physical node (default 1)
// opts.hash    — INJECTED deterministic function (string → non-negative int)
//                Never call a real crypto hash inside this file.
//
// Methods:
//   addNode(id: string): void   — place V positions for this node on the ring
//   removeNode(id: string): void — remove all positions for this node
//   getNode(key: string): string — return the node id responsible for this key
//                                  (throws if the ring is empty)
export interface HashRingOpts {
  vnodes: number;
  hash: (s: string) => number;
}

export class HashRing {
  constructor(_opts: HashRingOpts) {
    // TODO: store opts, initialise sorted ring structure
    void _opts;
  }

  addNode(_id: string): void {
    // TODO: insert V positions keyed as `${id}#${i}` for i in [0, vnodes)
    void _id;
  }

  removeNode(_id: string): void {
    // TODO: remove all positions for this node id
    void _id;
  }

  getNode(_key: string): string {
    // TODO: hash the key, binary-search the sorted ring, wrap around to first
    void _key;
    throw new Error("not implemented");
  }
}
