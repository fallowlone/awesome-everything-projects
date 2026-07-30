# Reporting schema optimizer — starter

Implement `src/schema.ts` until the acceptance suite passes:

    bun test

The suite is about the one thing that decides whether a reporting query is fast, and
about the discipline not to make things worse:

- **Column order.** Equality predicates first, then at most one range column. An index
  on `(created_at, tenant_id)` for `WHERE tenant_id = $1 AND created_at > $2` matches
  both columns and still cannot skip to the tenant — the suite insists you call that
  only partially usable, not covering.
- **ORDER BY rides the index or it does not.** It has to continue the same prefix, and
  a range column in the middle ends the useful ordering.
- **Conservative advice.** Every index costs write throughput and disk, so a small
  table gets left alone (a sequential scan of 500 rows is the right plan), a wrongly
  ordered index earns *reorder* advice rather than a second index, and a covering
  index earns silence.
- **Removal is advice too.** An index no query can use is pure write cost, an index
  that is a strict prefix of another is redundant, and a unique index is a constraint —
  never "unused".

Green suite = the reasoning is right. Then take it to a real warehouse on the project
page: EXPLAIN the actual workload, apply the changes, and measure the write cost you
just bought alongside the read win.
