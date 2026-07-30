import { test, expect } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { checkPlan, errorsOf, type Plan } from "../src/network";

const artifact = (): Plan =>
  JSON.parse(readFileSync(join(import.meta.dir, "..", "artifact", "network-plan.json"), "utf8"));

// ── Your work ──────────────────────────────────────────────────────────────────
test("YOUR PLAN: artifact/network-plan.json passes every acceptance check", () => {
  const findings = errorsOf(checkPlan(artifact()));
  const report = findings.map((f) => `  • [${f.id}] ${f.message}`).join("\n");
  expect(findings, `\nPlan not acceptable yet:\n${report}\n`).toEqual([]);
});

test("YOUR PLAN: separates management, trusted and IoT", () => {
  const purposes = new Set(artifact().segments.map((s) => s.purpose));
  for (const p of ["management", "trusted", "iot"]) expect(purposes.has(p as any), `no ${p} segment`).toBe(true);
});

test("YOUR PLAN: backups exist, go offsite, and the restore has been tested", () => {
  const b = artifact().backups;
  expect(b, "no backup plan").toBeTruthy();
  expect(b?.offsite).toBe(true);
  expect(b?.restoreTestedAt, "restore never tested").toBeTruthy();
});

// ── The grader itself ──────────────────────────────────────────────────────────
const good = (): Plan => ({
  segments: [
    { id: "mgmt", name: "Management", vlan: 10, purpose: "management", internetAccess: false },
    { id: "lan", name: "Trusted LAN", vlan: 20, purpose: "trusted", internetAccess: true },
    { id: "iot", name: "IoT", vlan: 30, purpose: "iot", internetAccess: true },
    { id: "dmz", name: "DMZ", vlan: 40, purpose: "dmz", internetAccess: true },
  ],
  rules: [
    { from: "lan", to: "iot", ports: [1883], action: "allow", reason: "home automation hub talks MQTT to devices" },
    { from: "lan", to: "mgmt", ports: [22, 443], action: "allow", reason: "admin access from the trusted LAN only" },
    { from: "iot", to: "internet", ports: [443], action: "allow", reason: "vendor cloud for firmware checks" },
  ],
  services: [
    { name: "reverse-proxy", segment: "dmz", exposed: true, auth: "sso", tls: true },
    { name: "nas", segment: "mgmt", exposed: false },
  ],
  backups: { target: "NAS + Backblaze B2", frequency: "nightly", offsite: true, restoreTestedAt: "2026-07-05" },
  updates: { automatic: true, cadence: "unattended-upgrades nightly, reboots on Sunday" },
});

test("the grader accepts a segmented plan", () => {
  expect(errorsOf(checkPlan(good()))).toEqual([]);
});

test("the grader rejects a flat network", () => {
  const p = good();
  p.segments = [p.segments[1]];
  p.rules = [];
  p.services = [{ name: "nas", segment: "lan", exposed: false }];
  expect(errorsOf(checkPlan(p)).map((f) => f.id)).toContain("flat-network");
});

test("the grader rejects IoT reaching the trusted LAN", () => {
  const p = good();
  p.rules.push({ from: "iot", to: "lan", ports: [445], action: "allow", reason: "share files with the TV" });
  expect(errorsOf(checkPlan(p)).map((f) => f.id)).toContain("iot-inbound");
});

test("the grader rejects an allow any→any rule", () => {
  const p = good();
  p.rules.push({ from: "any", to: "any", ports: ["any"], action: "allow", reason: "temporary" });
  expect(errorsOf(checkPlan(p)).map((f) => f.id)).toContain("any-any");
});

test("the grader rejects an any-port rule with no justification", () => {
  const p = good();
  p.rules.push({ from: "lan", to: "dmz", ports: ["any"], action: "allow" });
  expect(errorsOf(checkPlan(p)).map((f) => f.id)).toContain("wide-rule-unjustified");
});

test("the grader rejects a guest segment with LAN access", () => {
  const p = good();
  p.segments.push({ id: "guest", name: "Guest", vlan: 50, purpose: "guest", internetAccess: true });
  p.rules.push({ from: "guest", to: "lan", ports: [445], action: "allow", reason: "printing" });
  expect(errorsOf(checkPlan(p)).map((f) => f.id)).toContain("guest-inbound");
});

test("the grader rejects an exposed service without TLS or auth", () => {
  const p = good();
  p.services.push({ name: "grafana", segment: "dmz", exposed: true, auth: "none", tls: false });
  const ids = errorsOf(checkPlan(p)).map((f) => f.id);
  expect(ids).toContain("service-tls");
  expect(ids).toContain("service-auth");
});

test("the grader rejects exposing a service straight from a non-DMZ segment", () => {
  const p = good();
  p.services.push({ name: "nas-web", segment: "mgmt", exposed: true, auth: "sso", tls: true });
  expect(errorsOf(checkPlan(p)).map((f) => f.id)).toContain("exposed-outside-dmz");
});

test("the grader rejects duplicate VLAN ids", () => {
  const p = good();
  p.segments[1].vlan = p.segments[0].vlan;
  expect(errorsOf(checkPlan(p)).map((f) => f.id)).toContain("vlan-dup");
});

test("the grader rejects an untested or local-only backup", () => {
  const p = good();
  p.backups = { target: "NAS", frequency: "nightly", offsite: false };
  const ids = errorsOf(checkPlan(p)).map((f) => f.id);
  expect(ids).toContain("backup-offsite");
  expect(ids).toContain("backup-untested");
});

test("the grader rejects a rule pointing at a segment that does not exist", () => {
  const p = good();
  p.rules.push({ from: "lan", to: "ghost", ports: [80], action: "allow", reason: "x" });
  expect(errorsOf(checkPlan(p)).map((f) => f.id)).toContain("rule-unknown-segment");
});
