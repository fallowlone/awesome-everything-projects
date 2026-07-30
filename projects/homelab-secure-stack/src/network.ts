/**
 * Grader for a homelab network plan.
 *
 * You do not implement this file. Your work is `artifact/network-plan.json` — the
 * segments, the firewall rules between them, the services you expose, and how the
 * thing gets backed up and patched. Grading the plan catches the mistakes that make a
 * homelab a liability, without needing to reach your hardware.
 *
 * The through-line: a flat network is one compromised device away from total loss,
 * and the device most likely to be compromised is the one you cannot patch — the
 * camera, the TV, the bulb.
 */
export type Segment = {
  id: string;
  name: string;
  vlan: number;
  purpose: "management" | "trusted" | "iot" | "guest" | "dmz" | "storage";
  /** Devices here can reach the public internet. */
  internetAccess: boolean;
};

export type Rule = {
  from: string;
  to: string;
  /** "any" is allowed as a literal and is exactly what gets flagged. */
  ports: (number | "any")[];
  action: "allow" | "deny";
  /** Why this hole exists — a rule nobody can justify gets removed by nobody. */
  reason?: string;
};

export type Service = {
  name: string;
  segment: string;
  /** Exposed to the internet (port-forward, tunnel, or reverse proxy). */
  exposed: boolean;
  auth?: "none" | "basic" | "sso" | "mtls";
  tls?: boolean;
};

export type Plan = {
  segments: Segment[];
  rules: Rule[];
  services: Service[];
  backups?: { target: string; frequency: string; offsite: boolean; restoreTestedAt?: string };
  updates?: { automatic: boolean; cadence?: string };
};

export type Finding = { id: string; severity: "error" | "warn"; message: string };

const isBlank = (s: string | undefined): boolean => (s ?? "").trim().length === 0;
const isFiller = (s: string | undefined): boolean => /^(tbd|todo|n\/?a|-+|\?+)$/i.test((s ?? "").trim());
const missing = (s: string | undefined): boolean => isBlank(s) || isFiller(s);

export function checkPlan(plan: Plan): Finding[] {
  const out: Finding[] = [];
  const err = (id: string, message: string) => out.push({ id, severity: "error", message });
  const warn = (id: string, message: string) => out.push({ id, severity: "warn", message });

  const segments = plan.segments ?? [];
  const byId = new Map(segments.map((s) => [s.id, s]));

  if (segments.length < 3) {
    err("flat-network", `Only ${segments.length} segment(s) — a flat network is one compromised device away from total loss`);
  }
  for (const purpose of ["management", "iot"] as const) {
    if (!segments.some((s) => s.purpose === purpose)) {
      err(`missing-${purpose}`, `No ${purpose} segment — the devices you cannot patch must not share a network with the ones you cannot lose`);
    }
  }
  const vlans = segments.map((s) => s.vlan);
  if (new Set(vlans).size !== vlans.length) err("vlan-dup", "Two segments share a VLAN id — then they are one segment");

  for (const rule of plan.rules ?? []) {
    for (const end of [rule.from, rule.to]) {
      if (end !== "any" && end !== "internet" && !byId.has(end)) {
        err("rule-unknown-segment", `Rule references unknown segment "${end}"`);
      }
    }
    if (rule.action !== "allow") continue;

    const anyPort = rule.ports.includes("any");
    if (rule.from === "any" && rule.to === "any") {
      err("any-any", "An allow any→any rule makes every other rule decoration");
    }
    if (anyPort && missing(rule.reason)) {
      err("wide-rule-unjustified", `${rule.from}→${rule.to} allows any port with no reason — a rule nobody can justify gets removed by nobody`);
    }

    const to = byId.get(rule.to);
    const from = byId.get(rule.from);

    // The rule that makes segmentation real.
    if (from?.purpose === "iot" && to && ["trusted", "management", "storage"].includes(to.purpose)) {
      err("iot-inbound", `IoT (${from.name}) may reach ${to.name} — the least patchable devices must not reach the ones that matter`);
    }
    if (from?.purpose === "guest" && to && to.purpose !== "dmz") {
      err("guest-inbound", `Guest (${from.name}) may reach ${to.name} — guests get the internet, not your LAN`);
    }
    if (to?.purpose === "management" && from?.purpose !== "management" && anyPort) {
      err("management-open", `${rule.from} may reach management on any port — management is the segment that owns everything else`);
    }
  }

  const mgmt = segments.find((s) => s.purpose === "management");
  if (mgmt?.internetAccess === true) {
    warn("management-internet", "The management segment has direct internet access — it does not need it, and it is where a compromise hurts most");
  }

  for (const svc of plan.services ?? []) {
    if (!byId.has(svc.segment)) err("service-segment", `Service "${svc.name}" sits in unknown segment "${svc.segment}"`);
    if (!svc.exposed) continue;
    if (svc.tls !== true) err("service-tls", `"${svc.name}" is exposed without TLS`);
    if (!svc.auth || svc.auth === "none") err("service-auth", `"${svc.name}" is exposed with no authentication`);
    if (svc.auth === "basic") warn("service-basic-auth", `"${svc.name}" is exposed behind basic auth only`);
    const segment = byId.get(svc.segment);
    if (segment && segment.purpose !== "dmz") {
      err("exposed-outside-dmz", `"${svc.name}" is exposed to the internet from the ${segment.purpose} segment — put it in a DMZ`);
    }
  }

  const backups = plan.backups;
  if (!backups) err("backups", "No backup plan — a homelab without backups is a single disk away from losing everything");
  else {
    if (missing(backups.target)) err("backup-target", "Backups have no target");
    if (missing(backups.frequency)) err("backup-frequency", "Backups have no frequency");
    if (backups.offsite !== true) err("backup-offsite", "No offsite copy — fire, theft and ransomware all take the local copy too");
    if (missing(backups.restoreTestedAt)) {
      err("backup-untested", "The restore has never been tested — an untested backup is a hope, not a backup");
    }
  }

  if (!plan.updates) warn("updates", "No patching cadence recorded");
  else if (plan.updates.automatic !== true && missing(plan.updates.cadence)) {
    err("updates-manual", "Updates are manual with no cadence — that is how a homelab quietly rots");
  }

  return out;
}

export const errorsOf = (findings: Finding[]): Finding[] => findings.filter((f) => f.severity === "error");
