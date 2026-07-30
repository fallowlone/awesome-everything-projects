// TODO(you): the measurement core of the lab.
//
// The suite pins the judgement calls that decide whether a perf gate survives CI:
//   - percentiles, nearest-rank, WITHOUT mutating the caller's array (the mean hides
//     the experience: one 900ms outlier barely moves it);
//   - a budget with no measurement behind it FAILS — otherwise the dashboard stays
//     green while the metric is simply absent — and mismatched units fail too;
//   - a regression needs BOTH a relative threshold and an absolute floor: +5ms on a
//     10ms metric and on a 2s metric are different events, and sub-millisecond
//     metrics swing by large ratios as pure jitter on a shared runner;
//   - the hot path ranks by SELF time, or the profile points at `main` every run.
export type Sample = { name: string; selfMs: number };

export function percentile(values: number[], p: number): number {
  void values; void p;
  throw new Error("TODO");
}

export type Budget = { metric: string; maxMs?: number; maxBytes?: number };
export type Measurement = { metric: string; valueMs?: number; valueBytes?: number };
export type BudgetResult = { metric: string; ok: boolean; detail: string };

export function checkBudgets(budgets: Budget[], measurements: Measurement[]): BudgetResult[] {
  void budgets; void measurements;
  return []; // TODO
}

export const allWithinBudget = (results: BudgetResult[]): boolean => results.every((r) => r.ok);

export type Regression = { metric: string; baseline: number; current: number; ratio: number };

export function findRegressions(
  baseline: Measurement[],
  current: Measurement[],
  opts: { ratio: number; minDeltaMs: number },
): Regression[] {
  void baseline; void current; void opts;
  return []; // TODO
}

export function hotPath(samples: Sample[], topN = 3): Sample[] {
  void samples; void topN;
  return []; // TODO
}
