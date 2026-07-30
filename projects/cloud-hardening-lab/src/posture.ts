/**
 * Grader for a cloud-hardening before/after report.
 *
 * You do not implement this file. Your work is `artifact/posture.json`: the baseline
 * scan, the after scan, and what you did in between. The suite checks the thing that
 * makes a hardening exercise real rather than a screenshot:
 *
 *  - a baseline actually exists (you cannot harden what you never measured);
 *  - every critical/high finding is either FIXED with evidence, or explicitly
 *    ACCEPTED with a reason and an owner — "still open" is the one status that fails;
 *  - the after scan does not introduce new criticals;
 *  - the four controls this lab is about are present: least-privilege IAM, closed
 *    network paths, secrets in a managed store, and an audit trail that is on.
 *
 * "I think it's fine" is not a baseline, and a fix nobody can verify after the fact
 * is faith, not security.
 */
export type Severity = "critical" | "high" | "medium" | "low";
export type Status = "fixed" | "accepted" | "open";

export type Finding_ = {
  id: string;
  severity: Severity;
  title: string;
  status: Status;
  /** Required when fixed: how you know it is closed (rescan id, CLI output, test). */
  evidence?: string;
  /** Required when accepted: why, and who owns the residual risk. */
  reason?: string;
  owner?: string;
};

export type Posture = {
  provider: string;
  /** Tool + timestamp, so the baseline is a measurement rather than a memory. */
  baseline: { tool: string; at: string; findings: Finding_[] };
  after: { tool: string; at: string; findings: Finding_[] };
  controls: {
    iamLeastPrivilege?: { done: boolean; evidence?: string; wildcardPoliciesRemaining?: number };
    networkClosed?: { done: boolean; evidence?: string; openToWorldPorts?: number[] };
    secretsManaged?: { done: boolean; evidence?: string; plaintextSecretsRemaining?: number };
    auditTrail?: { done: boolean; evidence?: string; multiRegion?: boolean };
  };
};

export type Finding = { id: string; severity: "error" | "warn"; message: string };

const isBlank = (s: string | undefined): boolean => (s ?? "").trim().length === 0;
const isFiller = (s: string | undefined): boolean => /^(tbd|todo|n\/?a|none|-+|\?+)$/i.test((s ?? "").trim());
const missing = (s: string | undefined): boolean => isBlank(s) || isFiller(s);

const SEVERE: Severity[] = ["critical", "high"];

export function checkPosture(p: Posture): Finding[] {
  const out: Finding[] = [];
  const err = (id: string, message: string) => out.push({ id, severity: "error", message });
  const warn = (id: string, message: string) => out.push({ id, severity: "warn", message });

  if (isBlank(p.provider)) err("provider", "`provider` is empty — name the account/provider this report covers");

  for (const phase of ["baseline", "after"] as const) {
    const scan = p[phase];
    if (!scan) {
      err(`${phase}-missing`, `No ${phase} scan — a before/after report needs both halves`);
      continue;
    }
    if (missing(scan.tool)) err(`${phase}-tool`, `${phase}: no tool named — say what produced this scan`);
    if (missing(scan.at) || Number.isNaN(Date.parse(scan.at))) {
      err(`${phase}-at`, `${phase}: no valid timestamp — an undated scan cannot prove an order of events`);
    }
  }
  if (!p.baseline || (p.baseline.findings ?? []).length === 0) {
    err("baseline-empty", "The baseline has no findings — either the scan did not run or it was not really a baseline");
  }
  if (p.baseline && p.after && Date.parse(p.after.at) <= Date.parse(p.baseline.at)) {
    err("after-before-baseline", "The after scan is not later than the baseline");
  }

  // Every severe baseline finding must be resolved one way or the other.
  for (const f of p.baseline?.findings ?? []) {
    if (!SEVERE.includes(f.severity)) continue;
    const where = `${f.id || "(unnamed)"} "${f.title ?? ""}"`.trim();
    if (f.status === "open") {
      err("finding-open", `${where}: still open — a ${f.severity} finding must be fixed or explicitly accepted`);
      continue;
    }
    if (f.status === "fixed" && missing(f.evidence)) {
      err("finding-unproven", `${where}: marked fixed with no evidence — a fix nobody can verify is faith, not security`);
    }
    if (f.status === "accepted") {
      if (missing(f.reason)) err("finding-unjustified", `${where}: accepted with no reason`);
      if (missing(f.owner)) err("finding-unowned", `${where}: accepted with no owner — residual risk needs a name attached`);
    }
  }

  // Hardening that introduces new criticals is not hardening.
  const baselineIds = new Set((p.baseline?.findings ?? []).map((f) => f.id));
  for (const f of p.after?.findings ?? []) {
    if (SEVERE.includes(f.severity) && !baselineIds.has(f.id) && f.status !== "accepted") {
      err("regression", `${f.id}: new ${f.severity} finding in the after scan — the changes introduced this`);
    }
  }
  const stillSevere = (p.after?.findings ?? []).filter((f) => SEVERE.includes(f.severity) && f.status === "open");
  if (stillSevere.length > 0) {
    err("after-severe-open", `${stillSevere.length} severe finding(s) still open in the after scan`);
  }

  // The four controls this lab exists for.
  const c = p.controls ?? {};
  const requireControl = (
    key: keyof Posture["controls"],
    label: string,
    extra?: (v: any) => void,
  ) => {
    const control = c[key] as any;
    if (!control || control.done !== true) {
      err(`control-${key}`, `${label}: not done`);
      return;
    }
    if (missing(control.evidence)) err(`control-${key}-evidence`, `${label}: done but no evidence`);
    extra?.(control);
  };

  requireControl("iamLeastPrivilege", "IAM scoped to least privilege", (v) => {
    if ((v.wildcardPoliciesRemaining ?? 0) > 0) {
      err("iam-wildcards", `${v.wildcardPoliciesRemaining} policy/policies still carry a wildcard — most cloud breaches are an identity problem`);
    }
  });
  requireControl("networkClosed", "Open network paths closed", (v) => {
    const open: number[] = v.openToWorldPorts ?? [];
    const sensitive = open.filter((port) => [22, 3389, 5432, 3306, 6379, 27017].includes(port));
    if (sensitive.length > 0) {
      err("open-ports", `Ports still open to 0.0.0.0/0: ${sensitive.join(", ")} — "we'll restrict it later" is how later never comes`);
    }
    if (open.length > sensitive.length) {
      warn("open-ports-other", `Other ports open to the world: ${open.filter((x) => !sensitive.includes(x)).join(", ")}`);
    }
  });
  requireControl("secretsManaged", "Secrets moved into a managed store", (v) => {
    if ((v.plaintextSecretsRemaining ?? 0) > 0) {
      err("plaintext-secrets", `${v.plaintextSecretsRemaining} plaintext secret(s) remain — a secret committed once is committed forever`);
    }
  });
  requireControl("auditTrail", "Account-wide audit trail enabled", (v) => {
    if (v.multiRegion === false) {
      warn("audit-single-region", "The audit trail covers one region — activity elsewhere in the account is invisible");
    }
  });

  return out;
}

export const errorsOf = (findings: Finding[]): Finding[] => findings.filter((f) => f.severity === "error");
