import { test, expect } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { checkPosture, errorsOf, type Posture } from "../src/posture";

const artifact = (): Posture =>
  JSON.parse(readFileSync(join(import.meta.dir, "..", "artifact", "posture.json"), "utf8"));

// ── Your work ──────────────────────────────────────────────────────────────────
test("YOUR REPORT: artifact/posture.json passes every acceptance check", () => {
  const findings = errorsOf(checkPosture(artifact()));
  const report = findings.map((f) => `  • [${f.id}] ${f.message}`).join("\n");
  expect(findings, `\nReport not acceptable yet:\n${report}\n`).toEqual([]);
});

test("YOUR REPORT: every severe baseline finding is fixed or explicitly accepted", () => {
  for (const f of artifact().baseline.findings) {
    if (f.severity !== "critical" && f.severity !== "high") continue;
    expect(f.status, `finding ${f.id} is still open`).not.toBe("open");
    if (f.status === "fixed") expect(f.evidence, `finding ${f.id} has no evidence`).toBeTruthy();
    if (f.status === "accepted") {
      expect(f.reason, `finding ${f.id} accepted without a reason`).toBeTruthy();
      expect(f.owner, `finding ${f.id} accepted without an owner`).toBeTruthy();
    }
  }
});

test("YOUR REPORT: all four controls are done with evidence", () => {
  const c = artifact().controls;
  for (const key of ["iamLeastPrivilege", "networkClosed", "secretsManaged", "auditTrail"] as const) {
    expect(c[key]?.done, `${key} is not done`).toBe(true);
    expect(c[key]?.evidence, `${key} has no evidence`).toBeTruthy();
  }
});

// ── The grader itself ──────────────────────────────────────────────────────────
const good = (): Posture => ({
  provider: "aws:111122223333",
  baseline: {
    tool: "prowler 4.2",
    at: "2026-07-01T10:00:00Z",
    findings: [
      { id: "iam-admin-role", severity: "critical", title: "Role with Action:* Resource:*", status: "fixed", evidence: "rescan 2026-07-08: finding absent" },
      { id: "db-open", severity: "high", title: "Postgres open to 0.0.0.0/0", status: "fixed", evidence: "describe-security-groups shows 10.0.0.0/16 only" },
      { id: "old-ami", severity: "medium", title: "Instance on an outdated AMI", status: "open" },
    ],
  },
  after: { tool: "prowler 4.2", at: "2026-07-08T10:00:00Z", findings: [{ id: "old-ami", severity: "medium", title: "Instance on an outdated AMI", status: "open" }] },
  controls: {
    iamLeastPrivilege: { done: true, evidence: "policy diff in PR #42", wildcardPoliciesRemaining: 0 },
    networkClosed: { done: true, evidence: "security-group diff + rescan", openToWorldPorts: [443] },
    secretsManaged: { done: true, evidence: "gitleaks clean; secrets in Secrets Manager", plaintextSecretsRemaining: 0 },
    auditTrail: { done: true, evidence: "CloudTrail org trail id 0a1b2c", multiRegion: true },
  },
});

test("the grader accepts a complete before/after report", () => {
  expect(errorsOf(checkPosture(good()))).toEqual([]);
});

test("a medium finding may stay open — the bar is on critical and high", () => {
  const p = good();
  expect(errorsOf(checkPosture(p)).map((f) => f.id)).not.toContain("finding-open");
});

test("the grader rejects an empty baseline", () => {
  const p = good();
  p.baseline.findings = [];
  expect(errorsOf(checkPosture(p)).map((f) => f.id)).toContain("baseline-empty");
});

test("the grader rejects a severe finding left open", () => {
  const p = good();
  p.baseline.findings[0].status = "open";
  expect(errorsOf(checkPosture(p)).map((f) => f.id)).toContain("finding-open");
});

test("the grader rejects 'fixed' with no evidence, filler included", () => {
  for (const filler of [undefined, "", "TODO", "n/a"]) {
    const p = good();
    p.baseline.findings[0].evidence = filler as any;
    expect(errorsOf(checkPosture(p)).map((f) => f.id)).toContain("finding-unproven");
  }
});

test("the grader requires a reason and an owner for an accepted risk", () => {
  const p = good();
  p.baseline.findings[0] = { id: "x", severity: "critical", title: "y", status: "accepted" };
  const ids = errorsOf(checkPosture(p)).map((f) => f.id);
  expect(ids).toContain("finding-unjustified");
  expect(ids).toContain("finding-unowned");
});

test("the grader rejects a new severe finding introduced by the changes", () => {
  const p = good();
  p.after.findings.push({ id: "new-public-bucket", severity: "critical", title: "Bucket made public", status: "fixed", evidence: "x" });
  expect(errorsOf(checkPosture(p)).map((f) => f.id)).toContain("regression");
});

test("the grader rejects an after scan that is not later than the baseline", () => {
  const p = good();
  p.after.at = p.baseline.at;
  expect(errorsOf(checkPosture(p)).map((f) => f.id)).toContain("after-before-baseline");
});

test("the grader rejects remaining IAM wildcards and open sensitive ports", () => {
  const p = good();
  p.controls.iamLeastPrivilege!.wildcardPoliciesRemaining = 2;
  p.controls.networkClosed!.openToWorldPorts = [443, 22];
  const ids = errorsOf(checkPosture(p)).map((f) => f.id);
  expect(ids).toContain("iam-wildcards");
  expect(ids).toContain("open-ports");
});

test("the grader rejects leftover plaintext secrets", () => {
  const p = good();
  p.controls.secretsManaged!.plaintextSecretsRemaining = 1;
  expect(errorsOf(checkPosture(p)).map((f) => f.id)).toContain("plaintext-secrets");
});

test("the grader rejects a control claimed done with no evidence", () => {
  const p = good();
  p.controls.auditTrail = { done: true };
  expect(errorsOf(checkPosture(p)).map((f) => f.id)).toContain("control-auditTrail-evidence");
});
