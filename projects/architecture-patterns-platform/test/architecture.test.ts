import { test, expect } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { checkArchitecture, errorsOf, type Architecture } from "../src/architecture";

const artifact = (): Architecture =>
  JSON.parse(readFileSync(join(import.meta.dir, "..", "artifact", "architecture.json"), "utf8"));

// ── Your work ──────────────────────────────────────────────────────────────────
test("YOUR ARCHITECTURE: artifact/architecture.json passes every acceptance check", () => {
  const findings = errorsOf(checkArchitecture(artifact()));
  const report = findings.map((f) => `  • [${f.id}] ${f.message}`).join("\n");
  expect(findings, `\nArchitecture not acceptable yet:\n${report}\n`).toEqual([]);
});

test("YOUR ARCHITECTURE: every context has an owner and owns its own data", () => {
  const seen = new Map<string, string>();
  for (const c of artifact().contexts) {
    expect(c.owner, `context ${c.id} has no owner`).toBeTruthy();
    for (const store of c.ownsData) {
      expect(seen.has(store), `${store} is shared with ${seen.get(store)}`).toBe(false);
      seen.set(store, c.id);
    }
  }
});

test("YOUR ARCHITECTURE: every ADR records consequences", () => {
  for (const r of artifact().adrs) expect(r.consequences?.length ?? 0, `ADR ${r.id} has no consequences`).toBeGreaterThan(24);
});

// ── The grader itself ──────────────────────────────────────────────────────────
const good = (): Architecture => ({
  platform: "B2B orders",
  contexts: [
    { id: "orders", name: "Orders", owner: "team-orders", ownsData: ["orders_db"], responsibility: "Owns the lifecycle of an order from draft to fulfilled" },
    { id: "billing", name: "Billing", owner: "team-billing", ownsData: ["billing_db"], responsibility: "Owns invoices, payments and the money side of an order" },
    { id: "catalog", name: "Catalog", owner: "team-catalog", ownsData: ["catalog_db"], responsibility: "Owns products, prices and availability as published to buyers" },
  ],
  integrations: [
    { from: "orders", to: "catalog", style: "sync", failureBehaviour: "serve last-known price from cache and mark the quote provisional", contract: "GET /products/:id v2" },
    { from: "orders", to: "billing", style: "async", contract: "order.placed v1 event" },
  ],
  patterns: [
    { name: "Outbox", appliedTo: ["orders"], problem: "An order must not be placed without its event, and a dual write loses one of them under failure", cost: "A relay to operate and a table that grows" },
  ],
  adrs: [
    { id: "adr-1", title: "Split billing from orders", status: "accepted", context: "One deploy pipeline blocked both teams and a billing bug stopped order intake", decision: "Separate contexts with async integration", consequences: "Eventual consistency between order state and invoice state; support needs a joined view" },
    { id: "adr-2", title: "Async order → billing", status: "accepted", context: "Synchronous billing calls made order placement fail whenever billing was slow", decision: "Publish order.placed and let billing consume it", consequences: "Invoices appear seconds later; billing must be idempotent on the event" },
    { id: "adr-3", title: "Catalog reads stay synchronous", status: "accepted", context: "Prices must be current at quote time and staleness is visible to buyers", decision: "Synchronous read with a short-lived cache fallback", consequences: "Orders degrade to provisional quotes when catalog is down, rather than failing" },
  ],
});

test("the grader accepts a coherent architecture", () => {
  expect(errorsOf(checkArchitecture(good()))).toEqual([]);
});

test("the grader rejects two contexts writing the same store", () => {
  const a = good();
  a.contexts[1].ownsData = ["orders_db"];
  expect(errorsOf(checkArchitecture(a)).map((f) => f.id)).toContain("shared-store");
});

test("the grader rejects integrating through a shared database", () => {
  const a = good();
  a.integrations.push({ from: "billing", to: "catalog", style: "shared-db" });
  expect(errorsOf(checkArchitecture(a)).map((f) => f.id)).toContain("integration-shared-db");
});

test("the grader rejects a synchronous cycle", () => {
  // A ↔ B synchronous means neither deploys or fails independently — the entire
  // reason for splitting them is gone.
  const a = good();
  a.integrations.push({ from: "catalog", to: "orders", style: "sync", failureBehaviour: "fail the request", contract: "GET /orders/:id" });
  expect(errorsOf(checkArchitecture(a)).map((f) => f.id)).toContain("integration-sync-cycle");
});

test("the grader rejects a synchronous call with no stated failure behaviour", () => {
  const a = good();
  delete a.integrations[0].failureBehaviour;
  expect(errorsOf(checkArchitecture(a)).map((f) => f.id)).toContain("integration-no-fallback");
});

test("the grader rejects a context with no owner", () => {
  const a = good();
  a.contexts[0].owner = "";
  expect(errorsOf(checkArchitecture(a)).map((f) => f.id)).toContain("context-owner");
});

test("the grader rejects a pattern with no problem or no cost", () => {
  const a = good();
  a.patterns.push({ name: "CQRS", appliedTo: ["billing"], problem: "TBD", cost: "" });
  const ids = errorsOf(checkArchitecture(a)).map((f) => f.id);
  expect(ids).toContain("pattern-no-problem");
  expect(ids).toContain("pattern-no-cost");
});

test("the grader rejects an ADR with no consequences", () => {
  const a = good();
  a.adrs[0].consequences = "None.";
  expect(errorsOf(checkArchitecture(a)).map((f) => f.id)).toContain("adr-consequences");
});

test("the grader rejects a superseded ADR that points nowhere", () => {
  const a = good();
  a.adrs[0].status = "superseded";
  expect(errorsOf(checkArchitecture(a)).map((f) => f.id)).toContain("adr-superseded-dangling");

  a.adrs[0].supersededBy = "adr-99";
  expect(errorsOf(checkArchitecture(a)).map((f) => f.id)).toContain("adr-superseded-unknown");
});

test("the grader rejects an integration pointing at a context that does not exist", () => {
  const a = good();
  a.integrations.push({ from: "orders", to: "ghost", style: "async", contract: "x" });
  expect(errorsOf(checkArchitecture(a)).map((f) => f.id)).toContain("integration-unknown");
});
