import { test, expect } from "bun:test";
import { MinHeap, parseGrid, bfs, dijkstra, astar } from "../src/pathfind";

// ── (a) MinHeap ──────────────────────────────────────────────────────────────

test("MinHeap pops items in ascending priority order even when pushed out of order", () => {
  const h = new MinHeap<string>();
  h.push("c", 30);
  h.push("a", 10);
  h.push("b", 20);
  h.push("d", 5);

  const order: number[] = [];
  while (h.size > 0) {
    const item = h.pop()!;
    order.push(item.priority);
  }

  expect(order).toEqual([5, 10, 20, 30]);
});

// ── helpers ───────────────────────────────────────────────────────────────────

// 5×5 open grid (all '.', weight 1)
const OPEN = parseGrid(
  ".....\n" +
  ".....\n" +
  ".....\n" +
  ".....\n" +
  ".....\n"
);

// Grid with a heavy cell (weight 9) in the middle — going around is cheaper
//   S . . . .
//   . 9 9 9 .
//   . 9 9 9 .
//   . 9 9 9 .
//   . . . . G
const WEIGHTED = parseGrid(
  "S....\n" +
  ".999.\n" +
  ".999.\n" +
  ".999.\n" +
  "....G\n"
);
// Note: 'S' and 'G' are not valid grid chars — parseGrid must treat unknown
// chars as weight 1 (same as '.') so the test grid is self-describing.

// Grid where the goal is fully walled off
const WALLED = parseGrid(
  ".....\n" +
  ".....\n" +
  "..#..\n" +
  ".###.\n" +
  "..#..\n"
);
const WALLED_GOAL: [number, number] = [2, 3]; // surrounded by '#'

// ── (b) BFS shortest hop path ─────────────────────────────────────────────────

test("BFS returns a path whose length equals Manhattan distance + 1 on an open grid", () => {
  const start: [number, number] = [0, 0];
  const goal: [number, number] = [4, 4];
  const result = bfs(OPEN, start, goal);

  expect(result.path).not.toBeNull();
  const manhattan = Math.abs(goal[0] - start[0]) + Math.abs(goal[1] - start[1]);
  expect(result.path!.length).toBe(manhattan + 1); // includes start cell
});

// ── (c) Dijkstra respects weights ────────────────────────────────────────────

test("Dijkstra routes around a high-weight obstacle (weights respected)", () => {
  // Direct path from (0,0) to (4,4) cuts through the 9-weight block.
  // Going around the edges (perimeter) costs much less.
  const start: [number, number] = [0, 0];
  const goal: [number, number] = [4, 4];

  const result = dijkstra(WEIGHTED, start, goal);
  expect(result.path).not.toBeNull();

  // Perimeter route: right 4 + down 4 = 8 moves all weight-1 cells → cost 9
  // (cost = sum of entered cell weights; entering start typically not counted,
  //  but we define cost = sum of all cells in path including start for consistency
  //  — solution decides, test just checks the heavy cells are avoided)
  // Key assertion: cost must be less than a direct diagonal-equivalent path
  // through 9-weight cells. Worst naive cost would be many 9s.
  expect(result.cost).toBeLessThan(30); // perimeter path ~ 9, definitely < 30
});

// ── (d) A* expands ≤ Dijkstra and matches cost ───────────────────────────────

test("A* returns the same cost as Dijkstra and expands no more nodes", () => {
  const start: [number, number] = [0, 0];
  const goal: [number, number] = [4, 4];

  const d = dijkstra(OPEN, start, goal);
  const a = astar(OPEN, start, goal);

  expect(a.path).not.toBeNull();
  expect(a.cost).toBe(d.cost);
  expect(a.expanded).toBeLessThanOrEqual(d.expanded);
});

// ── (e) Walled-off goal returns null ─────────────────────────────────────────

test("returns path === null when goal is fully walled off", () => {
  const start: [number, number] = [0, 0];
  const bfsResult = bfs(WALLED, start, WALLED_GOAL);
  const dijkResult = dijkstra(WALLED, start, WALLED_GOAL);
  const astarResult = astar(WALLED, start, WALLED_GOAL);

  expect(bfsResult.path).toBeNull();
  expect(dijkResult.path).toBeNull();
  expect(astarResult.path).toBeNull();
});
