/**
 * Grader for a threat model.
 *
 * You do not implement this file. Your work is `artifact/threat-model.json`, and the
 * suite checks it the way a security reviewer would: not "is it long", but "does it
 * close the loop". Three failures make a threat model theatre, and each is an error
 * here:
 *
 *  1. A threat with no control — a risk written down and left open.
 *  2. A control with no evidence — a claim, not a fix. "Added helmet" is not proof
 *     that a header reaches the browser.
 *  3. A control that maps to no threat — churn you did for its own sake.
 *
 * It also insists on STRIDE coverage per trust boundary, because "all of it" is not a
 * threat model and neither is six XSS entries.
 */
export type Threat = {
  id: string;
  /** STRIDE category. */
  stride: string;
  /** Must name a boundary declared in `boundaries`. */
  boundary: string;
  description: string;
  /** The concrete change that closes it. */
  control?: string;
  /** How you know the control works: a test name, a scan, a log query. */
  evidence?: string;
  /** What remains after the fix — "none" is a claim you must be willing to defend. */
  residualRisk?: string;
};

export type ThreatModel = {
  app: string;
  boundaries: string[];
  assets: string[];
  threats: Threat[];
};

export type Finding = { id: string; severity: "error" | "warn"; message: string };

export const STRIDE = [
  "spoofing",
  "tampering",
  "repudiation",
  "information-disclosure",
  "denial-of-service",
  "elevation-of-privilege",
] as const;

/** Classes that show up in nearly every real breach of a small web app. */
const REQUIRED_TOPICS: { id: string; label: string; pattern: RegExp }[] = [
  { id: "authn", label: "authentication / session lifetime", pattern: /session|login|auth|password|token|mfa|credential/i },
  { id: "authz", label: "authorization / object ownership (IDOR)", pattern: /authoriz|ownership|idor|tenant|permission|access control/i },
  { id: "secrets", label: "secrets handling", pattern: /secret|api key|credential|\.env|key rotation|vault/i },
  { id: "input", label: "input validation", pattern: /validat|injection|sql|xss|schema|sanitiz/i },
  { id: "transport", label: "transport / headers", pattern: /header|csp|https|tls|hsts|cookie/i },
];

const isBlank = (s: string | undefined): boolean => (s ?? "").trim().length === 0;
/** Rejects the "TODO"/"n/a" filler that makes a field technically present. */
const isFiller = (s: string | undefined): boolean => /^(tbd|todo|n\/?a|none yet|-+|\?+)$/i.test((s ?? "").trim());

export function checkModel(model: ThreatModel): Finding[] {
  const findings: Finding[] = [];
  const err = (id: string, message: string) => findings.push({ id, severity: "error", message });
  const warn = (id: string, message: string) => findings.push({ id, severity: "warn", message });

  if (isBlank(model.app)) err("app", "`app` is empty — name the system this model is about");
  if ((model.boundaries ?? []).length < 2) {
    err("boundaries", "Fewer than 2 trust boundaries — a model with no boundaries cannot say where trust changes");
  }
  if ((model.assets ?? []).length < 1) err("assets", "No assets listed — name what an attacker would want");

  const threats = model.threats ?? [];
  if (threats.length < 6) err("threat-count", `Only ${threats.length} threats — one per STRIDE category is the floor, not the target`);

  const ids = new Set<string>();
  for (const t of threats) {
    const where = t.id || t.description?.slice(0, 40) || "(unnamed threat)";
    if (isBlank(t.id)) err("threat-id", "A threat has no id");
    else if (ids.has(t.id)) err("threat-dup", `Duplicate threat id "${t.id}"`);
    ids.add(t.id);

    if (!STRIDE.includes(t.stride as (typeof STRIDE)[number])) {
      err("threat-stride", `${where}: stride "${t.stride}" is not one of ${STRIDE.join(", ")}`);
    }
    if (!model.boundaries?.includes(t.boundary)) {
      err("threat-boundary", `${where}: boundary "${t.boundary}" is not in the declared boundaries — a threat must sit somewhere real`);
    }
    if (isBlank(t.description) || t.description.trim().length < 20) {
      err("threat-description", `${where}: description is missing or too thin to act on`);
    }

    // The three loop-closing rules.
    if (isBlank(t.control) || isFiller(t.control)) {
      err("threat-uncontrolled", `${where}: no control — this is an open risk you are pretending not to see`);
    }
    if (isBlank(t.evidence) || isFiller(t.evidence)) {
      err("threat-unproven", `${where}: no evidence — "we added a library" is a claim, not a verified fix`);
    }
    if (isBlank(t.residualRisk)) {
      warn("threat-residual", `${where}: residualRisk not stated — say what is left, even if it is "none"`);
    }
  }

  // STRIDE coverage: six XSS entries is not a threat model.
  const covered = new Set(threats.map((t) => t.stride));
  for (const category of STRIDE) {
    if (!covered.has(category)) err(`stride-${category}`, `No threat in the "${category}" category — walk the boundaries again`);
  }

  // Every boundary needs at least one threat, or it was decoration.
  for (const boundary of model.boundaries ?? []) {
    if (!threats.some((t) => t.boundary === boundary)) {
      err("boundary-unused", `Boundary "${boundary}" has no threats — either it is not a boundary or you have not looked at it`);
    }
  }

  // The classes that show up in nearly every real breach.
  const corpus = threats.map((t) => `${t.description} ${t.control ?? ""}`).join(" \n ");
  for (const topic of REQUIRED_TOPICS) {
    if (!topic.pattern.test(corpus)) {
      err(`topic-${topic.id}`, `Nothing in the model addresses ${topic.label}`);
    }
  }

  return findings;
}

export const errorsOf = (findings: Finding[]): Finding[] => findings.filter((f) => f.severity === "error");
