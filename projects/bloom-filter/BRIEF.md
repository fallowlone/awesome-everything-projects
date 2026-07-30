# Bloom filter

Build a space-efficient probabilistic set that answers membership queries in O(1) with a tunable false-positive rate — and understand exactly why it can never produce false negatives.

**Difficulty:** intermediate · **Est. days:** 4 · **Stack:** typescript · **Tracks:** data-engineering, backend

## Deliverable

A bloom filter that stores added items with zero false negatives, keeps the false-positive rate within the mathematically predicted bound for the chosen bit-array size and hash count, and exposes fill ratio so an operator can tell when the filter is saturating.

## Why this project

The bloom filter is one of the few data structures where understanding why it works requires actually working through the probability math — and where a seemingly simple bit-twiddling implementation hides three distinct engineering decisions: how many hash functions to use, how large to make the bit array, and what to do when the filter fills up. Building it from scratch forces you to confront all three, derive the sizing formulas rather than just paste them, and discover the failure mode (saturating past design capacity) that production systems hit most often.

## Skills

- bit array manipulation
- hash function composition
- false-positive probability math
- filter sizing (m/n/k)
- counting and scalable variants

## Milestones

### 1. Build the bit array and inject hash functions

The core of a bloom filter is a flat bit array of m bits — not a Set, not a Map, not an array of booleans, but a compact representation where each bit costs one bit of RAM rather than a full byte or object header. In JavaScript/TypeScript the idiomatic backing store is a Uint8Array where bit i lives at byte i>>3, bit position i&7 (set with |=, test with &). The number of hash functions k is not a property of the filter itself but of the injected hash family: accept an array of hash functions in the constructor so tests can provide fast, deterministic functions without touching crypto. This separation matters for two reasons: (1) it keeps the filter's correctness provable in isolation — you control every hash output in the test; (2) it mirrors the real-world practice where Murmur3 or xxHash seeds double as cheap k-function factories. Size the bit array in bytes (ceiling division by 8) and expose m (total bits) and k (hash count) for the math in the next milestone to consume.

**Definition of done:**

- The filter is backed by a Uint8Array of ceil(bits/8) bytes; setting bit i and testing bit i are correct for arbitrary i without off-by-one errors (verified with a direct bit-level test).
- Hash functions are injected via the constructor — no global hash is hardcoded — and the filter exposes `m` (bit count) and `k` (hash function count) as readable properties.

**Self-review:** Show that bit i is set and tested at byte floor(i/8), bit i%8 — a senior reviewer checks there is no boolean array, no Set, and that two distinct injected hash functions reaching the same bit index are idempotent (setting an already-set bit changes nothing).

### 2. Implement add: run all k hashes and set all k bits

Adding a string to the filter means computing each of the k hash functions on it, mapping each output to a bit index via modulo m, and setting that bit to 1. The modulo is not free: if hash outputs are 32-bit signed integers, a negative value modulo m is negative in JavaScript (unlike Python), so you must mask to unsigned first (h >>> 0) or use Math.abs — pick one and be consistent. The order in which you visit the k bits does not matter because all k bits must be set regardless, and reading from a partially-set key during an in-progress add of another key cannot happen in a single-threaded engine. At this milestone the filter only stores — it does not answer membership queries yet. The important invariant to lock in now is: after `add(s)`, for every hash function h_i, bit (h_i(s) % m) is 1.

**Definition of done:**

- After `add(s)`, every bit position (h_i(s) % m) for i in 0..k-1 is set to 1 — verifiable by checking each bit position directly, not just via `has()`.
- Negative hash outputs are handled correctly: (h(s) % m) is always a non-negative index in [0, m-1], verified with a hash function that can return negative values.

**Self-review:** Trace through `add('hello')` with two injected hash functions that return -3 and 15 on m=10 bits: a senior reviewer checks the modulo result is non-negative (7 and 5, not -3 and 5), and that both bit positions are set before the function returns.

### 3. Implement has: all-k-bits check and the false-positive guarantee

`has(s)` returns true if and only if all k bit positions for s are set. If any one bit is 0, the item was definitely never added — this is the no-false-negatives guarantee and it is absolute, not probabilistic: a bit can only go from 0 to 1, never 1 to 0 (in a standard filter). The false-positive case arises when all k bits happen to be 1 due to other items sharing those positions — the filter cannot distinguish this from a genuine member. A senior engineer must be able to state both sides of this precisely: 'has returns false ⟹ definitely absent; has returns true ⟹ probably present (FP rate ≈ (1−e^{−kn/m})^k)'. This milestone is also where you confirm that your implementation actually satisfies the no-false-negatives invariant — add 50 strings, check has on all 50, assert all true. The FP test comes in milestone 4 when you have the sizing math.

**Definition of done:**

- Every item added via `add(s)` is found by `has(s)` — zero false negatives — proven over at least 50 distinct strings.
- You can state the asymmetry in writing: 'false from has guarantees absence; true from has means probable presence with FP rate bounded by the sizing formula', and point to the test that demonstrates each side.

**Self-review:** A senior reviewer asks: if you add item A and item B collides on all k bit positions with A, does `has(B)` return true? Show that your implementation returns true (correct FP behavior) and explain why this is not a bug but the fundamental space-accuracy trade-off of the structure.

### 4. Derive m and k from target capacity and FP rate

A bloom filter has three tunable parameters: m (bits), k (hash functions), n (expected items). Given n and a target false-positive rate p, the optimal m and k are derived from: m = -n·ln(p)/(ln2)² and k = (m/n)·ln2. These formulas are not magic — they come from differentiating the FP probability expression (1−e^{−kn/m})^k with respect to k and m. A senior engineer should be able to derive or at least verify them numerically: for n=1000 items and p=0.01 (1%), m≈9585 bits (~1.2 KB), k≈7. Understating m by 2× doubles the FP rate; halving k often saves little space but triples FP rate. Build a sizing helper `optimalParams(n, p)` that returns {m, k}, add a sanity-check test that actual FP rate over 1000 absent keys stays under 2×p for the computed parameters, and write down what happens to FP rate when the filter exceeds its design capacity n — because that saturation case is the most common production failure.

**Definition of done:**

- `optimalParams(n, p)` returns m = ceil(-n*ln(p)/ln(2)^2) and k = round((m/n)*ln(2)), and you can show the formula derivation or a numerical sanity check for n=1000, p=0.01.
- A test inserts n items and probes 1000 absent keys; the observed FP fraction stays below 2×p, and you documented the FP degradation curve when inserted items exceed n by 50%.

**Self-review:** A senior reviewer asks what happens to the actual FP rate when you insert 2n items into a filter sized for n: show numerically that (1−e^{−k·2n/m})^k is substantially above p, and name the production mitigation (pre-scale m, rotate filter, use counting/scalable variant from the next milestone).

### 5. Extend to counting or scalable variant

A standard bloom filter has two fundamental limitations: you cannot remove items (decrementing a shared bit would corrupt items that happen to share it), and it cannot grow — once m and k are fixed, the FP rate rises monotonically as n increases. The counting bloom filter replaces each bit with a small counter (typically 4 bits) so `remove(s)` is possible by decrementing; this fixes removals but does not fix growth. The scalable bloom filter (SBF) fixes growth by chaining a sequence of standard filters with geometrically shrinking target FP rates so the total FP rate stays bounded: membership is positive if any sub-filter returns true, and additions go into the current sub-filter until it would exceed its target fill ratio, at which point a new sub-filter is created. Implement at least one of these two variants and test the invariant it adds: counting filter → after add+remove, has returns false (the item is absent); scalable filter → FP rate stays under the overall target even after inserting 10× the initial capacity n.

**Definition of done:**

- At least one variant (counting or scalable) is implemented; for counting: add then remove an item, and `has` returns false; for scalable: insert 5× capacity and FP rate on 1000 absent keys stays under 2× the target.
- You can explain why a standard filter cannot support either capability (shared bits make removal unsafe; fixed m/k make growth impossible without saturation) and what each variant trades in return.

**Self-review:** For the counting variant: can you remove an item that was never added? Show what happens (the counter underflows to 0 or wraps, corrupting the filter), and state why the counting filter requires callers to not remove non-members — this is the invariant a production counting filter must enforce or document.

### 6. Expose fill ratio, benchmark, and write the tradeoff memo

A bloom filter is useless without observability: you need to know how saturated it is before the FP rate silently degrades. `fillRatio()` returns the fraction of set bits (popcount of the bit array divided by m) — values above 0.5 signal that the filter is approaching its design capacity and the FP rate is rising. Popcount in JavaScript can be done bit-by-bit or via a look-up table for performance; for a 100 KB filter, the naive loop is fine, but at 10 MB it is measurable. Benchmark add and has at three scales (10 K, 100 K, 1 M items) and record bytes/item versus FP rate versus add throughput. Then write a short tradeoff memo: when should you choose a bloom filter over a hash set (constant memory regardless of n, at the cost of FP probability), when a counting filter over a standard one (removals needed, at 4× space), when a cuckoo filter instead (lower FP at same space, O(1) deletions, slightly more complex to implement and less well-studied). This memo is the difference between 'I implemented a bloom filter' and 'I know when to reach for one'.

**Definition of done:**

- `fillRatio()` correctly returns 0.0 on an empty filter and increases monotonically as items are added, and you can show the exact popcount implementation (not just counting set bits naively in a loop that would also count unset bits).
- A benchmark records bytes/item and add/has throughput at at least two scales, and the tradeoff memo names at least three concrete use-cases where a bloom filter beats a hash set and one where it loses.

**Self-review:** A senior reviewer asks: at what fillRatio does the observed FP rate exceed 2× the design target for your k? Compute it from the formula (1−fillRatio)^k and show the crossing point — this number is what an operator should alert on, not some arbitrary 80% threshold.

## Rubric

### Hashing & bit-array correctness

- **Junior:** A boolean array or Set stores set membership; hash functions are hardcoded rather than injected. Bit-index collisions between different hash functions are not handled — a second hash function setting an already-set bit may be counted as a new item.
- **Mid:** A Uint8Array backs the filter with correct byte/bit indexing (bit i at byte i>>3, position i&7). Hash functions are injected and negative hash outputs are masked to unsigned before the modulo. `add` sets all k bits; `has` checks all k bits and returns false on the first 0.
- **Senior:** You can prove no-false-negatives is an invariant of the bit-OR construction (a bit set to 1 can never be unset, so a stored item's k positions remain set forever), and you can compute the exact FP rate for a given fill ratio as (1−fillRatio)^k — not the approximation but the exact formula using the observed fraction of set bits, so the rate is empirically verifiable against any filter state.

### False-positive math & sizing

- **Junior:** m and k are chosen by trial and error or copied from an example. The FP rate for the chosen parameters is not computed, and there is no check that the filter stays within the intended FP budget as items are added.
- **Mid:** `optimalParams(n, p)` correctly computes m = ceil(-n·ln(p)/ln(2)²) and k = round((m/n)·ln(2)); a test confirms the observed FP rate on 1000 absent keys stays below 2×p for the computed parameters with n insertions.
- **Senior:** You can derive m and k analytically (minimise (1−e^{−kn/m})^k over k; set derivative to zero; recover m from that k and p), show numerically what happens to FP rate when the filter is overfilled beyond design capacity n, and name the fill-ratio threshold at which FP rate exceeds 2×p for your k — this is the alert threshold an operator should configure, not an arbitrary 80% fill.

### Scaling & variants (counting/scalable)

- **Junior:** Only a standard filter is implemented; when asked how to remove an item, the answer is 'rebuild the filter'. Growth past n is not addressed.
- **Mid:** At least one variant is implemented and tested: counting filter with working remove() that satisfies has() → false after add+remove on the same item; or scalable filter that chains sub-filters and keeps FP rate under target for 5× capacity.
- **Senior:** You can state when counting beats standard (delete-heavy workloads where 4× space is acceptable), when scalable beats counting (unbounded write volume where memory budget is fixed), and when a cuckoo filter beats both (same FP rate at half the bits, O(1) delete). The tradeoff memo names a concrete system (e.g. CDN negative-cache, database read filter, dedup pipeline) for each variant and explains why the standard filter is wrong there.

## Senior stretch

- Replace the injected hash functions with double-hashing: generate all k positions from just two base hashes h1 and h2 via the formula pos_i = (h1 + i*h2) % m. Show this is as effective as k independent hashes for large m but costs only two hash evaluations per item, and benchmark the throughput improvement on a 1M-item filter.
- Implement a cuckoo filter as an alternative and compare it to the bloom filter at the same false-positive rate: measure bits/item, deletion support, and lookup throughput. Show the concrete scenario (high deletion rate, FP target < 3%) where cuckoo wins on every metric.
- Make the scalable bloom filter production-ready: serialize and deserialize the entire chain (bit arrays + k/m metadata) to a Buffer so the filter can be persisted across restarts. Verify that a deserialized filter has the same has() results and fillRatio as the original.
- Use a bloom filter to accelerate a simulated disk lookup: items on 'disk' are expensive (1 ms simulated delay); queries that hit the bloom filter are rejected instantly; measure the reduction in simulated disk I/Os at a 1% FP rate versus a 0.1% rate and explain the latency-space trade-off in a short performance report.

---

Full project page, progress tracking and linked lessons: https://fallowlone.com/en/projects/bloom-filter
