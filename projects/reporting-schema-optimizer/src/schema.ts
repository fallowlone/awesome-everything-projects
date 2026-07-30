// TODO(you): the index-advice core.
//
// Composite index ORDER is the whole game, and the suite is built around the mistake
// everyone makes: an index on (created_at, tenant_id) for
// WHERE tenant_id = $1 AND created_at > $2 matches both columns, looks right, and
// still cannot skip to the tenant. Equality columns must come first, and at most ONE
// range column may follow — after a range predicate nothing is ordered usefully.
//
// The suite also holds you to conservatism: every suggested index costs write
// throughput, so a small table gets no advice at all (a seq scan of 500 rows is the
// correct plan), a unique index is never "unused" (it is a constraint), and an index
// that is a strict prefix of another is redundant.
export type Column = { name: string; type: string; nullable?: boolean };
export type Index = { name: string; columns: string[]; unique?: boolean };
export type Table = { name: string; columns: Column[]; indexes: Index[]; rowEstimate: number };

export type Predicate = { column: string; op: "eq" | "range" | "in" };
export type Query = {
  id: string;
  table: string;
  predicates: Predicate[];
  orderBy?: string[];
  select?: string[];
};

export type Advice = { queryId: string; kind: string; detail: string };

export function indexUsability(index: Index, query: Query): "covers" | "partial" | "unusable" {
  void index; void query;
  return "unusable"; // TODO
}

export function bestIndex(table: Table, query: Query): { index: Index | null; usability: "covers" | "partial" | "unusable" } {
  void table; void query;
  return { index: null, usability: "unusable" }; // TODO
}

export function adviseQuery(table: Table, query: Query): Advice[] {
  void table; void query;
  return []; // TODO
}

export function unusedIndexes(table: Table, workload: Query[]): Index[] {
  void table; void workload;
  return []; // TODO
}

export function redundantIndexes(table: Table): { redundant: Index; coveredBy: Index }[] {
  void table;
  return []; // TODO
}
