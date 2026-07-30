import { test, expect } from "bun:test";
import { DSU } from "../src/dsu";

// (a) fresh DSU(n): count()===n, no pair of distinct elements connected
test("fresh DSU has count equal to n and no elements connected", () => {
  const dsu = new DSU(6);
  expect(dsu.count()).toBe(6);
  for (let i = 0; i < 6; i++) {
    for (let j = i + 1; j < 6; j++) {
      expect(dsu.connected(i, j)).toBe(false);
    }
  }
});

// (b) union(a,b) makes connected(a,b) true and decrements count by 1
test("union makes two elements connected and decrements count by 1", () => {
  const dsu = new DSU(5);
  dsu.union(1, 3);
  expect(dsu.connected(1, 3)).toBe(true);
  expect(dsu.count()).toBe(4);
});

// (c) TRANSITIVITY: after union(0,1) and union(1,2), connected(0,2) is true
test("transitivity: indirect connection through intermediate element", () => {
  const dsu = new DSU(5);
  dsu.union(0, 1);
  dsu.union(1, 2);
  expect(dsu.connected(0, 2)).toBe(true);
  expect(dsu.connected(2, 0)).toBe(true);
  // 3 and 4 remain isolated
  expect(dsu.connected(0, 3)).toBe(false);
  expect(dsu.connected(1, 4)).toBe(false);
});

// (d) union of two already-connected elements does NOT change count
test("union of already-connected elements does not change count", () => {
  const dsu = new DSU(4);
  dsu.union(0, 1);
  const countAfterFirst = dsu.count();
  dsu.union(0, 1); // same pair again
  expect(dsu.count()).toBe(countAfterFirst);
  dsu.union(1, 0); // reversed, still same component
  expect(dsu.count()).toBe(countAfterFirst);
});

// (e) count and connected stay accurate across a sequence of unions
//     build 2 components from 6 elements → count===2
test("count and connected stay accurate building 2 components from 6 elements", () => {
  const dsu = new DSU(6);
  // component A: {0, 1, 2}
  dsu.union(0, 1);
  dsu.union(1, 2);
  // component B: {3, 4, 5}
  dsu.union(3, 4);
  dsu.union(4, 5);
  expect(dsu.count()).toBe(2);
  // within A
  expect(dsu.connected(0, 2)).toBe(true);
  // within B
  expect(dsu.connected(3, 5)).toBe(true);
  // across components
  expect(dsu.connected(0, 3)).toBe(false);
  expect(dsu.connected(2, 4)).toBe(false);
});

// (f) find returns a stable representative; path compression must not corrupt partition
test("find returns stable representative and remains correct after many unions", () => {
  const n = 100;
  const dsu = new DSU(n);
  // chain all elements into one component
  for (let i = 0; i < n - 1; i++) {
    dsu.union(i, i + 1);
  }
  expect(dsu.count()).toBe(1);
  // every element's representative must be the same root
  const root = dsu.find(0);
  for (let i = 1; i < n; i++) {
    expect(dsu.find(i)).toBe(root);
    expect(dsu.connected(0, i)).toBe(true);
  }
  // trigger path compression by calling find again; representative must not change
  for (let i = 0; i < n; i++) {
    expect(dsu.find(i)).toBe(root);
  }
});
