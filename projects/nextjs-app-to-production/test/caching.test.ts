import { test, expect } from "bun:test";
import { decide, cacheConfigIssues, DataCache, type Route } from "../src/caching";

const route = (over: Partial<Route> = {}): Route => ({
  path: "/products",
  readsRequest: false,
  readsMutableData: false,
  ...over,
});

test("a route with no request state and no mutable data is static", () => {
  expect(decide(route()).kind).toBe("static");
});

test("reading per-request state forces dynamic, whatever else is set", () => {
  // Caching a per-request page serves one visitor's page to another — the same bug
  // class as a shared session, and silent because the first visitor sees what they expect.
  expect(decide(route({ readsRequest: true })).kind).toBe("dynamic");
  expect(decide(route({ readsRequest: true, revalidate: 3600 })).kind).toBe("dynamic");
  expect(decide(route({ readsRequest: true, readsMutableData: false, revalidate: 60 })).kind).toBe("dynamic");
});

test("mutable data with a window is ISR", () => {
  const d = decide(route({ readsMutableData: true, revalidate: 60 }));
  expect(d.kind).toBe("isr");
  expect(d.reason).toContain("60s");
});

test("mutable data with no window is not silently cached forever", () => {
  // "Cache and hope" is how a price list goes stale for a week.
  expect(decide(route({ readsMutableData: true })).kind).toBe("dynamic");
});

test("revalidate=0 is an explicit opt-out", () => {
  expect(decide(route({ readsMutableData: true, revalidate: 0 })).kind).toBe("dynamic");
});

test("every decision carries a reason a reviewer can argue with", () => {
  for (const r of [route(), route({ readsRequest: true }), route({ readsMutableData: true, revalidate: 30 })]) {
    expect(decide(r).reason.length).toBeGreaterThan(10);
  }
});

test("a negative revalidate is a configuration error", () => {
  expect(cacheConfigIssues(route({ readsMutableData: true, revalidate: -5 })).length).toBeGreaterThan(0);
});

test("a fresh entry is served without a refresh", () => {
  const cache = new DataCache();
  cache.set("k", "v", 1000, { revalidate: 60 });
  expect(cache.get("k", 1000)).toEqual({ value: "v", stale: false });
  expect(cache.get("k", 30_000)).toEqual({ value: "v", stale: false });
});

test("an expired entry is still served, marked stale", () => {
  // Blocking every visitor on the origin the moment the window closes is a stampede
  // at exactly the moment the origin is slowest.
  const cache = new DataCache();
  cache.set("k", "v", 0, { revalidate: 60 });
  expect(cache.get("k", 60_000)).toEqual({ value: "v", stale: true });
  expect(cache.get("k", 600_000)).toEqual({ value: "v", stale: true });
});

test("an entry with no window never goes stale", () => {
  const cache = new DataCache();
  cache.set("k", "v", 0);
  expect(cache.get("k", 10_000_000)).toEqual({ value: "v", stale: false });
});

test("a missing key is undefined, not a thrown error", () => {
  expect(new DataCache().get("nope", 0)).toBeUndefined();
});

test("only one caller refreshes a stale key at a time", () => {
  const cache = new DataCache();
  cache.set("k", "v", 0, { revalidate: 10 });
  expect(cache.claimRefresh("k")).toBe(true);
  expect(cache.claimRefresh("k")).toBe(false); // the stampede collapses to one request
  cache.finishRefresh("k");
  expect(cache.claimRefresh("k")).toBe(true);
});

test("tag invalidation drops exactly the tagged entries", () => {
  const cache = new DataCache();
  cache.set("p:1", "a", 0, { tags: ["products"] });
  cache.set("p:2", "b", 0, { tags: ["products", "featured"] });
  cache.set("u:1", "c", 0, { tags: ["users"] });

  const dropped = cache.invalidateTag("products").sort();
  expect(dropped).toEqual(["p:1", "p:2"]);
  expect(cache.get("u:1", 0)).toBeTruthy();
  expect(cache.size).toBe(1);
});

test("tag invalidation is independent of the time window", () => {
  // "Publish now" must not wait for a 3600s window to elapse.
  const cache = new DataCache();
  cache.set("p:1", "a", 0, { tags: ["products"], revalidate: 3600 });
  cache.invalidateTag("products");
  expect(cache.get("p:1", 1)).toBeUndefined();
});

test("invalidating an unknown tag changes nothing", () => {
  const cache = new DataCache();
  cache.set("p:1", "a", 0, { tags: ["products"] });
  expect(cache.invalidateTag("nope")).toEqual([]);
  expect(cache.size).toBe(1);
});
