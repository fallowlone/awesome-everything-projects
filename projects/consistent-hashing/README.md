# Consistent Hashing Ring — starter

Implement `HashRing` in `src/ring.ts` so the acceptance suite passes.

    bun test

Rules: inject the hash function (no crypto inside ring.ts), support `vnodes`
(V positions per node), implement `addNode(id)`, `removeNode(id)`, and
`getNode(key): string`. The suite checks: presence of returned node id,
minimal remap on membership change, removeNode isolation, and that higher
vnodes yields lower load standard deviation.
