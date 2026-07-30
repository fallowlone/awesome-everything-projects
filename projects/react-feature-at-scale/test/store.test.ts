import { test, expect } from "bun:test";
import {
  normalize,
  selectAll,
  memoizeSelector,
  applyOptimistic,
  commitOptimistic,
  rollbackOptimistic,
  type Optimistic,
} from "../src/store";

type Order = { id: string; total: number; status?: string };

const orders: Order[] = [
  { id: "a", total: 10 },
  { id: "b", total: 20 },
  { id: "c", total: 30 },
];

test("normalize builds one copy per id and preserves server order", () => {
  const state = normalize(orders);
  expect(state.ids).toEqual(["a", "b", "c"]);
  expect(state.byId.b.total).toBe(20);
  expect(selectAll(state)).toEqual(orders);
});

test("a duplicate id collapses to one entry, last write winning", () => {
  const state = normalize([...orders, { id: "b", total: 99 }]);
  expect(state.ids).toEqual(["a", "b", "c"]); // no duplicate slot
  expect(state.byId.b.total).toBe(99);
});

test("normalizing an empty list is empty, not undefined", () => {
  expect(normalize([])).toEqual({ byId: {}, ids: [] });
  expect(selectAll({ byId: {}, ids: [] })).toEqual([]);
});

test("a memoised selector recomputes only when its inputs change", () => {
  // Recomputing a filtered array every render returns a NEW array, so a memoised
  // child re-renders although nothing it cares about changed.
  const state = normalize(orders);
  const bigOnes = memoizeSelector((s: typeof state) => selectAll(s).filter((o) => o.total >= 20));

  const first = bigOnes(state);
  const second = bigOnes(state);
  expect(second).toBe(first); // same reference — the child will not re-render
  expect(bigOnes.calls).toBe(1);

  const next = normalize([...orders, { id: "d", total: 40 }]);
  const third = bigOnes(next);
  expect(third).not.toBe(first);
  expect(bigOnes.calls).toBe(2);
});

test("a memoised selector supports several arguments", () => {
  const state = normalize(orders);
  const above = memoizeSelector((s: typeof state, min: number) => selectAll(s).filter((o) => o.total >= min));
  const a = above(state, 20);
  expect(above(state, 20)).toBe(a);
  expect(above(state, 10)).not.toBe(a);
  expect(above.calls).toBe(2);
});

test("an optimistic update is visible immediately", () => {
  const store: Optimistic<Order> = { state: normalize(orders), pending: {} };
  const next = applyOptimistic(store, "m1", { id: "b", total: 999 });
  expect(next.state.byId.b.total).toBe(999);
  expect(Object.keys(next.pending)).toEqual(["m1"]);
});

test("an optimistic insert appends the new id exactly once", () => {
  const store: Optimistic<Order> = { state: normalize(orders), pending: {} };
  const next = applyOptimistic(store, "m1", { id: "d", total: 40 });
  expect(next.state.ids).toEqual(["a", "b", "c", "d"]);
});

test("rollback restores the exact previous value, not an inverse edit", () => {
  // Re-applying the inverse is wrong the moment a second mutation lands in between;
  // a snapshot is the only correct undo.
  const store: Optimistic<Order> = { state: normalize(orders), pending: {} };
  const optimistic = applyOptimistic(store, "m1", { id: "b", total: 999 });
  const rolledBack = rollbackOptimistic(optimistic, "m1");
  expect(rolledBack.state.byId.b.total).toBe(20);
  expect(rolledBack.pending).toEqual({});
});

test("rolling back an optimistic INSERT removes the entity and its id", () => {
  const store: Optimistic<Order> = { state: normalize(orders), pending: {} };
  const optimistic = applyOptimistic(store, "m1", { id: "d", total: 40 });
  const rolledBack = rollbackOptimistic(optimistic, "m1");
  expect(rolledBack.state.byId.d).toBeUndefined();
  expect(rolledBack.state.ids).toEqual(["a", "b", "c"]);
});

test("commit clears the pending entry so nothing leaks", () => {
  const store: Optimistic<Order> = { state: normalize(orders), pending: {} };
  const committed = commitOptimistic(applyOptimistic(store, "m1", { id: "b", total: 999 }), "m1");
  expect(committed.pending).toEqual({});
  expect(committed.state.byId.b.total).toBe(999); // the server confirmed it
});

test("a late failure after commit cannot undo a newer value", () => {
  const store: Optimistic<Order> = { state: normalize(orders), pending: {} };
  const committed = commitOptimistic(applyOptimistic(store, "m1", { id: "b", total: 999 }), "m1");
  const userEditedAgain = applyOptimistic(committed, "m2", { id: "b", total: 1234 });
  const staleRollback = rollbackOptimistic(userEditedAgain, "m1"); // arrives too late
  expect(staleRollback.state.byId.b.total).toBe(1234);
});

test("two concurrent mutations roll back independently", () => {
  const store: Optimistic<Order> = { state: normalize(orders), pending: {} };
  let s = applyOptimistic(store, "m1", { id: "a", total: 111 });
  s = applyOptimistic(s, "m2", { id: "b", total: 222 });
  s = rollbackOptimistic(s, "m1");
  expect(s.state.byId.a.total).toBe(10); // restored
  expect(s.state.byId.b.total).toBe(222); // untouched
  expect(Object.keys(s.pending)).toEqual(["m2"]);
});

test("updates never mutate the previous state object", () => {
  // A store that mutates in place defeats every reference-equality check React makes.
  const store: Optimistic<Order> = { state: normalize(orders), pending: {} };
  const snapshot = JSON.stringify(store);
  applyOptimistic(store, "m1", { id: "b", total: 999 });
  expect(JSON.stringify(store)).toBe(snapshot);
});
