// TODO(you): the idempotent load core.
//
// The suite proves the property the whole project is about: running the same
// batch twice leaves the same table. Four things it pins down —
//   1. merge on the natural key, never append;
//   2. collapse duplicates WITHIN a batch, order-independently;
//   3. only overwrite with a NEWER row (re-running an old batch must not
//      resurrect stale values);
//   4. an inclusive watermark, so rows sharing the last tick are not lost.
export type Row = {
  id: string;
  updatedAt: number;
  [column: string]: unknown;
};

export type LoadResult = { inserted: number; updated: number; skipped: number };

export class TargetTable {
  merge(batch: Row[]): LoadResult {
    void batch;
    return { inserted: 0, updated: 0, skipped: 0 }; // TODO
  }
  get count(): number {
    return 0; // TODO
  }
  get(id: string): Row | undefined {
    void id;
    return undefined; // TODO
  }
  snapshot(): Row[] {
    return []; // TODO: stable order
  }
}

/** Inclusive lower bound — see the note above about shared timestamp ticks. */
export function selectSince(source: Row[], watermark: number): Row[] {
  void source; void watermark;
  return []; // TODO
}

/** Monotonic: never rewind. */
export function advanceWatermark(current: number, batch: Row[]): number {
  void current; void batch;
  return 0; // TODO
}

export type Check = { name: string; passed: boolean; detail: string };

/** Gate between staging and target. Required check names are in the suite. */
export function runChecks(batch: Row[], opts: { requiredColumns?: string[]; maxNullRatio?: number } = {}): Check[] {
  void batch; void opts;
  return []; // TODO
}

export const allPassed = (checks: Check[]): boolean => checks.every((c) => c.passed);

/** select → gate → merge → advance. A failed gate loads nothing and keeps the watermark. */
export function runOnce(
  source: Row[],
  target: TargetTable,
  watermark: number,
  opts: Parameters<typeof runChecks>[1] = {},
): { loaded: LoadResult | null; watermark: number; checks: Check[] } {
  void source; void target; void watermark; void opts;
  return { loaded: null, watermark, checks: [] }; // TODO
}
