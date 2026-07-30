import { test, expect } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseUnit, checkUnit, errorsOf, get, all, isYes } from "../src/unit";

const artifact = () => readFileSync(join(import.meta.dir, "..", "artifact", "app.service"), "utf8");

// ── Your work: the unit file in artifact/app.service ─────────────────────────────
test("YOUR UNIT: artifact/app.service passes every acceptance check", () => {
  const findings = errorsOf(checkUnit(parseUnit(artifact())));
  const report = findings.map((f) => `  • [${f.id}] ${f.message}`).join("\n");
  expect(findings, `\nUnit not acceptable yet:\n${report}\n`).toEqual([]);
});

test("YOUR UNIT: starts on boot, restarts on failure, and runs unprivileged", () => {
  const unit = parseUnit(artifact());
  expect(get(unit, "Install", "WantedBy")).toBeTruthy();
  expect(get(unit, "Service", "Restart")).toMatch(/always|on-failure|on-abnormal/);
  const user = get(unit, "Service", "User");
  expect(user).toBeTruthy();
  expect(user).not.toBe("root");
});

test("YOUR UNIT: is capped in memory and CPU", () => {
  const unit = parseUnit(artifact());
  expect(get(unit, "Service", "MemoryMax") ?? get(unit, "Service", "MemoryLimit")).toBeTruthy();
  expect(get(unit, "Service", "CPUQuota")).toBeTruthy();
});

test("YOUR UNIT: turns on the deny-by-default hardening", () => {
  const unit = parseUnit(artifact());
  expect(isYes(get(unit, "Service", "NoNewPrivileges"))).toBe(true);
  expect(isYes(get(unit, "Service", "PrivateTmp"))).toBe(true);
  expect(get(unit, "Service", "ProtectSystem")).toBeTruthy();
  expect(get(unit, "Service", "ProtectHome")).toBeTruthy();
});

// ── The grader itself: these guard against a checker that always says "fine" ─────
test("the parser follows systemd's last-one-wins rule for scalars", () => {
  const unit = parseUnit(`[Service]\nUser=root\nUser=app\n`);
  expect(get(unit, "Service", "User")).toBe("app");
});

test("the parser accumulates repeatable directives", () => {
  const unit = parseUnit(`[Service]\nExecStartPre=/bin/a\nExecStartPre=/bin/b\n`);
  expect(all(unit, "Service", "ExecStartPre")).toEqual(["/bin/a", "/bin/b"]);
});

test("an empty assignment resets a list instead of adding an empty entry", () => {
  // This is how a hardening line gets silently undone by something further down.
  const unit = parseUnit(`[Service]\nReadWritePaths=/var/lib/app\nReadWritePaths=\n`);
  expect(all(unit, "Service", "ReadWritePaths")).toEqual([]);
});

test("comments and blank lines are ignored", () => {
  const unit = parseUnit(`# comment\n\n[Unit]\n; also a comment\nDescription=x\n`);
  expect(get(unit, "Unit", "Description")).toBe("x");
});

test("the checker rejects a bare, default-everything unit", () => {
  const findings = errorsOf(
    checkUnit(parseUnit(`[Unit]\nDescription=x\n[Service]\nExecStart=/usr/bin/app\n[Install]\nWantedBy=multi-user.target\n`)),
  );
  const ids = findings.map((f) => f.id);
  expect(ids).toContain("restart"); // default Restart=no
  expect(ids).toContain("user"); // defaults to root
  expect(ids).toContain("memory-max");
  expect(ids).toContain("cpu-quota");
});

test("the checker rejects a relative ExecStart", () => {
  const findings = errorsOf(checkUnit(parseUnit(`[Service]\nExecStart=app --serve\n`)));
  expect(findings.map((f) => f.id)).toContain("exec-start-abs");
});

test("the checker rejects Service.User=root explicitly", () => {
  const findings = errorsOf(checkUnit(parseUnit(`[Service]\nUser=root\n`)));
  expect(findings.map((f) => f.id)).toContain("user-root");
});

test("the checker warns when logging bypasses journald", () => {
  const findings = checkUnit(parseUnit(`[Service]\nStandardOutput=file:/var/log/app.log\n`));
  expect(findings.map((f) => f.id)).toContain("logging");
});
