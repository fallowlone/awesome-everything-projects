import { test, expect } from "bun:test";
import { createStore, handle } from "../src/api";

// 1. POST /items with a name → 201, string id, correct name
test("POST /items with name creates item at 201", () => {
  const store = createStore();
  const res = handle({ method: "POST", path: "/items", body: { name: "a" } }, store);
  expect(res.status).toBe(201);
  expect(typeof res.body?.id).toBe("string");
  expect(res.body?.id.length).toBeGreaterThan(0);
  expect(res.body?.name).toBe("a");
});

// 2. POST /items without name → 400
test("POST /items without name returns 400", () => {
  const store = createStore();
  const res = handle({ method: "POST", path: "/items", body: {} }, store);
  expect(res.status).toBe(400);
});

// 3. After two creates, GET /items → array length 2
test("GET /items returns all created items", () => {
  const store = createStore();
  handle({ method: "POST", path: "/items", body: { name: "x" } }, store);
  handle({ method: "POST", path: "/items", body: { name: "y" } }, store);
  const res = handle({ method: "GET", path: "/items" }, store);
  expect(res.status).toBe(200);
  expect(Array.isArray(res.body)).toBe(true);
  expect(res.body.length).toBe(2);
});

// 4a. GET /items/:id (exists) → 200, correct item
test("GET /items/:id returns the item when it exists", () => {
  const store = createStore();
  const created = handle({ method: "POST", path: "/items", body: { name: "find-me" } }, store);
  const id = created.body?.id;
  const res = handle({ method: "GET", path: `/items/${id}` }, store);
  expect(res.status).toBe(200);
  expect(res.body?.id).toBe(id);
  expect(res.body?.name).toBe("find-me");
});

// 4b. GET /items/:id (missing) → 404
test("GET /items/:id returns 404 for unknown id", () => {
  const store = createStore();
  const res = handle({ method: "GET", path: "/items/nope" }, store);
  expect(res.status).toBe(404);
});

// 5a. PUT /items/:id (exists) → 200, updated body
test("PUT /items/:id updates the item when it exists", () => {
  const store = createStore();
  const created = handle({ method: "POST", path: "/items", body: { name: "old" } }, store);
  const id = created.body?.id;
  const res = handle({ method: "PUT", path: `/items/${id}`, body: { name: "b" } }, store);
  expect(res.status).toBe(200);
  expect(res.body?.name).toBe("b");
});

// 5b. PUT /items/:id (missing) → 404
test("PUT /items/:id returns 404 for unknown id", () => {
  const store = createStore();
  const res = handle({ method: "PUT", path: "/items/nope", body: { name: "b" } }, store);
  expect(res.status).toBe(404);
});

// 6a. DELETE /items/:id (exists) → 200 or 204; subsequent GET → 404
test("DELETE /items/:id removes the item and subsequent GET returns 404", () => {
  const store = createStore();
  const created = handle({ method: "POST", path: "/items", body: { name: "del-me" } }, store);
  const id = created.body?.id;
  const del = handle({ method: "DELETE", path: `/items/${id}` }, store);
  expect(del.status === 200 || del.status === 204).toBe(true);
  const after = handle({ method: "GET", path: `/items/${id}` }, store);
  expect(after.status).toBe(404);
});

// 6b. DELETE /items/:id (missing) → 404
test("DELETE /items/:id returns 404 for unknown id", () => {
  const store = createStore();
  const res = handle({ method: "DELETE", path: "/items/nope" }, store);
  expect(res.status).toBe(404);
});
