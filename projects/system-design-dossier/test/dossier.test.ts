import { test, expect } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { checkDossier, errorsOf, derivedStorageGb, derivedBandwidthMbps, type Dossier } from "../src/dossier";

const artifact = (): Dossier =>
  JSON.parse(readFileSync(join(import.meta.dir, "..", "artifact", "dossier.json"), "utf8"));

// ── Your work ──────────────────────────────────────────────────────────────────
test("YOUR DOSSIER: artifact/dossier.json passes every acceptance check", () => {
  const findings = errorsOf(checkDossier(artifact()));
  const report = findings.map((f) => `  • [${f.id}] ${f.message}`).join("\n");
  expect(findings, `\nDossier not acceptable yet:\n${report}\n`).toEqual([]);
});

test("YOUR DOSSIER: every decision names a rejected alternative", () => {
  for (const d of artifact().decisions) {
    expect(d.rejected.length, `decision ${d.id} has no rejected alternative`).toBeGreaterThan(0);
  }
});

test("YOUR DOSSIER: every SLO is measured and has a consequence", () => {
  for (const s of artifact().slos) {
    expect(s.measuredBy, `SLO ${s.metric} is not measured`).toBeTruthy();
    expect(s.errorBudgetPolicy, `SLO ${s.metric} has no consequence`).toBeTruthy();
  }
});

// ── The grader itself ──────────────────────────────────────────────────────────
const load = { peakRps: 2000, readWriteRatio: 100, avgPayloadBytes: 2048, retentionDays: 90 };

const good = (): Dossier => ({
  system: "Event ingest",
  problem: "Batch ingest lags by hours, so the dashboard everyone trusts is wrong during exactly the incidents it exists for.",
  load,
  capacity: {
    storageGb: Math.round(derivedStorageGb(load)),
    peakBandwidthMbps: Math.round(derivedBandwidthMbps(load)),
    derivation: "writes = 2000/(1+100) ≈ 19.8/s; 19.8 × 2KB × 86400 × 90d ≈ storage; egress = 2000 × 2KB × 8",
  },
  bottleneck: "Write amplification on the primary index during peak fan-out",
  decisions: [
    { id: "d1", title: "Queue", chosen: "Kafka", rejected: [{ option: "SQS", why: "no replay for backfills" }], tradeoff: "operational weight for replay and ordering" },
    { id: "d2", title: "Store", chosen: "Postgres + partitioning", rejected: [{ option: "Cassandra", why: "no team experience, and the query shape is relational" }], tradeoff: "vertical ceiling for familiarity and joins" },
    { id: "d3", title: "Delivery", chosen: "at-least-once + dedup", rejected: [{ option: "exactly-once", why: "cost outweighs the benefit at this volume" }], tradeoff: "handlers must be idempotent" },
  ],
  slos: [
    { metric: "p99 ingest latency", target: "< 2s", measuredBy: "histogram in Prometheus, alert on 30m burn", errorBudgetPolicy: "freeze features when 50% of the monthly budget is spent" },
    { metric: "availability", target: "99.9%", measuredBy: "black-box probe every 30s", errorBudgetPolicy: "page on fast burn; postmortem within 48h" },
  ],
  failureModes: [
    { component: "queue", failure: "broker loses a partition leader", blastRadius: "ingest stalls for that partition only", mitigation: "replication factor 3, min ISR 2", detection: "under-replicated partitions alert" },
    { component: "database", failure: "primary fails over", blastRadius: "writes rejected for ~30s", mitigation: "retry with backoff and a bounded queue", detection: "write error-rate alert" },
    { component: "consumer", failure: "poison message loops", blastRadius: "one partition stops advancing", mitigation: "dead-letter after 5 attempts", detection: "consumer lag alert" },
  ],
});

test("the grader accepts a complete dossier", () => {
  expect(errorsOf(checkDossier(good()))).toEqual([]);
});

test("the grader rejects a dossier with no numbers", () => {
  const d = good();
  d.load = { peakRps: 0, readWriteRatio: 0, avgPayloadBytes: 0, retentionDays: 0 };
  expect(errorsOf(checkDossier(d)).map((f) => f.id)).toContain("load-value");
});

test("the grader rejects capacity that does not follow from the load", () => {
  // Numbers asserted next to the load rather than derived from it.
  const d = good();
  d.capacity.storageGb = 5;
  expect(errorsOf(checkDossier(d)).map((f) => f.id)).toContain("capacity-storage");
});

test("the grader tolerates rounding but not fantasy", () => {
  const d = good();
  d.capacity.storageGb = Math.round(derivedStorageGb(load) * 1.5);
  expect(errorsOf(checkDossier(d)).map((f) => f.id)).not.toContain("capacity-storage");
});

test("the grader rejects a decision with no rejected alternative", () => {
  const d = good();
  d.decisions[0].rejected = [];
  expect(errorsOf(checkDossier(d)).map((f) => f.id)).toContain("decision-no-alternatives");
});

test("the grader rejects a rejected option with no reason", () => {
  const d = good();
  d.decisions[0].rejected[0].why = "TODO";
  expect(errorsOf(checkDossier(d)).map((f) => f.id)).toContain("decision-why");
});

test("the grader rejects an SLO nobody measures or enforces", () => {
  const d = good();
  d.slos[0].measuredBy = "";
  d.slos[1].errorBudgetPolicy = "";
  const ids = errorsOf(checkDossier(d)).map((f) => f.id);
  expect(ids).toContain("slo-measurement");
  expect(ids).toContain("slo-policy");
});

test("the grader rejects a design with too few failure modes", () => {
  const d = good();
  d.failureModes = d.failureModes.slice(0, 1);
  expect(errorsOf(checkDossier(d)).map((f) => f.id)).toContain("failure-modes");
});

test("the grader rejects a failure mode with no detection", () => {
  const d = good();
  d.failureModes[0].detection = "";
  expect(errorsOf(checkDossier(d)).map((f) => f.id)).toContain("failure-detection");
});

test("the grader rejects a missing bottleneck", () => {
  const d = good();
  d.bottleneck = "TBD";
  expect(errorsOf(checkDossier(d)).map((f) => f.id)).toContain("bottleneck");
});

test("the derivations are arithmetic anyone can check", () => {
  expect(derivedBandwidthMbps({ ...load, peakRps: 1000, avgPayloadBytes: 1000 })).toBeCloseTo(8, 5);
  expect(derivedStorageGb({ peakRps: 101, readWriteRatio: 100, avgPayloadBytes: 1e6, retentionDays: 1 })).toBeCloseTo(86.4, 1);
});
