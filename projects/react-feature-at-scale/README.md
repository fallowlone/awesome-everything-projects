# React feature at scale — starter

Implement `src/store.ts` until the acceptance suite passes:

    bun test

There is no React in this suite, on purpose: the problems that make a large feature
slow and stale are data-shape problems that merely show up as rendering problems.

- **Normalisation.** One copy per id, referenced by id everywhere else. A nested
  response duplicated across three screens is why only one of them updates.
- **Memoised selectors.** A filtered array recomputed each render is a new reference
  each render, so a memoised child re-renders although nothing it cares about changed.
  The suite asserts reference stability and counts recomputations.
- **Optimistic updates with a real rollback.** Undo from a snapshot, because
  re-applying the inverse edit is wrong as soon as a second mutation lands in between.
  Settle the pending entry on commit, and ignore a failure that arrives after the user
  has changed the value again.
- **No mutation.** A store that mutates in place defeats every reference-equality check
  React makes.

Green suite = the state layer is sound. Then build the feature on the project page:
data fetching with a cache, list virtualisation, code splitting at the route, and the
render-profiling pass that proves the memoisation actually pays for itself.
