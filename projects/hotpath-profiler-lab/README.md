# Hot-path profiler lab — starter

Implement `src/perf.ts` until the acceptance suite passes:

    bun test

This is the measurement layer the rest of the lab hangs off, and the suite is about
judgement rather than arithmetic:

- **Percentiles, not means.** One 900 ms outlier barely moves an average and ruins an
  experience. And `percentile` must not sort the caller's array in place — a
  measurement that reorders your data is a side effect wearing a helper's clothes.
- **A budget with no measurement fails.** Otherwise the gate is green because the
  metric is missing, which is worse than having no gate.
- **A regression needs a ratio AND an absolute floor.** +5 ms on a 10 ms metric and on
  a 2 s metric are not the same event, and a 0.2 ms → 0.6 ms swing is jitter on a
  shared runner. Alert on that and the gate gets muted within a week.
- **Self time ranks the hot path.** Total time points at `main` on every run.

Green suite = you can measure honestly. Then do the lab on the project page: profile a
real hot path, find the allocation or the layout thrash, fix it, and prove the fix
with the same numbers you just learned to trust.
