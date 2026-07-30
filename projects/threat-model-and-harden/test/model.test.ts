import { test, expect } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { checkModel, errorsOf, STRIDE, type ThreatModel } from "../src/model";

const artifact = (): ThreatModel =>
  JSON.parse(readFileSync(join(import.meta.dir, "..", "artifact", "threat-model.json"), "utf8"));

// ── Your work ──────────────────────────────────────────────────────────────────
test("YOUR MODEL: artifact/threat-model.json passes every acceptance check", () => {
  const findings = errorsOf(checkModel(artifact()));
  const report = findings.map((f) => `  • [${f.id}] ${f.message}`).join("\n");
  expect(findings, `\nThreat model not acceptable yet:\n${report}\n`).toEqual([]);
});

test("YOUR MODEL: every threat has a control AND evidence that it works", () => {
  for (const t of artifact().threats) {
    expect(t.control, `threat ${t.id} has no control`).toBeTruthy();
    expect(t.evidence, `threat ${t.id} has no evidence`).toBeTruthy();
  }
});

test("YOUR MODEL: covers all six STRIDE categories", () => {
  const covered = new Set(artifact().threats.map((t) => t.stride));
  for (const c of STRIDE) expect(covered.has(c), `no threat in category ${c}`).toBe(true);
});

// ── The grader itself ──────────────────────────────────────────────────────────
const base = (): ThreatModel => ({
  app: "notes-api",
  boundaries: ["browser → api", "api → database"],
  assets: ["user notes", "session cookies"],
  threats: STRIDE.map((stride, i) => ({
    id: `t${i}`,
    stride,
    boundary: i % 2 === 0 ? "browser → api" : "api → database",
    description:
      "A concrete, specific description of the abuse case long enough to act on, naming the entry point.",
    control: "session lifetime capped, authorization checks ownership, schema validation at the door, CSP header set, secrets in a vault",
    evidence: "test: auth.spec.ts + ZAP baseline scan output committed",
    residualRisk: "none material",
  })),
});

test("the grader accepts a complete model", () => {
  expect(errorsOf(checkModel(base()))).toEqual([]);
});

test("the grader rejects a threat with no control", () => {
  const m = base();
  delete m.threats[0].control;
  expect(errorsOf(checkModel(m)).map((f) => f.id)).toContain("threat-uncontrolled");
});

test("the grader rejects filler in place of a control or evidence", () => {
  // A field that is technically present but says nothing is the usual way this
  // document rots.
  for (const filler of ["TODO", "n/a", "-", "tbd"]) {
    const m = base();
    m.threats[0].control = filler;
    expect(errorsOf(checkModel(m)).map((f) => f.id)).toContain("threat-uncontrolled");
    const m2 = base();
    m2.threats[0].evidence = filler;
    expect(errorsOf(checkModel(m2)).map((f) => f.id)).toContain("threat-unproven");
  }
});

test("the grader rejects a missing STRIDE category", () => {
  const m = base();
  m.threats = m.threats.filter((t) => t.stride !== "repudiation");
  const ids = errorsOf(checkModel(m)).map((f) => f.id);
  expect(ids).toContain("stride-repudiation");
});

test("the grader rejects a threat pinned to an undeclared boundary", () => {
  const m = base();
  m.threats[0].boundary = "somewhere vague";
  expect(errorsOf(checkModel(m)).map((f) => f.id)).toContain("threat-boundary");
});

test("the grader rejects a boundary nobody analysed", () => {
  const m = base();
  m.boundaries = [...m.boundaries, "api → payment provider"];
  expect(errorsOf(checkModel(m)).map((f) => f.id)).toContain("boundary-unused");
});

test("the grader rejects a model that ignores authorization entirely", () => {
  // Six XSS entries is not a threat model; the classes in REQUIRED_TOPICS are the
  // ones that show up in real breaches.
  const m = base();
  for (const t of m.threats) {
    t.description = "Reflected script injection in a query parameter renders unescaped in the page body.";
    t.control = "output encoding plus a strict CSP header on every response over https with secure cookies and schema validation";
  }
  expect(errorsOf(checkModel(m)).map((f) => f.id)).toContain("topic-authz");
});

test("the grader rejects duplicate threat ids", () => {
  const m = base();
  m.threats[1].id = m.threats[0].id;
  expect(errorsOf(checkModel(m)).map((f) => f.id)).toContain("threat-dup");
});

test("the grader rejects a one-boundary model", () => {
  const m = base();
  m.boundaries = ["browser → api"];
  m.threats = m.threats.map((t) => ({ ...t, boundary: "browser → api" }));
  expect(errorsOf(checkModel(m)).map((f) => f.id)).toContain("boundaries");
});
