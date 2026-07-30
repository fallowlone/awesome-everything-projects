// TODO(you): the caching policy this app ships on.
//
// No Next.js in the suite — the decisions are what matter, and the one people get
// wrong is expensive: reading cookies/headers/searchParams makes a route per-request,
// full stop. Cache it and you serve one visitor's page to another, silently, because
// the first visitor sees exactly what they expect.
//
// The rest:
//   - static is only honest when nothing changes without a deploy;
//   - mutable data with NO window must not be cached forever ("cache and hope" is how
//     a price list goes stale for a week);
//   - an expired entry is still SERVED while a refresh happens behind it, or every
//     visitor blocks on the origin at the moment the window closes;
//   - a stale-key refresh collapses to one caller, not a stampede;
//   - tag invalidation works independently of the window, because "publish now" cannot
//     wait 3600 seconds.
export type RouteKind = "static" | "isr" | "dynamic";

export type Route = {
  path: string;
  readsRequest: boolean;
  readsMutableData: boolean;
  revalidate?: number;
  tags?: string[];
};

export type Decision = { path: string; kind: RouteKind; reason: string };

export function decide(route: Route): Decision {
  void route;
  throw new Error("TODO");
}

export function cacheConfigIssues(route: Route): string[] {
  void route;
  return []; // TODO
}

export type CacheEntry = { value: unknown; storedAt: number; tags: string[]; revalidate?: number };

export class DataCache {
  set(key: string, value: unknown, now: number, opts: { tags?: string[]; revalidate?: number } = {}): void {
    void key; void value; void now; void opts; // TODO
  }
  /** Undefined when absent; otherwise the value plus whether it is past its window. */
  get(key: string, now: number): { value: unknown; stale: boolean } | undefined {
    void key; void now;
    return undefined; // TODO
  }
  /** True when THIS caller should refresh; false when a refresh is already in flight. */
  claimRefresh(key: string): boolean {
    void key;
    return false; // TODO
  }
  finishRefresh(key: string): void {
    void key; // TODO
  }
  /** Returns the keys dropped. */
  invalidateTag(tag: string): string[] {
    void tag;
    return []; // TODO
  }
  get size(): number {
    return 0; // TODO
  }
}
