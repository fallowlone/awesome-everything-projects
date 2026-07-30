/**
 * Grader for a system-design dossier.
 *
 * You do not implement this file. Your work is `artifact/dossier.json`.
 *
 * A design document fails in predictable ways, and every check here is one of them:
 *
 *  - **No numbers.** "It should scale" is not a design. Without a load estimate the
 *    component choice cannot be argued with, which is the same as not having made one.
 *  - **Capacity that does not follow from the numbers.** Storage and throughput must be
 *    derived from the stated load, not asserted next to it.
 *  - **Decisions with no rejected alternative.** A decision with one option is a
 *    preference wearing a decision's clothes; the rejected options are the content.
 *  - **SLOs with no consequence.** A target nobody measures and nothing breaches is
 *    decoration.
 *  - **No failure modes.** The design says what happens when everything works, which is
 *    the least interesting case.
 */
export type Load = {
  /** Peak requests per second the system is designed for. */
  peakRps: number;
  /** Ratio of reads to writes, e.g. 100 means 100:1. */
  readWriteRatio: number;
  /** Average payload in bytes. */
  avgPayloadBytes: number;
  /** How long data is kept, in days. */
  retentionDays: number;
};

export type Capacity = {
  /** Derived from load + retention. */
  storageGb: number;
  /** Derived from load + payload. */
  peakBandwidthMbps: number;
  /** Explain the arithmetic — a number with no derivation cannot be checked. */
  derivation: string;
};

export type Decision = {
  id: string;
  title: string;
  chosen: string;
  /** At least one seriously considered alternative and why it lost. */
  rejected: { option: string; why: string }[];
  tradeoff: string;
};

export type Slo = {
  metric: string;
  target: string;
  /** How it is measured — a target nobody measures is decoration. */
  measuredBy: string;
  /** What happens when it is breached. */
  errorBudgetPolicy: string;
};

export type FailureMode = {
  component: string;
  failure: string;
  blastRadius: string;
  mitigation: string;
  /** How you know the mitigation works. */
  detection: string;
};

export type Dossier = {
  system: string;
  problem: string;
  load: Load;
  capacity: Capacity;
  bottleneck: string;
  decisions: Decision[];
  slos: Slo[];
  failureModes: FailureMode[];
};

export type Finding = { id: string; severity: "error" | "warn"; message: string };

const isBlank = (s: string | undefined): boolean => (s ?? "").trim().length === 0;
const isFiller = (s: string | undefined): boolean => /^(tbd|todo|n\/?a|-+|\?+)$/i.test((s ?? "").trim());
const missing = (s: string | undefined): boolean => isBlank(s) || isFiller(s);
const thin = (s: string | undefined, min: number): boolean => missing(s) || (s ?? "").trim().length < min;

/** Storage implied by the stated load, in GB. Writes only — reads store nothing. */
export function derivedStorageGb(load: Load): number {
  const writesPerSecond = load.peakRps / (1 + load.readWriteRatio);
  const bytesPerDay = writesPerSecond * load.avgPayloadBytes * 86_400;
  return (bytesPerDay * load.retentionDays) / 1e9;
}

/** Peak egress implied by the stated load, in Mbps. */
export function derivedBandwidthMbps(load: Load): number {
  return (load.peakRps * load.avgPayloadBytes * 8) / 1e6;
}

export function checkDossier(d: Dossier): Finding[] {
  const out: Finding[] = [];
  const err = (id: string, message: string) => out.push({ id, severity: "error", message });
  const warn = (id: string, message: string) => out.push({ id, severity: "warn", message });

  if (missing(d.system)) err("system", "The dossier does not name the system");
  if (thin(d.problem, 40)) err("problem", "The problem statement is missing or too thin — say what breaks today and for whom");

  const load = d.load;
  if (!load) {
    err("no-load", "No load estimate — 'it should scale' is not a design");
  } else {
    for (const [key, value] of Object.entries(load)) {
      if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
        err("load-value", `load.${key} must be a positive number — a design argues from numbers or it argues from nothing`);
      }
    }
  }

  const capacity = d.capacity;
  if (!capacity) err("no-capacity", "No capacity plan derived from the load");
  else if (load) {
    if (missing(capacity.derivation)) err("capacity-derivation", "capacity.derivation is empty — a number with no arithmetic cannot be checked");
    const storage = derivedStorageGb(load);
    const bandwidth = derivedBandwidthMbps(load);
    // An order of magnitude is the tolerance: this checks that the numbers came from
    // the load, not that you rounded the same way the grader would.
    if (capacity.storageGb > 0 && (capacity.storageGb > storage * 10 || capacity.storageGb < storage / 10)) {
      err("capacity-storage", `capacity.storageGb (${capacity.storageGb}) does not follow from the stated load (~${storage.toFixed(1)} GB)`);
    }
    if (capacity.peakBandwidthMbps > 0 && (capacity.peakBandwidthMbps > bandwidth * 10 || capacity.peakBandwidthMbps < bandwidth / 10)) {
      err("capacity-bandwidth", `capacity.peakBandwidthMbps (${capacity.peakBandwidthMbps}) does not follow from the stated load (~${bandwidth.toFixed(1)} Mbps)`);
    }
  }

  if (thin(d.bottleneck, 20)) err("bottleneck", "No bottleneck identified — every system has one; naming it is the design");

  const decisions = d.decisions ?? [];
  if (decisions.length < 3) err("decisions", `Only ${decisions.length} decision(s) recorded — a system this size makes more than that`);
  for (const dec of decisions) {
    const where = dec.id || dec.title || "(unnamed decision)";
    if (missing(dec.chosen)) err("decision-chosen", `${where}: nothing chosen`);
    if ((dec.rejected ?? []).length === 0) {
      err("decision-no-alternatives", `${where}: no rejected alternative — a decision with one option is a preference`);
    }
    for (const r of dec.rejected ?? []) {
      if (missing(r.why)) err("decision-why", `${where}: rejected "${r.option}" with no reason`);
    }
    if (thin(dec.tradeoff, 20)) err("decision-tradeoff", `${where}: no tradeoff stated — every choice costs something`);
  }

  const slos = d.slos ?? [];
  if (slos.length === 0) err("no-slos", "No SLOs — then nothing is a regression");
  for (const s of slos) {
    if (missing(s.target)) err("slo-target", `SLO "${s.metric}" has no target`);
    if (missing(s.measuredBy)) err("slo-measurement", `SLO "${s.metric}" is not measured — an unmeasured target is decoration`);
    if (missing(s.errorBudgetPolicy)) err("slo-policy", `SLO "${s.metric}" has no consequence when breached`);
  }
  if (!slos.some((s) => /latency|p9\d|response/i.test(s.metric))) warn("slo-latency", "No latency SLO");
  if (!slos.some((s) => /availab|uptime|error rate/i.test(s.metric))) warn("slo-availability", "No availability or error-rate SLO");

  const failures = d.failureModes ?? [];
  if (failures.length < 3) {
    err("failure-modes", `Only ${failures.length} failure mode(s) — the design describes what happens when everything works, the least interesting case`);
  }
  for (const f of failures) {
    const where = f.component || "(unnamed component)";
    if (missing(f.failure)) err("failure-what", `${where}: no failure described`);
    if (missing(f.blastRadius)) err("failure-blast", `${where}: no blast radius — who notices, and how much of the system goes with it`);
    if (missing(f.mitigation)) err("failure-mitigation", `${where}: no mitigation`);
    if (missing(f.detection)) err("failure-detection", `${where}: no detection — an undetected failure is an outage you learn about from users`);
  }

  return out;
}

export const errorsOf = (findings: Finding[]): Finding[] => findings.filter((f) => f.severity === "error");
