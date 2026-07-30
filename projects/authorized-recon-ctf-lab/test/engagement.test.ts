import { test, expect } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { checkEngagement, errorsOf, inScope, type Engagement } from "../src/engagement";

const artifact = (): Engagement =>
  JSON.parse(readFileSync(join(import.meta.dir, "..", "artifact", "engagement.json"), "utf8"));

// ── Your work ──────────────────────────────────────────────────────────────────
test("YOUR ENGAGEMENT: artifact/engagement.json passes every acceptance check", () => {
  const findings = errorsOf(checkEngagement(artifact()));
  const report = findings.map((f) => `  • [${f.id}] ${f.message}`).join("\n");
  expect(findings, `\nEngagement not acceptable yet:\n${report}\n`).toEqual([]);
});

test("YOUR ENGAGEMENT: authorization is recorded, dated and bounded", () => {
  const a = artifact().authorization;
  expect(a, "no authorization record").toBeTruthy();
  expect(a?.grantedBy).toBeTruthy();
  expect(Number.isNaN(Date.parse(a?.expiresAt ?? ""))).toBe(false);
});

test("YOUR ENGAGEMENT: every activity and finding is inside the authorised scope", () => {
  const e = artifact();
  for (const a of e.activities) expect(inScope(a.target, e.scope), `activity target ${a.target} out of scope`).toBe(true);
  for (const f of e.findings) expect(inScope(f.target, e.scope), `finding target ${f.target} out of scope`).toBe(true);
});

// ── The grader itself ──────────────────────────────────────────────────────────
const good = (): Engagement => ({
  name: "Home lab recon",
  authorization: {
    grantedBy: "me",
    role: "owner of the hardware and the domain",
    grantedAt: "2026-07-01T00:00:00Z",
    expiresAt: "2026-08-01T00:00:00Z",
    reference: "docs/authorization.md, signed",
  },
  scope: [{ target: "10.0.5.10" }, { target: "*.lab.example" }],
  activities: [{ at: "2026-07-02T10:00:00Z", target: "10.0.5.10", action: "port scan", tool: "nmap -sV" }],
  findings: [
    {
      id: "f1",
      target: "10.0.5.10",
      severity: "high",
      title: "Admin interface exposed without authentication",
      evidence: "curl -s http://10.0.5.10:8080/admin returns 200 with the dashboard body",
      remediation: "Bind the interface to localhost and put it behind the reverse proxy with SSO",
      remediationOwner: "me",
      status: "fixed",
      verifiedAt: "2026-07-06",
    },
  ],
});

test("the grader accepts a complete, authorised engagement", () => {
  expect(errorsOf(checkEngagement(good()))).toEqual([]);
});

test("the grader refuses an engagement with no authorization", () => {
  const e = good();
  delete e.authorization;
  expect(errorsOf(checkEngagement(e)).map((f) => f.id)).toContain("no-authorization");
});

test("the grader refuses authorization with no end date", () => {
  const e = good();
  e.authorization!.expiresAt = "";
  expect(errorsOf(checkEngagement(e)).map((f) => f.id)).toContain("auth-expires-at");
});

test("the grader refuses activity outside the authorisation window", () => {
  const before = good();
  before.activities[0].at = "2026-06-01T10:00:00Z";
  expect(errorsOf(checkEngagement(before)).map((f) => f.id)).toContain("activity-before-auth");

  const after = good();
  after.activities[0].at = "2026-09-01T10:00:00Z";
  expect(errorsOf(checkEngagement(after)).map((f) => f.id)).toContain("activity-after-auth");
});

test("the grader refuses an activity against an out-of-scope target", () => {
  const e = good();
  e.activities.push({ at: "2026-07-03T10:00:00Z", target: "93.184.216.34", action: "port scan" });
  expect(errorsOf(checkEngagement(e)).map((f) => f.id)).toContain("activity-out-of-scope");
});

test("a finding against an out-of-scope target is refused outright", () => {
  const e = good();
  e.findings.push({ ...e.findings[0], id: "f2", target: "not-mine.example" });
  expect(errorsOf(checkEngagement(e)).map((f) => f.id)).toContain("finding-out-of-scope");
});

test("the grader refuses destructive activity", () => {
  const e = good();
  e.activities.push({ at: "2026-07-03T10:00:00Z", target: "10.0.5.10", action: "DDoS flood to test resilience" });
  expect(errorsOf(checkEngagement(e)).map((f) => f.id)).toContain("destructive-activity");
});

test("the grader honours per-target exclusions", () => {
  const e = good();
  e.scope[0].excludes = ["password spray"];
  e.activities.push({ at: "2026-07-03T10:00:00Z", target: "10.0.5.10", action: "password spray against the login" });
  expect(errorsOf(checkEngagement(e)).map((f) => f.id)).toContain("excluded-activity");
});

test("the grader refuses a finding with no evidence or no remediation", () => {
  const noEvidence = good();
  noEvidence.findings[0].evidence = "TODO";
  expect(errorsOf(checkEngagement(noEvidence)).map((f) => f.id)).toContain("finding-unproven");

  const noFix = good();
  delete noFix.findings[0].remediation;
  expect(errorsOf(checkEngagement(noFix)).map((f) => f.id)).toContain("finding-unremediated");
});

test("the grader refuses 'fixed' that was never re-verified", () => {
  const e = good();
  delete e.findings[0].verifiedAt;
  expect(errorsOf(checkEngagement(e)).map((f) => f.id)).toContain("finding-unverified");
});

test("inScope understands a wildcard domain and a /24, and stays conservative", () => {
  const scope = [{ target: "*.lab.example" }, { target: "10.0.5.0/24" }];
  expect(inScope("host.lab.example", scope)).toBe(true);
  expect(inScope("10.0.5.99", scope)).toBe(true);
  expect(inScope("10.0.6.1", scope)).toBe(false);
  expect(inScope("lab.example.evil.com", scope)).toBe(false);
});
