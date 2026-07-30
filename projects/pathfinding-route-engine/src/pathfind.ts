// TODO(you): implement graph search algorithms on a weighted ASCII grid.
//
// Grid format (see parseGrid):
//   '.' = open cell, weight 1
//   '#' = impassable wall
//   '2'-'9' = passable cell with that numeric weight
//
// Coordinates are [col, row] i.e. [x, y], 0-indexed, 4-directional movement.

export interface Cell {
  x: number;
  y: number;
}

export interface Grid {
  width: number;
  height: number;
  weight: (x: number, y: number) => number | null; // null = wall
}

export interface SearchResult {
  path: [number, number][] | null;
  cost: number;
  expanded: number;
}

/** Min-heap ordered by numeric priority. */
export class MinHeap<T> {
  private _data: { priority: number; value: T }[] = [];

  push(value: T, priority: number): void {
    // TODO: insert and bubble up
    void value; void priority;
  }

  pop(): { priority: number; value: T } | undefined {
    // TODO: remove and return the min-priority element, then sift down
    return undefined;
  }

  get size(): number {
    return this._data.length;
  }
}

/** Parse an ASCII grid string into a Grid object. */
export function parseGrid(s: string): Grid {
  // TODO: split on newlines, build a 2-D weight lookup
  void s;
  return { width: 0, height: 0, weight: () => null };
}

/** Breadth-first search (unweighted shortest hop path). */
export function bfs(grid: Grid, start: [number, number], goal: [number, number]): SearchResult {
  // TODO: standard BFS; cost = number of hops
  void grid; void start; void goal;
  return { path: null, cost: 0, expanded: 0 };
}

/** Dijkstra's algorithm (respects cell weights). */
export function dijkstra(grid: Grid, start: [number, number], goal: [number, number]): SearchResult {
  // TODO: priority-queue Dijkstra; cost = sum of cell weights along path
  void grid; void start; void goal;
  return { path: null, cost: 0, expanded: 0 };
}

/** A* with Manhattan-distance heuristic (admissible on integer grids with weight ≥ 1). */
export function astar(grid: Grid, start: [number, number], goal: [number, number]): SearchResult {
  // TODO: A* using MinHeap; heuristic = |dx| + |dy|
  void grid; void start; void goal;
  return { path: null, cost: 0, expanded: 0 };
}
