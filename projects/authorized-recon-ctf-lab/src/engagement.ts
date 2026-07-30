/**
 * Grader for an authorized-testing engagement record.
 *
 * You do not implement this file. Your work is `artifact/engagement.json`: the
 * authorization, the scope, what you found, and what you did about it.
 *
 * The first check is the one that matters most and is not a technical one. Scope and
 * written authorization are what separate security work from a crime — a finding
 * against a host you were not authorised to touch is not a finding, it is an
 * admission. The grader therefore refuses any activity or finding whose target is not
 * inside the declared, authorised scope, and refuses an engagement whose authorization
 * has no date, no grantor, or has expired.
 *
 * After that it enforces the discipline that makes a report useful: every finding
 * carries reproducible evidence, a severity, and a remediation with an owner.
 */
export type Authorization = {
  grantedBy: string;
  /** Their relationship to the target — "me, the owner" is a valid answer. */
  role: string;
  grantedAt: string;
  expiresAt: string;
  /** Where the written permission lives. */
  reference: string;
};

export type ScopeEntry = {
  /** Host, CIDR, domain or app identifier. */
  target: string;
  /** Explicitly forbidden actions, e.g. denial of service, social engineering. */
  excludes?: string[];
};

export type Activity = { at: string; target: string; action: string; tool?: string };

export type EngagementFinding = {
  id: string;
  target: string;
  severity: "critical" | "high" | "medium" | "low" | "info";
  title: string;
  /** How to reproduce it — a command, a request, a screenshot reference. */
  evidence?: string;
  /** What fixes it. */
  remediation?: string;
  remediationOwner?: string;
  /** Fixed and verified, or still open with a plan. */
  status?: "fixed" | "accepted" | "open";
  verifiedAt?: string;
};

export type Engagement = {
  name: string;
  authorization?: Authorization;
  scope: ScopeEntry[];
  activities: Activity[];
  findings: EngagementFinding[];
};

export type Finding = { id: string; severity: "error" | "warn"; message: string };

const isBlank = (s: string | undefined): boolean => (s ?? "").trim().length === 0;
const isFiller = (s: string | undefined): boolean => /^(tbd|todo|n\/?a|-+|\?+)$/i.test((s ?? "").trim());
const missing = (s: string | undefined): boolean => isBlank(s) || isFiller(s);

/** Exact target match, or membership in a declared domain/CIDR-style entry. */
export function inScope(target: string, scope: ScopeEntry[]): boolean {
  return scope.some((entry) => {
    if (entry.target === target) return true;
    if (entry.target.startsWith("*.")) return target.endsWith(entry.target.slice(1));
    if (entry.target.includes("/")) {
      // Same first three octets is a deliberately conservative /24 approximation:
      // a grader that guessed wider than the authorisation would be the exact mistake
      // this project is about.
      const [net] = entry.target.split("/");
      return net.split(".").slice(0, 3).join(".") === target.split(".").slice(0, 3).join(".");
    }
    return false;
  });
}

const DESTRUCTIVE = /\b(ddos|dos flood|delete|drop table|ransom|wipe|encrypt files|shutdown)\b/i;

export function checkEngagement(e: Engagement): Finding[] {
  const out: Finding[] = [];
  const err = (id: string, message: string) => out.push({ id, severity: "error", message });
  const warn = (id: string, message: string) => out.push({ id, severity: "warn", message });

  if (missing(e.name)) err("name", "The engagement has no name");

  // ── authorization: the check that is not technical ──
  const auth = e.authorization;
  if (!auth) {
    err("no-authorization", "No authorization record — without written permission this is not security work");
  } else {
    if (missing(auth.grantedBy)) err("auth-grantor", "Authorization does not say who granted it");
    if (missing(auth.role)) err("auth-role", "Authorization does not say what authority the grantor had");
    if (missing(auth.reference)) err("auth-reference", "Authorization has no reference — point at where the written permission lives");
    const granted = Date.parse(auth.grantedAt ?? "");
    const expires = Date.parse(auth.expiresAt ?? "");
    if (Number.isNaN(granted)) err("auth-granted-at", "Authorization has no valid start date");
    if (Number.isNaN(expires)) err("auth-expires-at", "Authorization has no valid end date — permission without an end is not permission");
    if (!Number.isNaN(granted) && !Number.isNaN(expires) && expires <= granted) {
      err("auth-window", "Authorization expires before it starts");
    }
    for (const a of e.activities ?? []) {
      const at = Date.parse(a.at ?? "");
      if (Number.isNaN(at)) {
        err("activity-undated", `Activity "${a.action}" has no valid timestamp — an undated action cannot be shown to be authorised`);
        continue;
      }
      if (!Number.isNaN(granted) && at < granted) err("activity-before-auth", `Activity "${a.action}" predates the authorization`);
      if (!Number.isNaN(expires) && at > expires) err("activity-after-auth", `Activity "${a.action}" happened after the authorization expired`);
    }
  }

  // ── scope ──
  const scope = e.scope ?? [];
  if (scope.length === 0) err("no-scope", "No scope declared — everything is then out of scope");

  for (const a of e.activities ?? []) {
    if (!inScope(a.target, scope)) {
      err("activity-out-of-scope", `Activity against "${a.target}" is outside the declared scope`);
    }
    if (DESTRUCTIVE.test(a.action)) {
      err("destructive-activity", `Activity "${a.action}" is destructive — recon and remediation, not damage`);
    }
    const entry = scope.find((s) => s.target === a.target);
    for (const excluded of entry?.excludes ?? []) {
      if (a.action.toLowerCase().includes(excluded.toLowerCase())) {
        err("excluded-activity", `Activity "${a.action}" is explicitly excluded for ${a.target}`);
      }
    }
  }

  // ── findings ──
  const findings = e.findings ?? [];
  if (findings.length === 0) warn("no-findings", "No findings recorded — say so explicitly if the target really was clean");

  const ids = new Set<string>();
  for (const f of findings) {
    const where = f.id || f.title || "(unnamed finding)";
    if (missing(f.id)) err("finding-id", "A finding has no id");
    else if (ids.has(f.id)) err("finding-dup", `Duplicate finding id "${f.id}"`);
    ids.add(f.id);

    if (!inScope(f.target, scope)) {
      err("finding-out-of-scope", `${where}: target "${f.target}" is outside the authorised scope — that is not a finding, it is an admission`);
    }
    if (missing(f.title)) err("finding-title", `${where}: no title`);
    if (missing(f.evidence)) err("finding-unproven", `${where}: no evidence — a finding nobody can reproduce is an opinion`);
    if (missing(f.remediation)) err("finding-unremediated", `${where}: no remediation — reporting without fixing is half the job`);
    if (f.severity !== "info" && missing(f.remediationOwner)) {
      err("finding-unowned", `${where}: no remediation owner`);
    }
    if (f.status === "fixed" && missing(f.verifiedAt)) {
      err("finding-unverified", `${where}: marked fixed but never re-verified`);
    }
    if ((f.severity === "critical" || f.severity === "high") && f.status === "open") {
      warn("finding-open", `${where}: ${f.severity} left open — record the plan and the owner`);
    }
  }

  return out;
}

export const errorsOf = (findings: Finding[]): Finding[] => findings.filter((f) => f.severity === "error");
