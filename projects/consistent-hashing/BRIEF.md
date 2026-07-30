# Consistent hashing ring

Build a virtual-node hash ring that remaps only the minimum set of keys when a node joins or leaves — the foundational primitive behind Dynamo, Cassandra, and every sharded cache that must survive node churn without a full reshuffle.

**Difficulty:** advanced · **Est. days:** 5 · **Stack:** typescript · **Tracks:** distributed, backend

## Deliverable

A HashRing that maps arbitrary keys to nodes with consistent hashing, proves minimal remap on membership change, and shows that virtual nodes measurably reduce load imbalance compared to a single point per node.

## Why this project

Consistent hashing is the mechanism that lets distributed systems add or remove nodes without reshuffling the entire keyspace — the difference between an O(1/N) remap and an O(1) remap that triggers a thundering-herd resync. Building the ring from scratch makes every tradeoff concrete: why virtual nodes exist (arc-size variance), why the hash function must be collision-resistant (position collisions), why weighted nodes use proportional V counts, and why bounded load exists (skewed key distributions break the balance virtual nodes promised). Every database or cache that claims 'consistent hashing' relies on this chain of reasoning.

## Skills

- consistent hashing
- virtual nodes
- hash ring
- minimal remap
- load balance
- bounded load

## Milestones

### 1. Build the ring: sorted positions, key lookup

A consistent hash ring maps every key to a node by hashing the key onto a circular integer space and finding the first node position that is greater-than-or-equal (the successor). The ring is kept as a sorted array of (position, nodeId) pairs; a lookup is a binary search for the key's hash, wrapping from the last position back to the first if the key falls beyond the rightmost node. The choice of hash function matters: a good distribution prevents hot spots before you even add virtual nodes, and the function must be deterministic and collision-resistant to avoid two nodes landing on the same position. Start with one physical position per node; the tests use an injected hash so results are fully reproducible. Prove the contract: for any key, getNode returns one of the currently-present node ids, never a stale or removed one.

**Definition of done:**

- addNode / removeNode maintain a sorted ring, and getNode always returns one of the currently-present node ids (proven across a range of keys).
- Lookup uses binary search or sorted-insert, not a linear scan, and you can explain the wrap-around case when the key hash exceeds the largest node position.

**Self-review:** Walk the lookup for a key whose hash is larger than every node position — a senior reviewer checks you wrap around to the first node, not return undefined or throw.

### 2. Virtual nodes: replicate positions across the ring

A single position per node gives terrible balance: with N nodes, the arc sizes follow an exponential distribution, so the heaviest-loaded node typically carries 2–3× the average share. Virtual nodes fix this by placing each physical node at V positions across the ring (e.g. hash('nodeId#0'), hash('nodeId#1'), … hash('nodeId#V-1')), interleaving all nodes' positions so each node ends up owning many small arcs rather than one large one. As V grows, the standard deviation of key assignment converges toward 1/√(N·V) of the mean — measurably lower than the single-point case. The tradeoff is memory: V positions per node × N nodes entries in the sorted ring; for 100 nodes at V=150 that is 15 000 sorted entries, which is fine, but V=10 000 starts to matter. Implement virtual nodes and prove the balance improvement over a fixed key population.

**Definition of done:**

- With vnodes > 1, the ring contains V sorted positions per node, and you can show the ring's entries visually interleaved rather than grouped by node.
- Over a fixed population of ~100 keys, the standard deviation of per-node key counts with vnodes > 1 is strictly lower than with vnodes = 1 (quantified and stated).

**Self-review:** State the memory cost of the ring at N=100 nodes, V=150 vnodes — a senior reviewer checks you know the ring is a sorted array of N·V entries and can bound the lookup cost as O(log N·V).

### 3. Minimal remap: only the departing arc re-routes

The whole point of consistent hashing is that adding or removing one node only remaps the keys that were assigned to that node's arc(s) — everything else stays put. With N nodes each key has a 1/N probability of being remapped on any single membership change, compared to a complete reshuffle with a modulo-hash scheme. This is the 'blast radius' property: a node failure or a scale-out event touches only a bounded fraction of keyspace. Prove it: record each key's assignment before a membership change, apply the change, record assignments after, and assert that the fraction of keys that moved is well below 1 — specifically, that keys whose pre-change node was not the added/removed one were not disturbed. This is the test that distinguishes consistent hashing from a coincidentally-low-remap modulo scheme.

**Definition of done:**

- After addNode, the fraction of the key population whose assigned node changed is below 0.4 over a ~200-key set (tighter than 0.5 — a modulo-hash scheme moving random keys can accidentally satisfy < 0.5). With 3→4 nodes the expected remap is ~1/4 = 0.25.
- Strong consistent-hashing property: every key that changed assignment after addNode now routes to the newly-added node — no key moved between two pre-existing nodes. This is the property that distinguishes consistent hashing from a coincidentally-low-remap alternative.
- After removeNode, every key that was not previously assigned to the removed node keeps exactly its prior node — no collateral movement.

**Self-review:** Show the pre/post assignment table for a removeNode call — a senior reviewer checks that the only keys that moved are those that were assigned to the removed node, and that the total fraction moved is close to 1/N for N nodes.

### 4. Measure load balance: std-dev of key counts across nodes

Consistent hashing with a modest number of virtual nodes still produces imbalanced load if the hash function is poor or V is too low. Quantify it. Over a large key population (e.g. 1000 keys, 5 nodes, various V values), compute the coefficient of variation (stddev / mean) of per-node key counts. A single position per node (V=1) typically yields CV around 0.5–1.0 for small N; V=100–150 drops it to 0.1–0.2. Plot or tabulate V vs. CV so you can assert the monotonic improvement and give a rule of thumb: past V=150 the returns diminish rapidly, and memory cost grows linearly. This analysis is what a senior engineer presents when justifying the vnode count in a production Cassandra or Redis Cluster deployment.

**Definition of done:**

- You computed the per-node key count distribution for at least two V values (V=1 and V≈150) over ≥ 200 keys: stddev at V=150 is strictly lower than at V=1 (relative assertion), AND the coefficient of variation (CV = stddev / mean) at V=150 is below 0.3 (absolute assertion). CV at V=1 for N=5 is typically 0.5–1.0.
- You stated a concrete V recommendation for N=5 nodes and N=50 nodes based on the CV measurements, not just 'more V is better'.

**Self-review:** Given N=5, V=1 vs V=150 over 1000 keys: a senior reviewer expects the V=1 CV to be ≥ 0.4 and V=150 CV ≤ 0.25, and wants you to name the memory cost for each and the point where diminishing returns make increasing V pointless.

### 5. Weighted nodes: proportional capacity allocation

Real clusters are heterogeneous: a node with 2× the RAM should carry 2× the keys. Consistent hashing handles this natively: assign V × weight positions instead of V, where weight is the node's relative capacity. A node with weight=2 gets 2V positions; one with weight=0.5 gets V/2 positions. The key assignment fraction for each node converges to its weight fraction of the total weight sum. This is how Cassandra's 'num_tokens' per node is tuned in a mixed-generation cluster, and how a Redis Cluster rebalances when you promote a replica to a larger instance type. Implement weight support, verify the assignment fraction tracks the weight fraction over a large key population, and reason about what happens during a rebalance: adding a heavyweight node remaps more keys than adding a lightweight one.

**Definition of done:**

- addNode accepts an optional weight; a node with weight=2 receives approximately twice the key share of a node with weight=1 over ≥ 200 keys (within 20% tolerance).
- You can name the blast radius when adding a weight=2 node vs. a weight=1 node to a 4-node ring and explain why heavier nodes are added in steps in production.

**Self-review:** Show the per-node assignment fractions for a 3-node ring with weights [1, 2, 1] over 500 keys — a senior reviewer checks the weight=2 node carries ~50% ± 15% of keys and can explain the rebalance cost if you double that node's weight in a live cluster.

### 6. Bounded load: cap any node at ε above the average

Even with many virtual nodes the ring can produce hot spots under a skewed key distribution — a viral key or a hash-space hot region concentrates requests on one arc. Google's bounded-load consistent hashing (2017) fixes this by adding a soft cap: when a node is already at (1+ε) times the current average load, route the key to the next node instead. The cap is dynamic — it tracks live load, not static position counts — so it self-adjusts as load shifts. The parameter ε trades load balance (ε→0 is perfect balance but degrades to round-robin) against consistency (ε→∞ is pure consistent hashing with no rerouting). Walk the tradeoff: at ε=0.25 a node can carry at most 25% above average, and empirically the reassignment rate is very low under a uniform distribution but rises sharply under a skewed one. Implement the bounded-load probe: after finding the ring successor, walk forward until you find a node under the cap. Measure how many probes are needed on average under uniform vs. skewed traffic.

**Definition of done:**

- getNode probes forward past the ring successor when the successor is above the (1+ε)× average cap, and no node's load ever exceeds the cap during a run over ≥ 200 requests.
- You measured the average probe count under a uniform and a skewed key distribution and can state the latency cost of extra probes vs. the load-balance benefit.

**Self-review:** Under a skewed key distribution (80% of requests to 10% of keys), show how many probes bounded-load needs on average and what ε you chose — a senior reviewer checks ε is justified by a measured load distribution, not picked arbitrarily.

## Rubric

### Ring placement & lookup

- **Junior:** Keys are assigned by iterating over nodes; position collisions and wrap-around are not handled. The assignment changes when the iteration order changes.
- **Mid:** The ring is a sorted position array; lookup is binary search with wrap-around; a deterministic hash places nodes; and getNode always returns a present node id.
- **Senior:** You justify the hash-function choice (collision resistance, distribution quality), reason about the expected arc-size variance at N nodes with one position each, and measure that virtual nodes reduce the coefficient of variation to < 0.25 at V=150.

### Minimal remap on membership change

- **Junior:** Adding or removing a node reassigns many keys that were not on the changed node's arc — the blast radius is not bounded.
- **Mid:** After addNode or removeNode, only the keys previously assigned to the affected arc(s) move; all other keys stay on their node (verified over a fixed population).
- **Senior:** You measure the fraction of keys remapped on addNode and removeNode, show it is approximately 1/(N+1) and 1/N respectively, and name the worst-case blast radius for a weighted-node change (weight-proportional remap fraction).

### Load balance (vnodes, weights)

- **Junior:** All nodes have one position; load is visibly uneven and no measurement is made.
- **Mid:** Virtual nodes reduce load variance (measured stddev or CV), and weighted nodes assign proportionally more positions to higher-capacity nodes with assignment fractions that track weight fractions.
- **Senior:** You give a concrete V recommendation per cluster size (quantified CV target), state the memory cost of the ring at that V, and implement or reason about bounded-load to cap any hot node at (1+ε)× average even under a skewed key distribution.

## Senior stretch

- Implement replication: each key maps to R successive ring nodes (skipping virtual-node duplicates of the same physical node), and prove that removing one node never drops below R-1 replicas for any key.
- Add a rendezvous (HRW) hash ring as an alternative and compare: HRW needs no sorted structure (each node scores the key independently) but O(N) lookup vs. O(log N·V) — measure the crossover point where the lookup cost of HRW exceeds the binary-search ring.
- Drive bounded-load with a real-time load signal (request latency p99 per node) instead of a static key count, and show the ring self-heals when one node slows — keys route away before the node is explicitly removed.
- Implement jump consistent hashing (a 10-line algorithm that maps a key to a bucket in O(log N) with perfect balance but no removal support) and reason about when it beats a virtual-node ring: static shard counts where nodes never leave.

---

Full project page, progress tracking and linked lessons: https://fallowlone.com/en/projects/consistent-hashing
