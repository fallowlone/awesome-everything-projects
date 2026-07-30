# LRU cache

Build a Least-Recently-Used cache that evicts in O(1) by combining a hashmap and a doubly-linked list — the canonical interview problem that teaches you exactly why cache eviction is harder than it looks.

**Difficulty:** intermediate · **Est. days:** 4 · **Stack:** typescript · **Tracks:** backend, caching

## Deliverable

An LRUCache<K,V> class with O(1) get, put, has, and size, backed by a hashmap and doubly-linked list, with correct LRU eviction, recency-on-read, and optional TTL — all proven by the acceptance suite.

## Why this project

The LRU cache is the canonical data-structures interview problem that actually matters in production: every database buffer pool, CPU cache, DNS resolver, and CDN is some variant of this idea. Building it from scratch forces you to confront why a hashmap alone cannot evict in O(1) — you need an ordered structure — and why a doubly-linked list paired with the map is the minimal addition that achieves it. The TTL and instrumentation milestones then pull the problem from algorithm-land into engineering-land, where the interesting questions are about lazy vs proactive expiry, cache pollution, and whether your hit rate is actually telling you anything useful.

## Skills

- doubly-linked list
- hashmap + pointer composite
- O(1) eviction
- recency tracking
- TTL expiry
- hit-rate instrumentation

## Milestones

### 1. Naive baseline: Map with O(n) eviction

Before reaching for the optimal structure, implement a working cache using only a plain Map<K,V> so the correctness contract is nailed down first. On capacity overflow, scan the map for the least-recently-used entry by tracking insertion/access order in a parallel array or by comparing timestamps. This is O(n) per eviction — unacceptable at scale — but it forces you to write the test harness, define the interface (get, put, has, size), and decide the eviction contract precisely: does a put on an existing key count as a use? does a get on a missing key count? does reading count as use at all? Nail every edge case in the tests before you optimize. A wrong eviction order here will cascade as a silent bug into every later milestone.

**Definition of done:**

- get/put/has/size work correctly and the eviction removes the truly least-recently-used key (both reads and writes refresh recency).
- A test sequence of at least six operations proves the eviction order is correct, and put on an existing key updates the value without changing capacity.

**Self-review:** Walk through the eviction order after put(A), put(B), put(C) at capacity=2, then get(A): a senior reviewer checks that B is evicted on the next put (not A), and that your O(n) scan is correctly scanning by access time — not insertion time.

### 2. Hashmap + doubly-linked list: O(1) everywhere

Replace the O(n) scan with the canonical data structure pairing: a Map<K, Node<K,V>> for O(1) lookup and a doubly-linked list for O(1) ordering. The list's head is the most-recently-used end; the tail is the least-recently-used end that gets evicted. Every get and put moves the touched node to the head — which is a constant-time splice if the node holds direct prev/next pointers. The classic trick is sentinel nodes at both ends (a dummy head and dummy tail) so you never have null-pointer edge cases for insertions and removals at the boundary. With sentinel nodes, insert-at-head and remove-from-tail are two-line operations with no conditional branches — that is the structural insight that makes this O(1). Make sure the map and the list are always in sync: every map.set has a paired list.insertAtHead, every map.delete has a paired list.remove.

**Definition of done:**

- get, put, and eviction all run in O(1) with no iteration over the list or map — confirmed by reading the code, not a timing test.
- Sentinel nodes are used so insert-at-head and remove-from-tail are branchless, and map.size === list.length is an invariant you can assert at any point.

**Self-review:** Show the splice code for promoting a node to head: a senior reviewer checks it is four pointer assignments with no special cases for empty list or single-item list, and that the sentinel nodes make that possible.

### 3. Recency on read: get() refreshes, put() on existing key refreshes

This milestone is about making recency semantics exact. There are two independent rules: (1) a successful get(k) must move the node to the most-recently-used head, so a hot read-only key is never evicted; (2) a put(k, v) on an existing key must update the value AND move the node to head WITHOUT incrementing size, because the entry count does not change. Both rules together mean that an item can be immune to eviction purely through reads — that is the desired property for a read-heavy cache serving frequently accessed objects. A common bug is to forget rule (2) and let a re-inserted existing key stay at its old list position, meaning the value is updated but it becomes stale for eviction order purposes. Prove both rules with explicit test sequences.

**Definition of done:**

- A test sequence proves that a key accessed via get() outlives an untouched key of the same age when capacity is exceeded.
- A put on an existing key updates the value and moves to head, but cache.size stays the same — proven by an assertion after the put.

**Self-review:** Trace the linked-list state after: put(A,1) put(B,2) get(A) put(C,3) at capacity=2. A senior reviewer checks that B, not A, is evicted by the third put, and that the list order is [C, A] after.

### 4. Eviction policy: edge cases, capacity=1, size invariant

Harden the eviction logic against the cases that break naive implementations. Capacity=1 is a particularly sharp edge: a put of any new key must evict the single existing entry, even if that entry was just read. Capacity=0 must be handled (though it is degenerate — every put is an immediate eviction, every get misses). When put is called with a key that is already at the head of the LRU list (the most-recently-used position), the splice code must not corrupt the list by trying to move a node that is already in the right place — a no-op path for this case is essential. Also validate the size invariant across all operations: size must equal the number of live keys, never exceeding capacity, and must not count the sentinel nodes. A subtle trap is the delete-then-reinsert pattern: delete(k) followed by put(k,v) must create a new node with fresh recency, not resurrect a dangling pointer.

**Definition of done:**

- capacity=1 correctly evicts on every new-key put and get returns undefined immediately after eviction.
- Putting the MRU key again (the key already at head) does not corrupt the list and size stays stable, proven by checking all get results after.

**Self-review:** Show what happens when put(K,V) is called on the key currently at the head position — does your splice code handle the 'node.prev === sentinel.head' case, or does it corrupt next/prev pointers? A senior reviewer wants to see the no-op guard explicitly.

### 5. TTL variant: time-based expiry without background timers

Extend the cache with an optional per-entry TTL (time-to-live). A get(k) on an expired entry must return undefined and remove the entry as if it never existed — this is lazy expiry on access, not proactive purging. Never use setTimeout per entry: it leaks memory proportional to the number of entries, prevents garbage collection of evicted nodes, and fires even after the entry has been evicted by capacity pressure. Instead, record the expiry timestamp on the node at put-time and check it on get-time. The tricky invariant: an expired-but-not-yet-accessed entry still occupies a slot in the capacity count, because lazy expiry only cleans up on touch. If you also want proactive sweeping, implement a O(1)-amortized sweep by iterating from the LRU tail (entries most likely to be expired), so the sweep stays efficient. An injected clock is essential here — tests cannot sleep.

**Definition of done:**

- get(k) on an expired entry returns undefined, removes the entry (has(k) is false), and does not update LRU recency.
- No setTimeout or setInterval is used — expiry is purely lazy (checked on access) using an injected clock, and a unit test confirms expiry without sleeping.

**Self-review:** If a TTL entry sits in the cache and is never accessed, it still occupies a capacity slot. A senior reviewer asks: when does it get cleaned up, and is there a scenario where the cache fills with expired-but-unaccessed entries so that valid new puts are rejected? Show how your design prevents that or explicitly accepts it.

### 6. Instrument hit rate: hits, misses, evictions, and the real cost of cache pollution

A cache without instrumentation is a black box — you cannot tell whether it is helping or hurting. Add lightweight counters: hits (get returned a live value), misses (get returned undefined, whether key-absent or TTL-expired), evictions (an entry was removed due to capacity), and expirations (a TTL expiry triggered on access). Expose a stats() method returning all four. The senior insight here is that a high hit rate alone is misleading: if the cache is large enough to hold everything, hit rate is 100% but you are carrying stale or unused memory. Eviction rate relative to put rate tells you whether the cache is sized correctly (very high eviction rate = undersized for your working set). Expiration rate vs eviction rate tells you whether TTL is too short (most entries expire before they are ever evicted). With numbers in hand, reason about the optimal capacity for a given access pattern — for a Zipf-distributed access pattern (top 20% of keys receive 80% of requests), a cache sized at 20% of the key space achieves near-peak hit rate at a fraction of the memory of caching everything.

**Definition of done:**

- stats() returns { hits, misses, evictions, expirations } all zero at construction, and each counter increments exactly once per qualifying event.
- You can explain in one paragraph why a 95% hit rate cache might still be sized too large, using the eviction rate as supporting evidence.

**Self-review:** A cache has hit rate 90%, eviction rate near zero, and expiration rate near zero. A senior reviewer asks: is this cache well-sized, undersized, or oversized? What would change if you cut capacity in half — and how would your stats() tell you whether that hurt performance?

## Rubric

### O(1) operations & structure

- **Junior:** A Map with a parallel order array or timestamps gives correct eviction but scans O(n) on every put over capacity.
- **Mid:** Hashmap + doubly-linked list with sentinel nodes makes get, put, and eviction all O(1); map.size === list.length is an invariant maintained across all operations.
- **Senior:** The splice code handles the already-at-head case without branching corruption, capacity=1 and capacity=0 are explicitly handled, and you can argue why sentinel nodes eliminate all null-pointer conditionals in insert-at-head and remove-from-tail.

### Recency & eviction correctness

- **Junior:** Eviction removes the entry inserted longest ago (FIFO), not the one accessed longest ago — reads do not refresh recency.
- **Mid:** Both get() and put()-on-existing-key move the node to the MRU head; a new-key put evicts from the LRU tail; size does not increment on a value update.
- **Senior:** You can trace the list state through an interleaved sequence of gets and puts and predict the exact eviction order; the suite's case (c) — a get-saved key outliving an untouched same-age key — passes not by coincidence but because the splice is wired correctly.

### Memory, TTL & hit-rate at scale

- **Junior:** The cache has no TTL support and no counters; you cannot tell whether it is helping without adding external logging.
- **Mid:** Lazy TTL expiry on access using an injected clock (no setTimeout), and stats() exposes hit/miss/eviction/expiration counts so you can compute hit rate without external tooling.
- **Senior:** You can reason from eviction rate vs put rate whether the cache is correctly sized for the working set, explain why a near-zero eviction rate with a high hit rate suggests the cache is oversized, and articulate the cache-pollution failure mode where a sequential scan evicts all hot entries in a pure LRU policy.

## Senior stretch

- Prove amortised O(1) for the TTL sweep by bounding the number of tail-evictions per put: implement the sweep as 'evict at most k expired entries from the tail per put' and show that for k=1 the amortised cost per operation is still O(1) while expired entries are cleared within O(capacity) subsequent puts.
- Add a capacity-tuning heuristic: expose a resize(newCapacity) method that drains LRU entries until size ≤ newCapacity in O(evicted) time and test that all invariants hold after a live resize under concurrent reads.
- Implement a Two-Queue (2Q) or LIRS variant that resists cache pollution from sequential scans: a single full-scan of N keys in a capacity-N cache would evict all hot entries in pure LRU, but 2Q admits scan entries to a probationary queue and promotes them only on a second access — benchmark the difference in hit rate under a mixed hot-keys + scan workload.
- Extend stats() with a per-second hit-rate time series and a scan that identifies the top-K hottest keys since last reset — use a min-heap of size K over a Map<K, hitCount> so the scan is O(N log K) — and argue when O(N log K) bookkeeping is worth it versus just watching the global hit rate.

---

Full project page, progress tracking and linked lessons: https://fallowlone.com/en/projects/lru-cache
