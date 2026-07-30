# Cache stampede lab

Reproduce a thundering-herd cache miss under load, then kill it with single-flight and early-expiry recomputation.

**Difficulty:** intermediate · **Est. days:** 4 · **Stack:** — · **Tracks:** caching

## Deliverable

A demo where a hot key expiring sends 1 request to the origin instead of thousands, shown on a latency graph.

## Why this project

A read-through cache looks like a latency win until a hot key expires and your origin receives a thousand simultaneous misses — the cache just amplified a single expiry event into a thundering herd. This project makes you reproduce that failure mode under measurable load, watch the origin QPS spike on a graph, then kill it with two complementary weapons: single-flight coalescing (only one goroutine/Promise races to the origin while the rest wait for its result) and probabilistic early expiration (XFetch recomputes a hot key before it actually expires, so the hard-expiry cliff disappears). The senior insight is that TTL is not just a freshness budget — it is a synchronized timer shared by every in-flight request, and the right combination of jitter, early recomputation, and request coalescing is what turns that cliff into a smooth slope.

## Skills

- TTL design
- single-flight / request coalescing
- probabilistic early expiration
- load testing

## Milestones

### 1. Trigger the stampede

Build a read-through cache and load-test it to trigger a stampede on expiry.

**Definition of done:**

- Under load, expiring one hot key sends a burst of concurrent requests to the origin, visible as an origin-QPS spike on the graph.
- The cache is read-through: a miss recomputes and repopulates the key.

### 2. Collapse misses to one origin call

Add single-flight so concurrent misses for one key collapse into a single origin call.

**Definition of done:**

- Concurrent misses for one key result in exactly one origin call; the rest wait for and reuse its result.
- Early/probabilistic expiration recomputes before hard expiry so a hot key rarely fully expires under load.

## Rubric

### Stampede reproduction

- **Junior:** The cache misses on expiry but the load test is not instrumented; origin QPS during a stampede is not measured.
- **Mid:** A load test expires one hot key under sustained concurrent load and shows the origin-QPS spike (e.g. 1 request → N concurrent misses) on a graph with the miss-count recorded.
- **Senior:** You reproduce the stampede, measure the exact fan-out (ratio of concurrent misses to origin calls), and explain why TTL jitter alone doesn't fix a hot key — it only reduces the probability of collision when multiple keys expire in the same window.

### Single-flight coalescing

- **Junior:** All concurrent misses independently call the origin; no deduplication of in-flight requests exists.
- **Mid:** A single-flight (or mutex per key) ensures that concurrent misses for the same key collapse to one origin call; the rest wait for and reuse the result.
- **Senior:** You know the pathological case: if the origin call fails, single-flight broadcasts the error to all waiters — one origin error becomes N request errors. You handle this by retrying independently on failure rather than caching the error, and measure the latency cost of the wait queue under high concurrency.

### Early expiry & TTL design

- **Junior:** TTL is a fixed constant chosen by intuition; the cache always misses on hard expiry, never recomputes proactively.
- **Mid:** Stale-while-revalidate or XFetch probabilistic early expiry recomputes a hot key before the hard TTL fires, so the cliff at expiry boundaries disappears under load.
- **Senior:** You tune the XFetch beta parameter against your measured origin recomputation time: too small and you don't recompute early enough; too large and you recompute on nearly every request. You present the staleness-vs-origin-load curve and defend the chosen default with numbers from your load test.

## Senior stretch

- Add probabilistic early expiration (XFetch) and show it removes the cliff at TTL boundaries.
- Measure the staleness vs origin-load tradeoff and pick defaults you can defend.

---

Full project page, progress tracking and linked lessons: https://fallowlone.com/en/projects/cache-stampede-lab
