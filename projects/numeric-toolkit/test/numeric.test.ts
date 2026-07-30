import { test, expect } from "bun:test";
import { matmul, solve, variance } from "../src/numeric";

const EPS = 1e-9;
function close(a: number, b: number) {
  return Math.abs(a - b) < EPS;
}

// ── (a) matmul against a hand-computed product ────────────────────────────
test("matmul: [[1,2],[3,4]] · [[5,6],[7,8]] = [[19,22],[43,50]]", () => {
  const A = [[1, 2], [3, 4]];
  const B = [[5, 6], [7, 8]];
  const C = matmul(A, B);
  expect(C[0][0]).toBe(19);
  expect(C[0][1]).toBe(22);
  expect(C[1][0]).toBe(43);
  expect(C[1][1]).toBe(50);
});

// ── (b) solve a 3×3 system with a known integer solution ─────────────────
// 2x + y - z = 8, -3x - y + 2z = -11, -2x + y + 2z = -3  →  x=2, y=3, z=-1
test("solve: 3×3 system with known integer solution [2, 3, -1]", () => {
  const A = [
    [ 2,  1, -1],
    [-3, -1,  2],
    [-2,  1,  2],
  ];
  const b = [8, -11, -3];
  const x = solve(A, b);
  expect(close(x[0], 2)).toBe(true);
  expect(close(x[1], 3)).toBe(true);
  expect(close(x[2], -1)).toBe(true);
});

// ── (c) zero first-pivot — partial pivoting required ─────────────────────
// [[0,1],[1,0]]·x = [1,2]  →  x = [2, 1]
// Naive (no pivot swap) divides by 0 and returns NaN/Infinity.
test("solve: zero first pivot [[0,1],[1,0]]·x=[1,2] → x=[2,1] (requires partial pivoting)", () => {
  const A = [[0, 1], [1, 0]];
  const b = [1, 2];
  const x = solve(A, b);
  expect(close(x[0], 2)).toBe(true);
  expect(close(x[1], 1)).toBe(true);
});

// ── (d) numerically stable variance — catastrophic cancellation test ──────
// Naive sum-of-squares formula loses precision for large near-equal values.
// variance([1e9+1, 1e9+2, 1e9+3]) = variance([1,2,3]) = 2/3 ≈ 0.6667
test("variance: large near-equal values [1e9+1, 1e9+2, 1e9+3] ≈ 0.6667 (within 1e-3)", () => {
  const xs = [1e9 + 1, 1e9 + 2, 1e9 + 3];
  const v = variance(xs);
  expect(Math.abs(v - 2 / 3)).toBeLessThan(1e-3);
});

// ── (e) singular matrix must throw ───────────────────────────────────────
test("solve: singular matrix [[1,2],[2,4]] throws", () => {
  expect(() => solve([[1, 2], [2, 4]], [1, 2])).toThrow();
});
