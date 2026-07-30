import { test, expect } from "bun:test";
import {
  ValidationError,
  HttpError,
  parse,
  backoffDelays,
  withRetry,
  defineClient,
} from "../src/sdk";
import type { Schema, Policy } from "../src/sdk";

// --- helpers ---

function nameSchema(): Schema<{ name: string }> {
  return (data: unknown) => {
    if (
      data !== null &&
      typeof data === "object" &&
      "name" in data &&
      typeof (data as Record<string, unknown>).name === "string"
    ) {
      return { ok: true, value: data as { name: string } };
    }
    return { ok: false, issues: ["missing or invalid field: name"] };
  };
}

// --- 1. 200 + valid body: client.get returns parsed value ---
test("200 + valid body: client.get returns the parsed value", async () => {
  const client = defineClient({
    baseUrl: "https://api.example.com",
    fetchImpl: async (_url) => ({ status: 200, body: { name: "a" } }),
  });
  const result = await client.get("/item", nameSchema());
  expect(result).toEqual({ name: "a" });
});

// --- 2. Schema mismatch: client.get rejects with ValidationError ---
test("schema mismatch on 200: client.get rejects with ValidationError", async () => {
  const client = defineClient({
    baseUrl: "https://api.example.com",
    fetchImpl: async (_url) => ({ status: 200, body: {} }),
  });
  let caught: unknown;
  try {
    await client.get("/item", nameSchema());
  } catch (e) {
    caught = e;
  }
  expect(caught).toBeInstanceOf(ValidationError);
});

// --- 3. backoffDelays is pure exponential ---
test("backoffDelays({max:3, baseMs:100}) deep-equals [100,200,400]", () => {
  expect(backoffDelays({ max: 3, baseMs: 100 })).toEqual([100, 200, 400]);
});

// --- 4. withRetry succeeds after failures: fn throws on 1-2, resolves on 3 ---
test("withRetry succeeds after 2 failures: resolves and records correct sleeps", async () => {
  let attempt = 0;
  const fn = async () => {
    attempt++;
    if (attempt < 3) throw new Error("not yet");
    return "ok";
  };
  const policy: Policy = { max: 3, baseMs: 10 };
  const recorded: number[] = [];
  const sleep = async (ms: number) => { recorded.push(ms); };

  const result = await withRetry(fn, policy, sleep);
  expect(result).toBe("ok");
  expect(recorded).toEqual([10, 20]);
});

// --- 5. withRetry exhausts: always-throws fn re-throws last error ---
test("withRetry exhausts all retries and rethrows the last error", async () => {
  const err = new Error("always fails");
  const fn = async (): Promise<never> => { throw err; };
  const policy: Policy = { max: 2, baseMs: 10 };
  const sleep = async (_ms: number) => {};

  let caught: unknown;
  try {
    await withRetry(fn, policy, sleep);
  } catch (e) {
    caught = e;
  }
  expect(caught).toBe(err);
});

// --- 6. HttpError on 4xx ---
test("fetchImpl returning 404 causes client.get to reject with HttpError", async () => {
  const client = defineClient({
    baseUrl: "https://api.example.com",
    fetchImpl: async (_url) => ({ status: 404, body: { error: "nf" } }),
  });
  let caught: unknown;
  try {
    await client.get("/item", nameSchema());
  } catch (e) {
    caught = e;
  }
  expect(caught).toBeInstanceOf(HttpError);
  expect((caught as HttpError).status).toBe(404);
  expect((caught as HttpError).body).toEqual({ error: "nf" });
});
