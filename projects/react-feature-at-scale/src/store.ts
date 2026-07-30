// TODO(you): the state layer a large React feature stands on.
//
// No React in the suite — every one of these bugs is a data-shape bug that merely
// SHOWS UP as a rendering problem:
//   - normalise to one copy per id (a nested response duplicated across screens is
//     why "why is this stale" happens), preserving server order;
//   - memoise derived selectors on input identity: recomputing a filtered array
//     returns a NEW array every render, so a memoised child re-renders for nothing —
//     that is the whole "React is slow" complaint;
//   - optimistic updates roll back from a SNAPSHOT, never by applying an inverse edit
//     (which is wrong the moment a second mutation lands in between), settle their
//     pending entry so nothing leaks, and ignore a rollback that arrives after commit;
//   - never mutate the previous state object, or every reference check React makes is
//     defeated.
export type Entity = { id: string; [field: string]: unknown };
export type Normalized<T extends Entity> = { byId: Record<string, T>; ids: string[] };

export function normalize<T extends Entity>(items: T[]): Normalized<T> {
  void items;
  return { byId: {}, ids: [] }; // TODO
}

export const selectAll = <T extends Entity>(state: Normalized<T>): T[] => {
  void state;
  return []; // TODO
};

export function memoizeSelector<Args extends unknown[], R>(
  fn: (...args: Args) => R,
  equals?: (a: Args, b: Args) => boolean,
): ((...args: Args) => R) & { calls: number } {
  void fn; void equals;
  const stub = (..._args: Args): R => {
    throw new Error("TODO");
  };
  return Object.assign(stub, { calls: 0 });
}

export type Optimistic<T extends Entity> = {
  state: Normalized<T>;
  pending: Record<string, { id: string; previous: T | undefined }>;
};

export function applyOptimistic<T extends Entity>(store: Optimistic<T>, mutationId: string, entity: T): Optimistic<T> {
  void store; void mutationId; void entity;
  throw new Error("TODO");
}

export function commitOptimistic<T extends Entity>(store: Optimistic<T>, mutationId: string): Optimistic<T> {
  void store; void mutationId;
  throw new Error("TODO");
}

export function rollbackOptimistic<T extends Entity>(store: Optimistic<T>, mutationId: string): Optimistic<T> {
  void store; void mutationId;
  throw new Error("TODO");
}
