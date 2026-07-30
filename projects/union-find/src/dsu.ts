// TODO(you): implement a Disjoint Set Union (Union-Find) structure.
// Contract:
//   find(x)           — returns the representative of x's component (with path compression)
//   union(a, b)       — merges the components of a and b (union by rank or size)
//   connected(a, b)   — returns true iff a and b share a representative
//   count()           — returns the number of disjoint sets
//
// Constraints: no external libraries; path compression + union by rank required.
export class DSU {
  constructor(n: number) {
    // TODO: initialise parent[], rank[], and component count.
    void n;
  }

  find(x: number): number {
    void x;
    return 0; // TODO: walk to root with path compression.
  }

  union(a: number, b: number): void {
    void a; void b; // TODO: merge components by rank; update count only when sets differ.
  }

  connected(a: number, b: number): boolean {
    void a; void b;
    return false; // TODO: delegate to find.
  }

  count(): number {
    return 0; // TODO: return number of disjoint sets.
  }
}
