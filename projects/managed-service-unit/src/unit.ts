/**
 * systemd unit parser + acceptance checks.
 *
 * This workbench is the other shape of project verification. You are not asked to
 * implement this file — it is the grader. What you edit is `artifact/app.service`:
 * put YOUR unit there and run `bun test` until every check passes. That makes the
 * review machine-checkable without needing a machine to boot on.
 *
 * The parser is deliberately literal about systemd's quirks, because the quirks are
 * where unit files go wrong:
 *  - a directive can repeat, and for most of them the LAST occurrence wins, while a
 *    few (ExecStartPre, ReadWritePaths…) accumulate;
 *  - an empty assignment (`ReadWritePaths=`) RESETS the list rather than adding an
 *    empty entry, which is how a hardening line gets silently undone further down;
 *  - directives are case-sensitive, section names are not repeated per key.
 */
export type Unit = Map<string, Map<string, string[]>>;

export function parseUnit(text: string): Unit {
  const unit: Unit = new Map();
  let section = "";
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#") || line.startsWith(";")) continue;
    const sec = /^\[(.+)\]$/.exec(line);
    if (sec) {
      section = sec[1];
      if (!unit.has(section)) unit.set(section, new Map());
      continue;
    }
    const eq = line.indexOf("=");
    if (eq <= 0 || !section) continue;
    const key = line.slice(0, eq).trim();
    const value = line.slice(eq + 1).trim();
    const bucket = unit.get(section)!;
    if (value === "") {
      bucket.set(key, []); // an empty assignment resets the list
      continue;
    }
    bucket.set(key, [...(bucket.get(key) ?? []), value]);
  }
  return unit;
}

/** Last occurrence wins — systemd's rule for scalar directives. */
export function get(unit: Unit, section: string, key: string): string | undefined {
  const values = unit.get(section)?.get(key);
  return values && values.length > 0 ? values[values.length - 1] : undefined;
}

export function all(unit: Unit, section: string, key: string): string[] {
  return unit.get(section)?.get(key) ?? [];
}

const TRUTHY = new Set(["yes", "true", "on", "1"]);
export const isYes = (v: string | undefined): boolean => v !== undefined && TRUTHY.has(v.toLowerCase());

export type Finding = { id: string; severity: "error" | "warn"; message: string };

/**
 * The acceptance checks.
 *
 * Each one corresponds to an incident this project is meant to prevent, not to a
 * style preference — that is why they are errors and not lint nits.
 */
export function checkUnit(unit: Unit): Finding[] {
  const findings: Finding[] = [];
  const err = (id: string, message: string) => findings.push({ id, severity: "error", message });
  const warn = (id: string, message: string) => findings.push({ id, severity: "warn", message });

  if (!unit.has("Unit")) err("section-unit", "[Unit] section is missing");
  if (!unit.has("Service")) err("section-service", "[Service] section is missing");
  if (!unit.has("Install")) err("section-install", "[Install] section missing — the service will not start on boot");

  if (!get(unit, "Unit", "Description")) {
    err("description", "Unit.Description is missing — `systemctl status` will show only the unit name");
  }

  const execStart = get(unit, "Service", "ExecStart");
  if (!execStart) err("exec-start", "Service.ExecStart is missing");
  else if (!execStart.startsWith("/") && !execStart.startsWith("!") && !execStart.startsWith("-")) {
    err("exec-start-abs", `Service.ExecStart must be an absolute path (got "${execStart}") — systemd does not search $PATH`);
  }

  // Restart policy. `no` (the default) means one crash ends the service silently.
  const restart = get(unit, "Service", "Restart");
  if (!restart || restart === "no") {
    err("restart", "Service.Restart is unset or 'no' — a single crash takes the service down until someone notices");
  }
  if (!get(unit, "Service", "RestartSec")) {
    warn("restart-sec", "Service.RestartSec unset — a crash loop restarts as fast as it can fail");
  }
  // Without a burst window systemd gives up after 5 restarts in 10s and stays dead.
  if (!get(unit, "Unit", "StartLimitIntervalSec") && !get(unit, "Unit", "StartLimitBurst")) {
    warn("start-limit", "No StartLimitIntervalSec/StartLimitBurst — the default burst limit can leave the service permanently stopped");
  }

  // Identity: root is the default, and the default is the problem.
  const user = get(unit, "Service", "User");
  if (!user) err("user", "Service.User is unset — the service runs as root");
  else if (user === "root") err("user-root", "Service.User=root — run the daemon as a dedicated unprivileged user");

  // Resource budget: an unbounded service is a future incident.
  if (!get(unit, "Service", "MemoryMax") && !get(unit, "Service", "MemoryLimit")) {
    err("memory-max", "Service.MemoryMax is unset — a leak takes the whole host, not just this service");
  }
  if (!get(unit, "Service", "CPUQuota")) {
    err("cpu-quota", "Service.CPUQuota is unset — a runaway loop starves everything else on the box");
  }

  // Hardening: systemd ships a deny-by-default toolkit most units never turn on.
  const hardening: [string, string][] = [
    ["NoNewPrivileges", "a compromised process can still gain privileges via setuid binaries"],
    ["PrivateTmp", "/tmp is shared with every other service — a classic symlink-attack surface"],
    ["ProtectSystem", "/usr and /boot stay writable"],
    ["ProtectHome", "/home stays readable"],
  ];
  for (const [key, why] of hardening) {
    const value = get(unit, "Service", key);
    if (value === undefined) err(`hardening-${key.toLowerCase()}`, `Service.${key} is unset — ${why}`);
    else if (key === "NoNewPrivileges" || key === "PrivateTmp") {
      if (!isYes(value)) err(`hardening-${key.toLowerCase()}`, `Service.${key}=${value} — ${why}`);
    } else if (value.toLowerCase() === "no" || value.toLowerCase() === "false") {
      err(`hardening-${key.toLowerCase()}`, `Service.${key}=${value} — ${why}`);
    }
  }

  // Logging: journald captures stdout for free; a hand-rolled logfile loses rotation.
  const stdout = get(unit, "Service", "StandardOutput");
  if (stdout && /^(file|append):/.test(stdout)) {
    warn("logging", `Service.StandardOutput=${stdout} bypasses journald — you lose rotation, rate limiting and structured fields`);
  }

  // A reset later in the file silently undoes the hardening above it.
  const rw = unit.get("Service")?.get("ReadWritePaths");
  if (rw && rw.length === 0) {
    warn("readwrite-reset", "ReadWritePaths= (empty) resets the list — check that it is not undoing an earlier line");
  }

  if (!get(unit, "Install", "WantedBy")) {
    err("wanted-by", "Install.WantedBy is missing — `systemctl enable` has nothing to hook the service onto");
  }

  return findings;
}

export const errorsOf = (findings: Finding[]): Finding[] => findings.filter((f) => f.severity === "error");
