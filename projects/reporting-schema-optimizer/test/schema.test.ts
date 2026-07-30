import { test, expect } from "bun:test";
import {
  indexUsability,
  bestIndex,
  adviseQuery,
  unusedIndexes,
  redundantIndexes,
  type Table,
  type Query,
} from "../src/schema";

const table = (indexes: Table["indexes"], rowEstimate = 5_000_000): Table => ({
  name: "events",
  columns: [
    { name: "id", type: "bigint" },
    { name: "tenant_id", type: "uuid" },
    { name: "created_at", type: "timestamptz" },
    { name: "kind", type: "text" },
  ],
  indexes,
  rowEstimate,
});

const q: Query = {
  id: "q1",
  table: "events",
  predicates: [
    { column: "tenant_id", op: "eq" },
    { column: "created_at", op: "range" },
  ],
};

test("equality first, then one range column, covers the query", () => {
  const idx = { name: "ix_ok", columns: ["tenant_id", "created_at"] };
  expect(indexUsability(idx, q)).toBe("covers");
});

test("range column first is only partially usable, even though both columns match", () => {
  // The classic mistake: (created_at, tenant_id) looks right, matches both columns,
  // and still cannot skip to the tenant.
  const idx = { name: "ix_wrong_order", columns: ["created_at", "tenant_id"] };
  expect(indexUsability(idx, q)).toBe("partial");
});

test("an index on an unrelated column is unusable", () => {
  expect(indexUsability({ name: "ix_kind", columns: ["kind"] }, q)).toBe("unusable");
});

test("an index covering only some predicates is partial", () => {
  expect(indexUsability({ name: "ix_tenant", columns: ["tenant_id"] }, q)).toBe("partial");
});

test("an IN list counts as equality for prefix purposes", () => {
  const inQuery: Query = {
    id: "q-in",
    table: "events",
    predicates: [{ column: "tenant_id", op: "in" }, { column: "created_at", op: "range" }],
  };
  expect(indexUsability({ name: "ix_ok", columns: ["tenant_id", "created_at"] }, inQuery)).toBe("covers");
});

test("ORDER BY can ride the index only when it continues the prefix", () => {
  const ordered: Query = {
    id: "q-order",
    table: "events",
    predicates: [{ column: "tenant_id", op: "eq" }],
    orderBy: ["created_at"],
  };
  expect(indexUsability({ name: "ix_sorted", columns: ["tenant_id", "created_at"] }, ordered)).toBe("covers");
  expect(indexUsability({ name: "ix_unsorted", columns: ["tenant_id", "kind"] }, ordered)).toBe("partial");
});

test("a sort after a range column cannot be served by the index", () => {
  const ordered: Query = {
    id: "q-order2",
    table: "events",
    predicates: [{ column: "tenant_id", op: "eq" }, { column: "created_at", op: "range" }],
    orderBy: ["kind"],
  };
  expect(indexUsability({ name: "ix", columns: ["tenant_id", "created_at", "kind"] }, ordered)).toBe("partial");
});

test("bestIndex picks the most usable index available", () => {
  const t = table([
    { name: "ix_kind", columns: ["kind"] },
    { name: "ix_tenant", columns: ["tenant_id"] },
    { name: "ix_ok", columns: ["tenant_id", "created_at"] },
  ]);
  const best = bestIndex(t, q);
  expect(best.index?.name).toBe("ix_ok");
  expect(best.usability).toBe("covers");
});

test("with no usable index the advice names the column order to use", () => {
  const advice = adviseQuery(table([{ name: "ix_kind", columns: ["kind"] }]), q);
  expect(advice[0].kind).toBe("add-index");
  expect(advice[0].detail).toContain("tenant_id, created_at");
});

test("a wrongly ordered index earns reorder advice, not a second index", () => {
  const advice = adviseQuery(table([{ name: "ix_wrong", columns: ["created_at", "tenant_id"] }]), q);
  expect(advice[0].kind).toBe("reorder-index");
});

test("a covering index earns no advice", () => {
  expect(adviseQuery(table([{ name: "ix_ok", columns: ["tenant_id", "created_at"] }]), q)).toEqual([]);
});

test("a small table is left alone — a seq scan is the right plan there", () => {
  // Every suggested index costs write throughput; advice the planner would ignore is
  // worse than none.
  const advice = adviseQuery(table([], 500), q);
  expect(advice[0].kind).toBe("no-action");
});

test("an index no query can use is reported as pure write cost", () => {
  const t = table([
    { name: "ix_ok", columns: ["tenant_id", "created_at"] },
    { name: "ix_dead", columns: ["kind"] },
  ]);
  expect(unusedIndexes(t, [q]).map((i) => i.name)).toEqual(["ix_dead"]);
});

test("a unique index is never called unused — it is a constraint", () => {
  const t = table([{ name: "uq_id", columns: ["id"], unique: true }]);
  expect(unusedIndexes(t, [q])).toEqual([]);
});

test("an index that is a prefix of another is reported as redundant", () => {
  const t = table([
    { name: "ix_tenant", columns: ["tenant_id"] },
    { name: "ix_tenant_created", columns: ["tenant_id", "created_at"] },
  ]);
  const dup = redundantIndexes(t);
  expect(dup).toHaveLength(1);
  expect(dup[0].redundant.name).toBe("ix_tenant");
  expect(dup[0].coveredBy.name).toBe("ix_tenant_created");
});

test("a differently ordered index is not redundant", () => {
  const t = table([
    { name: "ix_a", columns: ["created_at"] },
    { name: "ix_b", columns: ["tenant_id", "created_at"] },
  ]);
  expect(redundantIndexes(t)).toEqual([]);
});
