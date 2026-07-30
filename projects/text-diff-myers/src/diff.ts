// TODO(you): implement lcs and diff.
//
// lcs<T>(a, b, eq?): returns the longest common subsequence of a and b.
// Elements are compared with `eq` (default: ===).
//
// diff<T>(a, b, eq?): returns a minimal edit script as an array of ops:
//   { op: 'keep' | 'insert' | 'delete', value: T }
//
// Invariant 1: keep + insert ops in order reproduce b exactly.
// Invariant 2: keep + delete ops in order reproduce a exactly.
//
// No Date.now(), no external deps, bun stdlib only.

export type EditOp<T> = { op: "keep" | "insert" | "delete"; value: T };

export function lcs<T>(
  a: T[],
  b: T[],
  eq: (x: T, y: T) => boolean = (x, y) => x === y
): T[] {
  void a; void b; void eq;
  return []; // TODO: dynamic programming LCS
}

export function diff<T>(
  a: T[],
  b: T[],
  eq: (x: T, y: T) => boolean = (x, y) => x === y
): EditOp<T>[] {
  void a; void b; void eq;
  return []; // TODO: backtrack DP table (or Myers V array) into edit script
}
